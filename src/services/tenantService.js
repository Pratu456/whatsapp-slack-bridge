// src/services/tenantService.js
const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');

/**
 * Get tenant for incoming message.
 * Logic:
 * 1. If message contains a valid claim code → switch/add to that tenant
 * 2. If returning contact with no claim code → route to last active tenant
 * 3. No match → return null (show instructions)
 */
const getTenantForIncomingMessage = async (fromNumber, messageBody) => {
  const words = (messageBody || '').toLowerCase().trim().split(/\s+/);

  // Stage 1 — Check if message contains a claim code (any word matches)
  for (const word of words) {
    if (!word) continue;
    const match = await pool.query(
      `SELECT * FROM tenants WHERE LOWER(claim_code) = $1 AND is_active = TRUE`,
      [word]
    );
    if (match.rows.length > 0) {
      const tenant = match.rows[0];

      // Check if this number is already mapped to this tenant
      const existing = await pool.query(
        'SELECT id FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
        [fromNumber, tenant.id]
      );

      if (existing.rows.length > 0) {
        // Already mapped — update last_active timestamp so this becomes active tenant
        await pool.query(
          'UPDATE contacts SET last_active = NOW() WHERE wa_number = $1 AND tenant_id = $2',
          [fromNumber, tenant.id]
        );
        console.log(`Contact ${fromNumber} re-activated for tenant: ${tenant.company_name}`);
        return { tenant, isNew: false, claimCodeUsed: true };
      } else {
        // New mapping for this tenant
        console.log(`New contact ${fromNumber} mapped to tenant: ${tenant.company_name}`);
        return { tenant, isNew: true, claimCodeUsed: true };
      }
    }
  }

  // Stage 2 — No claim code in message, check if returning contact
  // Route to the most recently active tenant for this number
  const contact = await pool.query(
    `SELECT t.* FROM contacts c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.wa_number = $1 AND t.is_active = TRUE
     ORDER BY c.last_active DESC NULLS LAST, c.created_at DESC
     LIMIT 1`,
    [fromNumber]
  );

  if (contact.rows.length > 0) {
    // Update last_active
    await pool.query(
      'UPDATE contacts SET last_active = NOW() WHERE wa_number = $1 AND tenant_id = $2',
      [fromNumber, contact.rows[0].id]
    );
    return { tenant: contact.rows[0], isNew: false, claimCodeUsed: false };
  }

  // Stage 3 — No match at all
  return { tenant: null, isNew: false, claimCodeUsed: false };
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
    // Use display name in channel name if available, fall back to number
  const safeName = displayName && displayName !== waNumber
    ? displayName.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')  // replace special chars with dash
        .replace(/-+/g, '-')          // collapse multiple dashes
        .replace(/^-|-$/g, '')        // trim leading/trailing dashes
        .slice(0, 20)                 // Slack channel name max 80 chars but keep it short
    : null;

  const channelName = safeName
    ? `wa-${safeName}`
    : 'wa-' + waNumber.replace(/\D/g, '').slice(-10);

  // 3. Create channel — handle name_taken gracefully
  let channelId;
  try {
    const result = await slack.conversations.create({
      name: channelName,
      is_private: false,
    });
    channelId = result.channel.id;
      // Set channel topic to show the WhatsApp number
  try {
    await slack.conversations.setTopic({
      channel: channelId,
      topic: `WhatsApp: ${waNumber}${displayName ? ' · ' + displayName : ''}`,
    });
  } catch (e) { /* non-critical */ }
  } catch (err) {
    if (err.data?.error === 'name_taken') {
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
    if (err.data?.error !== 'already_in_channel') {
      console.warn('Could not invite bot to channel:', err.data?.error);
    }
  }

  // 5. Save mapping with tenant_id and last_active
  await pool.query(
    `INSERT INTO contacts (wa_number, slack_channel, display_name, tenant_id, last_active)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (wa_number, tenant_id) DO UPDATE SET last_active = NOW()`,
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
  /**
   * Re-invite all workspace members who left the channel.
   * Called on every inbound message to ensure no one is locked out.
   */
  const ensureChannelMembers = async (tenant, channelId) => {
    try {
      const slack = new WebClient(tenant.slack_bot_token);

      // Get current channel members
      const channelInfo = await slack.conversations.members({ channel: channelId });
      const currentMembers = new Set(channelInfo.members);

      // Get all workspace members
      const memberList = await slack.users.list();
      const humanIds = memberList.members
        .filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
        .map(m => m.id);

      // Find anyone who left
      const missing = humanIds.filter(id => !currentMembers.has(id));
      if (missing.length === 0) return;

      // Re-invite in batches of 30
      for (let i = 0; i < missing.length; i += 30) {
        const batch = missing.slice(i, i + 30);
        try {
          await slack.conversations.invite({ channel: channelId, users: batch.join(',') });
          console.log(`[CHANNEL] Re-invited ${batch.length} missing members to ${channelId}`);
        } catch (err) {
          if (err.data?.error !== 'already_in_channel') {
            console.warn('[CHANNEL] Re-invite error:', err.data?.error);
          }
        }
      }
    } catch (err) {
      console.warn('[CHANNEL] ensureChannelMembers error:', err.message);
    }
  };
module.exports = {
  getTenantForIncomingMessage,
  getOrCreateChannelForTenant,
  getWaNumberForTenant,
  postToTenantSlack,
  createTenant,
  ensureChannelMembers, 
};