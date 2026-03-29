// // src/routes/admin.js
// const express = require('express');
// const router  = express.Router();
// const { pool } = require('../db');
// require('dotenv').config();

// const auth = (req, res, next) => {
//   try {
//     const pwd = (req.query && req.query.pwd) || (req.body && req.body.pwd) || '';
//     if (pwd !== process.env.ADMIN_PASSWORD) {
//       return res.send(`
//         <!DOCTYPE html><html><head><title>Admin Login</title>
//         <style>
//           body{font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;background:#f0fff4;margin:0}
//           .box{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;width:320px}
//           h2{color:#25D366;margin-bottom:24px}
//           input{width:100%;padding:12px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:16px}
//           button{width:100%;padding:12px;background:#25D366;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
//         </style></head>
//         <body><div class="box">
//           <h2>🔐 Admin Login</h2>
//           <form method="GET" action="/admin">
//             <input type="password" name="pwd" placeholder="Enter admin password" />
//             <button type="submit">Login</button>
//           </form>
//         </div></body></html>
//       `);
//     }
//     next();
//   } catch (err) {
//     console.error('Auth error:', err.message);
//     res.status(500).send('Auth error');
//   }
// };

// router.get('/', auth, async (req, res) => {
//   try {
//     const pwd = (req.query && req.query.pwd) || '';
//     const tenants = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');

//     const rows = tenants.rows.map(t => `
//       <tr>
//         <td>${t.id}</td>
//         <td><strong>${t.company_name}</strong></td>
//         <td>${t.twilio_number}</td>
//         <td><code>${t.claim_code || '-'}</code></td>
//         <td>${t.slack_team_name || '-'}</td>
//         <td>${t.is_active ? '<span class="badge active">✅ Active</span>' : '<span class="badge pending">⏳ Pending</span>'}</td>
//         <td>${new Date(t.created_at).toLocaleDateString()}</td>
//         <td>
//           ${!t.is_active
//             ? `<button onclick="activate(${t.id})" class="btn-activate">Activate</button>`
//             : `<button onclick="deactivate(${t.id})" class="btn-deactivate">Deactivate</button>`
//           }
//           <button onclick="deleteTenant(${t.id})" class="btn-delete">Delete</button>
//         </td>
//       </tr>
//     `).join('');

//     res.send(`
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8">
//         <title>Admin Panel — WA Bridge</title>
//         <style>
//           *{margin:0;padding:0;box-sizing:border-box}
//           body{font-family:Arial;background:#f0fff4;min-height:100vh}
//           .header{background:#25D366;padding:16px 32px;display:flex;align-items:center;justify-content:space-between}
//           .header h1{color:white;font-size:20px}
//           .header span{color:rgba(255,255,255,0.8);font-size:13px}
//           .container{padding:32px}
//           .stats{display:flex;gap:20px;margin-bottom:32px;flex-wrap:wrap}
//           .stat{background:white;padding:20px 28px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);min-width:160px}
//           .stat h3{font-size:32px;color:#25D366}
//           .stat p{color:#777;font-size:13px;margin-top:4px}
//           h2{color:#1a1a2e;margin-bottom:16px;font-size:20px}
//           table{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin-bottom:32px}
//           th{background:#25D366;color:white;padding:12px 16px;text-align:left;font-size:14px}
//           td{padding:12px 16px;border-bottom:1px solid #eee;font-size:14px}
//           tr:last-child td{border-bottom:none}
//           .badge{padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold}
//           .badge.active{background:#d5f5e3;color:#1b5e20}
//           .badge.pending{background:#fff9c4;color:#795548}
//           .btn-activate{background:#25D366;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-right:4px}
//           .btn-deactivate{background:#ff9800;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-right:4px}
//           .btn-delete{background:#f44336;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px}
//           .add-form{background:white;padding:28px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin-bottom:32px}
//           .form-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
//           .form-group{flex:1;min-width:200px}
//           .form-group label{display:block;font-size:13px;font-weight:bold;color:#333;margin-bottom:6px}
//           .form-group input{width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px}
//           .btn-add{background:#25D366;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
//           .modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100;justify-content:center;align-items:center}
//           .modal.show{display:flex}
//           .modal-box{background:white;padding:32px;border-radius:12px;width:400px}
//           .modal-box h3{margin-bottom:16px;color:#1a1a2e}
//           .modal-box input{width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px}
//           .modal-btns{display:flex;gap:12px}
//           .modal-btns button{flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
//           .btn-confirm{background:#25D366;color:white}
//           .btn-cancel{background:#eee;color:#333}
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <h1>🛠️ Admin Panel — WhatsApp ↔ Slack Bridge</h1>
//           <span>Logged in as Admin</span>
//         </div>
//         <div class="container">
//           <div class="stats">
//             <div class="stat"><h3>${tenants.rows.length}</h3><p>Total Tenants</p></div>
//             <div class="stat"><h3>${tenants.rows.filter(t => t.is_active).length}</h3><p>Active Tenants</p></div>
//             <div class="stat"><h3>${tenants.rows.filter(t => !t.is_active).length}</h3><p>Pending Activation</p></div>
//           </div>
//           <div class="add-form">
//             <h2>➕ Add New Tenant</h2>
//             <div class="form-row">
//               <div class="form-group"><label>Company Name</label><input type="text" id="newCompany" placeholder="e.g. Acme Corp" /></div>
//               <div class="form-group"><label>Twilio WhatsApp Number</label><input type="text" id="newTwilio" placeholder="+14155238886" /></div>
//               <div class="form-group"><label>Slack Bot Token</label><input type="text" id="newToken" placeholder="xoxb-..." /></div>
//               <div class="form-group"><label>Claim Code</label><input type="text" id="newClaimCode" placeholder="e.g. acme (one word, no spaces)" /></div>

