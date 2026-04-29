const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

// Add mobile CSS after the existing pager CSS
s = s.replace(
  '.pager-btn.active{background:rgba(37,211,102,.1);color:#4ade80;border-color:rgba(37,211,102,.2)}',
  '.pager-btn.active{background:rgba(37,211,102,.1);color:#4ade80;border-color:rgba(37,211,102,.2)}.mob-card{display:none}.desk-tbl{display:block}@media(max-width:700px){.mob-card{display:block}.desk-tbl{display:none}}'
);

// Fix renderMessages - add mobile cards
s = s.replace(
  "function renderMessages() {",
  `function renderMessages() {
  var mobile = window.innerWidth < 700;
  if (mobile) {
    var total=_msgs.length;var pages=Math.ceil(total/_msgsPerPage);var start=(_msgsPage-1)*_msgsPerPage;var slice=_msgs.slice(start,start+_msgsPerPage);
    var cards=slice.map(function(m){
      var time=new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      var dir=m.direction==='inbound'?'<span class="badge-green">In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(59,130,246,.2)">Out</span>';
      var msg=m.media_type?'['+m.media_type.split('/')[0]+']':(m.body||'').substring(0,60);
      return '<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.8)">'+m.wa_number+'</span>'+dir+'</div><div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:6px;word-break:break-word">'+msg+'</div><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+m.company_name+'</span><span style="font-size:11px;color:rgba(255,255,255,.25)">'+time+'</span></div></div>';
    }).join('');
    var pagerHTML='';
    if(pages>1){var btns='';if(_msgsPage>1)btns+='<button class="pager-btn" onclick="_msgsPage--;renderMessages()">← Prev</button>';for(var i=1;i<=pages;i++)btns+='<button class="pager-btn'+(i===_msgsPage?' active':'')+'" onclick="_msgsPage='+i+';renderMessages()">'+i+'</button>';if(_msgsPage<pages)btns+='<button class="pager-btn" onclick="_msgsPage++;renderMessages()">Next →</button>';pagerHTML='<div class="pager"><div class="pager-info">Showing '+(start+1)+'–'+Math.min(start+_msgsPerPage,total)+' of '+total+'</div><div class="pager-btns">'+btns+'</div></div>';}
    document.getElementById('msg-content').innerHTML=cards+pagerHTML;
    return;
  }`
);

// Fix renderContacts - add mobile cards
s = s.replace(
  "function renderContacts() {",
  `function renderContacts() {
  var mobile = window.innerWidth < 700;
  if (mobile) {
    var total=_contacts.length;var pages=Math.ceil(total/_contactsPerPage);var start=(_contactsPage-1)*_contactsPerPage;var slice=_contacts.slice(start,start+_contactsPerPage);
    var cards=slice.map(function(c){
      var date=new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
      var blocked=c.blocked?'<span style="color:#f87171;font-size:11px">Blocked</span>':'<span style="color:#4ade80;font-size:11px">Active</span>';
      return '<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85)">'+c.wa_number+'</span>'+blocked+'</div>'+(c.display_name?'<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:4px">'+c.display_name+'</div>':'')+'<div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+c.company_name+'</span><span style="font-size:11px;color:rgba(255,255,255,.25)">'+date+'</span></div></div>';
    }).join('');
    var pagerHTML='';
    if(pages>1){var btns='';if(_contactsPage>1)btns+='<button class="pager-btn" onclick="_contactsPage--;renderContacts()">← Prev</button>';for(var i=1;i<=pages;i++)btns+='<button class="pager-btn'+(i===_contactsPage?' active':'')+'" onclick="_contactsPage='+i+';renderContacts()">'+i+'</button>';if(_contactsPage<pages)btns+='<button class="pager-btn" onclick="_contactsPage++;renderContacts()">Next →</button>';pagerHTML='<div class="pager"><div class="pager-info">Showing '+(start+1)+'–'+Math.min(start+_contactsPerPage,total)+' of '+total+'</div><div class="pager-btns">'+btns+'</div></div>';}
    document.getElementById('contacts-content').innerHTML=cards+pagerHTML;
    return;
  }`
);

fs.writeFileSync('src/routes/admin.js', s);
console.log('done');
