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
.nav-cta{background:var(--g);color:#000;padding:8px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;transition:all .2s}
.nav-cta:hover{background:var(--gd);transform:translateY(-1px)}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:100px 24px 60px;position:relative;z-index:1}
.hero-logo{margin-bottom:32px}
.hero-logo img{height:80px;width:auto;filter:brightness(0) invert(1)}
.hero-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:var(--g);padding:6px 16px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:24px;letter-spacing:.5px}
.badge-dot{width:6px;height:6px;background:var(--g);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.4)}70%{box-shadow:0 0 0 6px rgba(37,211,102,0)}}
.hero h1{font-size:clamp(36px,6vw,72px);font-weight:900;line-height:1.0;letter-spacing:-3px;margin-bottom:20px}
.hero h1 span{color:var(--g)}
.hero-sub{font-size:clamp(15px,2vw,18px);color:var(--t2);max-width:500px;margin:0 auto 0;
.scroll-hint{margin-top:40px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--t4);font-size:12px}
.scroll-line{width:1px;height:40px;background:linear-gradient(var(--g),transparent);animation:scrollFade 2s ease-in-out infinite}
@keyframes scrollFade{0%,100%{opacity:.3}50%{opacity:1}}
.steps-section{padding:80px 24px;position:relative;z-index:1}
.section-label{text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--g);margin-bottom:16px}
.section-title{text-align:center;font-size:clamp(24px,3.5vw,38px);font-weight:800;letter-spacing:-1.5px;margin-bottom:48px}
.steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:1000px;margin:0 auto}
.step-card{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:24px;position:relative;overflow:hidden;transition:border-color .2s,transform .2s}
.step-card:hover{border-color:rgba(37,211,102,.2);transform:translateY(-3px)}
.step-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.step-card:nth-child(1)::before{background:linear-gradient(90deg,var(--g),transparent)}
.step-card:nth-child(2)::before{background:linear-gradient(90deg,#3b82f6,transparent)}
.step-card:nth-child(3)::before{background:linear-gradient(90deg,#8b5cf6,transparent)}
.step-card:nth-child(4)::before{background:linear-gradient(90deg,#f59e0b,transparent)}
.step-num{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--t4);margin-bottom:16px}
.step-icon{font-size:28px;margin-bottom:12px}
.step-title{font-size:15px;font-weight:700;color:var(--t);margin-bottom:8px}
.step-desc{font-size:13px;color:var(--t3);line-height:1.6}
.form-section{padding:0 24px 60px;position:relative;z-index:1}
.form-wrap{max-width:520px;margin:0 auto}
.form-label{text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:var(--g);margin-bottom:16px}
.form-title{text-align:center;font-size:clamp(24px,3vw,34px);font-weight:800;letter-spacing:-1.5px;margin-bottom:8px}
.form-sub{text-align:center;font-size:15px;color:var(--t3);margin-bottom:36px;line-height:1.6}
.form-card{background:var(--bg2);border:1px solid var(--b1);border-radius:20px;padding:36px;position:relative;overflow:hidden}
.form-card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.4),transparent)}
.fg{margin-bottom:18px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:7px}
.fg input{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:15px;color:var(--t);outline:none;font-family:'Inter',sans-serif;transition:all .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:var(--t4)}
.btn-connect{width:100%;padding:14px;background:var(--g);color:#000;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:8px}
.btn-connect:hover{background:var(--gd);transform:translateY(-1px);box-shadow:0 8px 24px rgba(37,211,102,.25)}
.btn-connect:disabled{background:rgba(255,255,255,.1);color:rgba(255,255,255,.3);cursor:not-allowed;transform:none;box-shadow:none}
.form-note{font-size:12px;color:var(--t4);text-align:center;margin-top:16px;line-height:1.6}
.features-section{padding:80px 24px;position:relative;z-index:1;background:var(--bg1);border-top:1px solid var(--b1);border-bottom:1px solid var(--b1)}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:760px;margin:0 auto}
.feature-item{background:var(--bg2);border:1px solid var(--b1);border-radius:14px;padding:20px;display:flex;align-items:flex-start;gap:14px}
.feature-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.15)}
.feature-text{font-size:13px;font-weight:600;color:var(--t2);line-height:1.4}
footer{padding:28px 40px;border-top:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;position:relative;z-index:1}
.footer-logo img{height:22px;width:auto;filter:brightness(0) invert(1)}
footer p{font-size:12px;color:var(--t4)}
@media(max-width:768px){nav{padding:0 20px}.steps-grid{grid-template-columns:1fr 1fr}.features-grid{grid-template-columns:1fr 1fr}.form-card{padding:24px}footer{padding:20px}}
@media(max-width:480px){.steps-grid{grid-template-columns:1fr}.features-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
<div class="bg-grid"></div>
<nav>
  <div class="nav-logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <a href="#form" class="nav-cta">Get started →</a>
</nav>
<section class="hero">
  <div class="hero-logo"><img src="/logo_full.png" alt="Syncora"/></div>
  <div class="hero-badge"><span class="badge-dot"></span>Free to get started</div>
  <h1>WhatsApp messages.<br/><span>Right in Slack.</span></h1>
</section>

 
<section class="form-section" id="form">
  <div class="form-wrap">
    <div class="form-title">Connect your workspace</div>
    <p class="form-sub">Takes under 2 minutes. No credit card required.</p>
    <div class="form-card">
      <div class="fg"><label>Company name</label><input type="text" id="company" placeholder="e.g. Acme Corp" autocomplete="organization"/></div>
      <div class="fg"><label>Work email</label><input type="email" id="email" placeholder="you@company.com" autocomplete="email"/></div>
      <button class="btn-connect" id="connectBtn" onclick="connectSlack()"><span>🔗</span><span>Connect Slack Workspace</span></button>
      <p class="form-note">By connecting you agree to our Terms of Service.<br/>We never share your data with third parties.</p>
    </div>
  </div>
</section>
<section class="features-section">
  <div class="section-label" style="margin-bottom:16px">What you get</div>
  <div class="section-title" style="margin-bottom:36px;font-size:clamp(20px,3vw,30px)">Everything your team needs</div>
  <div class="features-grid">
    <div class="feature-item"><div class="feature-icon">⚡</div><div class="feature-text">Real-time message 
    </div></div>
    <div class="feature-item"><div class="feature-icon">🖼️</div><div class="feature-text">Images, PDFs & voice notes</div></div>
    <div class="feature-item"><div class="feature-icon">📊</div><div class="feature-text">Message status tracking</div></div>
    <div class="feature-item"><div class="feature-icon">🔒</div><div class="feature-text">Fully isolated per company</div></div>
    <div class="feature-item"><div class="feature-icon">🚫</div><div class="feature-text">Block & unblock contacts</div></div>
    <div class="feature-item"><div class="feature-icon">📋</div><div class="feature-text">Full message history</div></div>
  </div>
</section>
<footer>
  <div class="footer-logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <p>© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  <p>Secure · GDPR Compliant · EU Hosted</p>
</footer>
<script>
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{e.preventDefault();const t=document.querySelector(a.getAttribute('href'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'})});
});
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