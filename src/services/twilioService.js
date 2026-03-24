// src/services/twilioService.js
const twilio = require('twilio');
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

module.exports = { sendWhatsApp };