// src/routes/auth.js
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { pool } = require('../db');
require('dotenv').config();

// ── Ensure users table exists ─────────────────────────────
const ensureUsersTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      full_name       VARCHAR(255) NOT NULL,
      email           VARCHAR(255) NOT NULL UNIQUE,
      company_name    VARCHAR(255) NOT NULL,
      password_hash   TEXT NOT NULL,
      verified        BOOLEAN DEFAULT FALSE,
      verify_token    TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
ensureUsersTable().catch(err => console.error('[USERS TABLE ERROR]', err.message));

// ── Register page ─────────────────────────────────────────
router.get('/register', (req, res) => {
  const error = req.query.error || '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Syncora — Create account</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);--t:#fff;--t2:rgba(255,255,255,.7);--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.08}
.orb1{width:500px;height:500px;background:var(--g);top:-150px;left:-150px}
.orb2{width:350px;height:350px;background:#7c3aed;bottom:-100px;right:-100px}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:80px 80px}
.card{position:relative;z-index:1;background:var(--bg2);border:1px solid var(--b1);border-radius:24px;padding:40px;max-width:460px;width:100%}
.card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.4),transparent)}
.logo{text-align:center;margin-bottom:28px}
.logo img{height:26px;width:auto;filter:brightness(0) invert(1) grayscale(1)}
h1{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;text-align:center}
.sub{font-size:13px;color:var(--t3);text-align:center;margin-bottom:28px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:7px}
.fg input{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:15px;color:var(--t);outline:none;font-family:'Inter',sans-serif;transition:all .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:var(--t4)}
.btn{width:100%;padding:13px;background:var(--g);color:#000;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;margin-top:4px}
.btn:hover{background:var(--gd);transform:translateY(-1px)}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;text-align:center}
.note{font-size:12px;color:var(--t4);text-align:center;margin-top:16px;line-height:1.6}
.note a{color:var(--g);text-decoration:none}
.divider{display:flex;align-items:center;gap:12px;margin:20px 0}
.divider span{font-size:12px;color:var(--t4)}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--b1)}
</style>
</head>
<body>
<div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
<div class="bg-grid"></div>
<div class="card">
  <div class="logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <h1>Create your account</h1>
  <p class="sub">Start connecting WhatsApp to Slack in minutes</p>
  ${error ? `<div class="err">${error}</div>` : ''}
  <form method="POST" action="/auth/register">
    <div class="fg"><label>Full name</label><input type="text" name="full_name" placeholder="Jane Smith" required autocomplete="name"/></div>
    <div class="fg"><label>Company name</label><input type="text" name="company_name" placeholder="Acme Corp" required autocomplete="organization"/></div>
    <div class="fg"><label>Work email</label><input type="email" name="email" placeholder="you@company.com" required autocomplete="email"/></div>
    <div class="fg"><label>Password</label><input type="password" name="password" placeholder="Minimum 8 characters" required minlength="8"/></div>
    <button type="submit" class="btn">Create account →</button>
  </form>
  <div class="divider"><span>already have an account?</span></div>
  <p class="note"><a href="/auth/login">Sign in →</a></p>
</div>
</div>

<footer style="position:relative;z-index:1;text-align:center;padding:32px 24px;margin-top:24px">
  <p style="font-size:13px;color:rgba(255,255,255,.25);line-height:1.8">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
    <a href="/privacy.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Privacy Policy</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/terms.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Terms of Service</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/impressum.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Impressum</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/contact.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Contact</a>
  </div>
</footer>
</body>
</html>`);
});

// ── Register POST ─────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { full_name, company_name, email, password } = req.body;

    if (!full_name || !company_name || !email || !password) {
      return res.redirect('/auth/register?error=All+fields+are+required');
    }
    if (password.length < 8) {
      return res.redirect('/auth/register?error=Password+must+be+at+least+8+characters');
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length) {
      return res.redirect('/auth/register?error=An+account+with+this+email+already+exists');
    }

    const password_hash = await bcrypt.hash(password, 12);
    const verify_token  = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO users (full_name, email, company_name, password_hash, verify_token)
       VALUES ($1, $2, $3, $4, $5)`,
      [full_name.trim(), email.trim().toLowerCase(), company_name.trim(), password_hash, verify_token]
    );
    // Remove from waitlist if exists
    await pool.query('DELETE FROM waitlist WHERE email = $1', [email.trim().toLowerCase()]);
     // Auto-verify user (skip email verification for now)
     await pool.query("UPDATE users SET verified = TRUE WHERE email = $1", [email.trim().toLowerCase()]);
     const newUser = await pool.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
     req.session.userId = newUser.rows[0].id;
     req.session.userName = newUser.rows[0].full_name;
     req.session.userEmail = newUser.rows[0].email;
     req.session.companyName = newUser.rows[0].company_name;
     res.redirect("/onboarding?email=" + encodeURIComponent(email.trim().toLowerCase()));
  } catch (err) {
    console.error('[REGISTER ERROR]', err.message);
    res.redirect('/auth/register?error=' + encodeURIComponent('Something went wrong — please try again'));
  }
});

