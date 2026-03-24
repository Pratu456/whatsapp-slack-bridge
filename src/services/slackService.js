// src/services/slackService.js
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

const postToSlack = async (channelId, text, senderName) => {
  const result = await withRetry(() =>
    slack.chat.postMessage({
      channel: channelId,
      text: `*${senderName}* (WhatsApp):\n${text}`,
    })
  );
  return result.ts;
};

module.exports = { postToSlack };