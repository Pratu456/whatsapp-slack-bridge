// src/routes/onboarding.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
require('dotenv').config();

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Syncora — Get Started</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);--t:#fff;--t2:rgba(255,255,255,.7);--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2)}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.1}
.orb1{width:600px;height:600px;background:var(--g);top:-200px;left:-200px;animation:drift 20s ease-in-out infinite}
.orb2{width:400px;height:400px;background:#7c3aed;bottom:-100px;right:-100px;animation:drift 26s ease-in-out infinite reverse}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:80px 80px}
nav{position:fixed;top:0;left:0;right:0;z-index:100;height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 40px;background:rgba(6,6,8,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--b1)}
.nav-logo img{height:28px;width:auto;filter:brightness(0) invert(1)}
.wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:100px 24px 60px}
.hero-logo{margin-bottom:24px;text-align:center}
.hero-logo img{height:72px;width:auto;filter:brightness(0) invert(1)}
.hero-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:var(--g);padding:6px 16px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:20px;letter-spacing:.5px}
.badge-dot{width:6px;height:6px;background:var(--g);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.4)}70%{box-shadow:0 0 0 6px rgba(37,211,102,0)}}
.hero-title{font-size:clamp(32px,5vw,56px);font-weight:900;line-height:1.05;letter-spacing:-2px;margin-bottom:14px;text-align:center}
.hero-title span{color:var(--g)}
.hero-sub{font-size:15px;color:var(--t2);max-width:460px;margin:0 auto 40px;line-height:1.7;text-align:center}
.form-card{background:var(--bg2);border:1px solid var(--b1);border-radius:20px;padding:36px;width:100%;max-width:460px;position:relative;overflow:hidden}
.form-card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.4),transparent)}
.form-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--g);margin-bottom:6px;text-align:center;display:block}
.form-title{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;text-align:center}
.form-sub{font-size:13px;color:var(--t3);margin-bottom:28px;text-align:center}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:7px}
.fg input{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:15px;color:var(--t);outline:none;font-family:'Inter',sans-serif;transition:all .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:var(--t4)}
.btn-connect{width:100%;padding:14px;background:var(--g);color:#000;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px}
.btn-connect:hover{background:var(--gd);transform:translateY(-1px);box-shadow:0 8px 24px rgba(37,211,102,.25)}
.btn-connect:disabled{background:rgba(255,255,255,.1);color:rgba(255,255,255,.3);cursor:not-allowed;transform:none;box-shadow:none}
.form-note{font-size:12px;color:var(--t4);text-align:center;margin-top:16px;line-height:1.6}
footer{position:relative;z-index:1;text-align:center;padding:32px 24px;border-top:1px solid var(--b1);background:var(--bg)}
.footer-logo img{height:18px;width:auto;opacity:.7;margin-bottom:12px}
footer p{font-size:13px;color:var(--t4);line-height:1.8}
@media(max-width:480px){nav{padding:0 20px}.form-card{padding:24px}.hero-title{font-size:28px}}
</style>
</head>
<body>
<div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
<div class="bg-grid"></div>

<nav>
  <div class="nav-logo"><img src="/logo_text.png" alt="Syncora"/></div>
</nav>

<div class="wrap">
<div class="hero-logo"><img src="/logo_text.png" alt="Syncora" style="height:28px;width:auto;filter:brightness(0) invert(1)"/></div>
  <div class="hero-badge"><span class="badge-dot"></span>Free to get started</div>
  <h1 class="hero-title">WhatsApp messages.<br/><span>Right in Slack.</span></h1>
  <p class="hero-sub">Customers message you on WhatsApp. Your team replies from Slack — no app switching, no missed conversations, ever.</p>

  <div class="form-card">
    <span class="form-label">Get started</span>
    <div class="form-title">Connect your workspace</div>
    <p class="form-sub">Takes under 2 minutes. No credit card required.</p>
    <div class="fg"><label>Company name</label><input type="text" id="company" placeholder="e.g. Acme Corp" autocomplete="organization"/></div>
    <div class="fg"><label>Work email</label><input type="email" id="email" placeholder="you@company.com" autocomplete="email"/></div>
    <button class="btn-connect" id="connectBtn" onclick="connectSlack()"><span>🔗</span><span>Connect Slack Workspace</span></button>
    <p class="form-note">By connecting you agree to our <a href="/terms.html" style="color:var(--g);text-decoration:none">Terms of Service</a>.<br/>We never share your data with third parties.</p>
  </div>
</div>

<footer>
  <div class="footer-logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <p>© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  <p>Secure · GDPR Compliant</p>
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;flex-wrap:wrap">
    <a href="/privacy.html" style="color:rgba(255,255,255,.55);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border:1px solid rgba(255,255,255,.1);border-radius:100px;background:rgba(255,255,255,.03)" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.4)'" onmouseout="this.style.color='rgba(255,255,255,.55)';this.style.borderColor='rgba(255,255,255,.1)'">Privacy Policy</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/terms.html" style="color:rgba(255,255,255,.55);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border:1px solid rgba(255,255,255,.1);border-radius:100px;background:rgba(255,255,255,.03)" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.4)'" onmouseout="this.style.color='rgba(255,255,255,.55)';this.style.borderColor='rgba(255,255,255,.1)'">Terms of Service</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/impressum.html" style="color:rgba(255,255,255,.55);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border:1px solid rgba(255,255,255,.1);border-radius:100px;background:rgba(255,255,255,.03)" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.4)'" onmouseout="this.style.color='rgba(255,255,255,.55)';this.style.borderColor='rgba(255,255,255,.1)'">Impressum</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/contact.html" style="color:rgba(255,255,255,.55);text-decoration:none;font-size:13px;font-weight:500;padding:6px 14px;border:1px solid rgba(255,255,255,.1);border-radius:100px;background:rgba(255,255,255,.03)" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.4)'" onmouseout="this.style.color='rgba(255,255,255,.55)';this.style.borderColor='rgba(255,255,255,.1)'">Contact</a>
  </div>
