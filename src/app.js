// src/app.js
require('dotenv').config();
const express       = require('express');
const { App }       = require('@slack/bolt');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp }  = require('./services/twilioService');
const { getWaNumber }   = require('./services/mappingService');
const { logMessage }    = require('./services/messageLogger');
const path = require('path');


// ── Express server ────────────────────────────────────────
const server = express();
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

server.use('/whatsapp', whatsappRoute);

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

    const waNumber = await getWaNumber(message.channel);
    if (!waNumber) return;

    // Handle file shares
    if (message.files && message.files.length > 0) {
      for (const file of message.files) {
        console.log('File shared from Slack:', file.name, file.mimetype);

        try {
          const axios = require('axios');

          // Download from Slack
          const response = await axios.get(file.url_private_download, {
            headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
            responseType: 'arraybuffer',
            timeout: 10000,
          });

          console.log('Downloaded from Slack, size:', response.data.byteLength);

          // Save file temporarily to disk
          const fs   = require('fs');
          const path = require('path');
          const tmpDir  = path.join(__dirname, 'tmp');
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
          const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const tmpPath = path.join(tmpDir, safeFileName);
          fs.writeFileSync(tmpPath, Buffer.from(response.data));

          // Build public URL via ngrok
          const publicUrl = `${process.env.NGROK_URL}/media/${encodeURIComponent(safeFileName)}`;
          console.log('NGROK_URL value:', process.env.NGROK_URL);
          console.log('Public media URL:', publicUrl);

          const { sendWhatsAppMedia } = require('./services/twilioService');
          const sid = await sendWhatsAppMedia(waNumber, publicUrl, message.text || '');
          console.log('Media sent to WhatsApp, SID:', sid);

          await logMessage({
            waNumber,
            body:      file.name,
            direction: 'outbound',
            twilioSid: sid,
            slackTs:   message.ts,
            mediaType: file.mimetype,
          });

          // Clean up temp file after 1 minute
          setTimeout(() => {
            try { fs.unlinkSync(tmpPath); } catch (e) {}
          }, 60000);

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
        waNumber,
        body:      message.text,
        direction: 'outbound',
        twilioSid: sid,
        slackTs:   message.ts,
      });
    }

  } catch (err) {
    console.error('Slack message handler error:', err.message);
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