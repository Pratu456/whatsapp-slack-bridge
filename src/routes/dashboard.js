// src/routes/dashboard.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const PLANS = {
  starter:  { label: 'Starter',  price: '€0',  msgLimit: 200, workspaces: 1,   color: 'rgba(255,255,255,.4)' },
  pro:      { label: 'Pro',      price: '€29', msgLimit: -1,  workspaces: 3,   color: '#25D366' },
  business: { label: 'Business', price: '€79', msgLimit: -1,  workspaces: 999, color: '#60a5fa' },
};

// ── Auth middleware ───────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  res.redirect('/auth/login');
};

// ── Dashboard home ────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) { req.session.destroy(); return res.redirect('/auth/login'); }
    const user = userResult.rows[0];

    // Get all tenants for this user by email
    const tenantsResult = await pool.query(
      'SELECT * FROM tenants WHERE LOWER(email) = $1 ORDER BY created_at ASC',
      [user.email.toLowerCase()]
    );
    const tenants = tenantsResult.rows;

    // Get message counts per tenant (today + total)
    const statsPromises = tenants.map(t => Promise.all([
      pool.query("SELECT COUNT(*) as total FROM messages WHERE tenant_id = $1", [t.id]),
      pool.query("SELECT COUNT(*) as today FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'", [t.id]),
    ]));
    const statsResults = await Promise.all(statsPromises);

    const plan = (tenants[0] && tenants[0].plan) ? tenants[0].plan : 'starter';
    const planInfo = PLANS[plan] || PLANS.starter;
    const maxWorkspaces = planInfo.workspaces;
    const canAddWorkspace = tenants.length < maxWorkspaces;

    // Build tenant cards HTML
    const workspaceCards = tenants.length === 0
      ? `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;background:#0c0c12;border:1px dashed rgba(255,255,255,.08);border-radius:16px">
          <div style="font-size:32px;margin-bottom:12px">🔗</div>
          <div style="font-size:15px;font-weight:600;color:rgba(255,255,255,.5);margin-bottom:8px">No workspaces connected</div>
          <div style="font-size:13px;color:rgba(255,255,255,.25);margin-bottom:20px">Connect your first Slack workspace to get started</div>
          <a href="/onboarding" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#000;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none">Connect Slack →</a>
        </div>`
      : tenants.map((t, i) => {
          const total = parseInt(statsResults[i][0].rows[0].total);
          const today = parseInt(statsResults[i][1].rows[0].today);
          const msgLimit = planInfo.msgLimit;
          const usagePct = msgLimit > 0 ? Math.min(100, Math.round((today / msgLimit) * 100)) : 0;
          const barColor = usagePct > 80 ? '#f87171' : usagePct > 60 ? '#fbbf24' : '#25D366';

          return `
          <div style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:22px;position:relative;overflow:hidden;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(37,211,102,.2)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)'">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#25D366,transparent)"></div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:38px;height:38px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#25D366">${t.company_name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style="font-size:14px;font-weight:700;color:#fff">${t.slack_team_name || t.company_name}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,.3)">Slack workspace</div>
                </div>
              </div>
              ${t.is_active
                ? '<span style="background:rgba(37,211,102,.1);color:#4ade80;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(37,211,102,.2)">Active</span>'
                : '<span style="background:rgba(245,158,11,.1);color:#fbbf24;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)">Pending</span>'}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
              <div style="background:#16161f;border-radius:10px;padding:12px">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:4px">Total messages</div>
                <div style="font-size:22px;font-weight:800;color:#fff">${total.toLocaleString()}</div>
              </div>
              <div style="background:#16161f;border-radius:10px;padding:12px">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:4px">Today</div>
                <div style="font-size:22px;font-weight:800;color:#25D366">${today}</div>
              </div>
            </div>

            ${msgLimit > 0 ? `
            <div style="margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.3);margin-bottom:6px">
                <span>Daily usage</span><span>${today} / ${msgLimit}</span>
              </div>
              <div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${usagePct}%;background:${barColor};border-radius:2px;transition:width .3s"></div>
              </div>
            </div>` : ''}

            ${t.claim_code ? `
            <div style="background:#16161f;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.25);margin-bottom:3px">Claim code</div>
                <div style="font-size:16px;font-weight:800;color:#25D366;letter-spacing:3px;font-family:monospace">${t.claim_code}</div>
              </div>
              <button onclick="copyCode('${t.claim_code}')" style="background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);padding:6px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif" id="copy-${t.claim_code}">Copy</button>
            </div>` : `
            <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#fbbf24">
              ⏳ Awaiting activation — our team will assign your WhatsApp number shortly
            </div>`}

            ${t.twilio_number && t.twilio_number !== 'PENDING' ? `
            <div style="font-size:12px;color:rgba(255,255,255,.3)">📱 WhatsApp: <span style="color:rgba(255,255,255,.6);font-weight:600">${t.twilio_number}</span></div>` : ''}
          </div>`;
        }).join('');

    const upgradeBanner = plan === 'starter' ? `
      <div style="background:linear-gradient(135deg,rgba(37,211,102,.08),rgba(96,165,250,.06));border:1px solid rgba(37,211,102,.15);border-radius:16px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
        <div>
          <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px">🚀 Upgrade to Pro</div>
          <div style="font-size:13px;color:rgba(255,255,255,.4)">Get unlimited messages, 3 workspaces and priority support for €29/mo</div>
        </div>
        <a href="/#pricing" style="background:#25D366;color:#000;padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap">View plans →</a>
      </div>` : '';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>Dashboard — Syncora</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);--t:#fff;--t2:rgba(255,255,255,.7);--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2);--sidebar:240px;--topbar:60px}