</footer>

<script>
function connectSlack(){
  const company=document.getElementById('company').value.trim();
  const email=document.getElementById('email').value.trim();
  if(!company){document.getElementById('company').focus();return}
  if(!email||!email.includes('@')){document.getElementById('email').focus();return}
  const btn=document.getElementById('connectBtn');
  btn.disabled=true;btn.innerHTML='<span>⏳</span><span>Connecting to Slack...</span>';
  sessionStorage.setItem('company',company);sessionStorage.setItem('email',email);
  window.location.href='/auth/slack?company='+encodeURIComponent(company)+'&email='+encodeURIComponent(email);
}
</script>
</body>
</html>`);
});

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, company_name, twilio_number, slack_team_name, is_active, created_at FROM tenants ORDER BY created_at DESC');
    const rows = result.rows.map(t => `<tr><td>${t.id}</td><td><strong>${t.company_name}</strong></td><td>${t.twilio_number}</td><td>${t.slack_team_name}</td><td>${t.is_active?'✅ Active':'⏳ Pending'}</td><td>${new Date(t.created_at).toLocaleDateString()}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><title>Syncora — Tenant Status</title><link rel="icon" type="image/png" href="/logo.png"/><style>body{font-family:Arial;padding:32px;background:#060608;color:#fff}h1{color:#25D366;margin-bottom:24px}table{width:100%;border-collapse:collapse;background:#111118;border-radius:8px;overflow:hidden}th{background:#25D366;color:#000;padding:12px 16px;text-align:left}td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.7)}</style></head><body><h1>Syncora — Tenant Status</h1><table><thead><tr><th>ID</th><th>Company</th><th>Twilio Number</th><th>Slack Workspace</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  } catch(err){ res.send('<h2>Error</h2>'); }
});

module.exports = router;