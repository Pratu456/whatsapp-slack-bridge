// src/app.js
require('dotenv').config();
const { pool } = require('./db');
const express = require('express');
const { App } = require('@slack/bolt');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp, sendWhatsAppMedia } = require('./services/twilioService');
const { getWaNumberForTenant } = require('./services/tenantService');
const { logMessage } = require('./services/messageLogger');
const path = require('path');
const crypto = require('crypto');

const authRoute = require('./routes/auth');
const onboardingRoute = require('./routes/onboarding');
const adminRoute = require('./routes/admin');
const commandsRoute = require('./routes/commands');

// ── Express server ────────────────────────────────────────
const server = express();
server.use(express.urlencoded({ extended: false }));
server.use(express.json());
server.use(express.static(path.join(__dirname, '../public')));
server.use((req, res, next) => { res.setHeader('Accept-Ranges', 'bytes'); next(); });

server.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
server.use('/whatsapp', whatsappRoute);
server.use('/auth', authRoute);
server.use('/onboarding', onboardingRoute);
server.use('/admin', adminRoute);
server.use('/commands', commandsRoute);
server.get('/health', (req, res) => res.json({ status: 'ok' }));
server.use('/media', express.static(path.join(__dirname, 'tmp')));

// ── Debug route — REMOVE AFTER CONFIRMING FIX ────────────
server.get('/debug-env', (req, res) => {
  res.json({
    twilio_number:       process.env.TWILIO_WHATSAPP_NUMBER,
    twilio_sid_present:  !!process.env.TWILIO_ACCOUNT_SID,
    slack_bot_present:   !!process.env.SLACK_BOT_TOKEN,
    slack_app_present:   !!process.env.SLACK_APP_TOKEN,
    database_present:    !!process.env.DATABASE_URL,
    redis_present:       !!process.env.REDIS_URL,
    node_env:            process.env.NODE_ENV,
  });
});

// ── Slack HTTP events endpoint ────────────────────────────
server.post('/slack/events', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const body    = req.body;
    const rawBody = Buffer.isBuffer(body) ? body.toString() : JSON.stringify(body);
    const parsed  = JSON.parse(rawBody);

    // URL verification challenge
    if (parsed.type === 'url_verification') {
      return res.json({ challenge: parsed.challenge });
    }

    // Verify Slack signature
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig  = req.headers['x-slack-signature'];
    const sigBase   = `v0:${timestamp}:${rawBody}`;
    const hmac      = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    hmac.update(sigBase);
    const mySig = `v0=${hmac.digest('hex')}`;

    if (mySig !== slackSig) {
      console.error('[SLACK] Signature mismatch');
      return res.status(401).send('Unauthorized');
    }

    // Respond to Slack immediately — must be within 3 seconds
    res.status(200).send('OK');

    // Process event async after response
    if (parsed.event) {
      handleSlackEvent(parsed.event).catch(err =>
        console.error('[SLACK EVENT ERROR]', err.message)
      );
    }
  } catch (err) {
    console.error('[SLACK EVENTS ROUTE ERROR]', err);
    res.status(500).send('Error');
  }
});

// ── Slack event handler ───────────────────────────────────
const { WebClient } = require('@slack/web-api');

