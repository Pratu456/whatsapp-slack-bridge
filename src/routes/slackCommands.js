const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');

// Verify Slack signature
const verifySlack = (req, res, next) => {
  const sig = req.headers['x-slack-signature'];
  const ts = req.headers['x-slack-request-timestamp'];
  if (!sig || !ts) return res.status(401).send('Unauthorized');
  if (Math.abs(Date.now()/1000 - ts) > 300) return res.status(401).send('Stale');
  const base = `v0:${ts}:${require('qs').stringify(req.body, {format:'RFC1738'})}`;
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
  hmac.update(base);
  const mine = `v0=${hmac.digest('hex')}`;
  if (mine !== sig) return res.status(401).send('Invalid signature');
  next();
};

// Find tenant from Slack team
const getTenant = async (slackTeamId) => {
  const { rows } = await pool.query(
    'SELECT * FROM tenants WHERE slack_team_id = $1 AND is_active = TRUE',
    [slackTeamId]
  );
  return rows[0] || null;
};

// /syncora-add +91xxxxxxxxxx group-name
router.post('/commands', express.urlencoded({ extended: true }), verifySlack, async (req, res) => {
  const { command, text, team_id, user_name, response_url } = req.body;

  // Respond immediately to avoid Slack timeout
  res.json({ response_type: 'ephemeral', text: '⏳ Processing...' });

  try {
    const tenant = await getTenant(team_id);
    if (!tenant) {
      await respond(response_url, '❌ No active Syncora tenant found for this workspace.');
      return;
    }

    if (command === '/syncora-groups') {
      // List all groups
      const { rows: groups } = await pool.query(
        'SELECT g.*, COUNT(gm.id) as member_count FROM wa_groups g LEFT JOIN wa_group_members gm ON gm.group_id = g.id WHERE g.tenant_id = $1 GROUP BY g.id ORDER BY g.name',
        [tenant.id]
      );
      if (!groups.length) {
        await respond(response_url, '📋 No groups found. Create one in the admin panel.');
        return;
      }
      let msg = '*📋 WhatsApp Groups:*\n';
      for (const g of groups) {
        const { rows: members } = await pool.query(
          'SELECT wa_number, display_name FROM wa_group_members WHERE group_id = $1',
          [g.id]
        );
        msg += `\n*${g.name}* (code: \`${g.claim_code || 'not set'}\`) — ${members.length} members\n`;
        members.forEach(m => { msg += `  • ${m.display_name || m.wa_number} (${m.wa_number})\n`; });
      }
      await respond(response_url, msg);
      return;
    }

    if (command === '/syncora-add') {
      // /syncora-add +91xxxxxxxxxx group-name
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        await respond(response_url, '❌ Usage: `/syncora-add +91xxxxxxxxxx group-name`');
        return;
      }
      const waNumber = parts[0].startsWith('+') ? parts[0] : '+' + parts[0];
      const groupName = parts.slice(1).join(' ').toLowerCase();

      // Find group
      const { rows: groups } = await pool.query(
        'SELECT * FROM wa_groups WHERE tenant_id = $1 AND (LOWER(name) = $2 OR LOWER(claim_code) = $2)',
        [tenant.id, groupName]
      );
      if (!groups.length) {
        await respond(response_url, `❌ Group *${groupName}* not found. Use \`/syncora-groups\` to see all groups.`);
        return;
      }
      const group = groups[0];

      // Find contact display name
      const { rows: contacts } = await pool.query(
        'SELECT display_name FROM contacts WHERE wa_number = $1 AND tenant_id = $2',
        [waNumber, tenant.id]
      );
      const displayName = contacts[0]?.display_name || waNumber;

      // Add to group
      await pool.query(
        `INSERT INTO wa_group_members (group_id, wa_number, display_name, tenant_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, wa_number) DO UPDATE SET display_name = $3`,
        [group.id, waNumber, displayName, tenant.id]
      );

      // Notify in group channel if exists
      if (group.slack_channel && tenant.slack_bot_token) {
        const slack = new WebClient(tenant.slack_bot_token);
        await slack.chat.postMessage({
          channel: group.slack_channel,
          text: `✅ *${displayName}* (${waNumber}) added to group by @${user_name}`
        });
      }

      await respond(response_url, `✅ *${displayName}* (${waNumber}) added to *${group.name}*`);
      return;
    }

    if (command === '/syncora-remove') {
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        await respond(response_url, '❌ Usage: `/syncora-remove +91xxxxxxxxxx group-name`');
        return;
      }
      const waNumber = parts[0].startsWith('+') ? parts[0] : '+' + parts[0];
      const groupName = parts.slice(1).join(' ').toLowerCase();

      const { rows: groups } = await pool.query(
        'SELECT * FROM wa_groups WHERE tenant_id = $1 AND (LOWER(name) = $2 OR LOWER(claim_code) = $2)',
        [tenant.id, groupName]
      );
      if (!groups.length) {
        await respond(response_url, `❌ Group *${groupName}* not found.`);
        return;
      }
      const group = groups[0];

      const { rows: members } = await pool.query(
        'SELECT display_name FROM wa_group_members WHERE group_id = $1 AND wa_number = $2',
        [group.id, waNumber]
      );
      if (!members.length) {
        await respond(response_url, `❌ ${waNumber} is not in *${group.name}*`);
        return;
      }
      const displayName = members[0].display_name || waNumber;

      await pool.query(
        'DELETE FROM wa_group_members WHERE group_id = $1 AND wa_number = $2',
        [group.id, waNumber]
      );

      if (group.slack_channel && tenant.slack_bot_token) {
        const slack = new WebClient(tenant.slack_bot_token);
        await slack.chat.postMessage({
          channel: group.slack_channel,
          text: `➖ *${displayName}* (${waNumber}) removed from group by @${user_name}`
        });
      }

      await respond(response_url, `✅ *${displayName}* removed from *${group.name}*`);
      return;
    }

    await respond(response_url, '❌ Unknown command. Use `/syncora-add`, `/syncora-remove`, or `/syncora-groups`');

  } catch(e) {
    console.error('[SLASH CMD ERROR]', e.message);
    await respond(response_url, '❌ Error: ' + e.message);
  }
});

async function respond(url, text) {
  const axios = require('axios');
  await axios.post(url, { response_type: 'ephemeral', text });
}

module.exports = router;
