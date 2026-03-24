// src/app.js
const express       = require('express');
const { App }       = require('@slack/bolt');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
const { sendWhatsApp }  = require('./services/twilioService');
const { getWaNumber }   = require('./services/mappingService');
const { logMessage }    = require('./services/messageLogger');
require('dotenv').config();

// ── Express server ────────────────────────────────────────
const server = express();
server.use(express.urlencoded({ extended: false }));
server.use(express.json());

server.use('/whatsapp', whatsappRoute);

server.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Slack Bolt App ────────────────────────────────────────
const slackApp = new App({
  token:         process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:    true,
  appToken:      process.env.SLACK_APP_TOKEN,
  clientOptions: {
    slackApiUrl: 'https://slack.com/api/',
  },
  socketModeOptions: {
    pingPongLoggingEnabled: false,
  },
});

slackApp.message(async ({ message }) => {
  console.log('Slack event received:', message.channel, message.subtype, message.bot_id);
  try {
    if (message.subtype === 'bot_message' || message.bot_id) return;

    const waNumber = await getWaNumber(message.channel);
    console.log('WA number found:', waNumber);
    if (!waNumber) return;

    const sid = await sendWhatsApp(waNumber, message.text);
    console.log('Sent to WhatsApp, SID:', sid);

    await logMessage({
      waNumber,
      body:      message.text,
      direction: 'outbound',
      twilioSid: sid,
      slackTs:   message.ts,
    });
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