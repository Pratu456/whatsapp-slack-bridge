// src/services/metaService.js
const axios = require('axios');
// Increase default limits for media
axios.defaults.maxContentLength = 100 * 1024 * 1024; // 100MB
axios.defaults.maxBodyLength = 100 * 1024 * 1024; // 100MB

const BASE_URL = 'https://graph.facebook.com/v19.0';

function getConfig(type = 'private') {
  return {
    phoneNumberId: type === 'group'
      ? (process.env.META_PHONE_NUMBER_ID_GROUP || process.env.META_PHONE_NUMBER_ID)
      : (process.env.META_PHONE_NUMBER_ID_PRIVATE || process.env.META_PHONE_NUMBER_ID),
    accessToken: process.env.META_ACCESS_TOKEN,
  };
}

function cleanNumber(to) {
  // Strip Twilio-style "whatsapp:+91..." prefix if present
  return to.replace(/^whatsapp:/i, '').replace(/^\+/, '');
}

/**
 * Send a plain-text WhatsApp message via Meta Cloud API.
 * Returns the Meta message ID string (wamid.xxx).
 */
async function sendWhatsAppMessage(to, body, type = 'private') {
  const { phoneNumberId, accessToken } = getConfig(msgType);

  const { data } = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                cleanNumber(to),
      type:              'text',
      text:              { preview_url: false, body },
    },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const msgId = data.messages?.[0]?.id || 'unknown';
  console.log(`[Meta] Sent to ${to}: ${msgId}`);
  return msgId;
}

/**
 * Send a media message (image, video, document, audio) via Meta Cloud API.
 * Meta fetches the file from the public URL you provide.
 * Returns the Meta message ID string.
 */
async function sendWhatsAppMedia(to, mediaUrlOrId, caption = '', mimeType = '', isMediaId = false, msgType = 'private') {
  const { phoneNumberId, accessToken } = getConfig(type);

  // Determine media type from MIME type
  let type = 'document';
  if (mimeType.startsWith('image/')) type = 'image';
  if (mimeType.startsWith('video/')) type = 'video';
  if (mimeType.startsWith('audio/')) type = 'audio';

  const mediaPayload = isMediaId ? { id: mediaUrlOrId } : { link: mediaUrlOrId };
  if (caption && type !== 'audio') mediaPayload.caption = caption;

  const { data } = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                cleanNumber(to),
      type,
      [type]:            mediaPayload,
    },
    {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const msgId = data.messages?.[0]?.id || 'unknown';
  console.log(`[Meta] Media sent to ${to}: ${msgId}`);
  return msgId;
}

/**
 * Mark a received message as read (shows double blue ticks).
 */
async function markAsRead(messageId) {
  const { phoneNumberId, accessToken } = getConfig();
  await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  ).catch(e => console.warn('[Meta] markAsRead failed:', e.response?.data || e.message));
}

/**
 * Parse an inbound Meta webhook body into a normalised object.
 * Returns null for status updates / non-message events.
 */
function parseInboundMessage(body) {
  try {
    const value   = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const contact = value?.contacts?.[0];
    return {
      from:      message.from,
      name:      contact?.profile?.name || message.from,
      type:      message.type,
      text:      message.type === 'text' ? message.text?.body : null,
      messageId: message.id,
      timestamp: message.timestamp,
    };
  } catch {
    return null;
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppMedia, markAsRead, parseInboundMessage };