// ── Verify email sent page ────────────────────────────────
router.get('/verify-sent', (req, res) => {
  const email = req.query.email || '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Syncora — Check your email</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--bg:#060608;--bg2:#111118;--b1:rgba(255,255,255,.06);--t:#fff;--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.08}
.orb1{width:500px;height:500px;background:var(--g);top:-150px;left:-150px}
.orb2{width:350px;height:350px;background:#7c3aed;bottom:-100px;right:-100px}
.card{position:relative;z-index:1;background:var(--bg2);border:1px solid var(--b1);border-radius:24px;padding:48px 40px;max-width:460px;width:100%;text-align:center}
.card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.4),transparent)}
.icon{font-size:48px;margin-bottom:20px}
h1{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:10px}
.sub{font-size:14px;color:var(--t3);line-height:1.7;margin-bottom:24px}
.email-box{background:#16161f;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 20px;font-size:14px;font-weight:600;color:var(--g);margin-bottom:24px}
.note{font-size:12px;color:var(--t4);line-height:1.6}
.note a{color:var(--g);text-decoration:none}
.logo img{height:22px;width:auto;filter:brightness(0) invert(1) grayscale(1);margin-bottom:28px}
</style>
</head>
<body>
<div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
<div class="card">
  <div class="logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <div class="icon">📧</div>
  <h1>Check your email</h1>
  <p class="sub">We've sent a verification link to:</p>
  <div class="email-box">${email}</div>
  <p class="sub">Click the link in the email to verify your account and continue to onboarding.</p>
  <p class="note">Didn't receive it? Check your spam folder or <a href="/auth/resend-verify?email=${encodeURIComponent(email)}">resend the email</a>.</p>
</div>


<footer style="position:relative;z-index:1;text-align:center;padding:32px 24px;margin-top:24px">
  <p style="font-size:13px;color:rgba(255,255,255,.25);line-height:1.8">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
    <a href="/privacy.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Privacy Policy</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/terms.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Terms of Service</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/impressum.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Impressum</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/contact.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Contact</a>
  </div>
</footer>
</body>
</html>`);
});

// ── Verify email token ────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect('/auth/register?error=Invalid+verification+link');

    const result = await pool.query(
      'UPDATE users SET verified = TRUE, verify_token = NULL WHERE verify_token = $1 RETURNING id, full_name, company_name, email',
      [token]
    );

    if (!result.rows.length) {
      return res.redirect('/auth/register?error=Verification+link+is+invalid+or+expired');
    }

    const user = result.rows[0];
    // Store user in session
    req.session.userId   = user.id;
    req.session.userName = user.full_name;
    req.session.userEmail = user.email;
    req.session.companyName = user.company_name;

    // Redirect to onboarding
    res.redirect('/dashboard');
  } catch (err) {
    console.error('[VERIFY ERROR]', err.message);
    res.redirect('/auth/register?error=Verification+failed+—+please+try+again');
  }
});

// ── Resend verification email ─────────────────────────────
router.get('/resend-verify', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.redirect('/auth/register');

    const newToken = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(
      'UPDATE users SET verify_token = $1 WHERE email = $2 AND verified = FALSE RETURNING full_name',
      [newToken, email.toLowerCase()]
    );

    if (result.rows.length) {
      try {
        const { sendVerificationEmail } = require('../services/emailService');
        await sendVerificationEmail({ to: email, fullName: result.rows[0].full_name, verifyToken: newToken });
      } catch (e) { console.error('[RESEND VERIFY ERROR]', e.message); }
    }

    res.redirect('/auth/verify-sent?email=' + encodeURIComponent(email));
  } catch (err) {
    res.redirect('/auth/register?error=Could+not+resend+email');
  }
});

// ── Login page ────────────────────────────────────────────
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Syncora — Sign in</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--t:#fff;--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.08}
.orb1{width:500px;height:500px;background:var(--g);top:-150px;left:-150px}
.orb2{width:350px;height:350px;background:#7c3aed;bottom:-100px;right:-100px}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:80px 80px}
.card{position:relative;z-index:1;background:var(--bg2);border:1px solid var(--b1);border-radius:24px;padding:40px;max-width:420px;width:100%}
.card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.4),transparent)}
.logo{text-align:center;margin-bottom:28px}
.logo img{height:26px;width:auto;filter:brightness(0) invert(1) grayscale(1)}
h1{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;text-align:center}
.sub{font-size:13px;color:var(--t3);text-align:center;margin-bottom:28px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:7px}
.fg input{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:15px;color:var(--t);outline:none;font-family:'Inter',sans-serif;transition:all .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:var(--t4)}
.btn{width:100%;padding:13px;background:var(--g);color:#000;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;margin-top:4px}
.btn:hover{background:var(--gd);transform:translateY(-1px)}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#f87171;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:16px;text-align:center}
.note{font-size:12px;color:var(--t4);text-align:center;margin-top:16px;line-height:1.6}
.note a{color:var(--g);text-decoration:none}
.divider{display:flex;align-items:center;gap:12px;margin:20px 0}
.divider span{font-size:12px;color:var(--t4)}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--b1)}
</style>
</head>
<body>
<div class="bg-orbs"><div class="orb orb1"></div><div class="orb orb2"></div></div>
<div class="bg-grid"></div>
<div class="card">
  <div class="logo"><img src="/logo_text.png" alt="Syncora"/></div>
  <h1>Welcome back</h1>
  <p class="sub">Sign in to your Syncora account</p>
  ${error ? `<div class="err">${error}</div>` : ''}
  <form method="POST" action="/auth/login">
    <div class="fg"><label>Email</label><input type="email" name="email" placeholder="you@company.com" required autocomplete="email"/></div>
    <div class="fg"><label>Password</label><input type="password" name="password" placeholder="Your password" required/></div>
    <button type="submit" class="btn">Sign in →</button>
  </form>
  <div class="divider"><span>don't have an account?</span></div>
  <p class="note"><a href="/auth/register">Create account →</a></p>
</div>


<footer style="position:relative;z-index:1;text-align:center;padding:32px 24px;margin-top:24px">
  <p style="font-size:13px;color:rgba(255,255,255,.25);line-height:1.8">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
    <a href="/privacy.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Privacy Policy</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/terms.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Terms of Service</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/impressum.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Impressum</a>
    <span style="color:rgba(255,255,255,.15)">·</span>
    <a href="/contact.html" style="color:rgba(255,255,255,.4);text-decoration:none;font-size:12px;padding:5px 12px;border:1px solid rgba(255,255,255,.08);border-radius:100px;transition:color .2s" onmouseover="this.style.color='#25D366';this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.color='rgba(255,255,255,.4)';this.style.borderColor='rgba(255,255,255,.08)'">Contact</a>
  </div>
</footer>

</body>
</html>`);
});

