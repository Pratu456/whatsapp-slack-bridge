// src/routes/admin.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { sendActivationEmail } = require('../services/emailService');
require('dotenv').config();
  // ── Auth middleware ───────────────────────────────────────
  const auth = (req, res, next) => {
    if (req.session && req.session.isAdmin) return next();
    return res.send(`<!DOCTYPE html><html><head><title>Syncora Admin</title>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#060608;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .wrap{width:100%;max-width:380px;text-align:center}
  h1{font-size:24px;font-weight:800;color:#fff;margin-bottom:8px}
  p{font-size:14px;color:rgba(255,255,255,.35);margin-bottom:32px}
  .card{background:#0f0f16;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:32px}
  input{width:100%;padding:13px 18px;background:#1a1a24;border:1px solid rgba(255,255,255,.1);border-radius:12px;font-size:15px;color:#fff;margin-bottom:14px;outline:none;font-family:'Inter',sans-serif;transition:border-color .2s}
  input:focus{border-color:rgba(37,211,102,.5);box-shadow:0 0 0 3px rgba(37,211,102,.08)}
  input::placeholder{color:rgba(255,255,255,.25)}
  button{width:100%;padding:14px;background:#25D366;color:#000;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
  button:hover{background:#1aad52}
  .err{color:#f87171;font-size:13px;margin-bottom:12px}
  </style></head>
  <body><div class="wrap">
  <img src="/logo_full.png" alt="Syncora" style="height:72px;width:auto;margin:0 auto 16px;display:block"/>
  <h1>Syncora Admin</h1>
  <p>Sign in to manage your platform</p>
  <div class="card">
  ${req.query.error ? '<div class="err">Incorrect password — try again</div>' : ''}
  <form method="POST" action="/admin/login">
  <input type="password" name="pwd" placeholder="Admin password" autofocus/>
  <button type="submit">Sign in →</button>
  </form>
  </div></div></body></html>`);
  };

  // ── Login POST ────────────────────────────────────────────
  router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
    if (req.body.pwd === process.env.ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      res.redirect('/admin');
    } else {
      res.redirect('/admin?error=1');
    }
  });

  // ── Logout ────────────────────────────────────────────────
  router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin');
  });
const generateClaimCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const validateClaimCode = (code) => {
  if (!code) return 'Claim code is required';
  if (code.length < 3) return 'Claim code must be at least 3 characters';
  if (code.length > 20) return 'Claim code must be 20 characters or less';
  if (!/^[a-z0-9_]+$/.test(code)) return 'Only lowercase letters, numbers and underscores allowed';
  return null;
};

const getStats = async () => {
  const [tenants, messages, todayMessages, contacts] = await Promise.all([
    pool.query('SELECT * FROM tenants ORDER BY created_at DESC'),
    pool.query('SELECT COUNT(*) as total FROM messages'),
    pool.query("SELECT COUNT(*) as total FROM messages WHERE created_at >= NOW() - INTERVAL '24 hours'"),
    pool.query('SELECT COUNT(*) as total FROM contacts'),
  ]);
  return {
    tenants: tenants.rows,
    totalMessages: parseInt(messages.rows[0].total),
    todayMessages: parseInt(todayMessages.rows[0].total),
    totalContacts: parseInt(contacts.rows[0].total),
  };
};

