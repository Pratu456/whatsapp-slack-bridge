// src/routes/admin.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
require('dotenv').config();

const auth = (req, res, next) => {
  try {
    const pwd = (req.query && req.query.pwd) || (req.body && req.body.pwd) || '';
    if (pwd !== process.env.ADMIN_PASSWORD) {
      return res.send(`
        <!DOCTYPE html><html><head><title>Admin Login</title>
        <style>
          body{font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;background:#f0fff4;margin:0}
          .box{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;width:320px}
          h2{color:#25D366;margin-bottom:24px}
          input{width:100%;padding:12px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:16px}
          button{width:100%;padding:12px;background:#25D366;color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
        </style></head>
        <body><div class="box">
          <h2>🔐 Admin Login</h2>
          <form method="GET" action="/admin">
            <input type="password" name="pwd" placeholder="Enter admin password" />
            <button type="submit">Login</button>
          </form>
        </div></body></html>
      `);
    }
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).send('Auth error');
  }
};

router.get('/', auth, async (req, res) => {
  try {
    const pwd = (req.query && req.query.pwd) || '';
    const tenants = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');

    const rows = tenants.rows.map(t => `
      <tr>
        <td>${t.id}</td>
        <td><strong>${t.company_name}</strong></td>
        <td>${t.twilio_number}</td>
        <td><code>${t.claim_code || '-'}</code></td>
        <td>${t.slack_team_name || '-'}</td>
        <td>${t.is_active ? '<span class="badge active">✅ Active</span>' : '<span class="badge pending">⏳ Pending</span>'}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td>
          ${!t.is_active
            ? `<button onclick="activate(${t.id})" class="btn-activate">Activate</button>`
            : `<button onclick="deactivate(${t.id})" class="btn-deactivate">Deactivate</button>`
          }
          <button onclick="deleteTenant(${t.id})" class="btn-delete">Delete</button>
        </td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Admin Panel — WA Bridge</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial;background:#f0fff4;min-height:100vh}
          .header{background:#25D366;padding:16px 32px;display:flex;align-items:center;justify-content:space-between}
          .header h1{color:white;font-size:20px}
          .header span{color:rgba(255,255,255,0.8);font-size:13px}
          .container{padding:32px}
          .stats{display:flex;gap:20px;margin-bottom:32px;flex-wrap:wrap}
          .stat{background:white;padding:20px 28px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);min-width:160px}
          .stat h3{font-size:32px;color:#25D366}
          .stat p{color:#777;font-size:13px;margin-top:4px}
          h2{color:#1a1a2e;margin-bottom:16px;font-size:20px}
          table{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin-bottom:32px}
          th{background:#25D366;color:white;padding:12px 16px;text-align:left;font-size:14px}
          td{padding:12px 16px;border-bottom:1px solid #eee;font-size:14px}
          tr:last-child td{border-bottom:none}
          .badge{padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold}
          .badge.active{background:#d5f5e3;color:#1b5e20}
          .badge.pending{background:#fff9c4;color:#795548}
          .btn-activate{background:#25D366;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-right:4px}
          .btn-deactivate{background:#ff9800;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;margin-right:4px}
          .btn-delete{background:#f44336;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px}
          .add-form{background:white;padding:28px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,0.08);margin-bottom:32px}
          .form-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px}
          .form-group{flex:1;min-width:200px}
          .form-group label{display:block;font-size:13px;font-weight:bold;color:#333;margin-bottom:6px}
          .form-group input{width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px}
          .btn-add{background:#25D366;color:white;border:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;cursor:pointer}
          .modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100;justify-content:center;align-items:center}
          .modal.show{display:flex}
          .modal-box{background:white;padding:32px;border-radius:12px;width:400px}
          .modal-box h3{margin-bottom:16px;color:#1a1a2e}
          .modal-box input{width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px}
          .modal-btns{display:flex;gap:12px}
          .modal-btns button{flex:1;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer}
          .btn-confirm{background:#25D366;color:white}
          .btn-cancel{background:#eee;color:#333}
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛠️ Admin Panel — WhatsApp ↔ Slack Bridge</h1>
          <span>Logged in as Admin</span>
        </div>
        <div class="container">
          <div class="stats">
            <div class="stat"><h3>${tenants.rows.length}</h3><p>Total Tenants</p></div>
            <div class="stat"><h3>${tenants.rows.filter(t => t.is_active).length}</h3><p>Active Tenants</p></div>
            <div class="stat"><h3>${tenants.rows.filter(t => !t.is_active).length}</h3><p>Pending Activation</p></div>
          </div>
          <div class="add-form">
            <h2>➕ Add New Tenant</h2>
            <div class="form-row">
              <div class="form-group"><label>Company Name</label><input type="text" id="newCompany" placeholder="e.g. Acme Corp" /></div>
              <div class="form-group"><label>Twilio WhatsApp Number</label><input type="text" id="newTwilio" placeholder="+14155238886" /></div>
              <div class="form-group"><label>Slack Bot Token</label><input type="text" id="newToken" placeholder="xoxb-..." /></div>
              <div class="form-group"><label>Claim Code</label><input type="text" id="newClaimCode" placeholder="e.g. acme (one word, no spaces)" /></div>

              </div>
            <button class="btn-add" onclick="addTenant()">Add Tenant</button>
          </div>
          <h2>📋 All Tenants</h2>
          <table>
            <thead><tr><th>ID</th><th>Company</th><th>Twilio Number</th><th>Claim Code</th><th>Slack Workspace</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="modal" id="activateModal">
        <div class="modal-box">
          <h3>✅ Activate Tenant</h3>
          <p style="color:#777;margin-bottom:16px;font-size:14px">Assign a Twilio number and claim code to activate.</p>
          <input type="text" id="modalTwilio" placeholder="Twilio number e.g. +14155238886" style="margin-bottom:10px"/>
          <input type="text" id="modalClaimCode" placeholder="Claim code e.g. flo (one word)" style="margin-bottom:16px"/>
          <input type="hidden" id="modalTenantId" />
          <div class="modal-btns">
            <button class="btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn-confirm" onclick="confirmActivate()">Activate</button>
          </div>
        </div>
        </div>
        <script>
          const pwd = '${pwd}';
          function activate(id){document.getElementById('modalTenantId').value=id;document.getElementById('modalTwilio').value='';document.getElementById('activateModal').classList.add('show')}
          function closeModal(){document.getElementById('activateModal').classList.remove('show')}
          async function confirmActivate(){
            const id=document.getElementById('modalTenantId').value;
            const twilio=document.getElementById('modalTwilio').value.trim();
            const claimCode=document.getElementById('modalClaimCode').value.trim().toLowerCase();
            if(!twilio||!claimCode){alert('Please enter both Twilio number and claim code');return}
            const res=await fetch('/admin/activate?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,twilio_number:twilio,claim_code:claimCode})});
            const data=await res.json();
            if(data.success){closeModal();location.reload()}else alert('Error: '+data.error);
          }
          async function deactivate(id){
            if(!confirm('Deactivate this tenant?'))return;
            const res=await fetch('/admin/deactivate?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
            const data=await res.json();
            if(data.success)location.reload();else alert('Error: '+data.error);
          }
          async function deleteTenant(id){
            if(!confirm('Permanently delete this tenant?'))return;
            const res=await fetch('/admin/delete?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
            const data=await res.json();
            if(data.success)location.reload();else alert('Error: '+data.error);
          }
          async function addTenant(){
            const company=document.getElementById('newCompany').value.trim();
            const twilio=document.getElementById('newTwilio').value.trim();
            const token=document.getElementById('newToken').value.trim();
            const claimCode=document.getElementById('newClaimCode').value.trim().toLowerCase();
            if(!company||!twilio||!token||!claimCode){alert('Please fill in all fields including Claim Code');return}
            const res=await fetch('/admin/add?pwd='+pwd,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,twilio_number:twilio,slack_bot_token:token,claim_code:claimCode})});
            const data=await res.json();
            if(data.success)location.reload();else alert('Error: '+data.error);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Admin dashboard error:', err.message);
    res.status(500).send('Error loading admin panel');
  }
});

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