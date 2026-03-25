// src/services/slackService.js
const { WebClient } = require('@slack/web-api');
const FormData      = require('form-data');
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

// Post text message to Slack
const postToSlack = async (channelId, text, senderName) => {
  const result = await withRetry(() =>
    slack.chat.postMessage({
      channel: channelId,
      text:    `*${senderName}* (WhatsApp):\n${text}`,
    })
  );
  return result.ts;
};

// Upload media file to Slack
const uploadMediaToSlack = async (channelId, fileBuffer, contentType, fileName, senderName, caption) => {
  const result = await withRetry(() =>
    slack.filesUploadV2({
      channel_id:      channelId,
      file:            Buffer.from(fileBuffer),
      filename:        fileName,
      initial_comment: `*${senderName}* (WhatsApp)${caption ? ': ' + caption : ''}`,
    })
  );
  return result.files?.[0]?.shares?.public?.[channelId]?.[0]?.ts
      || result.files?.[0]?.shares?.private?.[channelId]?.[0]?.ts
      || null;
};

module.exports = { postToSlack, uploadMediaToSlack };