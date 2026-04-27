const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const PLANS = {
  starter:  { label:'Starter',  price:'€0',  msgLimit:200, workspaces:1   },
  pro:      { label:'Pro',      price:'€29', msgLimit:-1,  workspaces:3   },
  business: { label:'Business', price:'€79', msgLimit:-1,  workspaces:999 },
};

const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  res.redirect('/auth/login');
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    if (!userResult.rows.length) { req.session.destroy(); return res.redirect('/auth/login'); }
    const user = userResult.rows[0];
    const tenantsResult = await pool.query('SELECT * FROM tenants WHERE LOWER(email) = $1 ORDER BY created_at ASC', [user.email.toLowerCase()]);
    const tenants = tenantsResult.rows;
    const plan = (tenants[0] && tenants[0].plan) ? tenants[0].plan : 'starter';
    const planInfo = PLANS[plan] || PLANS.starter;
    const maxWorkspaces = planInfo.workspaces;
    const canAddWorkspace = tenants.length < maxWorkspaces;

    const statsResults = await Promise.all(tenants.map(t => Promise.all([
      pool.query('SELECT COUNT(*) as total FROM messages WHERE tenant_id = $1', [t.id]),
      pool.query("SELECT COUNT(*) as today FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'", [t.id]),
    ])));

    const totalMsgs = statsResults.reduce((s,r) => s + parseInt(r[0].rows[0].total), 0);
    const todayMsgs = statsResults.reduce((s,r) => s + parseInt(r[1].rows[0].today), 0);

    const wsCards = tenants.length === 0
      ? '<div style="text-align:center;padding:48px;background:#0c0c12;border:1px dashed rgba(255,255,255,.08);border-radius:16px"><div style="font-size:32px;margin-bottom:12px">🔗</div><div style="font-size:15px;font-weight:600;color:rgba(255,255,255,.4);margin-bottom:16px">No workspaces connected yet</div><a href="/onboarding" style="background:#25D366;color:#000;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none">Connect Slack →</a></div>'
      : tenants.map((t,i) => {
          const total = parseInt(statsResults[i][0].rows[0].total);
          const today = parseInt(statsResults[i][1].rows[0].today);
          const limit = planInfo.msgLimit;
          const pct = limit > 0 ? Math.min(100, Math.round(today/limit*100)) : 0;
          const barColor = pct > 80 ? '#f87171' : pct > 60 ? '#fbbf24' : '#25D366';
          return '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"adding:22px;position:relative;overflow:hidden">'
            + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#25D366,transparent)"></div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
            + '<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#25D366">' + t.company_name.charAt(0).toUpperCase() + '</div>'
            + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + (t.slack_team_name||t.company_name) + '</div><div style="font-size:11px;color:rgba(255,255,255,.3)">Slack workspace</div></div></div>'
            + (t.is_active ? '<span style="background:rgba(37,211,102,.1);color:#4ade80;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(37,211,102,.2)">Active</span>' : '<span style="background:rgba(245,158,11,.1);color:#fbbf24;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(245,158,11,.2)">Pending</span>')
            + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
            + '<div style="background:#16161f;border-radius:10px;padding:12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:4px">Total</div><div style="font-size:22px;font-weight:800;color:#fff">' + total + '</div></div>'
            + '<div style="background:#16161f;border-radius:10px;padding:12px"><div data-goto="overview" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer">Today</div><div style="font-size:22px;font-weight:800;color:#25D366">' + today + '</div></div>'
            + '</div>'
            + (limit > 0 ? '<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.3);margin-bottom:5px"><span>Daily usage</span><span>' + today + ' / ' + limit + '</span></div><div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px"></div></div></div>' : '')
            + (t.claim_code ? '<div style="background:#16161f;border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.25);margin-bottom:3px">Claim code</div><div style="font-size:16px;font-weight:800;color:#25D366;letter-spacing:3px;font-family:monospace">' + t.claim_code + '</div></div><button onclick="navigator.clipboard.writeText(\'' + t.claim_code + '\').then(function(){this.textContent=\'✓\';}.bind(this))" style="background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);padding:6px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer">Copy</button></div>' : '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:10px;padding:10px 14px;font-size:12px;color:#fbbf24">⏳ Awaiting activation</div>')
            + '</div>';
        }).join('');

    res.send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Dashboard — Syncora</title><link rel="icon" type="image/png" href="/logo.png"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/><style>'
      + '*{margin:0;padding:0;box-sizing:border-box}:root{--g:#25D366;--gd:#1aad52;--bg:#060608;--bg1:#0c0c12;--bg2:#111118;--bg3:#16161f;--b1:rgba(255,255,255,.06);--b2:rgba(255,255,255,.1);--t:#fff;--t3:rgba(255,255,255,.4);--t4:rgba(255,255,255,.2);--sidebar:240px}'
      + 'html,body{height:100%}body{font-family:\'Inter\',sans-serif;background:var(--bg);color:var(--t);display:flex;-webkit-font-smoothing:antialiased}'
      + '.sidebar{width:var(--sidebar);min-height:100vh;background:var(--bg1);border-right:1px solid var(--b1);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100}'
      + '.sb-top{padding:20px 18px;border-bottom:1px solid var(--b1)}.sb-nav{padding:12px 10px;flex:1}'
      + '.sb-link{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;color:var(--t3);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;margin-bottom:2px;text-decoration:none}'
      + '.sb-link:hover{background:var(--b1);color:rgba(255,255,255,.75)}.sb-link.on{background:rgba(37,211,102,.1);color:var(--g)}'
      + '.sb-section{font-size:10px;font-weight:700;color:var(--t4);letter-spacing:2px;text-transform:uppercase;padding:14px 8px 6px}'
      + '.sb-bottom{padding:16px 18px;border-top:1px solid var(--b1)}'
      + '.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column}'
      + '.topbar{height:60px;background:var(--bg1);border-bottom:1px solid var(--b1);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}'
      + '.content{padding:28px;flex:1;max-width:1200px;width:100%}'
      + '.panel{display:none}.panel.on{display:block}'
      + '.card{background:var(--bg2);border:1px solid var(--b1);border-radius:16px;padding:24px;margin-bottom:20px}'
      + '.fg label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--t4);margin-bottom:6px}'
      + '.fg input{width:100%;padding:11px 14px;background:var(--bg3);border:1px solid var(--b1);border-radius:10px;font-size:14px;color:#fff;outline:none;font-family:\'Inter\',sans-serif;transition:border-color .2s;margin-bottom:14px}'
      + '.fg input:focus{border-color:rgba(37,211,102,.4)}.fg input:disabled{opacity:.5}'
      + '.btn{background:var(--g);color:#000;padding:10px 20px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;transition:all .2s}'
      + '.btn:hover{background:var(--gd)}.btn-ghost{background:rgba(255,255,255,.04);color:rgba(255,255,255,.6);padding:10px 20px;border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif}'
      + '.btn-red{background:rgba(239,68,68,.1);color:#f87171;padding:10px 20px;border:1px solid rgba(239,68,68,.2);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Inter\',sans-serif}'
      + '.msg{font-size:13px;margin-top:10px;padding:10px 14px;border-radius:8px;display:none}'
      + '.msg.ok{background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);display:block}'
      + '.msg.err{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);display:block}'
      + '.ws-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px}'
      + '.mob-bar{display:none;position:fixed;top:0;left:0;right:0;height:52px;background:var(--bg1);border-bottom:1px solid var(--b1);z-index:200;padding:0 16px;align-items:center;justify-content:space-between}.hbg{width:36px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;border-radius:8px;background:var(--b1);border:none}.hbg span{width:16px;height:2px;background:rgba(255,255,255,.7);border-radius:2px;display:block}.mob-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:150}.mob-ov.show{display:block}.mob-dr{position:fixed;top:52px;left:0;right:0;bottom:0;background:var(--bg1);z-index:160;padding:16px 12px;transform:translateY(-100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;border-top:1px solid var(--b1)}.mob-dr.open{transform:translateY(0)}.mob-dr .sb-link{padding:12px 14px;font-size:14px}@media(max-width:900px){.sidebar{display:none}.mob-bar{display:flex}.main{margin-left:0;padding-top:52px}.topbar{display:none}.content{padding:16px}.ws-grid{grid-template-columns:1fr}}'
      + '</style></head><body>'
      + '<div class="mob-bar"><img src="/logo_text.png" alt="Syncora" style="height:20px;filter:brightness(0) invert(1)"/><button class="hbg" onclick="toggleDrawer()"><span></span><span></span><span></span></button></div><div class="mob-ov" id="mob-ov" onclick="closeDrawer()"></div><div class="mob-dr" id="mob-dr"><a class="sb-link on" href="#" data-tab="overview" onclick="mobTab(this)">Overview</a><a class="sb-link" href="#" data-tab="workspaces" onclick="mobTab(this)">Workspaces</a><a class="sb-link" href="#" data-tab="account" onclick="mobTab(this)">Account</a><div style="height:1px;background:rgba(255,255,255,.06);margin:12px 0"></div><a class="sb-link" href="/auth/logout">Sign out</a></div><aside class="sidebar"><div class="sb-top"><img src="/logo_text.png" alt="Syncora" style="height:24px;filter:brightness(0) invert(1)"/></div>'
      + '<nav class="sb-nav"><div class="sb-section">Dashboard</div>'
      + '<a class="sb-link on" href="#" onclick="showTab(\'overview\',this);return false"><span style="width:22px;text-align:center">⬛</span>Overview</a>'
      + '<a class="sb-link" href="#" onclick="showTab(\'workspaces\',this);return false"><span style="width:22px;text-align:center">🔗</span>Workspaces</a>'
      + '<a class="sb-link" href="#" onclick="showTab(\'account\',this);return false"><span style="width:22px;text-align:center">👤</span>Account</a>'
      + '<div class="sb-section">Plan</div>'
      + '<div style="margin:4px 10px;background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.12);border-radius:10px;padding:12px"><div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:4px">Current plan</div><div style="font-size:14px;font-weight:800;color:#25D366">' + planInfo.label + '</div><div style="font-size:11px;color:rgba(255,255,255,.25);margin-top:2px">' + planInfo.price + '/mo</div>'
      + (plan === 'starter' ? '<a href="/#pricing" style="display:block;text-align:center;margin-top:10px;background:#25D366;color:#000;padding:6px;border-radius:7px;font-size:11px;font-weight:700;text-decoration:none">Upgrade →</a>' : '')
      + '</div></nav>'
      + '<div class="sb-bottom"><div style="display:flex;align-items:center;gap:10px"><div style="width:30px;height:30px;border-radius:8px;background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#25D366">' + user.full_name.charAt(0).toUpperCase() + '</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + user.full_name + '</div><div style="font-size:11px;color:rgba(255,255,255,.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + user.email + '</div></div>'
      + '<a href="/auth/logout" style="color:rgba(255,255,255,.3);font-size:14px;text-decoration:none;flex-shrink:0" onmouseover="this.style.color=\'#f87171\'" onmouseout="this.style.color=\'rgba(255,255,255,.3)\'">→</a></div></div></aside>'
      + '<div class="main"><div class="topbar"><div style="font-size:15px;font-weight:700" id="ttl">Overview</div>'
      + '<div style="display:flex;align-items:center;gap:6px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);color:#25D366;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600"><span style="width:6px;height:6px;background:#25D366;border-radius:50%;display:inline-block"></span>' + planInfo.label + '</div></div>'
      + '<div class="content">'

      // OVERVIEW
      + '<div id="tab-overview" class="panel on">'
      + '<div style="font-size:22px;font-weight:800;margin-bottom:4px">Welcome back, ' + user.full_name.split(' ')[0] + ' 👋</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px">' + user.company_name + ' · ' + planInfo.label + ' plan</div>'
      + (plan === 'starter' ? '<div style="background:linear-gradient(135deg,rgba(37,211,102,.08),rgba(96,165,250,.06));border:1px solid rgba(37,211,102,.15);border-radius:16px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px"><div><div style="font-size:14px;font-weight:700;margin-bottom:4px">🚀 Upgrade to Pro</div><div style="font-size:13px;color:rgba(255,255,255,.4)">Unlimited messages, 3 workspaces, priority support — €29/mo</div></div><a href="/#pricing" style="background:#25D366;color:#000;padding:9px 20px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap">View plans →</a></div>' : '')
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px">'
      + '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Workspaces</div><div style="font-size:36px;font-weight:900;letter-spacing:-1px">' + tenants.length + '<span style="font-size:16px;color:rgba(255,255,255,.25);font-weight:500"> / ' + (maxWorkspaces === 999 ? '∞' : maxWorkspaces) + '</span></div><div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#25D366,transparent)"></div></div>'
      + '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"><div data-goto="overview" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer">Total messages</div><div style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#a78bfa">' + totalMsgs.toLocaleString() + '</div><div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#8b5cf6,transparent)"></div></div>'
      + '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Today</div><div style="font-size:36px;font-weight:900;letter-spacing:-1px;color:#25D366">' + todayMsgs + '</div><div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#25D366,transparent)"></div></div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="font-size:15px;font-weight:700">Your workspaces</div>'
      + (canAddWorkspace ? '<a href="/onboarding?email=' + encodeURIComponent(user.email) + '" style="background:#25D366;color:#000;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none">+ Add workspace</a>' : '<a href="/#pricing" style="background:rgba(37,211,102,.1);color:#4ade80;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none;border:1px solid rgba(37,211,102,.2)">Upgrade for more →</a>')
      + '</div><div class="ws-grid">' + wsCards + '</div></div>'

      // WORKSPACES
      + '<div id="tab-workspaces" class="panel">'
      + '<div style="font-size:22px;font-weight:800;margin-bottom:4px">Workspaces</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px">' + tenants.length + ' of ' + (maxWorkspaces === 999 ? '∞' : maxWorkspaces) + ' used</div>'
      + '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">'
      + (canAddWorkspace ? '<a href="/onboarding?email=' + encodeURIComponent(user.email) + '" style="background:#25D366;color:#000;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700;text-decoration:none">+ Connect Slack</a>' : '<a href="/#pricing" style="background:rgba(37,211,102,.1);color:#4ade80;padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700;text-decoration:none;border:1px solid rgba(37,211,102,.2)">Upgrade to add more →</a>')
      + '</div><div class="ws-grid">' + wsCards + '</div></div>'

      // ACCOUNT
      + '<div id="tab-account" class="panel">'
      + '<div style="font-size:22px;font-weight:800;margin-bottom:4px">Account</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.35);margin-bottom:24px">Manage your profile and security</div>'
      + '<div class="card"><div style="font-size:14px;font-weight:700;margin-bottom:16px">👤 Personal information</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
      + '<div class="fg"><label>Full name</label><input type="text" id="uName" value="' + user.full_name.replace(/"/g,'&quot;') + '"/></div>'
      + '<div class="fg"><label>Email</label><input type="email" value="' + user.email + '" disabled/></div>'
      + '<div class="fg"><label>Company</label><input type="text" id="uCo" value="' + user.company_name.replace(/"/g,'&quot;') + '"/></div>'
      + '</div><button class="btn" onclick="saveProfile()">Save changes</button><div id="profMsg" class="msg"></div></div>'
      + '<div class="card"><div style="font-size:14px;font-weight:700;margin-bottom:16px">🔒 Change password</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
      + '<div class="fg"><label>Current password</label><input type="password" id="uCurr"/></div>'
      + '<div class="fg"><label>New password</label><input type="password" id="uNew"/></div>'
      + '</div><button class="btn" onclick="changePwd()">Update password</button><div id="pwdMsg" class="msg"></div></div>'
      + '<div class="card"><div style="font-size:14px;font-weight:700;margin-bottom:16px">💳 Plan</div>'
      + '<div style="font-size:24px;font-weight:900;margin-bottom:4px">' + planInfo.label + ' <span style="font-size:14px;color:rgba(255,255,255,.35);font-weight:400">' + planInfo.price + '/mo</span></div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:16px">' + (planInfo.msgLimit > 0 ? planInfo.msgLimit + ' msg/day' : 'Unlimited messages') + ' · ' + (maxWorkspaces === 999 ? 'Unlimited workspaces' : maxWorkspaces + ' workspace' + (maxWorkspaces > 1 ? 's' : '')) + '</div>'
      + (plan !== 'business' ? '<a href="/#pricing" class="btn" style="text-decoration:none;display:inline-block">Upgrade plan →</a>' : '<span style="color:#4ade80;font-size:13px;font-weight:600">✓ Max plan</span>')
      + '</div>'
      + '<div class="card" style="border-color:rgba(239,68,68,.15)"><div style="font-size:14px;font-weight:700;color:#f87171;margin-bottom:12px">⚠ Danger zone</div>'
      + '<p style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:16px">Permanently delete your account and all data. Cannot be undone.</p>'
      + '<button class="btn-red" onclick="delAccount()">Delete account</button><div id="delMsg" class="msg"></div></div>'
      + '</div>'
      + '</div></div>'

      + '<script>'
      + 'function showTab(n,el){if(!n)return;document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("on")});document.querySelectorAll(".sb-link").forEach(function(l){l.classList.remove("on")});document.getElementById("tab-"+n).classList.add("on");if(el)el.classList.add("on");var t={overview:"Overview",workspaces:"Workspaces",account:"Account"};var ttl=document.getElementById("ttl");if(ttl)ttl.textContent=t[n]||n;}'
      + 'async function saveProfile(){var n=document.getElementById("uName").value.trim();var c=document.getElementById("uCo").value.trim();var m=document.getElementById("profMsg");var r=await fetch("/dashboard/update-profile",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:n,company_name:c})});var d=await r.json();showMsg(m,d.success?"✓ Saved":"Error: "+d.error,d.success);}'
      + 'async function changePwd(){var c=document.getElementById("uCurr").value;var n=document.getElementById("uNew").value;var m=document.getElementById("pwdMsg");if(n.length<8){showMsg(m,"Min 8 characters",false);return;}var r=await fetch("/dashboard/change-password",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({current:c,newPassword:n})});var d=await r.json();showMsg(m,d.success?"✓ Updated":"Error: "+d.error,d.success);}'
      + 'async function delAccount(){if(!confirm("Delete your account and all data permanently?"))return;var r=await fetch("/dashboard/delete-account",{method:"POST",credentials:"same-origin"});var d=await r.json();if(d.success)window.location.href="/";else showMsg(document.getElementById("delMsg"),"Error: "+d.error,false);}'
      + 'window.history.pushState({},"","/dashboard");window.addEventListener("popstate",function(){window.history.pushState({},"","/dashboard");showTab("overview",null);});function mobTab(el){var tab=el.getAttribute("data-tab");showTab(tab,el);closeDrawer();return false;}function toggleDrawer(){document.getElementById("mob-dr").classList.toggle("open");document.getElementById("mob-ov").classList.toggle("show");}function closeDrawer(){document.getElementById("mob-dr").classList.remove("open");document.getElementById("mob-ov").classList.remove("show");}function showMsg(el,txt,ok){el.textContent=txt;el.className="msg "+(ok?"ok":"err");setTimeout(function(){el.className="msg";},4000);}'
      + '</script></body></html>');

  } catch(err) {
    console.error('[DASHBOARD ERROR]', err.message);
    res.status(500).send('Error: ' + err.message);
  }
});

router.post('/update-profile', requireAuth, async (req, res) => {
  try {
    const { full_name, company_name } = req.body;
    if (!full_name) return res.json({ success: false, error: 'Name required' });
    await pool.query('UPDATE users SET full_name=$1, company_name=$2 WHERE id=$3', [full_name.trim(), company_name||'', req.session.userId]);
    req.session.userName = full_name.trim();
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current, newPassword } = req.body;
    if (!current || !newPassword) return res.json({ success: false, error: 'Both fields required' });
    if (newPassword.length < 8) return res.json({ success: false, error: 'Min 8 characters' });
    const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.session.userId]);
    const valid = await bcrypt.compare(current, result.rows[0].password_hash);
    if (!valid) return res.json({ success: false, error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.session.userId]);
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

router.post('/delete-account', requireAuth, async (req, res) => {
  try {
    const user = await pool.query('SELECT email FROM users WHERE id=$1', [req.session.userId]);
    if (user.rows.length) await pool.query('DELETE FROM tenants WHERE LOWER(email)=$1', [user.rows[0].email.toLowerCase()]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.session.userId]);
    req.session.destroy();
    res.json({ success: true });
  } catch(err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
