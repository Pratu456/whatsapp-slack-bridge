// src/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const { pool } = require('../db');
const { logMessage }                        = require('../services/messageLogger');
const { checkMessageLimit }                 = require('../services/planEnforcement');
const { downloadTwilioMedia, sendWhatsApp } = require('../services/twilioService');
const { isDuplicate, markProcessed }        = require('../cache/redis');
const { getTenantForIncomingMessage,
        getOrCreateChannelForTenant,
        postToTenantSlack,
        ensureChannelMembers }              = require('../services/tenantService');
const { uploadMediaToSlack }               = require('../services/slackService');
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

    const waNumber = From.replace('whatsapp:', '');

    // 2. Identify tenant
    const { tenant, isNew, claimCodeUsed } = await getTenantForIncomingMessage(waNumber, Body);

    if (!tenant) {
      console.warn('[NO TENANT] for:', waNumber, '| Body:', Body);
      await sendWhatsApp(
        waNumber,
        `👋 Welcome to Syncora!\n\nTo connect with a company, send their *claim code* as your first message.\n\nExample: type *acme* or *mvtech*`
      );
      return res.status(200).send('<Response></Response>');
    }

    console.log(`[TENANT] ${tenant.company_name} | New: ${isNew} | ClaimCode: ${claimCodeUsed}`);

    // 3. Check if blocked
    const blockedCheck = await pool.query(
      'SELECT blocked FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
      [waNumber, tenant.id]
    );
    if (blockedCheck.rows[0]?.blocked) {
      console.log(`[BLOCKED] ${waNumber}`);
      return res.status(200).send('<Response></Response>');
    }

    // 4. Check plan limits
    const planCheck = await checkMessageLimit(tenant.id);
    if (planCheck.allowed === false) {
      console.log('[PLAN LIMIT]', tenant.company_name);
      await sendWhatsApp(waNumber, 'Sorry, daily message limit reached. Please upgrade.', tenant.twilio_number);
      return res.sendStatus(200);
    }

    // 5. Get or create Slack channel
    const channelId = await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);
    ensureChannelMembers(tenant, channelId).catch(err =>
      console.warn('[CHANNEL] ensureChannelMembers failed:', err.message)
    );

    // 6. New contact first message — just send welcome, don't post claim code word to Slack
    if (isNew && claimCodeUsed) {
      await sendWhatsApp(
        waNumber,
        `✅ You're now connected to *${tenant.company_name}*. Send your message and their team will reply shortly.`
      );
      return res.status(200).send('<Response></Response>');
    }

    // 7. Post message to Slack (ALL messages reach here — text or media)
    let slackTs = null;

    if (parseInt(NumMedia) > 0 && MediaUrl0) {
      console.log(`[MEDIA] ${MediaContentType0}`);
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
      console.log(`[SLACK POST] channel: ${channelId} | from: ${ProfileName || waNumber} | body: ${Body?.slice(0,50)}`);
      slackTs = await postToTenantSlack(tenant, channelId, Body, ProfileName || waNumber, waNumber);
      console.log(`[SLACK POST] success | ts: ${slackTs}`);
      await logMessage({
        waNumber, body: Body, direction: 'inbound',
        twilioSid: MessageSid, slackTs, tenantId: tenant.id,
      });
    }

    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message, err.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Status callback
router.post('/status', (req, res) => {
  const { MessageSid, MessageStatus, To } = req.body;
  console.log(`Status update: ${MessageSid} → ${MessageStatus} (to ${To})`);
  res.status(200).send('OK');
});

module.exports = router;
