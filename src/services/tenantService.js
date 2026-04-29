// src/services/tenantService.js
const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');

/**
 * Get tenant for incoming message.
 */
const getTenantForIncomingMessage = async (fromNumber, messageBody) => {
  const words = (messageBody || '').toLowerCase().trim().split(/\s+/);

  for (const word of words) {
    if (!word) continue;
    const match = await pool.query(
      `SELECT * FROM tenants WHERE LOWER(claim_code) = $1 AND is_active = TRUE`,
      [word]
    );
    if (match.rows.length > 0) {
      const tenant = match.rows[0];
      const existing = await pool.query(
        'SELECT id FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
        [fromNumber, tenant.id]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          'UPDATE contacts SET last_active = NOW() WHERE wa_number = $1 AND tenant_id = $2',
          [fromNumber, tenant.id]
        );
        console.log(`Contact ${fromNumber} re-activated for tenant: ${tenant.company_name}`);
        return { tenant, isNew: false, claimCodeUsed: true };
      } else {
        console.log(`New contact ${fromNumber} mapped to tenant: ${tenant.company_name}`);
        return { tenant, isNew: true, claimCodeUsed: true };
      }
    }
  }

  const contact = await pool.query(
    `SELECT t.* FROM contacts c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.wa_number = $1 AND t.is_active = TRUE
     ORDER BY c.last_active DESC NULLS LAST, c.created_at DESC
     LIMIT 1`,
    [fromNumber]
  );

  if (contact.rows.length > 0) {
    await pool.query(
      'UPDATE contacts SET last_active = NOW() WHERE wa_number = $1 AND tenant_id = $2',
      [fromNumber, contact.rows[0].id]
    );
    return { tenant: contact.rows[0], isNew: false, claimCodeUsed: false };
  }

  return { tenant: null, isNew: false, claimCodeUsed: false };
};

/**
 * Pick the next agent for a tenant using round-robin
 */
const pickAgent = async (tenantId) => {
  const agents = await pool.query(
    'SELECT slack_user_id, slack_name FROM tenant_agents WHERE tenant_id = $1 ORDER BY id',
    [tenantId]
  );
  if (!agents.rows.length) return null;

  // Round-robin based on existing contact count
  const countResult = await pool.query(
    'SELECT COUNT(*) as cnt FROM contacts WHERE tenant_id = $1',
    [tenantId]
  );
  const idx = parseInt(countResult.rows[0].cnt) % agents.rows.length;
  return agents.rows[idx];
};

/**
 * Get or create a PRIVATE Slack channel for a WhatsApp contact
 */
