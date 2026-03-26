// src/app.js
require('dotenv').config();
const { pool } = require('./db');
const express       = require('express');
const { App }       = require('@slack/bolt');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp }  = require('./services/twilioService');
const { getWaNumber }   = require('./services/mappingService');
const { logMessage }    = require('./services/messageLogger');
const path = require('path');
const statusRoute = require('./routes/status');
const commandsRoute = require('./routes/commands');


// ── Express server ────────────────────────────────────────
const server = express();
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

server.use('/whatsapp', whatsappRoute);
server.use('/status', statusRoute);
server.use('/commands', commandsRoute);

server.get('/health', (req, res) => res.json({ status: 'ok' }));
server.use('/media', require('express').static(path.join(__dirname, 'tmp')));
// ── Slack Bolt App ────────────────────────────────────────
const slackApp = new App({
  token:         process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:    true,
  appToken:      process.env.SLACK_APP_TOKEN,
});


slackApp.message(async ({ message }) => {
  try {
    console.log('Slack event received:', message.channel, message.subtype);
    if (message.subtype === 'bot_message' || message.bot_id) return;

    // Find tenant by channel
    const tenantResult = await pool.query(
      `SELECT t.* FROM tenants t
       JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE
       LIMIT 1`,
      [message.channel]
    );

    if (!tenantResult.rows.length) return;
    const tenant = tenantResult.rows[0];

    // Get WA number scoped to tenant
    const { getWaNumberForTenant } = require('./services/tenantService');
    const waNumber = await getWaNumberForTenant(message.channel, tenant.id);
    if (!waNumber) return;

    // Handle file shares
    if (message.files && message.files.length > 0) {
      for (const file of message.files) {
        console.log('File shared from Slack:', file.name, file.mimetype);
        try {
          const axios = require('axios');
          const response = await axios.get(file.url_private_download, {
            headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
            responseType: 'arraybuffer',
            timeout: 10000,
          });
          console.log('Downloaded from Slack, size:', response.data.byteLength);
          const fs   = require('fs');
          const path = require('path');
          const tmpDir = path.join(__dirname, 'tmp');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
          const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const tmpPath = path.join(tmpDir, safeFileName);
          fs.writeFileSync(tmpPath, Buffer.from(response.data));
          const publicUrl = `${process.env.NGROK_URL}/media/${encodeURIComponent(safeFileName)}`;
          console.log('Public media URL:', publicUrl);
          const { sendWhatsAppMedia } = require('./services/twilioService');
          const sid = await sendWhatsAppMedia(waNumber, publicUrl, message.text || '');
          console.log('Media sent to WhatsApp, SID:', sid);
          await logMessage({
            waNumber, body: file.name, direction: 'outbound',
            twilioSid: sid, slackTs: message.ts,
            mediaType: file.mimetype, tenantId: tenant.id,
          });
          setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (e) {} }, 60000);
        } catch (fileErr) {
          console.error('File handling error:', fileErr.message);
        }
      }
      return;
    }

    // Handle text
    if (message.text) {
      const sid = await sendWhatsApp(waNumber, message.text);
      console.log('Sent to WhatsApp, SID:', sid);
      await logMessage({
        waNumber, body: message.text, direction: 'outbound',
        twilioSid: sid, slackTs: message.ts, tenantId: tenant.id,
      });
    }

  } catch (err) {
    console.error('Slack message handler error:', err.message);
  }
});
// /history command
slackApp.command('/history', async ({ command, ack, respond }) => {
  await ack();
  try {
    const waNumber = await getWaNumber(command.channel_id);
    if (!waNumber) {
      return respond('❌ This channel is not linked to a WhatsApp contact.');
    }

    const result = await pool.query(
      `SELECT m.body, m.direction, m.status, m.created_at
       FROM messages m
       JOIN contacts c ON c.id = m.contact_id
       WHERE c.wa_number = $1
       ORDER BY m.created_at DESC
       LIMIT 10`,
      [waNumber]
    );

    if (!result.rows.length) {
      return respond('📭 No messages found for this contact.');
    }

    const lines = result.rows.reverse().map(msg => {
      const direction = msg.direction === 'inbound' ? '📱 WhatsApp' : '💬 Slack';
      const time = new Date(msg.created_at).toLocaleTimeString();
      return `*${direction}* [${msg.status}] ${time}\n${msg.body}`;
    });

    await respond(`📋 *Last ${result.rows.length} messages with ${waNumber}:*\n\n${lines.join('\n\n')}`);

  } catch (err) {
    console.error('/history error:', err.message);
    await respond('❌ Error fetching history.');
  }
});

// /block command
slackApp.command('/block', async ({ command, ack, respond }) => {
  await ack();
  try {
    const waNumber = await getWaNumber(command.channel_id);
    if (!waNumber) {
      return respond('❌ This channel is not linked to a WhatsApp contact.');
    }

    await pool.query(
      'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE'
    );
    await pool.query(
      'UPDATE contacts SET blocked = TRUE WHERE wa_number = $1',
      [waNumber]
    );

    await respond(`🚫 Contact *${waNumber}* has been blocked. No further messages will be forwarded.`);

  } catch (err) {
    console.error('/block error:', err.message);
    await respond('❌ Error blocking contact.');
  }
});

// /unblock command
slackApp.command('/unblock', async ({ command, ack, respond }) => {
  await ack();
  try {
    const waNumber = await getWaNumber(command.channel_id);
    if (!waNumber) {
      return respond('❌ This channel is not linked to a WhatsApp contact.');
    }

    await pool.query(
      'UPDATE contacts SET blocked = FALSE WHERE wa_number = $1',
      [waNumber]
    );

    await respond(`✅ Contact *${waNumber}* has been unblocked.`);

  } catch (err) {
    console.error('/unblock error:', err.message);
    await respond('❌ Error unblocking contact.');
  }
});

// ── Start everything ──────────────────────────────────────
const start = async () => {
  try {
    await connectRedis();
    await slackApp.start();
    console.log('Slack Bolt app started in Socket Mode');
    server.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();