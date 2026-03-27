// src/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const { pool } = require('../db');
const { logMessage }                        = require('../services/messageLogger');
const { downloadTwilioMedia, sendWhatsApp } = require('../services/twilioService');
const { isDuplicate, markProcessed }        = require('../cache/redis');
const { getTenantForIncomingMessage,
        getOrCreateChannelForTenant,
        postToTenantSlack }                 = require('../services/tenantService');
const { uploadMediaToSlack }                = require('../services/slackService');
require('dotenv').config();

const getExtension = (contentType) => {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3',
    'video/mp4': 'mp4', 'application/pdf': 'pdf',
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

    // 3. Identify tenant — by existing contact mapping OR claim code in message body
    const { tenant, isNew } = await getTenantForIncomingMessage(waNumber, Body);

    if (!tenant) {
      // Unknown contact, no claim code matched — send instructions
      console.warn('No tenant matched for:', waNumber, '| Body:', Body);
      await sendWhatsApp(
        waNumber,
        `👋 Welcome! To connect with a company, send their code word as your first message.\n\nExample: type *acme* or *mvtech*`
      );
      return res.status(200).send('<Response></Response>');
    }

    console.log(`Tenant identified: ${tenant.company_name} | New contact: ${isNew}`);

    // 4. Check if contact is blocked
    const blockedCheck = await pool.query(
      'SELECT blocked FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
      [waNumber, tenant.id]
    );
    if (blockedCheck.rows[0]?.blocked) {
      console.log(`Blocked contact: ${waNumber}`);
      return res.status(200).send('<Response></Response>');
    }

    // 5. Get or create Slack channel for this tenant
    const channelId = await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);

    // 6. If new contact, post a welcome banner in Slack so the team knows
    if (isNew) {
      const { WebClient } = require('@slack/web-api');
      const slack = new WebClient(tenant.slack_bot_token);
      await slack.chat.postMessage({
        channel: channelId,
        text: `🆕 *New contact connected via code \`${tenant.claim_code}\`*\nNumber: ${waNumber}\nName: ${ProfileName || 'Unknown'}`,
      });
    }

    let slackTs = null;

    // 7. Handle media or text
    if (parseInt(NumMedia) > 0 && MediaUrl0) {
      console.log(`Media received: ${MediaContentType0}`);
      const { data, contentType } = await downloadTwilioMedia(MediaUrl0);
      const ext      = getExtension(contentType);
      const fileName = `${MessageSid}.${ext}`;

      slackTs = await uploadMediaToSlack(
        channelId, data, contentType,
        fileName, ProfileName || waNumber, Body,
        tenant.slack_bot_token
      );

      await logMessage({
        waNumber, body: Body || `[${contentType} file]`,
        direction: 'inbound', twilioSid: MessageSid,
        slackTs, mediaUrl: MediaUrl0, mediaType: contentType,
        tenantId: tenant.id,
      });

    } else {
      // Skip forwarding the claim code message itself — it's just for routing
      if (!isNew) {
        slackTs = await postToTenantSlack(tenant, channelId, Body, ProfileName || waNumber);
      }
      await logMessage({
        waNumber, body: Body, direction: 'inbound',
        twilioSid: MessageSid, slackTs, tenantId: tenant.id,
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