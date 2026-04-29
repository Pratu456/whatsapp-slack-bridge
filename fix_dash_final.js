const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// 1. Add API routes before module.exports
const routes = `
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
`;
s = s.replace('module.exports = router;', routes + '\nmodule.exports = router;');

// 2. Add Messages + Contacts tabs HTML after account tab
s = s.replace(
  "+ '<div id=\"tab-account\" class=\"panel\">'",
  "+ '<div id=\"tab-messages\" class=\"panel\"><div style=\"font-size:22px;font-weight:800;margin-bottom:4px\">Messages</div><div style=\"font-size:13px;color:rgba(255,255,255,.35);margin-bottom:16px\">All messages across your workspaces</div><div id=\"msg-list\">Loading...</div></div>'"
  + "\n      + '<div id=\"tab-contacts\" class=\"panel\"><div style=\"font-size:22px;font-weight:800;margin-bottom:4px\">Contacts</div><div style=\"font-size:13px;color:rgba(255,255,255,.35);margin-bottom:16px\">All contacts across your workspaces</div><div id=\"cnt-list\">Loading...</div></div>'"
  + "\n      + '<div id=\"tab-account\" class=\"panel\">'"
);

// 3. Add load functions + update showTab
s = s.replace(
  'function showTab(n,el){if(!n)return;if(n==="messages")loadMessages();if(n==="contacts")loadContacts();',
  'function showTab(n,el){if(!n)return;if(n==="messages")loadMsgs();if(n==="contacts")loadCnts();'
);

// If above didn't match, try original
s = s.replace(
  'function showTab(n,el){if(!n)return;',
  'function showTab(n,el){if(!n)return;if(n==="messages")loadMsgs();if(n==="contacts")loadCnts();'
);

s = s.replace(
  'var t={overview:"Overview",workspaces:"Workspaces",account:"Account"};',
  'var t={overview:"Overview",workspaces:"Workspaces",messages:"Messages",contacts:"Contacts",account:"Account"};'
);

// 4. Add the JS fetch functions
const jsFns = `
function loadMsgs(){
  var el=document.getElementById("msg-list");
  if(!el||el.dataset.loaded)return;
  fetch("/dashboard/messages-data",{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(d){
    if(!d.messages||!d.messages.length){el.innerHTML='<div style="text-align:center;padding:48px;color:rgba(255,255,255,.25)">No messages yet</div>';return;}
    var tbl='<div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,.06)"><table style="width:100%;border-collapse:collapse;min-width:500px"><thead><tr style="background:#16161f"><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Time</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Number</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Dir</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Message</th></tr></thead><tbody>';
    d.messages.forEach(function(m){
      var t=new Date(m.created_at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
      var dir=m.direction==="inbound"?'<span style="background:rgba(37,211,102,.1);color:#4ade80;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(37,211,102,.2)">In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(59,130,246,.2)">Out</span>';
      tbl+='<tr><td style="padding:10px 14px;font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap;border-top:1px solid rgba(255,255,255,.04)">'+t+'</td><td style="padding:10px 14px;font-size:12px;border-top:1px solid rgba(255,255,255,.04)">'+m.wa_number+'</td><td style="padding:10px 14px;border-top:1px solid rgba(255,255,255,.04)">'+dir+'</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.5);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-top:1px solid rgba(255,255,255,.04)">'+(m.body||"").substring(0,60)+'</td></tr>';
    });
    tbl+='</tbody></table></div>';
    el.innerHTML=tbl;
    el.dataset.loaded=1;
  }).catch(function(){el.innerHTML='<div style="color:#f87171">Error loading</div>';});
}
function loadCnts(){
  var el=document.getElementById("cnt-list");
  if(!el||el.dataset.loaded)return;
  fetch("/dashboard/contacts-data",{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(d){
    if(!d.contacts||!d.contacts.length){el.innerHTML='<div style="text-align:center;padding:48px;color:rgba(255,255,255,.25)">No contacts yet</div>';return;}
    var sc=document.getElementById("stat-contacts");if(sc)sc.textContent=d.contacts.length;
    var tbl='<div style="overflow-x:auto;border-radius:12px;border:1px solid rgba(255,255,255,.06)"><table style="width:100%;border-collapse:collapse;min-width:400px"><thead><tr style="background:#16161f"><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">WhatsApp</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Name</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Slack channel</th><th style="padding:10px 14px;text-align:left;font-size:11px;color:rgba(255,255,255,.3);text-transform:uppercase">Added</th></tr></thead><tbody>';
    d.contacts.forEach(function(c){
      var dt=new Date(c.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
      tbl+='<tr><td style="padding:10px 14px;font-size:13px;border-top:1px solid rgba(255,255,255,.04)">'+c.wa_number+'</td><td style="padding:10px 14px;font-size:13px;color:rgba(255,255,255,.5);border-top:1px solid rgba(255,255,255,.04)">'+(c.display_name||"-")+'</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.4);border-top:1px solid rgba(255,255,255,.04)">'+c.slack_channel+'</td><td style="padding:10px 14px;font-size:12px;color:rgba(255,255,255,.3);border-top:1px solid rgba(255,255,255,.04)">'+dt+'</td></tr>';
    });
    tbl+='</tbody></table></div>';
    el.innerHTML=tbl;
    el.dataset.loaded=1;
  }).catch(function(){el.innerHTML='<div style="color:#f87171">Error loading</div>';});
}
`;

s = s.replace('function showMsg(', jsFns + 'function showMsg(');

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
