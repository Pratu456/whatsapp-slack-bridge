const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

const oldLine = s.indexOf("document.getElementById('waitlist-content').innerHTML=`<div class=\"tbl-wrap\">");
const endOfLine = s.indexOf('\n', oldLine);

const newHTML = `if(window.innerWidth<700){
      document.getElementById('waitlist-content').innerHTML='<div>'+d.rows.map(r=>'<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:8px">'+r.email+'</div><div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</span><button onclick="sendInvite(\''+r.email+'\',this)" style="background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Invite</button></div></div>').join('')+'</div>';
    } else {
      document.getElementById('waitlist-content').innerHTML=\`<div class="tbl-wrap"><table><thead><tr><th>Email</th><th>Signed up</th><th>Action</th></tr></thead><tbody>\${d.rows.map(r=>\`<tr class="tr-hover"><td style="font-size:13px">\${r.email}</td><td style="font-size:12px;color:rgba(255,255,255,.4)">\${new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td><td><button onclick="sendInvite('\${r.email}',this)" style="background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);padding:5px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">Invite →</button></td></tr>\`).join('')}</tbody></table></div>\`;
    }`;

s = s.slice(0, oldLine) + newHTML + s.slice(endOfLine);
fs.writeFileSync('src/routes/admin.js', s);
console.log('done', oldLine);