//               </div>
//             <button class="btn-add" onclick="addTenant()">Add Tenant</button>
//           </div>
//           <h2>📋 All Tenants</h2>
//           <table>
//             <thead><tr><th>ID</th><th>Company</th><th>Twilio Number</th><th>Claim Code</th><th>Slack Workspace</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
//             <tbody>${rows}</tbody>
//           </table>
//         </div>
//         <div class="modal" id="activateModal">
//         <div class="modal-box">
//           <h3>✅ Activate Tenant</h3>
//           <p style="color:#777;margin-bottom:16px;font-size:14px">Assign a Twilio number and claim code to activate.</p>
//           <input type="text" id="modalTwilio" placeholder="Twilio number e.g. +14155238886" style="margin-bottom:10px"/>
//           <input type="text" id="modalClaimCode" placeholder="Claim code e.g. flo (one word)" style="margin-bottom:16px"/>
//           <input type="hidden" id="modalTenantId" />
//           <div class="modal-btns">
//             <button class="btn-cancel" onclick="closeModal()">Cancel</button>
//             <button class="btn-confirm" onclick="confirmActivate()">Activate</button>
//           </div>
//         </div>
//         </div>
//         <script>
//           const pwd = '${pwd}';
//           function activate(id){document.getElementById('modalTenantId').value=id;document.getElementById('modalTwilio').value='';document.getElementById('activateModal').classList.add('show')}
//           function closeModal(){document.getElementById('activateModal').classList.remove('show')}
//           async function confirmActivate(){
//             const id=document.getElementById('modalTenantId').value;
//             const twilio=document.getElementById('modalTwilio').value.trim();
//             const claimCode=document.getElementById('modalClaimCode').value.trim().toLowerCase();
//             if(!twilio||!claimCode){alert('Please enter both Twilio number and claim code');return}
//             const res=await fetch('/admin/activate?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,twilio_number:twilio,claim_code:claimCode})});
//             const data=await res.json();
//             if(data.success){closeModal();location.reload()}else alert('Error: '+data.error);
//           }
//           async function deactivate(id){
//             if(!confirm('Deactivate this tenant?'))return;
//             const res=await fetch('/admin/deactivate?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
//             const data=await res.json();
//             if(data.success)location.reload();else alert('Error: '+data.error);
//           }
//           async function deleteTenant(id){
//             if(!confirm('Permanently delete this tenant?'))return;
//             const res=await fetch('/admin/delete?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
//             const data=await res.json();
//             if(data.success)location.reload();else alert('Error: '+data.error);
//           }
//           async function addTenant(){
//             const company=document.getElementById('newCompany').value.trim();
//             const twilio=document.getElementById('newTwilio').value.trim();
//             const token=document.getElementById('newToken').value.trim();
//             const claimCode=document.getElementById('newClaimCode').value.trim().toLowerCase();
//             if(!company||!twilio||!token||!claimCode){alert('Please fill in all fields including Claim Code');return}
//             const res=await fetch('/admin/add?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,twilio_number:twilio,slack_bot_token:token,claim_code:claimCode})});
//             const data=await res.json();
//             if(data.success)location.reload();else alert('Error: '+data.error);
//           }
//         </script>
//       </body>
//       </html>
//     `);
//   } catch (err) {
//     console.error('Admin dashboard error:', err.message);
//     res.status(500).send('Error loading admin panel');
//   }
// });

// router.post('/activate', auth, async (req, res) => {
//   try {
//     const { id, twilio_number, claim_code } = req.body;
//     if (!claim_code) return res.json({ success: false, error: 'Claim code is required' });
//     await pool.query(
//       'UPDATE tenants SET is_active = TRUE, twilio_number = $1, claim_code = $2 WHERE id = $3',
//       [twilio_number, claim_code.toLowerCase().trim(), id]
//     );
//     res.json({ success: true });
//   } catch (err) { res.json({ success: false, error: err.message }); }
// });

