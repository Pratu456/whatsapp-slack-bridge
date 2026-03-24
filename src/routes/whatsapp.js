// src/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const { getOrCreateChannel } = require('../services/mappingService');
const { postToSlack }        = require('../services/slackService');
const { logMessage }         = require('../services/messageLogger');
const { isDuplicate, markProcessed } = require('../cache/redis');
require('dotenv').config();

router.post('/webhook', async (req, res) => {
  try {
    const { MessageSid, From, Body, ProfileName } = req.body;

    if (await isDuplicate(MessageSid)) {
      return res.status(200).send('<Response></Response>');
    }
    await markProcessed(MessageSid);

    const waNumber = From.replace('whatsapp:', '');
    const channelId = await getOrCreateChannel(waNumber, ProfileName);
    const slackTs = await postToSlack(channelId, Body, ProfileName || waNumber);

    await logMessage({
      waNumber,
      body: Body,
      direction: 'inbound',
      twilioSid: MessageSid,
      slackTs
    });

    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;