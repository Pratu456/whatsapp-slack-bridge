// src/routes/onboarding.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
require('dotenv').config();

// Main onboarding page
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp ↔ Slack Bridge — Get Started</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f0fff4; min-height: 100vh; }

        /* HEADER */
        .header { background: #25D366; padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
        .header h1 { color: white; font-size: 22px; }
        .header span { color: rgba(255,255,255,0.8); font-size: 14px; }

        /* HERO */
        .hero { text-align: center; padding: 60px 24px 40px; }
        .hero h2 { font-size: 36px; color: #1a1a2e; margin-bottom: 12px; }
        .hero p { font-size: 18px; color: #555; max-width: 560px; margin: 0 auto; }

        /* HOW IT WORKS */
        .steps { display: flex; justify-content: center; gap: 24px; padding: 40px 24px; flex-wrap: wrap; }
        .step { background: white; border-radius: 12px; padding: 28px 24px; width: 220px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .step .icon { font-size: 36px; margin-bottom: 12px; }
        .step h3 { color: #1a1a2e; font-size: 16px; margin-bottom: 8px; }
        .step p { color: #777; font-size: 13px; line-height: 1.5; }
        .step .num { background: #25D366; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; margin: 0 auto 12px; }

        /* FORM */
        .form-section { max-width: 520px; margin: 0 auto; padding: 0 24px 60px; }
        .card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        .card h3 { font-size: 22px; color: #1a1a2e; margin-bottom: 8px; }
        .card p { color: #777; font-size: 14px; margin-bottom: 28px; }
        label { display: block; font-size: 14px; font-weight: bold; color: #333; margin-bottom: 6px; }
        input[type="text"], input[type="email"] {
          width: 100%; padding: 12px 16px; border: 1.5px solid #ddd;
          border-radius: 8px; font-size: 15px; margin-bottom: 20px;
          transition: border-color 0.2s;
        }
        input:focus { outline: none; border-color: #25D366; }
        .btn-slack {
          width: 100%; padding: 14px; background: #25D366; color: white;
          border: none; border-radius: 8px; font-size: 16px; font-weight: bold;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 10px; transition: background 0.2s;
        }
        .btn-slack:hover { background: #1da851; }
        .btn-slack:disabled { background: #aaa; cursor: not-allowed; }
        .note { font-size: 12px; color: #aaa; text-align: center; margin-top: 16px; }

        /* FEATURES */
        .features { background: white; padding: 48px 24px; }
        .features h2 { text-align: center; color: #1a1a2e; margin-bottom: 32px; font-size: 24px; }
        .features-grid { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; max-width: 900px; margin: 0 auto; }
        .feature { text-align: center; width: 180px; }
        .feature .icon { font-size: 32px; margin-bottom: 8px; }
        .feature p { font-size: 13px; color: #555; }

        /* FOOTER */
        .footer { text-align: center; padding: 24px; color: #aaa; font-size: 13px; }
      </style>
    </head>
    <body>

      <!-- HEADER -->
      <div class="header">
        <h1>📱 WhatsApp ↔ Slack Bridge</h1>
        <span>Connect your team in seconds</span>
      </div>

      <!-- HERO -->
      <div class="hero">
        <h2>Your clients on WhatsApp.</h2>
        <h2>Your team on Slack.</h2>
        <br>
        <p>The bridge connects both worlds — no new apps, no onboarding friction, no switching tools.</p>
      </div>

      <!-- HOW IT WORKS -->
      <div class="steps">
        <div class="step">
          <div class="num">1</div>
          <div class="icon">🏢</div>
          <h3>Enter your details</h3>
          <p>Tell us your company name and email address.</p>
        </div>
        <div class="step">
          <div class="num">2</div>
          <div class="icon">💜</div>
          <h3>Connect Slack</h3>
          <p>Authorize the bridge to post messages to your Slack workspace.</p>
        </div>
        <div class="step">
          <div class="num">3</div>
          <div class="icon">📞</div>
          <h3>Get your WhatsApp number</h3>
          <p>We assign you a dedicated WhatsApp number for your clients.</p>
        </div>
        <div class="step">
          <div class="num">4</div>
          <div class="icon">🚀</div>
          <h3>Go live</h3>
          <p>Your clients message on WhatsApp. Your team replies in Slack.</p>
        </div>
      </div>

      <!-- SIGNUP FORM -->
      <div class="form-section">
        <div class="card">
          <h3>Get Started Free</h3>
          <p>Connect your Slack workspace to get started in under 2 minutes.</p>

          <label for="company">Company Name</label>
          <input type="text" id="company" placeholder="e.g. Acme Corp" />

          <label for="email">Work Email</label>
          <input type="email" id="email" placeholder="you@company.com" />

          <button class="btn-slack" id="connectBtn" onclick="connectSlack()">
            <span>🔗</span>
            <span>Connect Slack Workspace</span>
          </button>

          <p class="note">By connecting, you agree to our Terms of Service. We never share your data.</p>
        </div>
      </div>

      <!-- FEATURES -->
      <div class="features">
        <h2>Everything your team needs</h2>
        <div class="features-grid">
          <div class="feature"><div class="icon">⚡</div><p>Real-time message sync</p></div>
          <div class="feature"><div class="icon">🖼️</div><p>Images, PDFs & voice notes</p></div>
          <div class="feature"><div class="icon">📊</div><p>Message status tracking</p></div>
          <div class="feature"><div class="icon">🔒</div><p>Fully isolated per company</p></div>
          <div class="feature"><div class="icon">🚫</div><p>Block & unblock contacts</p></div>
          <div class="feature"><div class="icon">📋</div><p>Full message history</p></div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="footer">
        <p>WhatsApp ↔ Slack Bridge &nbsp;|&nbsp; Secure &nbsp;|&nbsp; GDPR Compliant &nbsp;|&nbsp; EU Hosted</p>
      </div>

      <script>
        function connectSlack() {
          const company = document.getElementById('company').value.trim();
          const email   = document.getElementById('email').value.trim();

          if (!company) {
            alert('Please enter your company name.');
            return;
          }
          if (!email || !email.includes('@')) {
            alert('Please enter a valid work email.');
            return;
          }

          const btn = document.getElementById('connectBtn');
          btn.disabled = true;
          btn.innerHTML = '<span>⏳</span><span>Connecting...</span>';

          // Save to sessionStorage and redirect to Slack OAuth
          sessionStorage.setItem('company', company);
          sessionStorage.setItem('email', email);

          window.location.href = '/auth/slack?company=' + encodeURIComponent(company) + '&email=' + encodeURIComponent(email);
        }
      </script>
    </body>
    </html>
  `);
});

// Status page — show all active tenants (admin only)
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, company_name, twilio_number, slack_team_name, is_active, created_at
       FROM tenants ORDER BY created_at DESC`
    );

    const rows = result.rows.map(t => `
      <tr>
        <td>${t.id}</td>
        <td><strong>${t.company_name}</strong></td>
        <td>${t.twilio_number}</td>
        <td>${t.slack_team_name}</td>
        <td>${t.is_active ? '✅ Active' : '⏳ Pending'}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tenant Status</title>
        <style>
          body { font-family: Arial; padding: 32px; background: #f0fff4; }
          h1 { color: #25D366; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
          th { background: #25D366; color: white; padding: 12px 16px; text-align: left; }
          td { padding: 12px 16px; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) td { background: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>📊 Tenant Status</h1>
        <table>
          <thead><tr><th>ID</th><th>Company</th><th>Twilio Number</th><th>Slack Workspace</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (err) {
    res.send('<h2>Error loading tenants</h2>');
  }
});

module.exports = router;