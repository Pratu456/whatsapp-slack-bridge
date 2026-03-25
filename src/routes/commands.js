// src/routes/commands.js
const express  = require('express');
const router   = express.Router();
const { pool } = require('../db');
const { getWaNumber } = require('../services/mappingService');

// /history — show last 10 messages in this channel
router.post('/history', async (req, res) => {
  try {
    const { channel_id, user_id } = req.body;

    const waNumber = await getWaNumber(channel_id);
    if (!waNumber) {
      return res.json({
        response_type: 'ephemeral',
        text: '❌ This channel is not linked to a WhatsApp contact.',
      });
    }

    const result = await pool.query(
      `SELECT m.body, m.direction, m.status, m.created_at
       FROM messages m
       JOIN contacts c ON c.id = m.contact_id
       WHERE c.wa_number = $1
       ORDER BY m.created_at DESC
       LIMIT 10`,
      [waNumber]
    );

    if (!result.rows.length) {
      return res.json({
        response_type: 'ephemeral',
        text: '📭 No messages found for this contact.',
      });
    }

    const lines = result.rows.reverse().map(msg => {
      const direction = msg.direction === 'inbound' ? '📱 WhatsApp' : '💬 Slack';
      const time = new Date(msg.created_at).toLocaleTimeString();
      return `*${direction}* [${msg.status}] ${time}\n${msg.body}`;
    });

    return res.json({
      response_type: 'ephemeral',
      text: `📋 *Last ${result.rows.length} messages with ${waNumber}:*\n\n${lines.join('\n\n')}`,
    });

  } catch (err) {
    console.error('/history error:', err.message);
    return res.json({ response_type: 'ephemeral', text: '❌ Error fetching history.' });
  }
});

// /block — block a WhatsApp contact
router.post('/block', async (req, res) => {
  try {
    const { channel_id, text } = req.body;

    const waNumber = await getWaNumber(channel_id);
    if (!waNumber) {
      return res.json({
        response_type: 'ephemeral',
        text: '❌ This channel is not linked to a WhatsApp contact.',
      });
    }

    // Add blocked column if not exists and set it
    await pool.query(
      'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE'
    );

    await pool.query(
      'UPDATE contacts SET blocked = TRUE WHERE wa_number = $1',
      [waNumber]
    );

    return res.json({
      response_type: 'in_channel',
      text: `🚫 Contact *${waNumber}* has been blocked. No further messages will be forwarded.`,
    });

  } catch (err) {
    console.error('/block error:', err.message);
    return res.json({ response_type: 'ephemeral', text: '❌ Error blocking contact.' });
  }
});

// /unblock — unblock a WhatsApp contact
router.post('/unblock', async (req, res) => {
  try {
    const { channel_id } = req.body;

    const waNumber = await getWaNumber(channel_id);
    if (!waNumber) {
      return res.json({
        response_type: 'ephemeral',
        text: '❌ This channel is not linked to a WhatsApp contact.',
      });
    }

    await pool.query(
      'UPDATE contacts SET blocked = FALSE WHERE wa_number = $1',
      [waNumber]
    );

    return res.json({
      response_type: 'in_channel',
      text: `✅ Contact *${waNumber}* has been unblocked.`,
    });

  } catch (err) {
    console.error('/unblock error:', err.message);
    return res.json({ response_type: 'ephemeral', text: '❌ Error unblocking contact.' });
  }
});

module.exports = router;