router.get('/', auth, async (req, res) => {
  try {
    
    const { tenants, totalMessages, todayMessages, totalContacts } = await getStats();

    const inactiveTenants = await pool.query(`
      SELECT t.id, t.company_name, t.slack_team_name, MAX(m.created_at) as last_msg
      FROM tenants t LEFT JOIN messages m ON m.tenant_id = t.id
      WHERE t.is_active = TRUE
      GROUP BY t.id, t.company_name, t.slack_team_name
      HAVING MAX(m.created_at) < NOW() - INTERVAL '14 days' OR MAX(m.created_at) IS NULL
    `).catch(() => ({ rows: [] }));

    const msgActivity = await pool.query(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM messages WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at) ORDER BY day ASC
    `).catch(() => ({ rows: [] }));

    const active = tenants.filter(t => t.is_active).length;
    const pending = tenants.filter(t => !t.is_active).length;
    const activityData = JSON.stringify(msgActivity.rows.map(r => ({ day: r.day, count: parseInt(r.count) })));

    const tenantRows = tenants.map(t => `
      <tr class="tr-hover" onclick="location.href='/admin/tenant/${t.id}'" style="cursor:pointer">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#25D366;flex-shrink:0">${t.company_name.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-weight:600;font-size:14px;color:#fff">${t.company_name}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.3)">${t.email || t.slack_team_name || 'No email'}</div>
            </div>
          </div>
        </td>
        <td><code style="background:rgba(37,211,102,.08);color:#25D366;padding:3px 10px;border-radius:6px;font-size:12px;border:1px solid rgba(37,211,102,.15)">${t.claim_code || '-'}</code></td>
        <td style="font-size:13px;color:rgba(255,255,255,.4)">${t.twilio_number || '-'}</td>
        <td>${t.is_active ? '<span class="badge-green">Active</span>' : '<span class="badge-yellow">Pending</span>'}</td>
        <td style="font-size:12px;color:rgba(255,255,255,.3)">${new Date(t.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td onclick="event.stopPropagation()" style="white-space:nowrap">
          ${!t.is_active
            ? `<button onclick="activate(${t.id},'${t.email||''}')" class="btn-xs btn-xs-green">Activate</button>`
            : `<button onclick="deactivate(${t.id})" class="btn-xs btn-xs-orange">Deactivate</button>`}
          <button onclick="deleteTenant(${t.id})" class="btn-xs btn-xs-red">Delete</button>
        </td>
      </tr>`).join('');

    const inactiveRows = inactiveTenants.rows.length === 0
      ? '<div style="color:rgba(255,255,255,.25);font-size:13px;padding:8px 0">All companies are active!</div>'
      : inactiveTenants.rows.map(t => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <div>
            <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.8)">${t.company_name}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.3)">${t.last_msg?'Last: '+new Date(t.last_msg).toLocaleDateString():'No messages ever'}</div>
          </div>
          <button onclick="location.href='/admin/tenant/${t.id}'" class="btn-xs btn-xs-gray">View</button>
        </div>`).join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Syncora Admin</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --g:#25D366;--gd:#1aad52;
  --bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;
  --b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);
  --t:#ffffff;--t2:rgba(255,255,255,.75);--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2);
  --sidebar:240px;--topbar:60px;--mob-topbar:52px
}
html,body{height:100%}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);display:flex;-webkit-font-smoothing:antialiased}
.sidebar{width:var(--sidebar);min-height:100vh;background:var(--bg1);border-right:1px solid var(--b1);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100}
.sb-top{padding:20px 18px;border-bottom:1px solid var(--b1)}
.sb-logo{display:flex;align-items:center;gap:10px}
.sb-mark{width:36px;height:36px;background:var(--g);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#000;flex-shrink:0}
.sb-name{font-size:15px;font-weight:800;color:var(--t);letter-spacing:-.3px}
.sb-sub{font-size:10px;color:var(--t4);margin-top:1px;font-weight:500;letter-spacing:.5px;text-transform:uppercase}
.sb-nav{padding:12px 10px;flex:1;overflow-y:auto}
.sb-section{font-size:10px;font-weight:700;color:var(--t4);letter-spacing:2px;text-transform:uppercase;padding:14px 8px 6px}
.sb-link{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;color:var(--t3);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:2px;user-select:none}
.sb-link:hover{background:var(--b1);color:var(--t2)}
.sb-link.on{background:rgba(37,211,102,.1);color:var(--g)}
.sb-link.on .sb-dot{background:var(--g);box-shadow:0 0 8px var(--g)}
.sb-icon{font-size:15px;width:22px;text-align:center;flex-shrink:0}
.sb-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);margin-left:auto;transition:all .2s;flex-shrink:0}
.sb-bottom{padding:16px 18px;border-top:1px solid var(--b1)}
.sb-user{display:flex;align-items:center;gap:10px}
.sb-avatar{width:30px;height:30px;border-radius:8px;background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--g)}
.sb-uname{font-size:13px;font-weight:600;color:var(--t2)}
.sb-urole{font-size:11px;color:var(--t4)}
.mob-bar{display:none;position:fixed;top:0;left:0;right:0;height:var(--mob-topbar);background:var(--bg1);border-bottom:1px solid var(--b1);z-index:200;padding:0 16px;align-items:center;justify-content:space-between}
.mob-logo{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;color:var(--t)}
.mob-mark{width:28px;height:28px;background:var(--g);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#000}
.mob-right{display:flex;align-items:center;gap:8px}
.mob-live{display:flex;align-items:center;gap:5px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:var(--g);padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600}
.mob-live-dot{width:5px;height:5px;background:var(--g);border-radius:50%;animation:lp 2s infinite}
.hamburger{width:36px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;border-radius:8px;background:var(--b1);border:none;flex-shrink:0}
.hamburger span{width:16px;height:2px;background:var(--t2);border-radius:2px;transition:all .3s;display:block}
.hamburger.open span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
.hamburger.open span:nth-child(2){opacity:0;transform:scaleX(0)}
.hamburger.open span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
.mob-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:150;backdrop-filter:blur(3px)}
.mob-overlay.show{display:block}
.mob-drawer{position:fixed;top:var(--mob-topbar);left:0;right:0;bottom:0;background:var(--bg1);z-index:160;padding:16px 12px;transform:translateY(-100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;border-top:1px solid var(--b1)}
.mob-drawer.open{transform:translateY(0)}
.mob-drawer .sb-link{padding:12px 14px;font-size:14px}
.mob-drawer .sb-section{padding:16px 14px 8px;font-size:11px}
.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{height:var(--topbar);background:var(--bg1);border-bottom:1px solid var(--b1);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.topbar-title{font-size:15px;font-weight:700;color:var(--t)}
.topbar-right{display:flex;align-items:center;gap:12px}
.live-badge{display:flex;align-items:center;gap:6px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:var(--g);padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600}
.live-dot{width:6px;height:6px;background:var(--g);border-radius:50%;animation:lp 2s infinite}
@keyframes lp{0%,100%{box-shadow:0 0 0 2px rgba(37,211,102,.2)}50%{box-shadow:0 0 0 5px rgba(37,211,102,0)}}
.topbar-date{font-size:12px;color:var(--t4);font-weight:500}
.content{padding:24px 28px;flex:1}
.panel{display:none}.panel.on{display:block}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.scard{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:20px 22px;position:relative;overflow:hidden;transition:transform .2s,border-color .2s}
.scard:hover{transform:translateY(-2px);border-color:var(--b2)}
.scard-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.scard-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.scard-trend{font-size:11px;font-weight:600;padding:3px 8px;border-radius:100px}
.scard-num{font-size:40px;font-weight:900;line-height:1;letter-spacing:-2px;margin-bottom:4px}
.scard-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--t4)}
.scard-sub{font-size:12px;color:var(--t4);margin-top:6px}
.scard-bar{position:absolute;bottom:0;left:0;right:0;height:2px}
.row2{display:grid;grid-template-columns:1.8fr 1fr;gap:16px;margin-bottom:16px}
.card{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:22px}
.card-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.card-hd-left{display:flex;align-items:center;gap:8px}
.card-hd-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
.card-hd-title{font-size:14px;font-weight:700;color:var(--t)}
.card-hd-sub{font-size:12px;color:var(--t4)}
.tbl-wrap{overflow-x:auto;border-radius:12px;border:1px solid var(--b1);-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;min-width:600px}
thead tr{background:var(--bg3)}
th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.8px;white-space:nowrap}
td{padding:13px 16px;border-top:1px solid var(--b1);font-size:13px;vertical-align:middle}
.tr-hover:hover td{background:rgba(255,255,255,.02)}
.badge-green{background:rgba(37,211,102,.1);color:#4ade80;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(37,211,102,.2)}
.badge-yellow{background:rgba(245,158,11,.1);color:#fbbf24;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)}
.btn-xs{padding:5px 12px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-xs-green{background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2)}
.btn-xs-green:hover{background:rgba(37,211,102,.2)}
.btn-xs-orange{background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}
.btn-xs-orange:hover{background:rgba(245,158,11,.2)}
.btn-xs-red{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2)}
.btn-xs-red:hover{background:rgba(239,68,68,.2)}
.btn-xs-gray{background:var(--b1);color:var(--t3);border:1px solid var(--b2)}
.btn-xs-gray:hover{background:var(--b2);color:var(--t2)}
.btn-primary{background:var(--g);color:#000;padding:9px 18px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-primary:hover{background:var(--gd);transform:translateY(-1px)}
.btn-ghost{background:var(--b1);color:var(--t2);padding:9px 18px;border:1px solid var(--b2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.btn-ghost:hover{background:var(--b2)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:6px}
.fg input{width:100%;padding:11px 14px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:14px;color:var(--t);outline:none;font-family:'Inter',sans-serif;transition:border-color .2s}
.fg input:focus{border-color:rgba(37,211,102,.4);box-shadow:0 0 0 3px rgba(37,211,102,.06)}
.fg input::placeholder{color:var(--t4)}
.fg .hint{font-size:11px;color:var(--t4);margin-top:5px}
.fg .hint.err{color:#f87171}
.fg .hint.ok{color:#4ade80}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:300;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:16px}
.modal.show{display:flex}
.modal-box{background:var(--bg2);border:1px solid var(--b2);border-radius:20px;padding:32px;width:100%;max-width:480px;box-shadow:0 32px 80px rgba(0,0,0,.5);max-height:90vh;overflow-y:auto}
.modal-title{font-size:18px;font-weight:800;color:var(--t);margin-bottom:6px}
.modal-sub{font-size:13px;color:var(--t4);margin-bottom:24px}
.modal-box .fg{margin-bottom:14px}
.modal-btns{display:flex;gap:10px;margin-top:20px}
.modal-btns button{flex:1;padding:12px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}
.mbtn-confirm{background:var(--g);color:#000}
.mbtn-confirm:hover{background:var(--gd)}
.mbtn-cancel{background:var(--b1);color:var(--t3);border:1px solid var(--b2)}
.mbtn-cancel:hover{background:var(--b2);color:var(--t2)}
.code-preview{background:var(--bg3);border:1px solid rgba(37,211,102,.2);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.code-preview-val{font-size:20px;font-weight:800;color:var(--g);letter-spacing:3px;font-family:monospace}
.code-preview-btn{background:rgba(37,211,102,.1);color:var(--g);border:1px solid rgba(37,211,102,.2);padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif}
.code-preview-btn:hover{background:rgba(37,211,102,.2)}
.toggle-custom{font-size:12px;color:var(--t4);cursor:pointer;text-decoration:underline;margin-bottom:14px;display:inline-block}
.email-status{font-size:12px;margin-top:12px;padding:10px 14px;border-radius:8px;display:none;line-height:1.5}
.email-status.sent{background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);display:block}
.email-status.failed{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);display:block}
.divider{height:1px;background:var(--b1);margin:16px 0}
@media(max-width:960px){
  .sidebar{display:none}.mob-bar{display:flex}
  .main{margin-left:0;padding-top:var(--mob-topbar)}.topbar{display:none}
  .stats-row{grid-template-columns:1fr 1fr}.row2{grid-template-columns:1fr}
  .content{padding:16px}.form-grid{grid-template-columns:1fr}
}
@media(max-width:520px){
  .scard-num{font-size:32px;letter-spacing:-1px}.scard{padding:16px}
  .content{padding:12px}.card{padding:16px}
  .modal-box{padding:24px}.modal-btns{flex-direction:column}
}
@media(max-width:380px){.stats-row{grid-template-columns:1fr}}
</style>
</head>
<body>

<div class="mob-bar">
  <div class="mob-logo"><img src="/logo_text.png" alt="Syncora" style="height:20px;width:auto;filter:brightness(0) invert(1)"/>
</div>
  <div class="mob-right">
    <div class="mob-live"><span class="mob-live-dot"></span>Live</div>
    <button class="hamburger" id="hbg" onclick="toggleDrawer()"><span></span><span></span><span></span></button>
  </div>
</div>
<div class="mob-overlay" id="overlay" onclick="closeDrawer()"></div>
<div class="mob-drawer" id="drawer">
  <div class="sb-section" style="padding-top:8px">Main</div>
  <div class="sb-link on" id="mob-link-dashboard" onclick="show('dashboard',this);closeDrawer()"><span class="sb-icon" style="font-size:11px;font-weight:800;color:var(--t3)">DB</span>Dashboard</div>
  <div class="sb-link" id="mob-link-companies" onclick="show('companies',this);closeDrawer()"><span class="sb-icon">🏢</span>Companies</div>
  <div class="sb-link" id="mob-link-messages" onclick="show('messages',this);closeDrawer()"><span class="sb-icon">💬</span>Messages</div>

  <div class="sb-section">Actions</div>
  <div class="sb-link" id="mob-link-add" onclick="show('add',this);closeDrawer()"><span class="sb-icon">+</span>Add company</div>
  <div class="sb-link" onclick="location.reload();closeDrawer()"><span class="sb-icon">↺</span>Refresh</div>
  <div class="sb-link" onclick="location.reload();closeDrawer()"><span class="sb-icon">↺</span>Refresh</div>
</div>

<aside class="sidebar">
  <div class="sb-top">
    <div class="sb-logo">
      <img src="/logo_text.png" alt="Syncora" style="height:26px;width:auto;filter:brightness(0) invert(1)"/>

    </div>
  </div>
  <nav class="sb-nav">
    <div class="sb-section">Main</div>
    <div class="sb-link on" id="desk-link-dashboard" onclick="show('dashboard',this)"><span class="sb-icon" style="font-size:11px;font-weight:800;color:var(--t3)">DB</span>Dashboard<span class="sb-dot"></span></div>
    <div class="sb-link" id="desk-link-companies" onclick="show('companies',this)"><span class="sb-icon">🏢</span>Companies<span class="sb-dot"></span></div>
    <div class="sb-link" id="desk-link-messages" onclick="show('messages',this)"><span class="sb-icon">💬</span>Messages<span class="sb-dot"></span></div>
    <div class="sb-link" onclick="location.href='/admin/waitlist'"><span class="sb-icon">📧</span>Waitlist<span class="sb-dot"></span></div>

    <div class="sb-section">Actions</div>
    <div class="sb-link" id="desk-link-add" onclick="show('add',this)"><span class="sb-icon">+</span>Add company<span class="sb-dot"></span></div>
    <div class="sb-link" onclick="location.reload()"><span class="sb-icon">↺</span>Refresh<span class="sb-dot"></span></div>
  </nav>
  <div class="sb-bottom">
     <div class="sb-link" onclick="location.href='/admin/logout'" style="margin-bottom:12px">
       <span class="sb-icon">←</span>Logout<span class="sb-dot"></span>
     </div>
     <div class="sb-user">
       <div class="sb-avatar">A</div>
       <div><div class="sb-uname">Admin</div><div class="sb-urole">Syncora admin</div></div>
     </div>
   </div>
</aside>

<div class="main">
  <div class="topbar">
    <div class="topbar-title" id="ptitle">Dashboard</div>
    <div class="topbar-right">
      <div class="live-badge"><span class="live-dot"></span>Live</div>
      <div class="topbar-date">${new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div>
    </div>
  </div>

  <div class="content">

    <!-- DASHBOARD -->
    <div id="p-dashboard" class="panel on">
      <div class="stats-row">
        <div class="scard">
          <div class="scard-top"><div class="scard-icon" style="background:rgba(37,211,102,.1)">🏢</div><div class="scard-trend" style="background:rgba(37,211,102,.1);color:#4ade80">${active} live</div></div>
          <div class="scard-num">${tenants.length}</div><div class="scard-label">Total companies</div>
          <div class="scard-sub">${active} active · ${pending} pending</div>
          <div class="scard-bar" style="background:linear-gradient(90deg,#25D366,transparent)"></div>
        </div>
        <div class="scard">
          <div class="scard-top"><div class="scard-icon" style="background:rgba(59,130,246,.1)">✅</div><div class="scard-trend" style="background:rgba(59,130,246,.1);color:#60a5fa">Active</div></div>
          <div class="scard-num" style="color:#60a5fa">${active}</div><div class="scard-label">Active companies</div>
          <div class="scard-sub">Routing messages live</div>
          <div class="scard-bar" style="background:linear-gradient(90deg,#3b82f6,transparent)"></div>
        </div>
        <div class="scard">
          <div class="scard-top"><div class="scard-icon" style="background:rgba(139,92,246,.1)">💬</div><div class="scard-trend" style="background:rgba(139,92,246,.1);color:#a78bfa">Today</div></div>
          <div class="scard-num" style="color:#a78bfa">${todayMessages}</div><div class="scard-label">Messages today</div>
          <div class="scard-sub">${totalMessages} total all-time</div>
          <div class="scard-bar" style="background:linear-gradient(90deg,#8b5cf6,transparent)"></div>
        </div>
        <div class="scard">
          <div class="scard-top"><div class="scard-icon" style="background:rgba(245,158,11,.1)">👥</div><div class="scard-trend" style="background:rgba(245,158,11,.1);color:#fbbf24">All time</div></div>
          <div class="scard-num" style="color:#fbbf24">${totalContacts}</div><div class="scard-label">Total contacts</div>
          <div class="scard-sub">Across all workspaces</div>
          <div class="scard-bar" style="background:linear-gradient(90deg,#f59e0b,transparent)"></div>
        </div>
      </div>

      <div class="row2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-hd">
            <div class="card-hd-left"><div class="card-hd-icon" style="background:rgba(37,211,102,.1)">📈</div><div><div class="card-hd-title">Message activity</div><div class="card-hd-sub">Last 7 days</div></div></div>
          </div>
          <canvas id="actChart" height="80"></canvas>
        </div>
        <div class="card">
          <div class="card-hd">
            <div class="card-hd-left"><div class="card-hd-icon" style="background:rgba(245,158,11,.1)">⚠️</div><div><div class="card-hd-title">Inactive companies</div><div class="card-hd-sub">No messages in 14 days</div></div></div>
          </div>
          ${inactiveRows}
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div class="card-hd-left"><div class="card-hd-icon" style="background:rgba(139,92,246,.1)">🏢</div><div><div class="card-hd-title">Company overview</div><div class="card-hd-sub">Quick status of all companies</div></div></div>
          <button class="btn-ghost" onclick="show('companies',document.getElementById('desk-link-companies'))">View all →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
          ${tenants.map(t=>`
            <div onclick="location.href='/admin/tenant/${t.id}'" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid rgba(255,255,255,.06);border-radius:10px;cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.15);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#25D366;flex-shrink:0">${t.company_name.charAt(0)}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85)">${t.company_name}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,.3)">${t.claim_code?'Code: '+t.claim_code:'No claim code'}</div>
                </div>
              </div>
              ${t.is_active?'<span class="badge-green">Active</span>':'<span class="badge-yellow">Pending</span>'}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- COMPANIES -->
    <div id="p-companies" class="panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--t)">${tenants.length} Companies</div>
          <div style="font-size:13px;color:var(--t4);margin-top:2px">${active} active · ${pending} pending</div>
        </div>
        <button class="btn-primary" onclick="show('add',document.getElementById('desk-link-add'))">＋ Add company</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Company</th><th>Claim code</th><th>Twilio number</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>${tenantRows}</tbody>
        </table>
      </div>
    </div>

    <!-- MESSAGES -->
    <div id="p-messages" class="panel">
      <div style="margin-bottom:16px">
        <div style="font-size:18px;font-weight:800;color:var(--t)">Message log</div>
        <div style="font-size:13px;color:var(--t4);margin-top:2px">Last 50 messages across all companies</div>
      </div>
      <div id="msg-content" style="color:var(--t4);font-size:13px;padding:20px 0">Loading...</div>
    </div>
      
    <!-- ADD COMPANY -->
    <div id="p-add" class="panel">
      <div style="max-width:680px">
        <div style="font-size:18px;font-weight:800;color:var(--t);margin-bottom:4px">Add new company</div>
        <div style="font-size:13px;color:var(--t4);margin-bottom:24px">Manually onboard a company to the platform</div>
        <div class="card">
          <div class="form-grid">
            <div class="fg"><label>Company name</label><input type="text" id="nCo" placeholder="e.g. Acme Corp"/></div>
            <div class="fg"><label>Company email</label><input type="email" id="nEmail" placeholder="hello@acmecorp.com"/><div class="hint">Activation email will be sent here</div></div>
            <div class="fg"><label>Twilio WhatsApp number</label><input type="text" id="nTwilio" placeholder="+14155238886"/></div>
            <div class="fg"><label>Slack bot token</label><input type="text" id="nToken" placeholder="xoxb-..."/></div>
          </div>
          <div style="margin-bottom:6px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:8px">Claim code</div>
            <div class="code-preview">
              <div><div style="font-size:11px;color:var(--t4);margin-bottom:4px">Auto-generated</div><div class="code-preview-val" id="codePreview">------</div></div>
              <button class="code-preview-btn" onclick="regenerateCode()">↻ Regenerate</button>
            </div>
            <span class="toggle-custom" onclick="toggleCustomCode()">Use a custom claim code instead →</span>
            <div id="customCodeWrap" style="display:none">
              <div class="fg"><label>Custom claim code</label><input type="text" id="nCustomCode" placeholder="e.g. mycompany" oninput="validateCustomCode(this)"/><div class="hint" id="customCodeHint">3–20 chars · lowercase letters, numbers and _ only</div></div>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button class="btn-primary" onclick="addTenant()">Add company →</button>
            <button class="btn-ghost" onclick="show('companies',document.getElementById('desk-link-companies'))">Cancel</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>


<!-- ACTIVATE MODAL -->
<div class="modal" id="actModal">
  <div class="modal-box">
    <div class="modal-title">Activate company</div>
    <div class="modal-sub">Email is pre-filled from onboarding. Update if needed — activation email will be sent automatically.</div>


    <div class="fg"><label>Company email</label>
      <input type="email" id="mEmail" placeholder="hello@company.com"/>
      <div class="hint">Required — activation email will be sent here</div>
    </div>

    <div class="fg"><label>Twilio WhatsApp number</label>
      <input type="text" id="mTwilio" placeholder="+14155238886"/>
    </div>

    <div class="divider"></div>

    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:8px">Claim code</div>
    <div class="code-preview">
      <div><div style="font-size:11px;color:var(--t4);margin-bottom:4px">Auto-generated</div><div class="code-preview-val" id="mCodePreview">------</div></div>
      <button class="code-preview-btn" onclick="regenModalCode()">↻ Regenerate</button>
    </div>
    <span class="toggle-custom" id="mToggleCustom" onclick="toggleModalCustom()">Use a custom claim code →</span>
    <div id="mCustomWrap" style="display:none;margin-top:8px">
      <div class="fg"><label>Custom claim code</label><input type="text" id="mCustomCode" placeholder="e.g. mycompany" oninput="validateCustomCode(this)"/><div class="hint" id="mCustomHint">3–20 chars · lowercase letters, numbers and _ only</div></div>
    </div>

    <div id="emailStatus" class="email-status"></div>
    <input type="hidden" id="mId"/>

    <div class="modal-btns">
      <button class="mbtn-cancel" onclick="closeModal()">Cancel</button>
      <button class="mbtn-confirm" id="mConfirmBtn" onclick="confirmActivate()">Activate + Send email →</button>
    </div>
  </div>
</div>

<script>


function show(name,el){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(l=>l.classList.remove('on'));
  document.getElementById('p-'+name).classList.add('on');
  const deskEl=document.getElementById('desk-link-'+name);
  const mobEl=document.getElementById('mob-link-'+name);
  if(deskEl)deskEl.classList.add('on');
  if(mobEl)mobEl.classList.add('on');
  const titles={dashboard:'Dashboard',companies:'Companies',messages:'Messages',add:'Add Company'};
  const pt=document.getElementById('ptitle');
  if(pt)pt.textContent=titles[name]||name;
  if(name==='messages')loadMessages();
  
  if(name==='add')initAddForm();
}

function toggleDrawer(){
  document.getElementById('hbg').classList.toggle('open');
  document.getElementById('drawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
  document.body.style.overflow=document.getElementById('drawer').classList.contains('open')?'hidden':'';
}
function closeDrawer(){
  document.getElementById('hbg').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow='';
}

function genCode(){
  const c='abcdefghijklmnopqrstuvwxyz0123456789';
  let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s;
}
let currentAddCode=genCode();
let currentModalCode=genCode();

function initAddForm(){
  currentAddCode=genCode();
  document.getElementById('codePreview').textContent=currentAddCode;
  document.getElementById('customCodeWrap').style.display='none';
}
function regenerateCode(){currentAddCode=genCode();document.getElementById('codePreview').textContent=currentAddCode}
function toggleCustomCode(){
  const wrap=document.getElementById('customCodeWrap');
  const shown=wrap.style.display!=='none';
  wrap.style.display=shown?'none':'block';
  document.querySelector('[onclick="toggleCustomCode()"]').textContent=shown?'Use a custom claim code instead →':'Use auto-generated code instead →';
}
function regenModalCode(){currentModalCode=genCode();document.getElementById('mCodePreview').textContent=currentModalCode}
function toggleModalCustom(){
  const wrap=document.getElementById('mCustomWrap');
  const shown=wrap.style.display!=='none';
  wrap.style.display=shown?'none':'block';
  document.getElementById('mToggleCustom').textContent=shown?'Use a custom claim code →':'Use auto-generated code instead →';
}

function validateCustomCode(input){
  const val=input.value.toLowerCase().trim();
  input.value=val;
  const hintId=input.id==='nCustomCode'?'customCodeHint':'mCustomHint';
  const hint=document.getElementById(hintId);
  if(!val){hint.textContent='3–20 chars · lowercase letters, numbers and _ only';hint.className='hint';return true}
  if(val.length<3){hint.textContent='Too short — minimum 3 characters';hint.className='hint err';return false}
  if(val.length>20){hint.textContent='Too long — maximum 20 characters';hint.className='hint err';return false}
  if(!/^[a-z0-9_]+$/.test(val)){hint.textContent='Only lowercase letters, numbers and underscores allowed';hint.className='hint err';return false}
  hint.textContent='✓ Looks good!';hint.className='hint ok';return true;
}

const ad=${activityData || '[]'};
const labels=ad.length?ad.map(d=>new Date(d.day).toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})):['No data'];
const counts=ad.length?ad.map(d=>d.count):[0];
if(document.getElementById('actChart')){
  new Chart(document.getElementById('actChart'),{type:'bar',data:{labels,datasets:[{data:counts,backgroundColor:'rgba(37,211,102,.12)',borderColor:'#25D366',borderWidth:2,borderRadius:8,hoverBackgroundColor:'rgba(37,211,102,.2)'}]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false},tooltip:{backgroundColor:'#111118',borderColor:'rgba(37,211,102,.2)',borderWidth:1,titleColor:'#fff',bodyColor:'rgba(255,255,255,.6)',padding:10,cornerRadius:8}},scales:{y:{beginAtZero:true,ticks:{color:'rgba(255,255,255,.3)',stepSize:1,font:{size:11}},grid:{color:'rgba(255,255,255,.04)'},border:{display:false}},x:{ticks:{color:'rgba(255,255,255,.3)',font:{size:11}},grid:{display:false},border:{display:false}}}}});
}

async function loadMessages(){
  try{
    const r=await fetch('/admin/messages-data');
    const d=await r.json();
    if(!d.messages||!d.messages.length){document.getElementById('msg-content').innerHTML='<div style="text-align:center;padding:48px 24px;color:rgba(255,255,255,.25);font-size:13px">No messages yet</div>';return;}
    document.getElementById('msg-content').innerHTML=\`<div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Company</th><th>Number</th><th>Direction</th><th>Message</th></tr></thead><tbody>\${d.messages.map(m=>\`<tr class="tr-hover"><td style="font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap">\${new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td style="font-weight:600;font-size:13px">\${m.company_name}</td><td style="font-size:12px;color:rgba(255,255,255,.4)">\${m.wa_number}</td><td>\${m.direction==='inbound'?'<span class="badge-green">↓ In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(59,130,246,.2)">↑ Out</span>'}</td><td style="font-size:12px;color:rgba(255,255,255,.5);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${m.media_type?'['+m.media_type.split('/')[0]+']':(m.body||'').substring(0,80)}</td></tr>\`).join('')}</tbody></table></div>\`;
  }catch(e){document.getElementById('msg-content').innerHTML='<div style="color:#f87171;font-size:13px">Error loading messages</div>';}
}

function activate(id,email){
  document.getElementById('mId').value=id;
  document.getElementById('mEmail').value=email||'';
  document.getElementById('mTwilio').value='';
  currentModalCode=genCode();
  document.getElementById('mCodePreview').textContent=currentModalCode;
  document.getElementById('mCustomWrap').style.display='none';
  document.getElementById('mToggleCustom').textContent='Use a custom claim code →';
  document.getElementById('emailStatus').className='email-status';
  document.getElementById('emailStatus').textContent='';
  document.getElementById('mConfirmBtn').disabled=false;
  document.getElementById('mConfirmBtn').textContent='Activate + Send email →';
  document.getElementById('actModal').classList.add('show');
}

function closeModal(){document.getElementById('actModal').classList.remove('show')}
document.getElementById('actModal').addEventListener('click',function(e){if(e.target===this)closeModal()});

async function confirmActivate(){
  const id=document.getElementById('mId').value;
  const email=document.getElementById('mEmail').value.trim();
  const twilio=document.getElementById('mTwilio').value.trim();
  const customVisible=document.getElementById('mCustomWrap').style.display!=='none';
  const code=customVisible?document.getElementById('mCustomCode').value.trim().toLowerCase():currentModalCode;

  if(!email){alert('Please enter the company email address');return}
  if(!email.includes('@')){alert('Please enter a valid email address');return}
  if(!twilio){alert('Please enter a Twilio number');return}
  if(!code){alert('Please enter a claim code');return}
  if(customVisible&&!validateCustomCode(document.getElementById('mCustomCode'))){return}

  const btn=document.getElementById('mConfirmBtn');
  btn.disabled=true;btn.textContent='Activating...';

  const r=await fetch('/admin/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,email,twilio_number:twilio,claim_code:code})});
  const d=await r.json();

  if(d.success){
    const status=document.getElementById('emailStatus');
    if(d.emailSent){
      status.textContent='✓ Activation email sent to '+d.emailTo;
      status.className='email-status sent';
    }else{
      status.textContent='⚠ Activated but email could not be sent — check RESEND_API_KEY in Render environment variables';      status.className='email-status failed';
    }
    btn.textContent='Done!';
    setTimeout(()=>{closeModal();location.reload()},2500);
  }else{
    btn.disabled=false;btn.textContent='Activate + Send email →';
    alert('Error: '+d.error);
  }
}

async function deactivate(id){
  if(!confirm('Deactivate this company?'))return;
  const r=await fetch('/admin/deactivate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const d=await r.json();
  if(d.success)location.reload();else alert('Error: '+d.error);
}

async function deleteTenant(id){
  if(!confirm('Permanently delete this company and all its data?'))return;
  const r=await fetch('/admin/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const d=await r.json();
  if(d.success)location.reload();else alert('Error: '+d.error);
}

async function addTenant(){
  const co=document.getElementById('nCo').value.trim();
  const email=document.getElementById('nEmail').value.trim();
  const tw=document.getElementById('nTwilio').value.trim();
  const tok=document.getElementById('nToken').value.trim();
  const customVisible=document.getElementById('customCodeWrap').style.display!=='none';
  const code=customVisible?document.getElementById('nCustomCode').value.trim().toLowerCase():currentAddCode;
  if(!co||!tw||!tok){alert('Please fill in all fields');return}
  if(customVisible&&!validateCustomCode(document.getElementById('nCustomCode'))){return}
  const r=await fetch('/admin/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company:co,email,twilio_number:tw,slack_bot_token:tok,claim_code:code})});
  const d=await r.json();
  if(d.success)location.reload();else alert('Error: '+d.error);
}

window.addEventListener('resize',()=>{if(window.innerWidth>960)closeDrawer()});
initAddForm();
</script>
</body></html>`);
  } catch(err){
    console.error('Admin error:',err.message);
    res.status(500).send('Error: '+err.message);
  }
});

router.get('/messages-data', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.body, m.direction, m.created_at, m.media_type, c.wa_number, t.company_name
      FROM messages m JOIN contacts c ON c.id = m.contact_id JOIN tenants t ON t.id = m.tenant_id
      ORDER BY m.created_at DESC LIMIT 50
    `);
    res.json({ messages: result.rows });
  } catch(err){ res.json({ messages: [] }); }
});

router.get('/tenant/:id', auth, async (req, res) => {
  try {
    
    const { id } = req.params;
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (!tenant.rows.length) return res.send('Not found');
    const t = tenant.rows[0];
    const [contacts, messages] = await Promise.all([
      pool.query('SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC', [id]),
      pool.query(`SELECT m.*, c.wa_number FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.tenant_id = $1 ORDER BY m.created_at DESC LIMIT 20`, [id]),
    ]);
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t.company_name} — Syncora</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#060608;color:#fff;padding:24px;min-height:100vh}a{color:#25D366;text-decoration:none;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;margin-bottom:24px}.card{background:#111118;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;margin-bottom:16px}h1{font-size:22px;font-weight:800;margin-bottom:6px}.ig{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}.il label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);display:block;margin-bottom:5px}.il span{font-size:14px;font-weight:500;color:rgba(255,255,255,.8)}h2{font-size:15px;font-weight:700;margin-bottom:14px}.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}table{width:100%;border-collapse:collapse;min-width:500px}th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.8px;background:rgba(255,255,255,.03)}td{padding:10px 14px;border-top:1px solid rgba(255,255,255,.05);font-size:13px;color:rgba(255,255,255,.7)}.bg{background:rgba(37,211,102,.1);color:#4ade80;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(37,211,102,.2)}.by{background:rgba(245,158,11,.1);color:#fbbf24;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)}</style></head><body>
<a href="/admin">← Back to admin</a>
<div class="card"><h1>${t.company_name}</h1>
<div style="margin-bottom:18px">${t.is_active?'<span class="bg">Active</span>':'<span class="by">Pending</span>'}<span style="font-size:12px;color:rgba(255,255,255,.3);margin-left:10px">Created ${new Date(t.created_at).toLocaleDateString()}</span></div>
<div class="ig">
  <div class="il"><label>Claim code</label><span><code style="background:rgba(37,211,102,.08);color:#25D366;padding:2px 8px;border-radius:5px">${t.claim_code||'Not set'}</code></span></div>
  <div class="il"><label>Twilio number</label><span>${t.twilio_number||'Not set'}</span></div>
  <div class="il"><label>Email</label><span>${t.email||'Not set'}</span></div>
  <div class="il"><label>Slack workspace</label><span>${t.slack_team_name||'Not connected'}</span></div>
</div></div>
<div class="card"><h2>Contacts (${contacts.rows.length})</h2>
<div class="tbl"><table><thead><tr><th>WhatsApp number</th><th>Display name</th><th>Slack channel</th><th>Blocked</th><th>Added</th></tr></thead>
<tbody>${contacts.rows.map(c=>`<tr><td>${c.wa_number}</td><td style="color:rgba(255,255,255,.5)">${c.display_name||'-'}</td><td><code style="background:rgba(255,255,255,.05);padding:1px 6px;border-radius:4px;font-size:11px">${c.slack_channel}</code></td><td>${c.blocked?'<span style="color:#f87171">Blocked</span>':'<span style="color:#4ade80">✓</span>'}</td><td style="color:rgba(255,255,255,.3);font-size:12px">${new Date(c.created_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><h2>Recent messages (last 20)</h2>
<div class="tbl"><table><thead><tr><th>Time</th><th>Number</th><th>Direction</th><th>Message</th></tr></thead>
<tbody>${messages.rows.map(m=>`<tr><td style="font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap">${new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td style="font-size:12px">${m.wa_number}</td><td>${m.direction==='inbound'?'<span class="bg">↓ In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(59,130,246,.2)">↑ Out</span>'}</td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.media_type?'['+m.media_type+']':(m.body||'')}</td></tr>`).join('')}</tbody></table></div></div>
</body></html>`);
  } catch(err){ res.status(500).send('Error: '+err.message); }
});

// ── Activate (saves email + sends activation email) ─────────
router.post('/activate', auth, async (req, res) => {
  try {
    const { id, email, twilio_number, claim_code } = req.body;

    const validationError = validateClaimCode(claim_code);
    if (validationError) return res.json({ success: false, error: validationError });

    if (!email || !email.includes('@')) return res.json({ success: false, error: 'Valid email is required' });

    // Check claim code uniqueness
    const existing = await pool.query(
      'SELECT id FROM tenants WHERE LOWER(claim_code) = $1 AND id != $2',
      [claim_code.toLowerCase().trim(), id]
    );
    if (existing.rows.length) return res.json({ success: false, error: 'This claim code is already taken — try a different one' });

    // Save email + activate
    await pool.query(
      'UPDATE tenants SET is_active = TRUE, twilio_number = $1, claim_code = $2, email = $3 WHERE id = $4',
      [twilio_number, claim_code.toLowerCase().trim(), email.trim(), id]
    );

    // Send activation email
    let emailSent = false;
    try {
      await sendActivationEmail({
        to: email.trim(),
        companyName: (await pool.query('SELECT company_name FROM tenants WHERE id = $1', [id])).rows[0].company_name,
        claimCode: claim_code.toLowerCase().trim(),
        twilioNumber: twilio_number,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    res.json({ success: true, emailSent, emailTo: email.trim() });
  } catch(err){ res.json({ success: false, error: err.message }); }
});

router.post('/deactivate', auth, async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('UPDATE tenants SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch(err){ res.json({ success: false, error: err.message }); }
});

router.post('/delete', auth, async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch(err){ res.json({ success: false, error: err.message }); }
});

router.post('/add', auth, async (req, res) => {
  try {
    const { company, email, twilio_number, slack_bot_token, claim_code } = req.body;
    if (!company || !twilio_number || !slack_bot_token) return res.json({ success: false, error: 'Please fill in all required fields' });

    const validationError = validateClaimCode(claim_code);
    if (validationError) return res.json({ success: false, error: validationError });

    const existing = await pool.query('SELECT id FROM tenants WHERE LOWER(claim_code) = $1', [claim_code.toLowerCase().trim()]);
    if (existing.rows.length) return res.json({ success: false, error: 'This claim code is already taken' });

    await pool.query(
      `INSERT INTO tenants (company_name, email, twilio_number, slack_bot_token, slack_team_id, slack_team_name, claim_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [company, email || null, twilio_number, slack_bot_token, 'MANUAL', company, claim_code.toLowerCase().trim()]
    );
    res.json({ success: true });
  } catch(err){ res.json({ success: false, error: err.message }); }
});

router.get('/waitlist', auth, async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id         SERIAL PRIMARY KEY,
        email      VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const result = await pool.query(
      'SELECT email, created_at FROM waitlist ORDER BY created_at DESC'
    );
    const rows = result.rows.map(r => `
      <tr>
        <td>${r.email}</td>
        <td style="color:rgba(255,255,255,.4);font-size:12px">
          ${new Date(r.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}
        </td>
      </tr>`).join('');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Waitlist — Syncora Admin</title>
<link rel="icon" type="image/png" href="/logo.png"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);--t:#ffffff;--t2:rgba(255,255,255,.75);--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2);--sidebar:240px;--topbar:60px}
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
.sb-user{display:flex;align-items:center;gap:10px}
.sb-avatar{width:30px;height:30px;border-radius:8px;background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--g)}
.sb-uname{font-size:13px;font-weight:600;color:var(--t2)}
.sb-urole{font-size:11px;color:var(--t4)}
.main{margin-left:var(--sidebar);flex:1;min-height:100vh}
.topbar{height:var(--topbar);background:var(--bg1);border-bottom:1px solid var(--b1);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.topbar-title{font-size:15px;font-weight:700;color:var(--t)}
.content{padding:24px 28px}
.card{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:22px}
.tbl-wrap{overflow-x:auto;border-radius:12px;border:1px solid var(--b1)}
table{width:100%;border-collapse:collapse}
thead tr{background:var(--bg3)}
th{padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:var(--t4);text-transform:uppercase;letter-spacing:.8px}
td{padding:13px 16px;border-top:1px solid var(--b1);font-size:13px;vertical-align:middle}
.count-badge{background:rgba(37,211,102,.1);color:#4ade80;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;border:1px solid rgba(37,211,102,.2)}
@media(max-width:960px){.sidebar{display:none}.main{margin-left:0}.content{padding:16px}}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="sb-top">
    <img src="/logo_text.png" alt="Syncora" style="height:26px;width:auto;filter:brightness(0) invert(1)"/>
  </div>
  <nav class="sb-nav">
    <div class="sb-section">Main</div>
    <a href="/admin" class="sb-link"><span class="sb-icon" style="font-size:11px;font-weight:800;color:var(--t3)">DB</span>Dashboard</a>
    <a href="/admin?panel=companies" class="sb-link"><span class="sb-icon" style="font-size:11px;font-weight:800;color:var(--t3)">CO</span>Companies</a>
    <a href="/admin?panel=messages" class="sb-link"><span class="sb-icon" style="font-size:11px;font-weight:800;color:var(--t3)">MSG</span>Messages</a>
    <a href="/admin/waitlist" class="sb-link on"><span class="sb-icon" style="font-size:13px;font-weight:700;color:var(--t3)">@</span>Waitlist</a>
    <div class="sb-section">Actions</div>
    <a href="/admin?panel=add" class="sb-link"><span class="sb-icon">+</span>Add company</a>
    <a href="/admin" class="sb-link"><span class="sb-icon">↺</span>Refresh</a>
  </nav>
  <div class="sb-bottom">
    <a href="/admin/logout" class="sb-link" style="margin-bottom:12px;text-decoration:none"><span class="sb-icon">←</span>Logout</a>
    <div class="sb-user">
      <div class="sb-avatar">A</div>
      <div><div class="sb-uname">Admin</div><div class="sb-urole">Syncora admin</div></div>
    </div>
  </div>
</aside>

<div class="main">
  <div class="topbar">
    <div class="topbar-title">Waitlist</div>
    <span class="count-badge">${result.rows.length} signups</span>
  </div>
  <div class="content">
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Email</th><th>Signed up</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2" style="color:rgba(255,255,255,.3);text-align:center;padding:24px">No signups yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>
</div>
</body></html>`);
  } catch (err) {
    console.error('[WAITLIST ERROR]', err.message);
    res.status(500).send('Error: ' + err.message);
  }
});

module.exports = router;
