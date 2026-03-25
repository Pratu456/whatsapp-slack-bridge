// src/services/twilioService.js
const twilio = require('twilio');
const axios  = require('axios');
require('dotenv').config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const withRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay * (i + 1)));
    }
  }
};

// Send text message to WhatsApp
const sendWhatsApp = async (toNumber, body) => {
  const message = await withRetry(() =>
    client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to:   `whatsapp:${toNumber}`,
      body,
    })
  );
  return message.sid;
};

// Send media message to WhatsApp
const sendWhatsAppMedia = async (toNumber, mediaUrl, caption = '') => {
  const message = await withRetry(() =>
    client.messages.create({
      from:     process.env.TWILIO_WHATSAPP_NUMBER,
      to:       `whatsapp:${toNumber}`,
      body:     caption,
      mediaUrl: [mediaUrl],
    })
  );
  return message.sid;
};

// Download media from Twilio (authenticated)
const downloadTwilioMedia = async (mediaUrl) => {
  const response = await axios.get(mediaUrl, {
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN,
    },
    responseType: 'arraybuffer',
  });
  return {
    data:        response.data,
    contentType: response.headers['content-type'],
  };
};

module.exports = { sendWhatsApp, sendWhatsAppMedia, downloadTwilioMedia };