html,body{height:100%}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);display:flex;-webkit-font-smoothing:antialiased}
.sidebar{width:var(--sidebar);min-height:100vh;background:var(--bg1);border-right:1px solid var(--b1);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100}
.sb-top{padding:20px 18px;border-bottom:1px solid var(--b1)}
.sb-nav{padding:12px 10px;flex:1}
.sb-section{font-size:10px;font-weight:700;color:var(--t4);letter-spacing:2px;text-transform:uppercase;padding:14px 8px 6px}
.sb-link{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;color:var(--t3);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:2px;text-decoration:none}
.sb-link:hover{background:var(--b1);color:var(--t2)}
.sb-link.on{background:rgba(37,211,102,.1);color:var(--g)}
.sb-icon{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.sb-bottom{padding:16px 18px;border-top:1px solid var(--b1)}
.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{height:var(--topbar);background:var(--bg1);border-bottom:1px solid var(--b1);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.content{padding:28px;flex:1;max-width:1200px;width:100%}
.page-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
.page-sub{font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px}
.card{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:24px;margin-bottom:20px}
.card-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.section-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ws-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px}
.plan-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.3);margin-bottom:6px}
.fg input{width:100%;padding:11px 14px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:14px;color:#fff;outline:none;font-family:'Inter',sans-serif;transition:border-color .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:rgba(255,255,255,.2)}
.fg input:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:var(--g);color:#000;padding:10px 20px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-primary:hover{background:var(--gd);transform:translateY(-1px)}
.btn-ghost{background:rgba(255,255,255,.04);color:rgba(255,255,255,.6);padding:10px 20px;border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-ghost:hover{background:rgba(255,255,255,.08)}
.btn-danger{background:rgba(239,68,68,.1);color:#f87171;padding:10px 20px;border:1px solid rgba(239,68,68,.2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-danger:hover{background:rgba(239,68,68,.2)}
.msg{font-size:13px;margin-top:10px;padding:10px 14px;border-radius:8px;display:none}
.msg.ok{background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);display:block}
.msg.err{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);display:block}
.tab-bar{display:flex;gap:4px;background:var(--bg3);border-radius:10px;padding:4px;margin-bottom:24px;width:fit-content}
.tab{padding:7px 16px;border-radius:7px;font-size:13px;font-weight:600;color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s;border:none;background:none;font-family:'Inter',sans-serif}
.tab.on{background:var(--bg2);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.panel{display:none}.panel.on{display:block}
.mob-bar{display:none;position:fixed;top:0;left:0;right:0;height:52px;background:var(--bg1);border-bottom:1px solid var(--b1);z-index:200;padding:0 16px;align-items:center;justify-content:space-between}
.hamburger{width:36px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;border-radius:8px;background:var(--b1);border:none}
.hamburger span{width:16px;height:2px;background:rgba(255,255,255,.7);border-radius:2px;display:block}
.mob-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:150}
.mob-overlay.show{display:block}
.mob-drawer{position:fixed;top:52px;left:0;right:0;bottom:0;background:var(--bg1);z-index:160;padding:16px 12px;transform:translateY(-100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;border-top:1px solid var(--b1)}
.mob-drawer.open{transform:translateY(0)}
@media(max-width:900px){
  .sidebar{display:none}.mob-bar{display:flex}
  .main{margin-left:0;padding-top:52px}
  .topbar{display:none}.content{padding:16px}
  .ws-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>

<div class="mob-bar">
  <img src="/logo_text.png" alt="Syncora" style="height:20px;filter:brightness(0) invert(1)"/>
  <button class="hamburger" onclick="toggleDrawer()"><span></span><span></span><span></span></button>
</div>
<div class="mob-overlay" id="overlay" onclick="closeDrawer()"></div>
<div class="mob-drawer" id="drawer">
  <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.2);letter-spacing:2px;text-transform:uppercase;padding:8px 14px 6px">Menu</div>
  <a class="sb-link on" href="#" onclick="showTab('overview',this);closeDrawer();return false"><span class="sb-icon">⬛</span>Overview</a>
  <a class="sb-link" href="#" onclick="showTab('workspaces',this);closeDrawer();return false"><span class="sb-icon">🔗</span>Workspaces</a>
  <a class="sb-link" href="#" onclick="showTab('messages',this);closeDrawer();return false"><span class="sb-icon">💬</span>Messages</a>
  <a class="sb-link" href="#" onclick="showTab('contacts',this);closeDrawer();return false"><span class="sb-icon">👤</span>Contacts</a>
  <a class="sb-link" href="#" onclick="showTab('account',this);closeDrawer();return false"><span class="sb-icon">⚙</span>Account</a>
  <div style="height:1px;background:rgba(255,255,255,.06);margin:12px 0"></div>
  <a class="sb-link" href="/auth/logout" onclick="closeDrawer()"><span class="sb-icon">→</span>Sign out</a>
</div>

<aside class="sidebar">
  <div class="sb-top">
    <img src="/logo_text.png" alt="Syncora" style="height:24px;filter:brightness(0) invert(1)"/>
  </div>
  <nav class="sb-nav">
    <div class="sb-section">Dashboard</div>
    <a class="sb-link on" href="#" onclick="showTab('overview',this);return false"><span class="sb-icon">⬛</span>Overview</a>
    <a class="sb-link" href="#" onclick="showTab('workspaces',this);return false"><span class="sb-icon">🔗</span>Workspaces</a>
    <a class="sb-link" href="#" onclick="showTab('messages',this);return false"><span class="sb-icon">💬</span>Messages</a>
    <a class="sb-link" href="#" onclick="showTab('contacts',this);return false"><span class="sb-icon">👤</span>Contacts</a>
    <a class="sb-link" href="#" onclick="showTab('account',this);return false"><span class="sb-icon">⚙</span>Account</a>
    <div class="sb-section">Plan</div>
    <div style="margin:4px 10px 0;background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.12);border-radius:10px;padding:12px">
      <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:4px">Current plan</div>
      <div style="font-size:14px;font-weight:800;color:#25D366">${planInfo.label}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.25);margin-top:2px">${planInfo.price}/mo</div>
      ${plan === 'starter' ? `<a href="/#pricing" style="display:block;text-align:center;margin-top:10px;background:#25D366;color:#000;padding:6px;border-radius:7px;font-size:11px;font-weight:700;text-decoration:none">Upgrade →</a>` : ''}
    </div>
  </nav>
  <div class="sb-bottom">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#25D366;flex-shrink:0">${user.full_name.charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user.full_name}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user.email}</div>
      </div>
      <a href="/auth/logout" title="Sign out" style="color:rgba(255,255,255,.3);font-size:14px;text-decoration:none;flex-shrink:0" onmouseover="this.style.color='#f87171'" onmouseout="this.style.color='rgba(255,255,255,.3)'">→</a>
    </div>
  </div>
</aside>

<div class="main">
  <div class="topbar">
    <div style="font-size:15px;font-weight:700" id="topbar-title">Overview</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div style="display:flex;align-items:center;gap:6px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:#25D366;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600">
        <span style="width:6px;height:6px;background:#25D366;border-radius:50%;display:inline-block"></span>
        ${planInfo.label}
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.3)">${new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>
    </div>
  </div>

  <div class="content">

    <!-- OVERVIEW TAB -->
    <div id="tab-overview" class="panel on">
      <div class="page-title">Welcome back, ${user.full_name.split(' ')[0]} 👋</div>
      <div class="page-sub">${user.company_name} · ${planInfo.label} plan</div>

      ${upgradeBanner}

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">
        <div onclick="showTab('workspaces',document.querySelector('.sb-link[onclick*=workspaces]'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(37,211,102,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)'">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Workspaces</div>
          <div style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#fff">${tenants.length}<span style="font-size:16px;color:rgba(255,255,255,.25);font-weight:500"> / ${maxWorkspaces === 999 ? '∞' : maxWorkspaces}</span></div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#25D366,transparent)"></div>
        </div>
        <div onclick="showTab('messages',document.querySelector('.sb-link[onclick*=messages]'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(139,92,246,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)'">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Total messages</div>
          <div style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#a78bfa">${statsResults.reduce((sum,s) => sum + parseInt(s[0].rows[0].total), 0).toLocaleString()}</div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#8b5cf6,transparent)"></div>
        </div>
        <div onclick="showTab('contacts',document.querySelector('.sb-link[onclick*=contacts]'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor='rgba(245,158,11,.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,.07)'">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Contacts</div>
          <div id="stat-contacts" style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#fbbf24">...</div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#f59e0b,transparent)"></div>
        </div>
      </div>

      <div class="section-hd">
        <div style="font-size:15px;font-weight:700;color:#fff">Your workspaces</div>
        ${canAddWorkspace
          ? `<a href="/onboarding?email=${encodeURIComponent(user.email)}" style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#000;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">+ Add workspace</a>`
          : `<div style="font-size:12px;color:rgba(255,255,255,.3);background:rgba(255,255,255,.04);padding:7px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.06)">Upgrade to add more</div>`}
      </div>
      <div class="ws-grid">${workspaceCards}</div>
    </div>

    <!-- WORKSPACES TAB -->
    <div id="tab-workspaces" class="panel">
      <div class="page-title">Workspaces</div>
      <div class="page-sub">Manage your connected Slack workspaces</div>
      <div class="section-hd">
        <div style="font-size:13px;color:rgba(255,255,255,.4)">${tenants.length} of ${maxWorkspaces === 999 ? '∞' : maxWorkspaces} workspaces used</div>
        ${canAddWorkspace
          ? `<a href="/onboarding?email=${encodeURIComponent(user.email)}" style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#000;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">+ Connect Slack</a>`
          : `<a href="/#pricing" style="display:inline-flex;align-items:center;gap:6px;background:rgba(37,211,102,.1);color:#4ade80;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none;border:1px solid rgba(37,211,102,.2)">Upgrade to add more →</a>`}
      </div>
      <div class="ws-grid">${workspaceCards}</div>
      ${!canAddWorkspace ? `
      <div style="background:linear-gradient(135deg,rgba(37,211,102,.06),rgba(96,165,250,.04));border:1px solid rgba(37,211,102,.12);border-radius:14px;padding:24px;text-align:center">
        <div style="font-size:20px;margin-bottom:10px">🚀</div>
        <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px">Need more workspaces?</div>
        <div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:16px">
          ${plan === 'starter' ? 'Upgrade to Pro for 3 workspaces or Business for unlimited' : 'Upgrade to Business for unlimited workspaces'}
        </div>
        <a href="/#pricing" style="background:#25D366;color:#000;padding:10px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none">View plans →</a>
      </div>` : ''}
    </div>

    <!-- ACCOUNT TAB -->
    <div id="tab-account" class="panel">
      <div class="page-title">Account</div>
      <div class="page-sub">Manage your personal information and security</div>

      <!-- Profile -->
      <div class="card">
        <div class="card-title">👤 Personal information</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="fg" style="margin-bottom:0">
            <label>Full name</label>
            <input type="text" id="uFullName" value="${user.full_name}" placeholder="Your name"/>
          </div>
          <div class="fg" style="margin-bottom:0">
            <label>Email address</label>
            <input type="email" id="uEmail" value="${user.email}" disabled style="opacity:.5;cursor:not-allowed"/>
          </div>
          <div class="fg" style="margin-bottom:0">
            <label>Company name</label>
            <input type="text" id="uCompany" value="${user.company_name}" placeholder="Your company"/>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn-primary" onclick="saveProfile()">Save changes</button>
          <div id="profileMsg" class="msg"></div>
        </div>
      </div>

      <!-- Change password -->
      <div class="card">
        <div class="card-title">🔒 Change password</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="fg" style="margin-bottom:0">
            <label>Current password</label>
            <input type="password" id="uCurrPwd" placeholder="Current password"/>
          </div>
          <div class="fg" style="margin-bottom:0">
            <label>New password</label>
            <input type="password" id="uNewPwd" placeholder="Min 8 characters"/>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn-primary" onclick="changePassword()">Update password</button>
          <div id="pwdMsg" class="msg"></div>
        </div>
      </div>

      <!-- Plan info -->
      <div class="card">
        <div class="card-title">💳 Plan & billing</div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:4px">${planInfo.label} <span style="font-size:14px;color:rgba(255,255,255,.35);font-weight:500">${planInfo.price}/mo</span></div>
            <div style="font-size:13px;color:rgba(255,255,255,.4)">
              ${planInfo.msgLimit > 0 ? planInfo.msgLimit + ' messages/day' : 'Unlimited messages'} · 
              ${maxWorkspaces === 999 ? 'Unlimited workspaces' : maxWorkspaces + ' workspace' + (maxWorkspaces > 1 ? 's' : '')}
            </div>
          </div>
          ${plan !== 'business' ? `<a href="/#pricing" style="background:#25D366;color:#000;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none">Upgrade plan →</a>` : '<span style="color:#4ade80;font-size:13px;font-weight:600">✓ Max plan</span>'}
        </div>
      </div>

      <!-- Danger zone -->
      <div class="card" style="border-color:rgba(239,68,68,.15)">
        <div class="card-title" style="color:#f87171">⚠ Danger zone</div>
        <p style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:16px;line-height:1.6">Once you delete your account, all your data will be permanently removed. This cannot be undone.</p>
        <button class="btn-danger" onclick="deleteAccount()">Delete account</button>
        <div id="deleteMsg" class="msg"></div>
      </div>
    </div>

    <!-- MESSAGES TAB -->
    <div id="tab-messages" class="panel">
      <div class="page-title">Messages</div>
      <div class="page-sub">All messages across your workspaces</div>
      <div id="msg-list" style="color:rgba(255,255,255,.4);font-size:13px">Loading...</div>
    </div>

    <!-- CONTACTS TAB -->
    <div id="tab-contacts" class="panel">
      <div class="page-title">Contacts</div>
      <div class="page-sub">All WhatsApp contacts across your workspaces</div>
      <div id="cnt-list" style="color:rgba(255,255,255,.4);font-size:13px">Loading...</div>
    </div>

  </div>
