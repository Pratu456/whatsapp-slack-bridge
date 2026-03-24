// src/services/mappingService.js
const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const withRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay * (i + 1)));
    }
  }
};

const getOrCreateChannel = async (waNumber, displayName) => {
  // 1. Check if mapping already exists
  const existing = await pool.query(
    'SELECT slack_channel FROM contacts WHERE wa_number = $1',
    [waNumber]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].slack_channel;
  }

  // 2. Create a new Slack channel
  const channelName = 'wa-' + waNumber.replace(/\D/g, '').slice(-10);
  const result = await withRetry(() =>
    slack.conversations.create({
      name: channelName,
      is_private: false,
    })
  );

  const channelId = result.channel.id;

  // 3. Save the mapping to PostgreSQL
  await pool.query(
    'INSERT INTO contacts (wa_number, slack_channel, display_name) VALUES ($1, $2, $3)',
    [waNumber, channelId, displayName || waNumber]
  );

  // 4. Post a welcome message to the new channel
  await withRetry(() =>
    slack.chat.postMessage({
      channel: channelId,
      text: `:phone: New WhatsApp contact: *${displayName || waNumber}*\nNumber: ${waNumber}`,
    })
  );

  return channelId;
};

const getWaNumber = async (channelId) => {
  const result = await pool.query(
    'SELECT wa_number FROM contacts WHERE slack_channel = $1',
    [channelId]
  );
  return result.rows[0]?.wa_number || null;
};

module.exports = { getOrCreateChannel, getWaNumber };