// router.post('/deactivate', auth, async (req, res) => {
//   try {
//     const { id } = req.body;
//     await pool.query('UPDATE tenants SET is_active = FALSE WHERE id = $1', [id]);
//     res.json({ success: true });
//   } catch (err) { res.json({ success: false, error: err.message }); }
// });

// router.post('/delete', auth, async (req, res) => {
//   try {
//     const { id } = req.body;
//     await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
//     res.json({ success: true });
//   } catch (err) { res.json({ success: false, error: err.message }); }
// });

// router.post('/add', auth, async (req, res) => {
//   try {
//     const { company, twilio_number, slack_bot_token, claim_code } = req.body;
//     if (!claim_code) return res.json({ success: false, error: 'Claim code is required' });
//     await pool.query(
//       `INSERT INTO tenants (company_name, twilio_number, slack_bot_token, slack_team_id, slack_team_name, claim_code, is_active)
//        VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
//       [company, twilio_number, slack_bot_token, 'MANUAL', company, claim_code.toLowerCase().trim()]
//     );
//     res.json({ success: true });
//   } catch (err) { res.json({ success: false, error: err.message }); }
// });

// module.exports = router;
// src/routes/admin.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
require('dotenv').config();
 
const auth = (req, res, next) => {
  try {
    const pwd = (req.query && req.query.pwd) || (req.body && req.body.pwd) || '';
    if (pwd !== process.env.ADMIN_PASSWORD) {
      return res.send(`<!DOCTYPE html><html><head><title>BridgeChat Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#111118;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:48px 40px;width:360px;text-align:center}
.logo{width:48px;height:48px;background:#25D366;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#000;margin:0 auto 20px}
h2{color:#fff;font-size:22px;font-weight:700;margin-bottom:8px}
p{color:rgba(255,255,255,.4);font-size:14px;margin-bottom:32px}
input{width:100%;padding:12px 16px;background:#1a1a24;border:1px solid rgba(255,255,255,.1);border-radius:10px;font-size:15px;color:#fff;margin-bottom:16px;outline:none;font-family:inherit}
input:focus{border-color:rgba(37,211,102,.5)}
button{width:100%;padding:13px;background:#25D366;color:#000;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
button:hover{background:#1aad52}
</style></head>
<body><div class="card">
<div class="logo">B</div>
<h2>Admin Login</h2>
<p>BridgeChat control panel</p>
<form method="GET" action="/admin">
<input type="password" name="pwd" placeholder="Enter admin password" autofocus/>
<button type="submit">Sign in →</button>
</form>
</div></body></html>`);
    }
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).send('Auth error');
  }
};
 
// ── Helper to get dashboard stats ──────────────────────────
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
 
