const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

// Replace the entire broken loadMessages + renderMessages section
const broken = s.indexOf('let _msgs=[];let _msgsPage=1;const _msgsPerPage=10;\nasync function loadMessages(){');
const afterFixed = s.indexOf('async function loadWaitlist()');

if (broken === -1 || afterFixed === -1) {
  console.log('markers not found', broken, afterFixed);
  process.exit(1);
}

const fixed = `let _msgs=[];let _msgsPage=1;const _msgsPerPage=10;
async function loadMessages(){
  try{
    const r=await fetch('/admin/messages-data',{credentials:'same-origin'});const d=await r.json();
    if(!d.messages||!d.messages.length){document.getElementById('msg-content').innerHTML='<div style="text-align:center;padding:48px 24px;color:rgba(255,255,255,.25);font-size:13px">No messages yet</div>';return;}
    _msgs=d.messages;_msgsPage=1;renderMessages();
  }catch(e){document.getElementById('msg-content').innerHTML='<div style="color:#f87171;font-size:13px">Error loading messages</div>';}
}
function renderMessages(){
  if(window.innerWidth<700){
    var mt=_msgs.length;var mp=Math.ceil(mt/_msgsPerPage);var ms=(_msgsPage-1)*_msgsPerPage;var msl=_msgs.slice(ms,ms+_msgsPerPage);
    var mc=msl.map(function(m){var tm=new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});var dr=m.direction==='inbound'?'<span class="badge-green">In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:3px 8px;border-radius:100px;font-size:11px;border:1px solid rgba(59,130,246,.2)">Out</span>';var mg=m.media_type?'['+m.media_type.split('/')[0]+']':(m.body||'').substring(0,60);return '<div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:rgba(255,255,255,.8)">'+m.wa_number+'</span>'+dr+'</div><div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:6px;word-break:break-word">'+mg+'</div><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:rgba(255,255,255,.3)">'+m.company_name+'</span><span style="font-size:11px;color:rgba(255,255,255,.25)">'+tm+'</span></div></div>';}).join('');
    var mpr='';if(mp>1){var mbt='';if(_msgsPage>1)mbt+='<button class="pager-btn" onclick="_msgsPage--;renderMessages()">← Prev</button>';for(var mi=1;mi<=mp;mi++)mbt+='<button class="pager-btn'+(mi===_msgsPage?' active':'')+'" onclick="_msgsPage='+mi+';renderMessages()">'+mi+'</button>';if(_msgsPage<mp)mbt+='<button class="pager-btn" onclick="_msgsPage++;renderMessages()">Next →</button>';mpr='<div class="pager"><div class="pager-info">Showing '+(ms+1)+'--'+Math.min(ms+_msgsPerPage,mt)+' of '+mt+'</div><div class="pager-btns">'+mbt+'</div></div>';}
    document.getElementById('msg-content').innerHTML=mc+mpr;return;
  }
  var total=_msgs.length;var pages=Math.ceil(total/_msgsPerPage);
  var start=(_msgsPage-1)*_msgsPerPage;var slice=_msgs.slice(start,start+_msgsPerPage);
  var rows=slice.map(function(m){
    var time=new Date(m.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    var dir=m.direction==='inbound'?'<span class="badge-green">In</span>':'<span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;border:1px solid rgba(59,130,246,.2)">Out</span>';
    var msg=m.media_type?'['+m.media_type.split('/')[0]+']':(m.body||'').substring(0,60);
    return '<tr class="tr-hover"><td style="font-size:11px;color:rgba(255,255,255,.3);white-space:nowrap">'+time+'</td><td style="font-weight:600;font-size:13px">'+m.company_name+'</td><td style="font-size:12px;color:rgba(255,255,255,.4)">'+m.wa_number+'</td><td>'+dir+'</td><td style="font-size:12px;color:rgba(255,255,255,.5);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+msg+'</td></tr>';
  }).join('');
  var pagerHTML='';
  if(pages>1){var btns='';if(_msgsPage>1)btns+='<button class="pager-btn" onclick="_msgsPage--;renderMessages()">← Prev</button>';for(var i=1;i<=pages;i++)btns+='<button class="pager-btn'+(i===_msgsPage?' active':'')+'" onclick="_msgsPage='+i+';renderMessages()">'+i+'</button>';if(_msgsPage<pages)btns+='<button class="pager-btn" onclick="_msgsPage++;renderMessages()">Next →</button>';pagerHTML='<div class="pager"><div class="pager-info">Showing '+(start+1)+'--'+Math.min(start+_msgsPerPage,total)+' of '+total+'</div><div class="pager-btns">'+btns+'</div></div>';}
  document.getElementById('msg-content').innerHTML='<div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Company</th><th>Number</th><th>Direction</th><th>Message</th></tr></thead><tbody>'+rows+'</tbody></table>'+pagerHTML+'</div>';
}
`;

s = s.slice(0, broken) + fixed + s.slice(afterFixed);
fs.writeFileSync('src/routes/admin.js', s);
console.log('done');
