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

    // 1. Check GROUP claim codes FIRST
    const groupMatch = await pool.query(
      `SELECT g.id, g.name, g.slack_channel, g.claim_code, g.tenant_id,
              t.id as tid, t.company_name, t.slack_bot_token, t.twilio_number, t.plan, t.claim_code as tenant_claim_code
       FROM wa_groups g JOIN tenants t ON t.id = g.tenant_id
       WHERE LOWER(g.claim_code) = $1 AND t.is_active = TRUE`,
      [word]
    );
    if (groupMatch.rows.length > 0) {
      const row = groupMatch.rows[0];
      const tenant = {
        id: row.tid, company_name: row.company_name,
        slack_bot_token: row.slack_bot_token, twilio_number: row.twilio_number,
        claim_code: row.tenant_claim_code, plan: row.plan
      };
      const group = { id: row.id, name: row.name, slack_channel: row.slack_channel, claim_code: row.claim_code };

      // Add to group members
      await pool.query(
        `INSERT INTO wa_group_members (group_id, wa_number, display_name, tenant_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, wa_number) DO NOTHING`,
        [group.id, fromNumber, fromNumber, tenant.id]
      );

      // Set active group session — update or insert contact
      const existingContact = await pool.query(
        'SELECT id FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
        [fromNumber, tenant.id]
      );
      if (existingContact.rows.length > 0) {
        await pool.query(
          'UPDATE contacts SET active_group_id = $1, last_active = NOW() WHERE wa_number = $2 AND tenant_id = $3',
          [group.id, fromNumber, tenant.id]
        );
      } else {
        // Create contact with active group
        await pool.query(
          `INSERT INTO contacts (wa_number, tenant_id, active_group_id, last_active, display_name)
           VALUES ($1, $2, $3, NOW(), $1)
           ON CONFLICT (wa_number, tenant_id) DO UPDATE SET active_group_id = $3, last_active = NOW()`,
          [fromNumber, tenant.id, group.id]
        );
      }

      console.log(`[GROUP] ${fromNumber} joined/re-joined group: ${group.name}`);
      return { tenant, isNew: false, claimCodeUsed: true, group };
    }

    // 2. Check TENANT claim codes
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
          'UPDATE contacts SET last_active = NOW(), active_group_id = NULL WHERE wa_number = $1 AND tenant_id = $2',
          [fromNumber, tenant.id]
        );
        console.log(`Contact ${fromNumber} switched to private chat for tenant: ${tenant.company_name}`);
        return { tenant, isNew: false, claimCodeUsed: true, group: null };
      } else {
        console.log(`New contact ${fromNumber} mapped to tenant: ${tenant.company_name}`);
        return { tenant, isNew: true, claimCodeUsed: true, group: null };
      }
    }
  }

  // 3. No claim code — check existing contact
  const contact = await pool.query(
    `SELECT t.*, c.active_group_id FROM contacts c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.wa_number = $1 AND t.is_active = TRUE
     ORDER BY c.last_active DESC NULLS LAST, c.created_at DESC
     LIMIT 1`,
    [fromNumber]
  );
  if (contact.rows.length > 0) {
    const tenant = contact.rows[0];
    await pool.query(
      'UPDATE contacts SET last_active = NOW() WHERE wa_number = $1 AND tenant_id = $2',
      [fromNumber, tenant.id]
    );
    if (contact.rows[0].active_group_id) {
      const groupResult = await pool.query('SELECT * FROM wa_groups WHERE id = $1', [contact.rows[0].active_group_id]);
      if (groupResult.rows.length > 0) {
        console.log(`[GROUP SESSION] ${fromNumber} → group: ${groupResult.rows[0].name}`);
        return { tenant, isNew: false, claimCodeUsed: false, group: groupResult.rows[0] };
      }
    }
    return { tenant, isNew: false, claimCodeUsed: false, group: null };
  }

  return { tenant: null, isNew: false, claimCodeUsed: false, group: null };
};

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
    if (existing.rows[0].slack_channel) return existing.rows[0].slack_channel;
    // Channel is null - fall through to create new one
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
        // No agents configured - bot only, team joins manually
        console.log("[CHANNEL] No agents configured, channel created bot-only");
      }
    } catch (err) {
      console.warn('[CHANNEL] Could not invite agent:', err.message);
    }
  }

  // 3. Save contact mapping
  await pool.query(
    `INSERT INTO contacts (wa_number, slack_channel, display_name, tenant_id, last_active)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (wa_number, tenant_id) DO UPDATE SET slack_channel = $2, last_active = NOW()`
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
    text: `*${senderName}* (WhatsApp · ${waNumber}):
${text}`,
    mrkdwn: true,
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
  // disabled - manual invites only
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