// ── Main dashboard ──────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const pwd = (req.query && req.query.pwd) || '';
    const { tenants, totalMessages, todayMessages, totalContacts } = await getStats();
 
    // Recent messages
    const recentMessages = await pool.query(`
      SELECT m.body, m.direction, m.created_at, m.media_type,
             c.wa_number, t.company_name
      FROM messages m
      JOIN contacts c ON c.id = m.contact_id
      JOIN tenants t ON t.id = m.tenant_id
      ORDER BY m.created_at DESC LIMIT 8
    `).catch(() => ({ rows: [] }));
 
    // Inactive tenants (no messages in 14 days)
    const inactiveTenants = await pool.query(`
      SELECT t.id, t.company_name, t.slack_team_name, MAX(m.created_at) as last_msg
      FROM tenants t
      LEFT JOIN messages m ON m.tenant_id = t.id
      WHERE t.is_active = TRUE
      GROUP BY t.id, t.company_name, t.slack_team_name
      HAVING MAX(m.created_at) < NOW() - INTERVAL '14 days' OR MAX(m.created_at) IS NULL
    `).catch(() => ({ rows: [] }));
 
    // Message activity per day (last 7 days)
    const msgActivity = await pool.query(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).catch(() => ({ rows: [] }));
 
    const active = tenants.filter(t => t.is_active).length;
    const pending = tenants.filter(t => !t.is_active).length;
 
    const activityData = JSON.stringify(msgActivity.rows.map(r => ({ day: r.day, count: parseInt(r.count) })));
 
    const tenantRows = tenants.map(t => `
      <tr class="tenant-row" onclick="location.href='/admin/tenant/${t.id}?pwd=${pwd}'" style="cursor:pointer">
        <td><strong>${t.company_name}</strong></td>
        <td><code style="background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:12px">${t.claim_code || '-'}</code></td>
        <td style="font-size:13px;color:#666">${t.twilio_number || '-'}</td>
        <td style="font-size:13px;color:#666">${t.slack_team_name || '-'}</td>
        <td>${t.is_active ? '<span class="badge-active">Active</span>' : '<span class="badge-pending">Pending</span>'}</td>
        <td style="font-size:12px;color:#999">${new Date(t.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</td>
        <td onclick="event.stopPropagation()">
          ${!t.is_active
            ? `<button onclick="activate(${t.id})" class="btn-sm btn-green">Activate</button>`
            : `<button onclick="deactivate(${t.id})" class="btn-sm btn-orange">Deactivate</button>`}
          <button onclick="deleteTenant(${t.id})" class="btn-sm btn-red">Delete</button>
        </td>
      </tr>`).join('');
 
    const recentMsgRows = recentMessages.rows.map(m => `
      <div class="activity-row">
        <div class="activity-dir ${m.direction === 'inbound' ? 'dir-in' : 'dir-out'}">${m.direction === 'inbound' ? '↓' : '↑'}</div>
        <div class="activity-body">
          <div class="activity-company">${m.company_name} · <span style="color:#999;font-weight:400">${m.wa_number}</span></div>
          <div class="activity-msg">${m.media_type ? '[' + m.media_type.split('/')[0] + ']' : (m.body || '').substring(0, 60)}</div>
        </div>
        <div class="activity-time">${new Date(m.created_at).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}</div>
      </div>`).join('');
 
    const inactiveRows = inactiveTenants.rows.length === 0
      ? '<p style="color:#999;font-size:13px;padding:12px 0">No inactive tenants — all good!</p>'
      : inactiveTenants.rows.map(t => `
        <div class="alert-row">
          <div>
            <div style="font-weight:600;font-size:14px">${t.company_name}</div>
            <div style="font-size:12px;color:#999">${t.last_msg ? 'Last message: ' + new Date(t.last_msg).toLocaleDateString() : 'No messages ever'}</div>
          </div>
          <button onclick="location.href='/admin/tenant/${t.id}?pwd=${pwd}'" class="btn-sm btn-gray">View</button>
        </div>`).join('');
 
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BridgeChat Admin</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:#25D366;--gd:#1aad52;--bg:#f5f5f7;--white:#ffffff;--dark:#0a0a0f;--text:#1a1a2e;--muted:#888;--border:#e8e8ec;--sidebar:220px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);display:flex;min-height:100vh}
 
/* SIDEBAR */
.sidebar{width:var(--sidebar);background:var(--dark);min-height:100vh;display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:100}
.sb-logo{padding:24px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)}
.sb-logo-mark{width:32px;height:32px;background:var(--g);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000;flex-shrink:0}
.sb-logo-text{font-size:16px;font-weight:700;color:#fff}
.sb-logo-sub{font-size:10px;color:rgba(255,255,255,.3);margin-top:1px}
.sb-nav{padding:16px 12px;flex:1}
.sb-label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.25);font-weight:600;padding:8px 8px 4px;margin-top:8px}
.sb-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;color:rgba(255,255,255,.55);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;text-decoration:none;margin-bottom:2px}
.sb-item:hover{background:rgba(255,255,255,.06);color:#fff}
.sb-item.active{background:rgba(37,211,102,.12);color:var(--g)}
.sb-item-icon{font-size:15px;width:20px;text-align:center}
.sb-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.06)}
.sb-footer p{font-size:11px;color:rgba(255,255,255,.25)}
 
