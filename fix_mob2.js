const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');
const start = s.indexOf('<div class="mob-ov" id="mob-ov"');
const end = s.indexOf('<aside class="sidebar">');
console.log('start:', start, 'end:', end);
const newMobDr = '<div class="mob-ov" id="mob-ov" onclick="closeDrawer()"></div>'
  + '<div class="mob-dr" id="mob-dr">'
  + '<a class="sb-link on" href="#" onclick="showTab(\'overview\',this);closeDrawer();return false">Overview</a>'
  + '<a class="sb-link" href="#" onclick="showTab(\'workspaces\',this);closeDrawer();return false">Workspaces</a>'
  + '<a class="sb-link" href="#" onclick="showTab(\'account\',this);closeDrawer();return false">Account</a>'
  + '<div style="height:1px;background:rgba(255,255,255,.06);margin:12px 0"></div>'
  + '<a class="sb-link" href="/auth/logout">Sign out</a>'
  + '</div>';
s = s.slice(0, start) + newMobDr + s.slice(end);
fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
