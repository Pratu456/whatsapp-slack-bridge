// src/routes/whatsapp.js
const { pool } = require('../db');
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const { getOrCreateChannel }            = require('../services/mappingService');
const { postToSlack, uploadMediaToSlack } = require('../services/slackService');
const { logMessage }                    = require('../services/messageLogger');
const { downloadTwilioMedia }           = require('../services/twilioService');
const { isDuplicate, markProcessed }    = require('../cache/redis');
require('dotenv').config();

// Map Twilio media content types to file extensions
const getExtension = (contentType) => {
  const map = {
    'image/jpeg':       'jpg',
    'image/png':        'png',
    'image/gif':        'gif',
    'image/webp':       'webp',
    'audio/ogg':        'ogg',
    'audio/mpeg':       'mp3',
    'video/mp4':        'mp4',
    'application/pdf':  'pdf',
    'application/octet-stream': 'bin',
  };
  return map[contentType] || 'bin';
};

router.post('/webhook', async (req, res) => {
  try {
    const {
      MessageSid, From, Body, ProfileName,
      NumMedia, MediaUrl0, MediaContentType0
    } = req.body;

    // 1. Deduplicate
    if (await isDuplicate(MessageSid)) {
      return res.status(200).send('<Response></Response>');
    }
    await markProcessed(MessageSid);

    // 2. Get sender number
    const waNumber = From.replace('whatsapp:', '');
    // Check if contact is blocked
    const blockedCheck = await pool.query(
      'SELECT blocked FROM contacts WHERE wa_number = $1',
      [waNumber]
    );
    if (blockedCheck.rows[0]?.blocked) {
      console.log(`Blocked contact tried to message: ${waNumber}`);
      return res.status(200).send('<Response></Response>');
    }

    // 3. Get or create Slack channel
    const channelId = await getOrCreateChannel(waNumber, ProfileName);

    let slackTs = null;

    // 4. Handle media or text
    if (parseInt(NumMedia) > 0 && MediaUrl0) {
      console.log(`Media received: ${MediaContentType0}`);

      // Download media from Twilio
      const { data, contentType } = await downloadTwilioMedia(MediaUrl0);
      const ext      = getExtension(contentType);
      const fileName = `${MessageSid}.${ext}`;

      // Upload to Slack
      slackTs = await uploadMediaToSlack(
        channelId, data, contentType,
        fileName, ProfileName || waNumber, Body
      );

      // Log with media info
      await logMessage({
        waNumber,
        body:      Body || `[${contentType} file]`,
        direction: 'inbound',
        twilioSid: MessageSid,
        slackTs,
        mediaUrl:  MediaUrl0,
        mediaType: contentType,
      });

    } else {
      // Text message
      slackTs = await postToSlack(channelId, Body, ProfileName || waNumber);

      await logMessage({
        waNumber,
        body:      Body,
        direction: 'inbound',
        twilioSid: MessageSid,
        slackTs,
      });
    }

    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;