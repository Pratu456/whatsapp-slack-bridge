const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');
const { sendWhatsApp } = require('./twilioService');

/**
 * Check if a WA number belongs to any group for this tenant
 */
const getGroupForContact = async (waNumber, tenantId) => {
  const result = await pool.query(`
    SELECT g.*, gm.display_name as sender_name
    FROM wa_groups g
    JOIN wa_group_members gm ON gm.group_id = g.id
    WHERE gm.wa_number = $1 AND g.tenant_id = $2
    LIMIT 1
  `, [waNumber, tenantId]);
  return result.rows[0] || null;
};

/**
 * Get all members of a group except the sender
 */
const getOtherMembers = async (groupId, excludeNumber) => {
  const result = await pool.query(`
    SELECT wa_number, display_name FROM wa_group_members
    WHERE group_id = $1 AND wa_number != $2
  `, [groupId, excludeNumber]);
  return result.rows;
};

/**
 * Get all members of a group
 */
const getAllMembers = async (groupId) => {
  const result = await pool.query(`
    SELECT wa_number, display_name FROM wa_group_members WHERE group_id = $1
  `, [groupId]);
  return result.rows;
};

/**
 * Get or create Slack channel for a group
 */
const getOrCreateGroupChannel = async (tenant, group) => {
  // Already has a channel
  if (group.slack_channel) return group.slack_channel;

  const slack = new WebClient(tenant.slack_bot_token);
  const channelName = 'group-' + group.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) + '-' + group.id;

  try {
    const result = await slack.conversations.create({
      name: channelName,
      is_private: true
    });
    const channelId = result.channel.id;

    // Set topic
    await slack.conversations.setTopic({
      channel: channelId,
      topic: 'WhatsApp Group: ' + group.name
    });

    // Invite ALL agents
    const { rows: agents } = await pool.query(
      'SELECT slack_user_id FROM tenant_agents WHERE tenant_id = $1',
      [tenant.id]
    );
    if (agents.length) {
      await slack.conversations.invite({
        channel: channelId,
        users: agents.map(a => a.slack_user_id).join(',')
      });
      console.log('[GROUP] Invited', agents.length, 'agents to', channelName);
    }

    // Save channel ID
    await pool.query('UPDATE wa_groups SET slack_channel = $1 WHERE id = $2', [channelId, group.id]);

    // Post welcome
    await slack.chat.postMessage({
      channel: channelId,
      text: ':busts_in_silhouette: *WhatsApp Group: ' + group.name + '* is now connected!\nMembers will see each other\'s messages.'
    });

    console.log('[GROUP] Created channel', channelName, 'for group', group.name);
    return channelId;
  } catch(err) {
    if (err.data?.error === 'name_taken') {
      // Find existing
      const list = await slack.conversations.list({ types: 'private_channel', limit: 200 });
      const existing = list.channels.find(c => c.name === channelName);
      if (existing) {
        await pool.query('UPDATE wa_groups SET slack_channel = $1 WHERE id = $2', [existing.id, group.id]);
        return existing.id;
      }
    }
    throw err;
  }
};

/**
 * Post group message to Slack
 */
const postGroupMessageToSlack = async (tenant, channelId, text, senderName, senderNumber) => {
  const slack = new WebClient(tenant.slack_bot_token);
  const result = await slack.chat.postMessage({
    channel: channelId,
    text: '*' + senderName + '* (WhatsApp Group · ' + senderNumber + '):\n' + text,
    mrkdwn: true
  });
  return result.ts;
};

/**
 * Broadcast message to all group members except sender
 */
const broadcastToGroup = async (groupId, excludeNumber, senderName, text, twilioNumber) => {
  const others = await getOtherMembers(groupId, excludeNumber);
  console.log('[GROUP] Broadcasting to', others.length, 'members');
  for (const member of others) {
    try {
      await sendWhatsApp(
        member.wa_number,
        '*' + senderName + '*: ' + text,
        twilioNumber
      );
      console.log('[GROUP] Sent to', member.wa_number);
    } catch(e) {
      console.warn('[GROUP] Failed to send to', member.wa_number, ':', e.message);
    }
  }
};

/**
 * Broadcast Slack reply to ALL group members
 */
const broadcastReplyToGroup = async (groupId, agentName, text, twilioNumber) => {
  const members = await getAllMembers(groupId);
  console.log('[GROUP REPLY] Broadcasting to', members.length, 'members');
  for (const member of members) {
    try {
      await sendWhatsApp(
        member.wa_number,
        '*' + agentName + '* (Support): ' + text,
        twilioNumber
      );
      console.log('[GROUP REPLY] Sent to', member.wa_number);
    } catch(e) {
      console.warn('[GROUP REPLY] Failed to send to', member.wa_number, ':', e.message);
    }
  }
};

module.exports = {
  getGroupForContact,
  getOtherMembers,
  getAllMembers,
  getOrCreateGroupChannel,
  postGroupMessageToSlack,
  broadcastToGroup,
  broadcastReplyToGroup
};
