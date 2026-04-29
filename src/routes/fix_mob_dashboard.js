const fs = require('fs');
let src = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// 1. Add mobile CSS
src = src.replace(
  '@media(max-width:900px){.sidebar{display:none}.main{margin-left:0}.content{padding:16px}.ws-grid{grid-template-columns:1fr}}',
  '.mob-bar{display:none;position:fixed;top:0;left:0;right:0;height:52px;background:var(--bg1);border-bottom:1px solid var(--b1);z-index:200;padding:0 16px;align-items:center;justify-content:space-between}'
  + '.hbg{width:36px;height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;border-radius:8px;background:var(--b1);border:none}'
  + '.hbg span{width:16px;height:2px;background:rgba(255,255,255,.7);border-radius:2px;display:block}'
  + '.mob-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:150}'
  + '.mob-ov.show{display:block}'
  + '.mob-dr{position:fixed;top:52px;left:0;right:0;bottom:0;background:var(--bg1);z-index:160;padding:16px 12px;transform:translateY(-100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;border-top:1px solid var(--b1)}'
  + '.mob-dr.open{transform:translateY(0)}'
  + '.mob-dr .sb-link{padding:12px 14px;font-size:14px}'
  + '@media(max-width:900px){.sidebar{display:none}.mob-bar{display:flex}.main{margin-left:0;padding-top:52px}.topbar{display:none}.content{padding:16px}.ws-grid{grid-template-columns:1fr}}'
);

// 2. Add mob-bar + drawer HTML before sidebar
const mobHTML = '<div class="mob-bar">'
  + '<img src="/logo_text.png" alt="Syncora" style="height:20px;filter:brightness(0) invert(1)"/>'
  + '<button class="hbg" onclick="toggleDrawer()"><span></span><span></span><span></span></button>'
  + '</div>'
  + '<div class="mob-ov" id="mob-ov" onclick="closeDrawer()"></div>'
  + '<div class="mob-dr" id="mob-dr">'
  + '<a class="sb-link on" href="#" onclick="showTab(\'overview\',this);closeDrawer();return false">⬛ Overview</a>'
  + '<a class="sb-link" href="#" onclick="showTab(\'workspaces\',this);closeDrawer();return false">🔗 Workspaces</a>'
  + '<a class="sb-link" href="#" onclick="showTab(\'account\',this);closeDrawer();return false">👤 Account</a>'
  + '<div style="height:1px;background:rgba(255,255,255,.06);margin:12px 0"></div>'
  + '<a class="sb-link" href="/auth/logout">→ Sign out</a>'
  + '</div>';

src = src.replace('<aside class="sidebar">', mobHTML + '<aside class="sidebar">');

// 3. Add JS functions
src = src.replace(
  'function showMsg(',
  'function toggleDrawer(){document.getElementById("mob-dr").classList.toggle("open");document.getElementById("mob-ov").classList.toggle("show");}'
  + 'function closeDrawer(){document.getElementById("mob-dr").classList.remove("open");document.getElementById("mob-ov").classList.remove("show");}'
  + 'function showMsg('
);

fs.writeFileSync('src/routes/dashboard.js', src);
console.log('Done');
