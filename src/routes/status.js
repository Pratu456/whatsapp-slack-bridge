// src/routes/status.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

router.post('/webhook', async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;
    console.log(`Status update: ${MessageSid} → ${MessageStatus}`);

    // Update message status in database
    await pool.query(
      'UPDATE messages SET status = $1 WHERE twilio_sid = $2',
      [MessageStatus, MessageSid]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('Status webhook error:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;