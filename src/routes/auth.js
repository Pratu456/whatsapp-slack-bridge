// src/routes/auth.js
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { pool } = require('../db');
require('dotenv').config();

// Step 1 — Redirect to Slack OAuth
router.get('/slack', (req, res) => {
  const scopes = [
    'channels:manage',
    'channels:read',
    'chat:write',
    'files:write',
    'im:write',
    'groups:write',
  ].join(',');

  const url = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.APP_URL}/auth/slack/callback`;

  res.redirect(url);
});

// Step 2 — Handle OAuth callback from Slack
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.send(`<h2>❌ Authorization denied: ${error}</h2>`);
    }

    if (!code) {
      return res.send('<h2>❌ No code received from Slack</h2>');
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

    if (!data.ok) {
      return res.send(`<h2>❌ Slack OAuth error: ${data.error}</h2>`);
    }

    const botToken   = data.access_token;
    const teamId     = data.team.id;
    const teamName   = data.team.name;

    console.log(`Slack OAuth success: ${teamName} (${teamId})`);

    // Check if tenant already exists for this team
    const existing = await pool.query(
      'SELECT id FROM tenants WHERE slack_team_id = $1',
      [teamId]
    );

    if (existing.rows.length > 0) {
      // Update existing tenant token
      await pool.query(
        'UPDATE tenants SET slack_bot_token = $1, slack_team_name = $2 WHERE slack_team_id = $3',
        [botToken, teamName, teamId]
      );
      console.log(`Updated existing tenant: ${teamName}`);
    } else {
      // Create new tenant (inactive until Twilio number assigned)
      await pool.query(
        `INSERT INTO tenants (company_name, twilio_number, slack_bot_token, slack_team_id, slack_team_name, is_active)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [teamName, 'PENDING', botToken, teamId, teamName]
      );
      console.log(`New tenant created: ${teamName}`);
    }

    // Success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connected!</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0fff4; }
          .box { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; }
          h1 { color: #25D366; }
          p { color: #555; }
          .badge { background: #25D366; color: white; padding: 8px 20px; border-radius: 20px; display: inline-block; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>✅ Slack Connected!</h1>
          <p>Your workspace <strong>${teamName}</strong> has been successfully connected to the WhatsApp Bridge.</p>
          <p>A team member will assign your WhatsApp number shortly.</p>
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