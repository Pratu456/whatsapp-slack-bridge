const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');
const lines = s.split('\n');

lines[722] = `function renderContacts(){
  if(window.innerWidth<700){
    var mt=_contacts.length;var mp=Math.ceil(mt/_contactsPerPage);var ms=(_contactsPage-1)*_contactsPerPage;var msl=_contacts.slice(ms,ms+_contactsPerPage);
    var mc=msl.map(function(c){var md=new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});var mb=c.blocked?'<span style="color:#f87171;font-size:11px">Blocked</span>':'<span style="color:#4ade80;font-size:11px">Active</span>';return '<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85)">'+c.wa_number+'</span>'+mb+'</div>'+(c.display_name?'<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:4px">'+c.display_name+'</div>':'')+'<div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+c.company_name+'</span><span style="font-size:11px;color:rgba(255,255,255,.25)">'+md+'</span></div></div>';}).join('');
    var mpr='';if(mp>1){var mbt='';if(_contactsPage>1)mbt+='<button class="pager-btn" onclick="_contactsPage--;renderContacts()">← Prev</button>';for(var mi=1;mi<=mp;mi++)mbt+='<button class="pager-btn'+(mi===_contactsPage?' active':'')+'" onclick="_contactsPage='+mi+';renderContacts()">'+mi+'</button>';if(_contactsPage<mp)mbt+='<button class="pager-btn" onclick="_contactsPage++;renderContacts()">Next →</button>';mpr='<div class="pager"><div class="pager-info">Showing '+(ms+1)+'–'+Math.min(ms+_contactsPerPage,mt)+' of '+mt+'</div><div class="pager-btns">'+mbt+'</div></div>';}
    document.getElementById('contacts-content').innerHTML=mc+mpr;return;
  }`;

lines[778] = `function renderMessages(){
  if(window.innerWidth<700){
    var mt=_msgs.length;var mp=Math.ceil(mt/_msgsPerPage);var ms=(_msgsPage-1)*_msgsPerPage;var msl=_msgs.slice(ms,ms+_msgsPerPage);
    var mc=msl.map(function(m){var tm=new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});var dr=m.direction==='inbound'?'<span class="badge-green">In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(59,130,246,.2)">Out</span>';var mg=m.media_type?'['+m.media_type.split('/')[0]+']':(m.body||'').substring(0,60);return '<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.8)">'+m.wa_number+'</span>'+dr+'</div><div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:6px;word-break:break-word">'+mg+'</div><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+m.company_name+'</span><span style="font-size:11px;color:rgba(255,255,255,.25)">'+tm+'</span></div></div>';}).join('');
    var mpr='';if(mp>1){var mbt='';if(_msgsPage>1)mbt+='<button class="pager-btn" onclick="_msgsPage--;renderMessages()">← Prev</button>';for(var mi=1;mi<=mp;mi++)mbt+='<button class="pager-btn'+(mi===_msgsPage?' active':'')+'" onclick="_msgsPage='+mi+';renderMessages()">'+mi+'</button>';if(_msgsPage<mp)mbt+='<button class="pager-btn" onclick="_msgsPage++;renderMessages()">Next →</button>';mpr='<div class="pager"><div class="pager-info">Showing '+(ms+1)+'–'+Math.min(ms+_msgsPerPage,mt)+' of '+mt+'</div><div class="pager-btns">'+mbt+'</div></div>';}
    document.getElementById('msg-content').innerHTML=mc+mpr;return;
  }`;

fs.writeFileSync('src/routes/admin.js', lines.join('\n'));
console.log('done');
