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
   res.send(`<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Syncora — You're registered!</title>
  <link rel="icon" type="image/png" href="/logo.png"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#060608;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
  .bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.08}
  .orb1{width:500px;height:500px;background:#25D366;top:-150px;left:-150px}
  .orb2{width:350px;height:350px;background:#7c3aed;bottom:-100px;right:-100px}
  .bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:80px 80px}
  .card{position:relative;z-index:1;background:#0f0f16;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:48px 40px;max-width:520px;width:100%;text-align:center}
  .card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.5),transparent)}
  .check-wrap{width:72px;height:72px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;position:relative}
  .check-wrap::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(37,211,102,.1)}
  .check{font-size:32px}
  .logo-text{font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:16px}
  h1{font-size:28px;font-weight:900;letter-spacing:-1px;margin-bottom:10px;color:#fff}
  .subtitle{font-size:15px;color:rgba(255,255,255,.5);line-height:1.6;margin-bottom:32px}
  .info-box{background:#16161f;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px;margin-bottom:28px;text-align:left}
  .info-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
  .info-row:not(:last-child){border-bottom:1px solid rgba(255,255,255,.05)}
  .info-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.3)}
  .info-value{font-size:14px;font-weight:600;color:rgba(255,255,255,.85)}
  .steps{text-align:left;margin-bottom:32px}
  .steps-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:14px}
  .step{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
  .step-num{width:22px;height:22px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#000;flex-shrink:0;margin-top:1px}
  .step-text{font-size:14px;color:rgba(255,255,255,.6);line-height:1.5}
  .step-text strong{color:rgba(255,255,255,.9)}
  .pending-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:#fbbf24;padding:8px 16px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:24px}
  .pending-dot{width:6px;height:6px;background:#fbbf24;border-radius:50%;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  .back-link{font-size:13px;color:rgba(255,255,255,.3);text-decoration:none;transition:color .2s}
  .back-link:hover{color:rgba(255,255,255,.6)}
  .footer-logo{font-size:18px;font-weight:900;color:#25D366;letter-spacing:-0.5px;margin-top:32px;position:relative;z-index:1}
  .footer-logo span{color:rgba(255,255,255,.4)}
  </style>
  </head>
  <body>
  <div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
  <div class="bg-grid"></div>
  
  <div class="card">
    <div class="logo-text">Syncora</div>
    <div class="check-wrap"><div class="check">✓</div></div>
    <h1>You're registered!</h1>
    <p class="subtitle">Your Slack workspace is connected.<br/>You're one step away from going live.</p>
  
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Company</span>
        <span class="info-value">${companyName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Slack workspace</span>
        <span class="info-value">${teamName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span style="background:rgba(245,158,11,.1);color:#fbbf24;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)">Pending activation</span>
      </div>
    </div>
  
    <div class="pending-badge">
      <span class="pending-dot"></span>
      Awaiting admin activation
    </div>
  
    <div class="steps">
      <div class="steps-title">What happens next</div>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Our team reviews your registration and <strong>assigns your WhatsApp number</strong></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">You receive an <strong>activation email</strong> with your unique claim code</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Share your WhatsApp number with customers — <strong>messages appear in Slack instantly</strong></div>
      </div>
    </div>
  
    <a href="/onboarding" class="back-link">← Back to homepage</a>
  </div>
  
  <div class="footer-logo">SYNC<span>ORA</span></div>
  </body>
  </html>`);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.send('<h2>❌ Something went wrong. Please try again.</h2>');
  }
});

module.exports = router;
