// src/services/tenantService.js
const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');

/**
 * Get tenant by Twilio number (the number the message was sent TO)
 */
// const getTenantByTwilioNumber = async (twilioNumber) => {
//   const result = await pool.query(
//     'SELECT * FROM tenants WHERE twilio_number = $1 AND is_active = TRUE',
//     [twilioNumber]
//   );
//   return result.rows[0] || null;
// };

 // ✅ Replace getTenantForIncomingMessage with this
const getTenantForIncomingMessage = async (fromNumber, messageBody) => {

  // Stage 1 — returning contact, already mapped
  const contact = await pool.query(
    `SELECT t.* FROM contacts c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.wa_number = $1 AND t.is_active = TRUE
     LIMIT 1`,
    [fromNumber]
  );
  if (contact.rows.length > 0) return { tenant: contact.rows[0], isNew: false };

  // Stage 2 — new contact, match by claim code in message
  const words = (messageBody || '').toLowerCase().trim().split(/\s+/);
  for (const word of words) {
    const match = await pool.query(
      `SELECT * FROM tenants WHERE LOWER(claim_code) = $1 AND is_active = TRUE`,
      [word]
    );
    if (match.rows.length > 0) return { tenant: match.rows[0], isNew: true };
  }

  // No match found
  return { tenant: null, isNew: false };
};
/**
 * Get or create a Slack channel for a WhatsApp number under a specific tenant
 */
const getOrCreateChannelForTenant = async (tenant, waNumber, displayName) => {
  // 1. Check if mapping already exists for this tenant
  const existing = await pool.query(
    'SELECT slack_channel FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
    [waNumber, tenant.id]
  );
  if (existing.rows.length > 0) return existing.rows[0].slack_channel;

  // 2. Create Slack client using tenant's own bot token
  const slack = new WebClient(tenant.slack_bot_token);
  const channelName = 'wa-' + waNumber.replace(/\D/g, '').slice(-10);

  // 3. Create channel — handle name_taken gracefully
  let channelId;
  try {
    const result = await slack.conversations.create({
      name: channelName,
      is_private: false,
    });
    channelId = result.channel.id; // ✅ defined here first
  } catch (err) {
    if (err.data?.error === 'name_taken') {
      // Channel exists in Slack but not in our DB — find it
      const list = await slack.conversations.list({ limit: 200 });
      const found = list.channels.find(c => c.name === channelName);
      if (!found) throw new Error('Channel name taken but could not be found');
      channelId = found.id;
    } else {
      throw err;
    }
  }

  // 4. Invite bot into the channel
  try {
    const botInfo = await slack.auth.test();
    await slack.conversations.invite({
      channel: channelId,
      users: botInfo.user_id,
    });
  } catch (err) {
    // already_in_channel is fine — ignore it
    if (err.data?.error !== 'already_in_channel') {
      console.warn('Could not invite bot to channel:', err.data?.error);
    }
  }

  // 5. Save mapping with tenant_id
  await pool.query(
    'INSERT INTO contacts (wa_number, slack_channel, display_name, tenant_id) VALUES ($1, $2, $3, $4)',
    [waNumber, channelId, displayName || waNumber, tenant.id]
  );

  // 6. Post welcome message
  await slack.chat.postMessage({
    channel: channelId,
    text: `:phone: New WhatsApp contact: *${displayName || waNumber}*\nNumber: ${waNumber}`,
  });

  return channelId;
};

/**
 * Get WhatsApp number from Slack channel — scoped to tenant
 */
const getWaNumberForTenant = async (channelId, tenantId) => {
  const result = await pool.query(
    'SELECT wa_number FROM contacts WHERE slack_channel = $1 AND tenant_id = $2',
    [channelId, tenantId]
  );
  return result.rows[0]?.wa_number || null;
};

/**
 * Post message to Slack using tenant's own bot token
 */
const postToTenantSlack = async (tenant, channelId, text, senderName) => {
  const slack = new WebClient(tenant.slack_bot_token);
  const result = await slack.chat.postMessage({
    channel: channelId,
    text: `*${senderName}* (WhatsApp):\n${text}`,
  });
  return result.ts;
};

/**
 * Register a new tenant manually
 */
const createTenant = async ({ companyName, twilioNumber, slackBotToken, slackTeamId, slackTeamName }) => {
  const result = await pool.query(
    `INSERT INTO tenants (company_name, twilio_number, slack_bot_token, slack_team_id, slack_team_name, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING *`,
    [companyName, twilioNumber, slackBotToken, slackTeamId, slackTeamName]
  );
  return result.rows[0];
};

module.exports = {
  //getTenantByTwilioNumber,
  getTenantForIncomingMessage, 
  getOrCreateChannelForTenant,
  getWaNumberForTenant,
  postToTenantSlack,
  createTenant,
};