/* MAIN */
.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--white);border-bottom:1px solid var(--border);padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.topbar-title{font-size:16px;font-weight:700;color:var(--text)}
.topbar-right{display:flex;align-items:center;gap:12px}
.topbar-badge{background:#f0fdf4;color:#166534;font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;border:1px solid #bbf7d0}
.content{padding:28px 32px;flex:1}
 
/* STAT CARDS */
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat-card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:20px 24px;position:relative;overflow:hidden;transition:transform .2s}
.stat-card:hover{transform:translateY(-2px)}
.stat-card::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:14px 14px 0 0}
.stat-card.green::after{background:var(--g)}
.stat-card.blue::after{background:#3b82f6}
.stat-card.purple::after{background:#8b5cf6}
.stat-card.orange::after{background:#f59e0b}
.stat-label{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.stat-num{font-size:36px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px}
.stat-sub{font-size:12px;color:var(--muted)}
.stat-icon{position:absolute;top:20px;right:20px;font-size:24px;opacity:.15}
 
/* GRID LAYOUT */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.grid-3{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px}
.card{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px}
.card-title{font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.card-title-left{display:flex;align-items:center;gap:8px}
.card-title-icon{font-size:16px}
 
/* TABLE */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{background:#f8f8fa;padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
td{padding:12px 14px;border-bottom:1px solid #f5f5f7;font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:none}
.tenant-row:hover td{background:#fafafa}
 
/* BADGES */
.badge-active{background:#dcfce7;color:#166534;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600}
.badge-pending{background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600}
 
/* BUTTONS */
.btn-sm{padding:5px 12px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-right:4px}
.btn-green{background:#dcfce7;color:#166534}
.btn-green:hover{background:#bbf7d0}
.btn-orange{background:#fef3c7;color:#92400e}
.btn-orange:hover{background:#fde68a}
.btn-red{background:#fee2e2;color:#991b1b}
.btn-red:hover{background:#fecaca}
.btn-gray{background:#f3f4f6;color:#374151}
.btn-gray:hover{background:#e5e7eb}
.btn-primary{background:var(--g);color:#000;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.btn-primary:hover{background:var(--gd)}
 
/* ACTIVITY FEED */
.activity-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f5f5f7}
.activity-row:last-child{border-bottom:none}
.activity-dir{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}
.dir-in{background:#f0fdf4;color:#16a34a}
.dir-out{background:#eff6ff;color:#2563eb}
.activity-body{flex:1;min-width:0}
.activity-company{font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px}
.activity-msg{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.activity-time{font-size:11px;color:#ccc;flex-shrink:0}
 
/* ALERT ROWS */
.alert-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f5f5f7}
.alert-row:last-child{border-bottom:none}
 
/* ADD FORM */
.add-form-section{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:20px}
.form-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
.form-group{flex:1;min-width:180px}
.form-group label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.form-group input{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s}
.form-group input:focus{border-color:var(--g)}
 
/* MODAL */
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#fff;padding:32px;border-radius:16px;width:420px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.modal-box h3{font-size:18px;font-weight:700;margin-bottom:8px}
.modal-box p{font-size:13px;color:var(--muted);margin-bottom:20px}
.modal-box input{width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;font-family:inherit}
.modal-box input:focus{border-color:var(--g)}
.modal-btns{display:flex;gap:10px;margin-top:4px}
.modal-btns button{flex:1;padding:11px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.btn-confirm{background:var(--g);color:#000}
.btn-confirm:hover{background:var(--gd)}
.btn-cancel{background:#f3f4f6;color:#374151}
.btn-cancel:hover{background:#e5e7eb}
 
/* SECTION TABS */
.section-tabs{display:flex;gap:4px;margin-bottom:20px;background:var(--white);border:1px solid var(--border);border-radius:10px;padding:4px;width:fit-content}
.tab{padding:7px 18px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .2s}
.tab.active{background:var(--g);color:#000}
.tab:hover:not(.active){background:var(--bg)}
 
.section-panel{display:none}
.section-panel.active{display:block}
 
@media(max-width:900px){
  .sidebar{display:none}
  .main{margin-left:0}
  .stats-grid{grid-template-columns:1fr 1fr}
  .grid-2,.grid-3{grid-template-columns:1fr}
  .content{padding:20px 16px}
}
</style>
</head>
<body>
 
<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sb-logo">
    <div class="sb-logo-mark">B</div>
    <div>
      <div class="sb-logo-text">BridgeChat</div>
      <div class="sb-logo-sub">Admin Panel</div>
    </div>
  </div>
  <nav class="sb-nav">
    <div class="sb-label">Main</div>
    <a class="sb-item active" onclick="showSection('dashboard')">
      <span class="sb-item-icon">📊</span> Dashboard
    </a>
    <a class="sb-item" onclick="showSection('companies')">
      <span class="sb-item-icon">🏢</span> Companies
    </a>
    <a class="sb-item" onclick="showSection('messages')">
      <span class="sb-item-icon">💬</span> Messages
    </a>
    <div class="sb-label">Manage</div>
    <a class="sb-item" onclick="showSection('add-tenant')">
      <span class="sb-item-icon">➕</span> Add Tenant
    </a>
    <a class="sb-item" href="/admin?pwd=${pwd}">
      <span class="sb-item-icon">🔄</span> Refresh
    </a>
  </nav>
  <div class="sb-footer">
    <p>Logged in as Admin</p>
    <p style="margin-top:4px">v2.0 · BridgeChat</p>
  </div>
</aside>
 
<!-- MAIN -->
<div class="main">
  <div class="topbar">
    <div class="topbar-title" id="page-title">Dashboard</div>
    <div class="topbar-right">
      <span class="topbar-badge">● Live</span>
      <span style="font-size:13px;color:var(--muted)">${new Date().toLocaleDateString('en-GB', {weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span>
    </div>
  </div>
 
  <div class="content">
 
    <!-- DASHBOARD SECTION -->
    <div id="section-dashboard" class="section-panel active">
 
      <!-- STAT CARDS -->
      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-icon">🏢</div>
          <div class="stat-label">Total companies</div>
          <div class="stat-num">${tenants.length}</div>
          <div class="stat-sub">${active} active · ${pending} pending</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Active companies</div>
          <div class="stat-num">${active}</div>
          <div class="stat-sub">Live and routing messages</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">💬</div>
          <div class="stat-label">Messages today</div>
          <div class="stat-num">${todayMessages}</div>
          <div class="stat-sub">${totalMessages} total all-time</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">👥</div>
          <div class="stat-label">Total contacts</div>
          <div class="stat-num">${totalContacts}</div>
          <div class="stat-sub">Across all workspaces</div>
        </div>
      </div>
 
      <!-- CHART + ALERTS ROW -->
      <div class="grid-3">
        <div class="card">
          <div class="card-title">
            <div class="card-title-left"><span class="card-title-icon">📈</span> Message activity — last 7 days</div>
          </div>
          <canvas id="activityChart" height="120"></canvas>
        </div>
        <div class="card">
          <div class="card-title">
            <div class="card-title-left"><span class="card-title-icon">⚠️</span> Inactive companies</div>
          </div>
          ${inactiveRows}
        </div>
      </div>
 
      <!-- RECENT ACTIVITY + TENANT QUICK VIEW -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title">
            <div class="card-title-left"><span class="card-title-icon">🔄</span> Recent messages</div>
            <span style="font-size:12px;color:var(--muted)">Last 8</span>
          </div>
          ${recentMsgRows || '<p style="color:#999;font-size:13px">No messages yet</p>'}
        </div>
        <div class="card">
          <div class="card-title">
            <div class="card-title-left"><span class="card-title-icon">🏢</span> Company overview</div>
          </div>
          ${tenants.slice(0, 5).map(t => `
            <div class="alert-row">
              <div>
                <div style="font-weight:600;font-size:14px">${t.company_name}</div>
                <div style="font-size:12px;color:#999">${t.slack_team_name || 'No workspace'} · <code style="background:#f5f5f5;padding:1px 5px;border-radius:3px;font-size:11px">${t.claim_code || 'no code'}</code></div>
              </div>
              ${t.is_active ? '<span class="badge-active">Active</span>' : '<span class="badge-pending">Pending</span>'}
            </div>`).join('')}
          ${tenants.length > 5 ? `<div style="text-align:center;margin-top:12px"><button class="btn-sm btn-gray" onclick="showSection('companies')">View all ${tenants.length} companies</button></div>` : ''}
        </div>
      </div>
 
    </div>
 
    <!-- COMPANIES SECTION -->
    <div id="section-companies" class="section-panel">
      <div class="card">
        <div class="card-title">
          <div class="card-title-left"><span class="card-title-icon">🏢</span> All companies (${tenants.length})</div>
          <button class="btn-primary" onclick="showSection('add-tenant')">+ Add company</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Company</th><th>Claim code</th><th>Twilio number</th>
              <th>Slack workspace</th><th>Status</th><th>Created</th><th>Actions</th>
            </tr></thead>
            <tbody>${tenantRows}</tbody>
          </table>
        </div>
      </div>
    </div>
 
    <!-- MESSAGES SECTION -->
    <div id="section-messages" class="section-panel">
      <div class="card">
        <div class="card-title">
          <div class="card-title-left"><span class="card-title-icon">💬</span> Recent messages (last 50)</div>
        </div>
        <div id="messages-content" style="color:#999;font-size:13px">Loading...</div>
      </div>
    </div>
 
    <!-- ADD TENANT SECTION -->
    <div id="section-add-tenant" class="section-panel">
      <div class="add-form-section">
        <div class="card-title" style="margin-bottom:20px">
          <div class="card-title-left"><span class="card-title-icon">➕</span> Add new company</div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Company Name</label><input type="text" id="newCompany" placeholder="e.g. Acme Corp"/></div>
          <div class="form-group"><label>Twilio WhatsApp Number</label><input type="text" id="newTwilio" placeholder="+14155238886"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Slack Bot Token</label><input type="text" id="newToken" placeholder="xoxb-..."/></div>
          <div class="form-group"><label>Claim Code</label><input type="text" id="newClaimCode" placeholder="e.g. acme (one word)"/></div>
        </div>
        <button class="btn-primary" onclick="addTenant()">Add company →</button>
      </div>
    </div>
 
  </div>
</div>
 
<!-- ACTIVATE MODAL -->
<div class="modal" id="activateModal">
  <div class="modal-box">
    <h3>Activate company</h3>
    <p>Assign a Twilio number and claim code to go live.</p>
    <input type="text" id="modalTwilio" placeholder="Twilio number e.g. +14155238886"/>
    <input type="text" id="modalClaimCode" placeholder="Claim code e.g. flo (one word)"/>
    <input type="hidden" id="modalTenantId"/>
    <div class="modal-btns">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-confirm" onclick="confirmActivate()">Activate →</button>
    </div>
  </div>
</div>
 
<script>
const pwd = '${pwd}';
 
// Section navigation
function showSection(name) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  const titles = {dashboard:'Dashboard',companies:'Companies',messages:'Messages','add-tenant':'Add Company'};
  document.getElementById('page-title').textContent = titles[name] || name;
  if (name === 'messages') loadMessages();
}
 
// Activity chart
const actData = ${activityData};
const labels = actData.map(d => new Date(d.day).toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}));
const counts = actData.map(d => d.count);
if (document.getElementById('activityChart')) {
  new Chart(document.getElementById('activityChart'), {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        data: counts.length ? counts : [0],
        backgroundColor: 'rgba(37,211,102,.15)',
        borderColor: '#25D366',
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f5f5f7' } },
        x: { grid: { display: false } }
      }
    }
  });
}
 
// Load messages
async function loadMessages() {
  try {
    const res = await fetch('/admin/messages-data?pwd=' + pwd);
    const data = await res.json();
    if (!data.messages || !data.messages.length) {
      document.getElementById('messages-content').innerHTML = '<p style="color:#999;font-size:13px;padding:12px 0">No messages yet.</p>';
      return;
    }
    document.getElementById('messages-content').innerHTML = \`
      <table>
        <thead><tr><th>Time</th><th>Company</th><th>Number</th><th>Direction</th><th>Message</th></tr></thead>
        <tbody>\${data.messages.map(m => \`
          <tr>
            <td style="font-size:12px;color:#999;white-space:nowrap">\${new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
            <td style="font-size:13px;font-weight:600">\${m.company_name}</td>
            <td style="font-size:12px;color:#666">\${m.wa_number}</td>
            <td>\${m.direction === 'inbound' ? '<span class="badge-active">↓ In</span>' : '<span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600">↑ Out</span>'}</td>
            <td style="font-size:13px;color:#333;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${m.media_type ? '['+m.media_type.split('/')[0]+']' : (m.body||'').substring(0,80)}</td>
          </tr>\`).join('')}
        </tbody>
      </table>\`;
  } catch(e) {
    document.getElementById('messages-content').innerHTML = '<p style="color:#e55;font-size:13px">Error loading messages.</p>';
  }
}
 
// Activate modal
function activate(id) {
  document.getElementById('modalTenantId').value = id;
  document.getElementById('modalTwilio').value = '';
  document.getElementById('modalClaimCode').value = '';
  document.getElementById('activateModal').classList.add('show');
}
function closeModal() { document.getElementById('activateModal').classList.remove('show'); }
 
async function confirmActivate() {
  const id = document.getElementById('modalTenantId').value;
  const twilio = document.getElementById('modalTwilio').value.trim();
  const claimCode = document.getElementById('modalClaimCode').value.trim().toLowerCase();
  if (!twilio || !claimCode) { alert('Please fill in both fields'); return; }
  const res = await fetch('/admin/activate?pwd=' + pwd, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,twilio_number:twilio,claim_code:claimCode})});
  const data = await res.json();
  if (data.success) { closeModal(); location.reload(); } else alert('Error: ' + data.error);
}
 
async function deactivate(id) {
  if (!confirm('Deactivate this company?')) return;
  const res = await fetch('/admin/deactivate?pwd=' + pwd, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const data = await res.json();
  if (data.success) location.reload(); else alert('Error: ' + data.error);
}
 
async function deleteTenant(id) {
  if (!confirm('Permanently delete this company and all its data?')) return;
  const res = await fetch('/admin/delete?pwd=' + pwd, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const data = await res.json();
  if (data.success) location.reload(); else alert('Error: ' + data.error);
}
 
async function addTenant() {
  const company = document.getElementById('newCompany').value.trim();
  const twilio = document.getElementById('newTwilio').value.trim();
  const token = document.getElementById('newToken').value.trim();
  const claimCode = document.getElementById('newClaimCode').value.trim().toLowerCase();
  if (!company || !twilio || !token || !claimCode) { alert('Please fill in all fields'); return; }
  const res = await fetch('/admin/add?pwd=' + pwd, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,twilio_number:twilio,slack_bot_token:token,claim_code:claimCode})});
  const data = await res.json();
  if (data.success) location.reload(); else alert('Error: ' + data.error);
}
 
// Close modal on backdrop click
document.getElementById('activateModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
</script>
</body></html>`);
  } catch (err) {
    console.error('Admin dashboard error:', err.message);
    res.status(500).send('Error loading admin panel: ' + err.message);
  }
});
 
// ── Messages data API ───────────────────────────────────────
router.get('/messages-data', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.body, m.direction, m.created_at, m.media_type,
             c.wa_number, t.company_name
      FROM messages m
      JOIN contacts c ON c.id = m.contact_id
      JOIN tenants t ON t.id = m.tenant_id
      ORDER BY m.created_at DESC LIMIT 50
    `);
    res.json({ messages: result.rows });
  } catch (err) {
    res.json({ messages: [] });
  }
});
 
// ── Tenant detail page ──────────────────────────────────────
router.get('/tenant/:id', auth, async (req, res) => {
  try {
    const pwd = (req.query && req.query.pwd) || '';
    const { id } = req.params;
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (!tenant.rows.length) return res.send('Tenant not found');
    const t = tenant.rows[0];
 
    const [contacts, messages] = await Promise.all([
      pool.query('SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC', [id]),
      pool.query(`SELECT m.*, c.wa_number FROM messages m JOIN contacts c ON c.id = m.contact_id WHERE m.tenant_id = $1 ORDER BY m.created_at DESC LIMIT 20`, [id]),
    ]);
 
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${t.company_name} — BridgeChat Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;color:#1a1a2e;padding:32px}
.back{color:#25D366;text-decoration:none;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;margin-bottom:24px}
.card{background:#fff;border:1px solid #e8e8ec;border-radius:14px;padding:24px;margin-bottom:20px}
h1{font-size:24px;font-weight:800;margin-bottom:4px}
.sub{font-size:14px;color:#888;margin-bottom:24px}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:0}
.info-item label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888;display:block;margin-bottom:4px}
.info-item span{font-size:14px;color:#1a1a2e;font-weight:500}
h2{font-size:16px;font-weight:700;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th{background:#f8f8fa;padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee}
td{padding:11px 14px;border-bottom:1px solid #f5f5f7;font-size:13px}
.badge-active{background:#dcfce7;color:#166534;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600}
.badge-pending{background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600}
</style></head><body>
<a href="/admin?pwd=${pwd}" class="back">← Back to admin</a>
<div class="card">
  <h1>${t.company_name}</h1>
  <div class="sub">${t.is_active ? '<span class="badge-active">Active</span>' : '<span class="badge-pending">Pending</span>'} · Created ${new Date(t.created_at).toLocaleDateString()}</div>
  <div class="info-grid">
    <div class="info-item"><label>Claim code</label><span><code style="background:#f0f0f0;padding:2px 8px;border-radius:4px">${t.claim_code || 'Not set'}</code></span></div>
    <div class="info-item"><label>Twilio number</label><span>${t.twilio_number || 'Not set'}</span></div>
    <div class="info-item"><label>Slack workspace</label><span>${t.slack_team_name || 'Not connected'}</span></div>
  </div>
</div>
<div class="card">
  <h2>Contacts (${contacts.rows.length})</h2>
  <table><thead><tr><th>WhatsApp number</th><th>Display name</th><th>Slack channel</th><th>Blocked</th><th>Added</th></tr></thead>
  <tbody>${contacts.rows.map(c => `<tr>
    <td>${c.wa_number}</td><td>${c.display_name || '-'}</td>
    <td><code style="background:#f5f5f5;padding:1px 6px;border-radius:3px;font-size:11px">${c.slack_channel}</code></td>
    <td>${c.blocked ? '🚫 Blocked' : '✓'}</td>
    <td style="color:#999">${new Date(c.created_at).toLocaleDateString()}</td>
  </tr>`).join('')}</tbody></table>
</div>
<div class="card">
  <h2>Recent messages (last 20)</h2>
  <table><thead><tr><th>Time</th><th>Number</th><th>Direction</th><th>Message</th></tr></thead>
  <tbody>${messages.rows.map(m => `<tr>
    <td style="color:#999;font-size:12px;white-space:nowrap">${new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
    <td style="font-size:12px">${m.wa_number}</td>
    <td>${m.direction === 'inbound' ? '<span class="badge-active">↓ In</span>' : '<span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600">↑ Out</span>'}</td>
    <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.media_type ? '['+m.media_type+']' : (m.body||'')}</td>
  </tr>`).join('')}</tbody></table>
</div>
</body></html>`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});
 
// ── Existing action routes (unchanged) ─────────────────────
router.post('/activate', auth, async (req, res) => {
  try {
    const { id, twilio_number, claim_code } = req.body;
    if (!claim_code) return res.json({ success: false, error: 'Claim code is required' });
    await pool.query(
      'UPDATE tenants SET is_active = TRUE, twilio_number = $1, claim_code = $2 WHERE id = $3',
      [twilio_number, claim_code.toLowerCase().trim(), id]
    );
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
 
router.post('/deactivate', auth, async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('UPDATE tenants SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
 
router.post('/delete', auth, async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM tenants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
 
router.post('/add', auth, async (req, res) => {
  try {
    const { company, twilio_number, slack_bot_token, claim_code } = req.body;
    if (!claim_code) return res.json({ success: false, error: 'Claim code is required' });
    await pool.query(
      `INSERT INTO tenants (company_name, twilio_number, slack_bot_token, slack_team_id, slack_team_name, claim_code, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [company, twilio_number, slack_bot_token, 'MANUAL', company, claim_code.toLowerCase().trim()]
    );
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});
 
module.exports = router;