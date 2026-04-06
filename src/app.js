// src/app.js
require('dotenv').config();
const { pool } = require('./db');
const express = require('express');
const { App, ExpressReceiver } = require('@slack/bolt');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp, sendWhatsAppMedia } = require('./services/twilioService');
const { getWaNumberForTenant } = require('./services/tenantService');
const { logMessage } = require('./services/messageLogger');
const path = require('path');

const authRoute = require('./routes/auth');
const onboardingRoute = require('./routes/onboarding');
const adminRoute = require('./routes/admin');
const commandsRoute = require('./routes/commands');

// ── Express receiver for Slack HTTP mode ──────────────────
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
});

// ── Slack Bolt App (HTTP mode) ────────────────────────────
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// ── Express server ────────────────────────────────────────
const server = receiver.app;
server.use(express.urlencoded({ extended: false }));
server.use(express.json());
server.use(express.static(path.join(__dirname, '../public')));

server.use((req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');
  next();
});

server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

server.use('/whatsapp', whatsappRoute);
server.use('/auth', authRoute);
server.use('/onboarding', onboardingRoute);
server.use('/admin', adminRoute);
server.use('/commands', commandsRoute);
server.get('/health', (req, res) => res.json({ status: 'ok' }));
server.use('/media', express.static(path.join(__dirname, 'tmp')));

// Slack challenge verification
server.post('/slack/events', (req, res, next) => {
  if (req.body && req.body.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }
  next();
});

// ── Slack message handler ─────────────────────────────────
slackApp.message(async ({ message }) => {
  try {
    console.log('Slack event received:', message.channel, message.subtype);
    if (message.subtype === 'bot_message' || message.bot_id) return;

    const tenantResult = await pool.query(
      `SELECT t.* FROM tenants t
       JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE
       LIMIT 1`,
      [message.channel]
    );
    if (!tenantResult.rows.length) return;
    const tenant = tenantResult.rows[0];

    const waNumber = await getWaNumberForTenant(message.channel, tenant.id);
    if (!waNumber) return;

    if (message.files && message.files.length > 0) {
      for (const file of message.files) {
        try {
          const axios = require('axios');
          const fs = require('fs');
          const { WebClient } = require('@slack/web-api');

          const response = await axios.get(file.url_private_download, {
            headers: { Authorization: `Bearer ${tenant.slack_bot_token}` },
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 16 * 1024 * 1024,
          });

          const fileSizeBytes = response.data.byteLength;
          const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

          if (fileSizeBytes > 16 * 1024 * 1024) {
            const slack = new WebClient(tenant.slack_bot_token);
            await slack.chat.postMessage({
              channel: message.channel,
              text: `⚠️ File *${file.name}* (${fileSizeMB}MB) is too large to send via WhatsApp. Maximum size is 16MB.`,
            });
            continue;
          }

          const tmpDir = path.join(__dirname, 'tmp');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
          const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const tmpPath = path.join(tmpDir, safeFileName);
          fs.writeFileSync(tmpPath, Buffer.from(response.data));

          const publicUrl = `${process.env.APP_URL}/media/${encodeURIComponent(safeFileName)}`;
          const sid = await sendWhatsAppMedia(waNumber, publicUrl, message.text || '');

          await logMessage({
            waNumber, body: file.name, direction: 'outbound',
            twilioSid: sid, slackTs: message.ts,
            mediaType: file.mimetype, tenantId: tenant.id,
          });

          setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (e) {} }, 60000);

        } catch (fileErr) {
          console.error('File handling error:', fileErr.message);
          try {
            const { WebClient } = require('@slack/web-api');
            const slack = new WebClient(tenant.slack_bot_token);
            await slack.chat.postMessage({
              channel: message.channel,
              text: `⚠️ Failed to send file *${file.name}* to WhatsApp: ${fileErr.message}`,
            });
          } catch (e) {}
        }
      }
      return;
    }

    if (message.text) {
      const sid = await sendWhatsApp(waNumber, message.text);
      await logMessage({
        waNumber, body: message.text, direction: 'outbound',
        twilioSid: sid, slackTs: message.ts, tenantId: tenant.id,
      });
    }
  } catch (err) {
    console.error('Slack message handler error:', err.message);
  }
});

slackApp.command('/history', async ({ command, ack, respond }) => {
  await ack();
  try {
    const tenantResult = await pool.query(
      `SELECT t.*, c.wa_number FROM tenants t
       JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
      [command.channel_id]
    );
    if (!tenantResult.rows.length) return respond('❌ This channel is not linked to a WhatsApp contact.');
    const { wa_number, id: tenantId } = tenantResult.rows[0];
    const result = await pool.query(
      `SELECT m.body, m.direction, m.status, m.created_at
       FROM messages m JOIN contacts c ON c.id = m.contact_id
       WHERE c.wa_number = $1 AND m.tenant_id = $2
       ORDER BY m.created_at DESC LIMIT 10`,
      [wa_number, tenantId]
    );
    if (!result.rows.length) return respond('📭 No messages found.');
    const lines = result.rows.reverse().map(msg => {
      const dir = msg.direction === 'inbound' ? '📱 WhatsApp' : '💬 Slack';
      return `*${dir}* ${new Date(msg.created_at).toLocaleTimeString()}\n${msg.body}`;
    });
    await respond(`📋 *Last ${result.rows.length} messages:*\n\n${lines.join('\n\n')}`);
  } catch (err) { await respond('❌ Error fetching history.'); }
});

slackApp.command('/block', async ({ command, ack, respond }) => {
  await ack();
  try {
    const r = await pool.query(
      `SELECT t.*, c.wa_number FROM tenants t JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
      [command.channel_id]
    );
    if (!r.rows.length) return respond('❌ Channel not linked to any contact.');
    await pool.query('UPDATE contacts SET blocked = TRUE WHERE wa_number = $1 AND tenant_id = $2',
      [r.rows[0].wa_number, r.rows[0].id]);
    await respond(`🚫 Contact *${r.rows[0].wa_number}* has been blocked.`);
  } catch (err) { await respond('❌ Error blocking contact.'); }
});

slackApp.command('/unblock', async ({ command, ack, respond }) => {
  await ack();
  try {
    const r = await pool.query(
      `SELECT t.*, c.wa_number FROM tenants t JOIN contacts c ON c.tenant_id = t.id
       WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
      [command.channel_id]
    );
    if (!r.rows.length) return respond('❌ Channel not linked to any contact.');
    await pool.query('UPDATE contacts SET blocked = FALSE WHERE wa_number = $1 AND tenant_id = $2',
      [r.rows[0].wa_number, r.rows[0].id]);
    await respond(`✅ Contact *${r.rows[0].wa_number}* has been unblocked.`);
  } catch (err) { await respond('❌ Error unblocking contact.'); }
});

// ── Start ─────────────────────────────────────────────────
const start = async () => {
  try {
    await connectRedis();
    await slackApp.start(process.env.PORT || 3000);
    console.log(`Server running on port ${process.env.PORT || 3000} in HTTP mode`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();