// ── Login POST ────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.redirect('/auth/login?error=Please+fill+in+all+fields');

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!result.rows.length) return res.redirect('/auth/login?error=Invalid+email+or+password');

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.redirect('/auth/login?error=Invalid+email+or+password');

    if (!user.verified) {
      return res.redirect('/auth/verify-sent?email=' + encodeURIComponent(user.email));
    }

    req.session.userId      = user.id;
    req.session.userName    = user.full_name;
    req.session.userEmail   = user.email;
    req.session.companyName = user.company_name;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    res.redirect('/auth/login?error=Something+went+wrong+—+please+try+again');
  }
});

// ── Slack OAuth — Step 1 ──────────────────────────────────
router.get('/slack', (req, res) => {
  const companyName = req.query.company || req.session.companyName || 'Unknown Company';
  const email       = req.query.email   || req.session.userEmail   || '';

  const scopes = [
    'channels:manage','channels:read','channels:history',
    'chat:write','files:write','files:read',
    'im:write','groups:write','groups:read','groups:history',
    'users:read','users:read.email',
  ].join(',');
  const url = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.APP_URL}/auth/slack/callback&state=${state}`;
  res.redirect(url);
});

// ── Slack OAuth — Step 2 callback ─────────────────────────
router.get('/slack/callback', async (req, res) => {
  try {
    const { code, error, state } = req.query;

    if (error) return res.send(`<h2>❌ Authorization denied: ${error}</h2>`);
    if (!code)  return res.send('<h2>❌ No code received from Slack</h2>');

    let companyName = 'Unknown Company';
    let email = '';
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      companyName = decoded.companyName || 'Unknown Company';
      email       = decoded.email || '';
    } catch (e) { console.log('Could not decode state:', e.message); }

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

    const existing = await pool.query('SELECT id FROM tenants WHERE slack_team_id = $1', [teamId]);

    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE tenants SET slack_bot_token = $1, slack_team_name = $2, company_name = $3, email = COALESCE(NULLIF($4,\'\'), email) WHERE slack_team_id = $5',
        [botToken, teamName, companyName, email, teamId]
      );
    } else {
      await pool.query(
        `INSERT INTO tenants (company_name, email, twilio_number, slack_bot_token, slack_team_id, slack_team_name, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [companyName, email || null, 'PENDING', botToken, teamId, teamName]
      );
    }

        return res.redirect('/dashboard');

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
:root{--g:#25D366;--bg:#060608;--bg2:#111118;--b1:rgba(255,255,255,.06);--t:#fff;--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2)}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.bg-orbs{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.08}
.orb1{width:500px;height:500px;background:var(--g);top:-150px;left:-150px}
.orb2{width:350px;height:350px;background:#7c3aed;bottom:-100px;right:-100px}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:80px 80px}
.card{position:relative;z-index:1;background:var(--bg2);border:1px solid var(--b1);border-radius:24px;padding:48px 40px;max-width:520px;width:100%;text-align:center}
.card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(37,211,102,.5),transparent)}
.check-wrap{width:72px;height:72px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;position:relative}
.check-wrap::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(37,211,102,.1)}
.check{font-size:32px}
.logo-text{font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:16px}
h1{font-size:28px;font-weight:900;letter-spacing:-1px;margin-bottom:10px}
.subtitle{font-size:15px;color:rgba(255,255,255,.5);line-height:1.6;margin-bottom:32px}
.info-box{background:#16161f;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px;margin-bottom:28px;text-align:left}
.info-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0}
.info-row:not(:last-child){border-bottom:1px solid rgba(255,255,255,.05)}
.info-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.3)}
.info-value{font-size:14px;font-weight:600;color:rgba(255,255,255,.85)}
.steps{text-align:left;margin-bottom:32px}
.steps-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.3);margin-bottom:14px}
.step{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.step-num{width:22px;height:22px;background:var(--g);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#000;flex-shrink:0;margin-top:1px}
.step-text{font-size:14px;color:rgba(255,255,255,.6);line-height:1.5}
.step-text strong{color:rgba(255,255,255,.9)}
.pending-badge{display:inline-flex;align-items:center;gap:7px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:#fbbf24;padding:8px 16px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:24px}
.pending-dot{width:6px;height:6px;background:#fbbf24;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.back-link{font-size:13px;color:rgba(255,255,255,.3);text-decoration:none;transition:color .2s}
.back-link:hover{color:rgba(255,255,255,.6)}
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
    <div class="info-row"><span class="info-label">Company</span><span class="info-value">${companyName}</span></div>
    <div class="info-row"><span class="info-label">Slack workspace</span><span class="info-value">${teamName}</span></div>
    <div class="info-row"><span class="info-label">Status</span><span style="background:rgba(245,158,11,.1);color:#fbbf24;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)">Pending activation</span></div>
  </div>
  <div class="pending-badge"><span class="pending-dot"></span>Awaiting admin activation</div>
  <div class="steps">
    <div class="steps-title">What happens next</div>
    <div class="step"><div class="step-num">1</div><div class="step-text">Our team reviews your registration and <strong>assigns your WhatsApp number</strong></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">You receive an <strong>activation email</strong> with your unique claim code</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">Share your WhatsApp number with customers — <strong>messages appear in Slack instantly</strong></div></div>
  </div>
  <a href="/" class="back-link">← Back to homepage</a>
</div>
</body>
</html>`);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.send('<h2>❌ Something went wrong. Please try again.</h2>');
  }
});

module.exports = router;
