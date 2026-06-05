const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { logMessage } = require('../services/messageLogger');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// Convert audio buffer to MP3
function convertToMp3(inputBuffer) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpIn = path.join(os.tmpdir(), 'wa_audio_' + Date.now() + '.ogg');
    const tmpOut = path.join(os.tmpdir(), 'wa_audio_' + Date.now() + '.wav');
    fs.writeFileSync(tmpIn, inputBuffer);
    ffmpeg(tmpIn)
      .format('wav')
      .on('end', () => {
        const result = fs.readFileSync(tmpOut);
        console.log('[AUDIO] Converted to MP4 video, size:', result.length);
        try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut); fs.unlinkSync(tmpImg); } catch(e) {}
        resolve(result);
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpIn); } catch(e) {}
        reject(err);
      })
      .save(tmpOut);
  });
}
const { checkMessageLimit } = require('../services/planEnforcement');
const { getTenantForIncomingMessage, getOrCreateChannelForTenant, postToTenantSlack, ensureChannelMembers } = require('../services/tenantService');
const { getOrCreateGroupChannel, postGroupMessageToSlack, broadcastToGroup } = require('../services/groupService');

const sendMetaMessage = async (to, text, phoneNumberId, accessToken) => {
  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body: text } })
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  console.log('[META OUT] to:', to, '| id:', data.messages?.[0]?.id);
  return data.messages?.[0]?.id;
};

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('[META] Verification attempt | mode:', mode, '| token:', token);
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[META] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

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
          const privateNumId = process.env.META_PHONE_NUMBER_ID_PRIVATE || process.env.META_PHONE_NUMBER_ID;
          const groupNumId = process.env.META_PHONE_NUMBER_ID_GROUP;
          const isGroupNumber = groupNumId && phoneNumberId === groupNumId;
          const numId = phoneNumberId;

          console.log('[META ROUTING] incoming to:', isGroupNumber ? 'GROUP number' : 'PRIVATE number');

          const result = await getTenantForIncomingMessage(waNumber, Body, isGroupNumber, phoneNumberId);
          let { tenant, isNew, claimCodeUsed, group } = result;

          if (!tenant) {
            if (isGroupNumber) {
              await sendMetaMessage(waNumber, 'Welcome! To join a group, please send your group claim code.', numId, accessToken);
            }
            continue;
          }

          console.log('[META TENANT]', tenant.company_name, '| New:', isNew, '| Group:', group?.name || 'none');

          // Enforce number routing
          if (isGroupNumber && !group && !claimCodeUsed) {
            await sendMetaMessage(waNumber, 'This number is for group chats only. Please send a group claim code.', numId, accessToken);
            continue;
          }
          if (!isGroupNumber && group && claimCodeUsed) {
            await sendMetaMessage(waNumber, 'To join a group please send the group claim code to our group number.', numId, accessToken);
            group = null;
            claimCodeUsed = false;
          }

          const blockedCheck = await pool.query('SELECT blocked FROM contacts WHERE wa_number = $1 AND tenant_id = $2', [waNumber, tenant.id]);
          if (blockedCheck.rows[0]?.blocked) continue;

          const planCheck = await checkMessageLimit(tenant.id);
          if (!planCheck.allowed) {
            await sendMetaMessage(waNumber, 'Sorry, message limit reached. Please upgrade.', numId, accessToken);
            continue;
          }

          if (claimCodeUsed && !group) {
            await getOrCreateChannelForTenant(tenant, waNumber, ProfileName);
            await sendMetaMessage(waNumber,
              'Hi ' + ProfileName + '! Welcome to *' + tenant.company_name + '*.\n\nYou are now connected and our team will be with you shortly. Feel free to send your message!',
              privateNumId, accessToken
            );
            continue;
          }

          if (group) {
            const channelId = await getOrCreateGroupChannel(tenant, group);
            if (claimCodeUsed) {
              await sendMetaMessage(waNumber,
                'You are now in *' + group.name + '*. Your messages will be shared with the group.',
                groupNumId || privateNumId, accessToken
              );
              continue;
            }
            const slackTs = await postGroupMessageToSlack(tenant, channelId, Body, ProfileName, waNumber);
            await broadcastToGroup(group.id, waNumber, ProfileName, Body, null, groupNumId || privateNumId, accessToken, tenant);
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
            const mediaObj = message[message.type];
            const mediaId = mediaObj?.id;
            const caption = mediaObj?.caption || '';
            const mimeType = mediaObj?.mime_type || '';
            const filename = mediaObj?.filename || message.type;
            console.log('[META MEDIA IN] type:', message.type, '| id:', mediaId);
            try {
              const mediaUrlResp = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } });
              const mediaData = await mediaUrlResp.json();
              const mediaUrl = mediaData.url;
              const mediaResp = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } });
              const mediaBuffer = Buffer.from(await mediaResp.arrayBuffer());
              const { WebClient } = require('@slack/web-api');
              const slack = new WebClient(tenant.slack_bot_token);
              const normalizedMime = mimeType.split(";")[0].trim();
              const extMap = {'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp','video/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','application/pdf':'pdf'};
              let ext = extMap[normalizedMime] || (normalizedMime.startsWith('audio') ? 'ogg' : message.type);
              let uploadBuffer = mediaBuffer;
              if (normalizedMime === 'audio/ogg' || ext === 'ogg' || normalizedMime === 'audio/mpeg' || ext === 'mp3') {
                try {
                  uploadBuffer = await convertToMp3(mediaBuffer);
                  ext = 'wav';
                  console.log('[UPLOAD] Buffer first bytes:', uploadBuffer.slice(0,4).toString('hex'), 'ext:', ext, 'size:', uploadBuffer.length);
                } catch(convErr) {
                  console.error('[AUDIO] Conversion failed, using original:', convErr.message);
                }
              }
              await slack.filesUploadV2({
                channel_id: channelId,
                file: uploadBuffer,
                filename: `${filename || message.type}.${ext}`,
                initial_comment: `*${ProfileName}* (${waNumber})${caption ? ': ' + caption : ''}`
              });
              console.log('[META MEDIA] Uploaded to Slack');
              await logMessage({ waNumber, body: caption || '[media]', direction: 'inbound', twilioSid: MessageSid, slackTs: null, tenantId: tenant.id });
            } catch(e) {
              console.error('[META MEDIA ERROR]', e.message);
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
