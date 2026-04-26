// src/app.js
require('dotenv').config();
const { pool } = require('./db');
const express = require('express');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp, sendWhatsAppMedia } = require('./services/twilioService');
const { getWaNumberForTenant } = require('./services/tenantService');
const { logMessage } = require('./services/messageLogger');
const path = require('path');
const crypto = require('crypto');
const { WebClient } = require('@slack/web-api');

const authRoute = require('./routes/auth');
const onboardingRoute = require('./routes/onboarding');
const adminRoute = require('./routes/admin');
const commandsRoute = require('./routes/commands');
const { sendWaitlistConfirmationEmail } = require('./services/emailService');
const server = express();
server.set('trust proxy', 1);
server.use(session({
    secret: process.env.SESSION_SECRET || 'syncora-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }));

// ✅ STEP 1 — raw body parser for Slack MUST come before express.json()
server.post('/slack/events', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    const parsed = JSON.parse(rawBody);

    // URL verification — respond immediately
    if (parsed.type === 'url_verification') {
      console.log('[SLACK] Challenge received ✓');
      return res.status(200).json({ challenge: parsed.challenge });
    }

    // Respond to Slack within 3 seconds
    res.status(200).end();

    // Validate signature
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig  = req.headers['x-slack-signature'];
    if (!timestamp || !slackSig) {
      console.error('[SLACK] Missing signature headers');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.warn('[SLACK] Stale request rejected');
      return;
    }

    const sigBase = `v0:${timestamp}:${rawBody}`;
    const hmac    = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    hmac.update(sigBase);
    const mySig = `v0=${hmac.digest('hex')}`;

    if (mySig !== slackSig) {
      console.error('[SLACK] Signature mismatch');
      return;
    }

    console.log('[SLACK EVENT]', parsed.event?.type, '| channel:', parsed.event?.channel);

    if (parsed.event) {
      handleSlackEvent(parsed.event).catch(err =>
        console.error('[SLACK EVENT ERROR]', err.message)
      );
    }

  } catch (err) {
    console.error('[SLACK EVENTS ROUTE ERROR]', err.message);
    if (!res.headersSent) res.status(500).end();
  }
});

// ✅ STEP 2 — all other middleware comes AFTER Slack events route
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

  
  
  // TEMPORARY — remove after confirming
  server.get('/debug-env', (req, res) => {
    res.json({
      twilio_sid_present:  !!process.env.TWILIO_ACCOUNT_SID,
      slack_bot_present:   !!process.env.SLACK_BOT_TOKEN,
      resend_present:      !!process.env.RESEND_API_KEY,
      database_present:    !!process.env.DATABASE_URL,
      redis_present:       !!process.env.REDIS_URL,
    });
  });

// ── Slack event handler ───────────────────────────────────
async function handleSlackEvent(event) {
  if (event.type !== 'message') return;
  if (event.subtype === 'bot_message' || event.bot_id) return;
  if (event.subtype === 'channel_join' || event.subtype === 'channel_leave' || event.subtype === 'channel_topic' || event.subtype === 'channel_purpose') return;
  if (!event.text && (!event.files || event.files.length === 0)) return;

  console.log('[SLACK EVENT] channel:', event.channel, '| text:', event.text?.slice(0, 50));

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
          headers:          { Authorization: `Bearer ${tenant.slack_bot_token}` },
          responseType:     'arraybuffer',
          timeout:          60000,
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

        const tmpDir       = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmpPath      = path.join(tmpDir, safeFileName);
        fs.writeFileSync(tmpPath, Buffer.from(response.data));

        const publicUrl = `${process.env.APP_URL}/media/${encodeURIComponent(safeFileName)}`;

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

 
 
 // ── Waitlist signup ───────────────────────────────────────
 server.post('/waitlist', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.json({ success: false, error: 'Invalid email' });
      }
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (existingUser.rows.length) {
        return res.json({ success: false, error: 'An account with this email already exists. Please sign in instead.' });
      }
      const result = await pool.query(
        `INSERT INTO waitlist (email, created_at)
         VALUES ($1, NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email.trim().toLowerCase()]
      );
      if (result.rows.length) {
        // New signup — send confirmation email
        try {
          await sendWaitlistConfirmationEmail({ to: email.trim().toLowerCase() });
        } catch (emailErr) {
          console.error('[WAITLIST EMAIL ERROR]', emailErr.message);
        }
        console.log('[WAITLIST] New signup:', email);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[WAITLIST ERROR]', err.message);
      res.json({ success: false, error: err.message });
    }
  });

 // ── Slack interactions (button clicks) ───────────────────
server.post('/slack/interactions', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);

    // Respond immediately to Slack
    res.status(200).end();

    if (payload.type === 'view_submission') {
      // Handle modal submission
      const values = payload.view.state.values;
      const replyText = values.reply_input.reply_text.value;
      const waNumber = payload.view.private_metadata;
      const channelId = payload.view.callback_id.replace('reply_modal_', '');

      // Get tenant for this channel
      const tenantResult = await pool.query(
        `SELECT t.* FROM tenants t
         JOIN contacts c ON c.tenant_id = t.id
         WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
        [channelId]
      );
      if (!tenantResult.rows.length) return;
      const tenant = tenantResult.rows[0];

      // Send to WhatsApp
      const sid = await sendWhatsApp(waNumber, replyText, tenant.twilio_number);
      await logMessage({
        waNumber,
        body: replyText,
        direction: 'outbound',
        twilioSid: sid,
        tenantId: tenant.id,
      });

      console.log('[REPLY MODAL] Sent to', waNumber, ':', replyText);

      // Post confirmation in Slack
      const { WebClient } = require('@slack/web-api');
      const slack = new WebClient(tenant.slack_bot_token);
      await slack.chat.postMessage({
        channel: channelId,
        text: `✅ *Reply sent to ${waNumber}:*\n${replyText}`,
      });

    } else if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      if (action.action_id === 'reply_to_wa') {
        const waNumber = action.value;
        const channelId = payload.channel.id;
        const triggerId = payload.trigger_id;

        // Get tenant bot token
        const tenantResult = await pool.query(
          `SELECT t.* FROM tenants t
           JOIN contacts c ON c.tenant_id = t.id
           WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
          [channelId]
        );
        if (!tenantResult.rows.length) return;
        const tenant = tenantResult.rows[0];

        const { WebClient } = require('@slack/web-api');
        const slack = new WebClient(tenant.slack_bot_token);

        // Open reply modal
        await slack.views.open({
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: `reply_modal_${channelId}`,
            private_metadata: waNumber,
            title: { type: 'plain_text', text: 'Reply to WhatsApp' },
            submit: { type: 'plain_text', text: 'Send' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `Replying to *${waNumber}* on WhatsApp`,
                },
              },
              {
                type: 'input',
                block_id: 'reply_input',
                element: {
                  type: 'plain_text_input',
                  action_id: 'reply_text',
                  multiline: true,
                  placeholder: { type: 'plain_text', text: 'Type your reply...' },
                },
                label: { type: 'plain_text', text: 'Message' },
              },
            ],
          },
        });
      }
    }
  } catch (err) {
    console.error('[INTERACTIONS ERROR]', err.message);
  }
});
// ── Contact form ──────────────────────────────────────────
server.post('/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    if (!email || !email.includes('@')) return res.json({ success: false });
    console.log('[CONTACT]', { firstName, lastName, email, subject, message });
    // TODO: send email via Resend when official email is ready
    res.json({ success: true });
  } catch(err){
    res.json({ success: false });
  }
});
// ── Start ─────────────────────────────────────────────────
const start = async () => {
  try {
    await connectRedis();
console.log('Session store: memory');
    server.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000} in HTTP mode`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