const getOrCreateChannelForTenant = async (tenant, waNumber, displayName) => {
  // 1. Check if contact already mapped
  const existing = await pool.query(
    'SELECT slack_channel FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
    [waNumber, tenant.id]
  );
  if (existing.rows.length > 0) {
    if (tenant.default_slack_channel && existing.rows[0].slack_channel !== tenant.default_slack_channel) {
      await pool.query(
        'UPDATE contacts SET slack_channel = $1 WHERE wa_number = $2 AND tenant_id = $3',
        [tenant.default_slack_channel, waNumber, tenant.id]
      );
      return tenant.default_slack_channel;
    }
    return existing.rows[0].slack_channel;
  }

  const slack = new WebClient(tenant.slack_bot_token);
  let channelId;

  if (tenant.default_slack_channel) {
    // Use pre-configured shared channel
    channelId = tenant.default_slack_channel;
    console.log(`[CHANNEL] Using shared channel ${channelId} for ${waNumber}`);
    try {
      await slack.conversations.join({ channel: channelId });
    } catch (err) {
      if (err.data?.error !== 'already_in_channel') {
        console.warn('[CHANNEL] Could not join channel:', err.data?.error);
      }
    }
  } else {
    // Create a PRIVATE channel for this contact
    const channelName = (() => {
      const safeName = displayName && displayName !== waNumber
        ? displayName.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 20)
        : null;
      return safeName ? `wa-${safeName}` : 'wa-' + waNumber.replace(/\D/g, '').slice(-10);
    })();

    try {
      const result = await slack.conversations.create({
        name: channelName,
        is_private: true,  // ← PRIVATE channel
      });
      channelId = result.channel.id;
      console.log(`[CHANNEL] Created private channel ${channelName} for ${waNumber}`);
    } catch (err) {
      if (err.data?.error === 'name_taken') {
        // Try with timestamp suffix
        const result = await slack.conversations.create({
          name: channelName + '-' + Date.now().toString().slice(-4),
          is_private: true,
        });
        channelId = result.channel.id;
      } else {
        throw err;
      }
    }

    // Set channel topic
    try {
      await slack.conversations.setTopic({
        channel: channelId,
        topic: `WhatsApp: ${waNumber}${displayName ? ' · ' + displayName : ''}`,
      });
    } catch (e) { /* non-critical */ }

    // Invite assigned agent (round-robin) or fall back to all members
    try {
      const agent = await pickAgent(tenant.id);
      if (agent) {
        // Invite only the assigned agent
        await slack.conversations.invite({ channel: channelId, users: agent.slack_user_id });
        console.log(`[CHANNEL] Invited agent ${agent.slack_name} to ${channelName}`);
        // Save assignment
        await pool.query(
          'UPDATE contacts SET assigned_to = $1, assigned_name = $2 WHERE wa_number = $3 AND tenant_id = $4',
          [agent.slack_user_id, agent.slack_name, waNumber, tenant.id]
        );
      } else {
        // No agents configured — invite all workspace members (fallback)
        console.log('[CHANNEL] No agents configured, inviting all members');
        const memberList = await slack.users.list();
        const humanIds = memberList.members
          .filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
          .map(m => m.id);
        for (let i = 0; i < humanIds.length; i += 30) {
          const batch = humanIds.slice(i, i + 30);
          try {
            await slack.conversations.invite({ channel: channelId, users: batch.join(',') });
          } catch (err) {
            if (err.data?.error !== 'already_in_channel') {
              console.warn('Could not invite batch:', err.data?.error);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CHANNEL] Could not invite agent:', err.message);
    }
  }

  // 3. Save contact mapping
  await pool.query(
    `INSERT INTO contacts (wa_number, slack_channel, display_name, tenant_id, last_active)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (wa_number, tenant_id) DO UPDATE SET last_active = NOW()`,
    [waNumber, channelId, displayName || waNumber, tenant.id]
  );

  // 4. Post welcome message
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
const postToTenantSlack = async (tenant, channelId, text, senderName, waNumber) => {
  const slack = new WebClient(tenant.slack_bot_token);
  const result = await slack.chat.postMessage({
    channel: channelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${senderName}* (WhatsApp · ${waNumber}):\n${text}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: `Reply to ${senderName}` },
            action_id: 'reply_to_wa',
            value: waNumber,
            style: 'primary',
          },
        ],
      },
    ],
    text: `${senderName}: ${text}`,
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
 * Ensure assigned agent is still in the channel (re-invite if they left)
 */
const ensureChannelMembers = async (tenant, channelId) => {
  try {
    const slack = new WebClient(tenant.slack_bot_token);

    // Check if there's an assigned agent for this channel
    const contact = await pool.query(
      'SELECT assigned_to FROM contacts WHERE slack_channel = $1 AND tenant_id = $2',
      [channelId, tenant.id]
    );

    if (contact.rows.length > 0 && contact.rows[0].assigned_to) {
      // Only ensure the assigned agent is in the channel
      const agentId = contact.rows[0].assigned_to;
      const channelInfo = await slack.conversations.members({ channel: channelId });
      if (!channelInfo.members.includes(agentId)) {
        await slack.conversations.invite({ channel: channelId, users: agentId });
        console.log(`[CHANNEL] Re-invited assigned agent ${agentId} to ${channelId}`);
      }
    } else {
      // No assigned agent — ensure all members (legacy fallback)
      const channelInfo = await slack.conversations.members({ channel: channelId });
      const currentMembers = new Set(channelInfo.members);
      const memberList = await slack.users.list();
      const humanIds = memberList.members
        .filter(m => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
        .map(m => m.id);
      const missing = humanIds.filter(id => !currentMembers.has(id));
      if (missing.length === 0) return;
      for (let i = 0; i < missing.length; i += 30) {
        const batch = missing.slice(i, i + 30);
        try {
          await slack.conversations.invite({ channel: channelId, users: batch.join(',') });
        } catch (err) {
          if (err.data?.error !== 'already_in_channel') {
            console.warn('[CHANNEL] Re-invite error:', err.data?.error);
          }
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
  pickAgent,
};