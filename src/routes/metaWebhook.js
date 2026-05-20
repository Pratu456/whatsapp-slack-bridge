const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { logMessage } = require('../services/messageLogger');
const { checkMessageLimit } = require('../services/planEnforcement');
const { getTenantForIncomingMessage,
        getOrCreateChannelForTenant,
        postToTenantSlack,
        ensureChannelMembers } = require('../services/tenantService');
const {
  getOrCreateGroupChannel,
  postGroupMessageToSlack,
  broadcastToGroup
} = require('../services/groupService');

// Send message via Meta Cloud API
const sendMetaMessage = async (to, text, phoneNumberId, accessToken) => {
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: { body: text }
      })
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  console.log('[META OUT] to:', to, '| id:', data.messages?.[0]?.id);
  return data.messages?.[0]?.id;
};

// Webhook verification
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('[META] Verification attempt | mode:', mode, '| token:', token);
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[META] Webhook verified ✅');
    return res.status(200).send(challenge);
  }
  console.log('[META] Verification failed ❌');
  res.sendStatus(403);
});

// Receive messages
router.post('/', async (req, res) => {
  try {
    res.status(200).send('OK');
    const body = req.body;
    if (!body.object || body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const messages = value.messages;
        if (!messages || !messages.length) continue;

        for (const message of messages) {
          const waNumber = '+' + message.from;
          const phoneNumberId = value.metadata.phone_number_id;
          const Body = message.text?.body || '';
          const MessageSid = message.id;
          const ProfileName = value.contacts?.[0]?.profile?.name || waNumber;

          console.log('[META IN] from:', waNumber, '| body:', Body?.slice(0,50));

          const accessToken = process.env.META_ACCESS_TOKEN;
          const numId = process.env.META_PHONE_NUMBER_ID;

          const { tenant, isNew, claimCodeUsed, group } = await getTenantForIncomingMessage(waNumber, Body);

          if (!tenant) {
            await sendMetaMessage(waNumber,
              '👋 Welcome to Syncora!\n\nTo connect with a company, send their *claim code* as your first message.',
              numId, accessToken
            );
            continue;
          }

          console.log('[META TENANT]', tenant.company_name, '| New:', isNew, '| Group:', group?.name || 'none');

          const blockedCheck = await pool.query(
            'SELECT blocked FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
            [waNumber, tenant.id]
          );
          if (blockedCheck.rows[0]?.blocked) continue;

          const planCheck = await checkMessageLimit(tenant.id);
          if (!planCheck.allowed) {
            await sendMetaMessage(waNumber, 'Sorry, message limit reached. Please upgrade.', numId, accessToken);
            continue;
          }

          if (isNew && claimCodeUsed) {
            await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);
            await sendMetaMessage(waNumber,
              '✅ You\'re now connected to *' + tenant.company_name + '*. Send your message and their team will reply shortly.',
              numId, accessToken
            );
            continue;
          }

          if (group) {
            const channelId = await getOrCreateGroupChannel(tenant, group);
            if (claimCodeUsed) {
              await sendMetaMessage(waNumber,
                '✅ You\'re now in *' + group.name + '*. Your messages will be shared with the group.',
                numId, accessToken
              );
              continue;
            }
            const slackTs = await postGroupMessageToSlack(tenant, channelId, Body, ProfileName, waNumber);
            await broadcastToGroup(group.id, waNumber, ProfileName, Body, null, numId, accessToken);
            await logMessage({ waNumber, body: Body, direction: 'inbound', twilioSid: MessageSid, slackTs, tenantId: tenant.id });
            continue;
          }

          const channelId = await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);
          ensureChannelMembers(tenant, channelId).catch(e => console.warn('[META] ensureChannelMembers:', e.message));

          if (message.type === 'text' && Body) {
            const slackTs = await postToTenantSlack(tenant, channelId, Body, ProfileName, waNumber);
            console.log('[META SLACK POST] success | ts:', slackTs);
            await logMessage({ waNumber, body: Body, direction: 'inbound', twilioSid: MessageSid, slackTs, tenantId: tenant.id });
          } else if (['image','video','audio','document','sticker'].includes(message.type)) {
            // Handle media messages from Meta
            const mediaObj = message[message.type];
            const mediaId = mediaObj?.id;
            const caption = mediaObj?.caption || '';
            const mimeType = mediaObj?.mime_type || '';
            const filename = mediaObj?.filename || message.type;

            console.log('[META MEDIA IN] type:', message.type, '| id:', mediaId);

            try {
              // Get media URL from Meta
              const mediaUrlResp = await fetch(
                `https://graph.facebook.com/v19.0/${mediaId}`,
                { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } }
              );
              const mediaData = await mediaUrlResp.json();
              const mediaUrl = mediaData.url;

              // Download media
              const mediaResp = await fetch(mediaUrl, {
                headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` }
              });
              const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer());

              // Upload to Slack
              const { WebClient } = require('@slack/web-api');
              const slack = new WebClient(tenant.slack_bot_token);
              // Determine file extension from mime type
              const extMap = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','video/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','application/pdf':'pdf'};
              const ext = extMap[mimeType] || message.type;
              const uploadResp = await slack.filesUploadV2({
                channel_id: channelId,
                file: mediaBuffer,
                filename: `${filename || message.type}.${ext}`,
                initial_comment: `*${ProfileName}* (${waNumber})${caption ? ': ' + caption : ''}`
              });
              console.log('[META MEDIA] Uploaded to Slack ✅');
              await logMessage({ waNumber, body: caption || '[media]', direction: 'inbound', twilioSid: MessageSid, slackTs: null, tenantId: tenant.id, mediaType: mimeType });
            } catch(e) {
              console.error('[META MEDIA ERROR]', e.message);
              // Fallback — post media URL as text
              const slackTs = await postToTenantSlack(tenant, channelId, `[${message.type}] ${caption || ''}`, ProfileName, waNumber);
              await logMessage({ waNumber, body: `[${message.type}]`, direction: 'inbound', twilioSid: MessageSid, slackTs, tenantId: tenant.id });
            }
          } else if (['image','video','audio','document','sticker'].includes(message.type)) {
            // Handle media messages from Meta
            const mediaObj = message[message.type];
            const mediaId = mediaObj?.id;
            const caption = mediaObj?.caption || '';
            const mimeType = mediaObj?.mime_type || '';
            const filename = mediaObj?.filename || message.type;

            console.log('[META MEDIA IN] type:', message.type, '| id:', mediaId);

            try {
              // Get media URL from Meta
              const mediaUrlResp = await fetch(
                `https://graph.facebook.com/v19.0/${mediaId}`,
                { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } }
              );
              const mediaData = await mediaUrlResp.json();
              const mediaUrl = mediaData.url;

              // Download media
              const mediaResp = await fetch(mediaUrl, {
                headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` }
              });
              const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer());

              // Upload to Slack
              const { WebClient } = require('@slack/web-api');
              const slack = new WebClient(tenant.slack_bot_token);
              const uploadResp = await slack.filesUploadV2({
                channel_id: channelId,
                content: mediaBuffer,
                filename: filename || message.type,
                initial_comment: `*${ProfileName}* (${waNumber})${caption ? ': ' + caption : ''}`
              });
              console.log('[META MEDIA] Uploaded to Slack ✅');
              await logMessage({ waNumber, body: caption || '[media]', direction: 'inbound', twilioSid: MessageSid, slackTs: null, tenantId: tenant.id, mediaType: mimeType });
            } catch(e) {
              console.error('[META MEDIA ERROR]', e.message);
              // Fallback — post media URL as text
              const slackTs = await postToTenantSlack(tenant, channelId, `[${message.type}] ${caption || ''}`, ProfileName, waNumber);
              await logMessage({ waNumber, body: `[${message.type}]`, direction: 'inbound', twilioSid: MessageSid, slackTs, tenantId: tenant.id });
            }
          }
        }
      }
    }
  } catch(err) {
    console.error('[META WEBHOOK ERROR]', err.message, err.stack);
  }
});

module.exports = { router, sendMetaMessage };
