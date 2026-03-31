// src/routes/auth.js
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { pool } = require('../db');
require('dotenv').config();

// Step 1 — Redirect to Slack OAuth
// Step 1 — Redirect to Slack OAuth
router.get('/slack', (req, res) => {
  const companyName = req.query.company || 'Unknown Company';
  const email       = req.query.email || '';

  const scopes = [
    'channels:manage',
    'channels:read',
    'channels:history',
    'chat:write',
    'files:write',
    'files:read',
    'im:write',
    'groups:write',
    'users:read',
  ].join(',');

  // Encode company info in state parameter
  const state = Buffer.from(JSON.stringify({ companyName, email })).toString('base64');

  const url = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.APP_URL}/auth/slack/callback&state=${state}`;

  res.redirect(url);
});

// Step 2 — Handle OAuth callback from Slack
// Step 2 — Handle OAuth callback from Slack
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) return res.send(`<h2>❌ Authorization denied: ${error}</h2>`);
    if (!code) return res.send('<h2>❌ No code received from Slack</h2>');

    // Decode company info from state
    let companyName = 'Unknown Company';
    let email = '';
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      companyName = decoded.companyName || 'Unknown Company';
      email       = decoded.email || '';
    } catch (e) {
      console.log('Could not decode state:', e.message);
    }

    // Exchange code for access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id:     process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri:  `${process.env.APP_URL}/auth/slack/callback`,
      }
    });

    const data = response.data;
    if (!data.ok) return res.send(`<h2>❌ Slack OAuth error: ${data.error}</h2>`);

    const botToken = data.access_token;
    const teamId   = data.team.id;
    const teamName = data.team.name;

    console.log(`Slack OAuth success: ${companyName} — ${teamName} (${teamId})`);

    // Check if tenant already exists
    const existing = await pool.query(
      'SELECT id FROM tenants WHERE slack_team_id = $1',
      [teamId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE tenants SET slack_bot_token = $1, slack_team_name = $2, company_name = $3, email = COALESCE(NULLIF($4,\'\'), email) WHERE slack_team_id = $5',
        [botToken, teamName, companyName, email, teamId]
      );
      console.log(`Updated existing tenant: ${companyName}`);
    } else {
      // Create new tenant — is_active FALSE until admin assigns Twilio number
      await pool.query(
        `INSERT INTO tenants 
        (company_name, email, twilio_number, slack_bot_token, slack_team_id, slack_team_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [companyName, email || null, 'PENDING', botToken, teamId, teamName]
      );
      console.log(`New tenant created: ${companyName} — pending activation`);
    }

    // Success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connected!</title>
        <style>
          body{font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0fff4}
          .box{text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:480px}
          h1{color:#25D366}
          p{color:#555;margin:8px 0}
          .badge{background:#25D366;color:white;padding:8px 20px;border-radius:20px;display:inline-block;margin-top:16px}
        </style>
      </head>
      <body>
        <div class="box">
          <h1>✅ Slack Connected!</h1>
          <p>Your company <strong>${companyName}</strong> has been successfully registered.</p>
          <p>Workspace: <strong>${teamName}</strong></p>
          <p style="color:#aaa;font-size:13px;margin-top:16px">A team member will assign your WhatsApp number shortly. You'll be notified when you're live.</p>
          <div class="badge">Setup Complete</div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.send('<h2>❌ Something went wrong. Please try again.</h2>');
  }
});

module.exports = router;
