const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /waitlist — save email
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  try {
    await db.query(
      `INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /waitlist — list all (admin only)
router.get('/', async (req, res) => {
  const pwd = req.query.pwd || req.headers['x-admin-password'];
  if (pwd !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const result = await db.query(
      `SELECT id, email, created_at FROM waitlist ORDER BY created_at DESC`
    );
    res.json({ count: result.rows.length, emails: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;