</div>

<script>
function showTab(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('on'));
  document.getElementById('tab-' + name).classList.add('on');
  if (el) el.classList.add('on');
  var titles = {overview:'Overview', workspaces:'Workspaces', messages:'Messages', contacts:'Contacts', account:'Account'};
  document.getElementById('topbar-title').textContent = titles[name] || name;
  if (name === 'messages') loadMessages();
  if (name === 'contacts') loadContacts();
}
async function loadMessages() {
  var el = document.getElementById('msg-list');
  if (!el || el.dataset.loaded) return;
  try {
    var r = await fetch('/dashboard/messages-data', {credentials:'same-origin'});
    var d = await r.json();
    if (!d.messages || !d.messages.length) { el.innerHTML = '<div style="text-align:center;padding:48px;color:rgba(255,255,255,.25)">No messages yet</div>'; return; }
    var rows = d.messages.map(function(m) {
      var t = new Date(m.created_at).toLocaleString('en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      var dir = m.direction === 'inbound' ? '<span style="background:rgba(37,211,102,.1);color:#4ade80;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(37,211,102,.2)">In</span>' : '<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(59,130,246,.2)">Out</span>';
      return '<tr><td style="padding:10px 14px;font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap;border-top:1px solid rgba(255,255,255,.04)">' + t + '</td><td style="padding:10px 14px;font-size:12px;border-top:1px solid rgba(255,255,255,.04)">' + m.wa_number + '</td><td style="padding:10px 14px;border-top:1px solid rgba(255,255,255,.04)">' + dir + '</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.5);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-top:1px solid rgba(255,255,255,.04)">' + (m.body||'').substring(0,60) + '</td></tr>';
    }).join('');
    el.innerHTML = '<div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,.06)"><table style="width:100%;border-collapse:collapse;min-width:500px"><thead><tr style="background:#16161f"><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Time</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Number</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Dir</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Message</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    el.dataset.loaded = '1';
  } catch(e) { el.innerHTML = '<div style="color:#f87171">Error loading messages</div>'; }
}
async function loadContacts() {
  var el = document.getElementById('cnt-list');
  if (!el || el.dataset.loaded) return;
  try {
    var r = await fetch('/dashboard/contacts-data', {credentials:'same-origin'});
    var d = await r.json();
    if (!d.contacts || !d.contacts.length) { el.innerHTML = '<div style="text-align:center;padding:48px;color:rgba(255,255,255,.25)">No contacts yet</div>'; return; }
    var sc = document.getElementById('stat-contacts');
    if (sc) sc.textContent = d.contacts.length;
    var rows = d.contacts.map(function(c) {
      var dt = new Date(c.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
      return '<tr><td style="padding:10px 14px;font-size:13px;border-top:1px solid rgba(255,255,255,.04)">' + c.wa_number + '</td><td style="padding:10px 14px;font-size:13px;color:rgba(255,255,255,.5);border-top:1px solid rgba(255,255,255,.04)">' + (c.display_name||'-') + '</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.4);border-top:1px solid rgba(255,255,255,.04)">' + c.slack_channel + '</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.3);border-top:1px solid rgba(255,255,255,.04)">' + dt + '</td></tr>';
    }).join('');
    el.innerHTML = '<div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,.06)"><table style="width:100%;border-collapse:collapse;min-width:400px"><thead><tr style="background:#16161f"><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">WhatsApp</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Name</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Slack channel</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Added</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    el.dataset.loaded = '1';
  } catch(e) { el.innerHTML = '<div style="color:#f87171">Error loading contacts</div>'; }
}
function toggleDrawer() {
  document.getElementById('drawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
function copyCode(code) {
  navigator.clipboard.writeText(code).then(function() {
    var btn = document.getElementById('copy-' + code);
    var orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.color = '#4ade80';
    setTimeout(function(){ btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}
async function saveProfile() {
  var name = document.getElementById('uFullName').value.trim();
  var company = document.getElementById('uCompany').value.trim();
  var msg = document.getElementById('profileMsg');
  if (!name) { showMsg(msg, 'Name is required', false); return; }
  var r = await fetch('/dashboard/update-profile', {
    method: 'POST', credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({full_name: name, company_name: company})
  });
  var d = await r.json();
  showMsg(msg, d.success ? '✓ Profile updated' : 'Error: ' + d.error, d.success);
}
async function changePassword() {
  var curr = document.getElementById('uCurrPwd').value;
  var newp = document.getElementById('uNewPwd').value;
  var msg = document.getElementById('pwdMsg');
  if (!curr || !newp) { showMsg(msg, 'Please fill in both fields', false); return; }
  if (newp.length < 8) { showMsg(msg, 'New password must be at least 8 characters', false); return; }
  var r = await fetch('/dashboard/change-password', {
    method: 'POST', credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({current: curr, newPassword: newp})
  });
  var d = await r.json();
  showMsg(msg, d.success ? '✓ Password updated' : 'Error: ' + d.error, d.success);
  if (d.success) { document.getElementById('uCurrPwd').value = ''; document.getElementById('uNewPwd').value = ''; }
}
async function deleteAccount() {
  if (!confirm('Are you sure? This will permanently delete your account and all data.')) return;
  if (!confirm('This cannot be undone. Are you absolutely sure?')) return;
  var r = await fetch('/dashboard/delete-account', {method:'POST', credentials:'same-origin'});
  var d = await r.json();
  if (d.success) { window.location.href = '/'; }
  else showMsg(document.getElementById('deleteMsg'), 'Error: ' + d.error, false);
}
function showMsg(el, text, ok) {
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  setTimeout(function(){ el.className = 'msg'; }, 4000);
}
// Check URL for tab param
var urlTab = new URLSearchParams(window.location.search).get('tab');
if (urlTab) {
  var el = document.querySelector('.sb-link[onclick*="' + urlTab + '"]');
  showTab(urlTab, el);
}
</script>
</body>
</html>`);

  } catch(err) {
    console.error('[DASHBOARD ERROR]', err.message);
    res.status(500).send('Error: ' + err.message);
  }
});

// ── Update profile ────────────────────────────────────────
router.post('/update-profile', requireAuth, async (req, res) => {
  try {
    const { full_name, company_name } = req.body;
    if (!full_name) return res.json({ success: false, error: 'Name is required' });
    await pool.query(
      'UPDATE users SET full_name = $1, company_name = $2 WHERE id = $3',
      [full_name.trim(), company_name ? company_name.trim() : '', req.session.userId]
    );
    req.session.userName    = full_name.trim();
    req.session.companyName = company_name ? company_name.trim() : '';
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

// ── Change password ───────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current, newPassword } = req.body;
    if (!current || !newPassword) return res.json({ success: false, error: 'Both fields required' });
    if (newPassword.length < 8) return res.json({ success: false, error: 'Password must be at least 8 characters' });
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    const valid = await bcrypt.compare(current, result.rows[0].password_hash);
    if (!valid) return res.json({ success: false, error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

// ── Delete account ────────────────────────────────────────
router.post('/delete-account', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (user.rows.length) {
      // Remove tenants linked to this email
      await pool.query('DELETE FROM tenants WHERE LOWER(email) = $1', [user.rows[0].email.toLowerCase()]);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    req.session.destroy();
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

// ── Logout ────────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

router.get('/messages-data', requireAuth, async (req, res) => {
  try {
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    const tenants = await pool.query('SELECT id FROM tenants WHERE LOWER(email) = $1', [user.rows[0].email.toLowerCase()]);
    const ids = tenants.rows.map(t => t.id);
    if (!ids.length) return res.json({ messages: [] });
    const result = await pool.query(
      'SELECT m.body, m.direction, m.created_at, c.wa_number FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.tenant_id = ANY($1) ORDER BY m.created_at DESC LIMIT 50',
      [ids]
    );
    res.json({ messages: result.rows });
  } catch(e) { res.json({ messages: [] }); }
});

router.get('/contacts-data', requireAuth, async (req, res) => {
  try {
    const user = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId]);
    const tenants = await pool.query('SELECT id FROM tenants WHERE LOWER(email) = $1', [user.rows[0].email.toLowerCase()]);
    const ids = tenants.rows.map(t => t.id);
    if (!ids.length) return res.json({ contacts: [] });
    const result = await pool.query(
      'SELECT wa_number, display_name, slack_channel, created_at FROM contacts WHERE tenant_id = ANY($1) ORDER BY created_at DESC',
      [ids]
    );
    res.json({ contacts: result.rows });
  } catch(e) { res.json({ contacts: [] }); }
});

module.exports = router;