async function handleSlackEvent(event) {
  if (event.type !== 'message') return;
  if (event.subtype === 'bot_message' || event.bot_id) return;
  if (!event.text && (!event.files || event.files.length === 0)) return;

  console.log('[SLACK EVENT] channel:', event.channel, '| text:', event.text?.slice(0, 50));

  // Look up tenant from channel
  const tenantResult = await pool.query(
    `SELECT t.* FROM tenants t
     JOIN contacts c ON c.tenant_id = t.id
     WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
    [event.channel]
  );

  if (!tenantResult.rows.length) {
    console.log('[SLACK EVENT] No tenant found for channel:', event.channel);
    return;
  }

  const tenant = tenantResult.rows[0];
  console.log('[TENANT]', tenant.company_name, '| twilio_number:', tenant.twilio_number);

  // Look up WhatsApp number for this channel + tenant
  const waNumber = await getWaNumberForTenant(event.channel, tenant.id);
  if (!waNumber) {
    console.log('[SLACK EVENT] No WA number for channel:', event.channel, 'tenant:', tenant.id);
    return;
  }

  console.log('[OUTBOUND] to WhatsApp:', waNumber, '| from:', tenant.twilio_number);

  // ── Handle file attachments ───────────────────────────
  if (event.files && event.files.length > 0) {
    for (const file of event.files) {
      try {
        const axios = require('axios');
        const fs    = require('fs');

        const response = await axios.get(file.url_private_download, {
          headers:         { Authorization: `Bearer ${tenant.slack_bot_token}` },
          responseType:    'arraybuffer',
          timeout:         60000,
          maxContentLength: 16 * 1024 * 1024,
        });

        if (response.data.byteLength > 16 * 1024 * 1024) {
          const slack = new WebClient(tenant.slack_bot_token);
          await slack.chat.postMessage({
            channel: event.channel,
            text:    '⚠️ File too large to forward (max 16MB)',
          });
          continue;
        }

        const tmpDir      = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmpPath      = path.join(tmpDir, safeFileName);
        fs.writeFileSync(tmpPath, Buffer.from(response.data));

        const publicUrl = `${process.env.APP_URL}/media/${encodeURIComponent(safeFileName)}`;

        // ✅ Pass tenant.twilio_number as fromNumber
        const sid = await sendWhatsAppMedia(
          waNumber,
          publicUrl,
          event.text || '',
          tenant.twilio_number
        );

        await logMessage({
          waNumber,
          body:      file.name,
          direction: 'outbound',
          twilioSid: sid,
          slackTs:   event.ts,
          mediaType: file.mimetype,
          tenantId:  tenant.id,
        });

        console.log('[TWILIO MEDIA SENT]', sid);
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (e) {} }, 60000);

      } catch (fileErr) {
        console.error('[FILE ERROR]', fileErr.message);
      }
    }
    return;
  }

  // ── Handle text message ───────────────────────────────
  if (event.text) {
    try {
      // ✅ Pass tenant.twilio_number as fromNumber
      const sid = await sendWhatsApp(waNumber, event.text, tenant.twilio_number);

      await logMessage({
        waNumber,
        body:      event.text,
        direction: 'outbound',
        twilioSid: sid,
        slackTs:   event.ts,
        tenantId:  tenant.id,
      });

      console.log('[TWILIO TEXT SENT]', sid);
    } catch (err) {
      console.error('[TWILIO SEND ERROR]', err.message);
    }
  }
}

// ── Slash commands ────────────────────────────────────────
server.post('/slack/commands', express.urlencoded({ extended: true }), async (req, res) => {
  const { command, channel_id } = req.body;
  res.status(200).send('');

  try {
    const r = await pool.query(
      `SELECT t.*, c.wa_number FROM tenants t JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
      [channel_id]
    );

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    if (!r.rows.length) {
      await slack.chat.postMessage({
        channel: channel_id,
        text:    '❌ Channel not linked to any contact.',
      });
      return;
    }

    const { wa_number, id: tenantId } = r.rows[0];

    if (command === '/history') {
      const msgs = await pool.query(
        `SELECT m.body, m.direction, m.created_at FROM messages m
         JOIN contacts c ON c.id = m.contact_id
         WHERE c.wa_number = $1 AND m.tenant_id = $2
         ORDER BY m.created_at DESC LIMIT 10`,
        [wa_number, tenantId]
      );
      if (!msgs.rows.length) {
        await slack.chat.postMessage({ channel: channel_id, text: '📭 No messages found.' });
        return;
      }
      const lines = msgs.rows.reverse().map(m =>
        `*${m.direction === 'inbound' ? '📱' : '💬'}* ${new Date(m.created_at).toLocaleTimeString()}\n${m.body}`
      );
      await slack.chat.postMessage({
        channel: channel_id,
        text:    `📋 Last ${msgs.rows.length} messages:\n\n${lines.join('\n\n')}`,
      });
    } else if (command === '/block') {
      await pool.query(
        'UPDATE contacts SET blocked = TRUE WHERE wa_number = $1 AND tenant_id = $2',
        [wa_number, tenantId]
      );
      await slack.chat.postMessage({ channel: channel_id, text: `🚫 ${wa_number} blocked.` });
    } else if (command === '/unblock') {
      await pool.query(
        'UPDATE contacts SET blocked = FALSE WHERE wa_number = $1 AND tenant_id = $2',
        [wa_number, tenantId]
      );
      await slack.chat.postMessage({ channel: channel_id, text: `✅ ${wa_number} unblocked.` });
    }
  } catch (err) {
    console.error('[COMMAND ERROR]', err.message);
  }
});

// ── Start ─────────────────────────────────────────────────
const start = async () => {
  try {
    await connectRedis();
    server.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000} in HTTP mode`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();