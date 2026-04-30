// src/routes/whatsapp.js
const express  = require('express');
const router   = express.Router();
const { pool } = require('../db');
const { logMessage }                        = require('../services/messageLogger');
const { checkMessageLimit } = require('../services/planEnforcement');
const { downloadTwilioMedia, sendWhatsApp } = require('../services/twilioService');
const { isDuplicate, markProcessed }        = require('../cache/redis');
const { getTenantForIncomingMessage,
        getOrCreateChannelForTenant,
        postToTenantSlack,
        ensureChannelMembers,  }                 = require('../services/tenantService');
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

    const waNumber = From.replace('whatsapp:', '');

    // 2. Identify tenant
    const { tenant, isNew, claimCodeUsed } = await getTenantForIncomingMessage(waNumber, Body);

    if (!tenant) {
      console.warn('No tenant matched for:', waNumber, '| Body:', Body);
      await sendWhatsApp(
        waNumber,
        `👋 Welcome to Syncora!\n\nTo connect with a company, send their *claim code* as your first message.\n\nExample: type *acme* or *mvtech*`
      );
      return res.status(200).send('<Response></Response>');
    }

    console.log(`Tenant identified: ${tenant.company_name} | New: ${isNew} | ClaimCode: ${claimCodeUsed}`);

    // 3. Check if blocked
    const blockedCheck = await pool.query(
      'SELECT blocked FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
      [waNumber, tenant.id]
    );
    if (blockedCheck.rows[0]?.blocked) {
      console.log(`Blocked contact: ${waNumber}`);
      return res.status(200).send('<Response></Response>');
    }

    const planCheck = await checkMessageLimit(tenant.id);
    if (planCheck.allowed === false) {
      console.log("[PLAN LIMIT]", tenant.company_name);
      await sendWhatsApp(waNumber, "Sorry, daily message limit reached. Please upgrade.", tenant.twilio_number);
      return res.sendStatus(200);
    }
    const channelId = await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);
    ensureChannelMembers(tenant, channelId).catch(err =>
    console.warn('[CHANNEL] ensureChannelMembers failed:', err.message)
    );

    // 5. If new contact, post welcome banner in Slack
    if (isNew) {
      const { WebClient } = require('@slack/web-api');
      const slack = new WebClient(tenant.slack_bot_token);
      await slack.chat.postMessage({
        channel: channelId,
        text: `🆕 *New contact connected via code \`${tenant.claim_code}\`*\nNumber: ${waNumber}\nName: ${ProfileName || 'Unknown'}`,
      });
      // Confirm to the customer
      await sendWhatsApp(
        waNumber,
       `👋 Hello!\n\nTo reach a company's support team, you need their *claim code*.\n\n*What is a claim code?*\nIt's a short word the company gave you when they shared this WhatsApp number.\n\n*Example:* If the company told you to send *acme* — just type that word and send it.\n\nOnce connected, you can message normally and their team will reply here on WhatsApp. 💬`
    );
  return res.status(200).send('<Response></Response>');
    }

    // 6. If returning contact switched workspace via claim code — notify and confirm
    if (claimCodeUsed && !isNew) {
      const { WebClient } = require('@slack/web-api');
      const slack = new WebClient(tenant.slack_bot_token);
      await slack.chat.postMessage({
        channel: channelId,
        text: `🔄 *${ProfileName || waNumber}* reconnected via claim code \`${tenant.claim_code}\``,
      });
      await sendWhatsApp(
        waNumber,
        `✅ Switched to *${tenant.company_name}*. Send your message and their team will reply shortly.`
      );
      return res.status(200).send('<Response></Response>');
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
        console.log('[DEBUG] About to post to Slack | channel:', channelId, '| tenant:', tenant.company_name, '| body:', Body?.slice(0,30));
        try {
          slackTs = await postToTenantSlack(tenant, channelId, Body, ProfileName || waNumber, waNumber);
          console.log('[DEBUG] postToTenantSlack success | ts:', slackTs);
        } catch(slackErr) {
          console.error('[DEBUG] postToTenantSlack FAILED:', slackErr.message, slackErr.data?.error);
          throw slackErr;
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

// Status callback — handles delivery status updates from Twilio
router.post('/status', (req, res) => {
  const { MessageSid, MessageStatus, To } = req.body;
  console.log(`Status update: ${MessageSid} → ${MessageStatus} (to ${To})`);
  res.status(200).send('OK');
});

module.exports = router;