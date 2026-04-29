const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

const start = s.indexOf('<div class="mob-ov" id="mob-ov"');
const end = s.indexOf('<aside class="sidebar">');

const newMobDr = '<div class="mob-ov" id="mob-ov" onclick="closeDrawer()"></div>'
  + '<div class="mob-dr" id="mob-dr">'
  + '<a class="sb-link on" href="#" data-tab="overview" onclick="mobTab(this)">Overview</a>'
  + '<a class="sb-link" href="#" data-tab="workspaces" onclick="mobTab(this)">Workspaces</a>'
  + '<a class="sb-link" href="#" data-tab="account" onclick="mobTab(this)">Account</a>'
  + '<div style="height:1px;background:rgba(255,255,255,.06);margin:12px 0"></div>'
  + '<a class="sb-link" href="/auth/logout">Sign out</a>'
  + '</div>';

s = s.slice(0, start) + newMobDr + s.slice(end);

// Add mobTab function
s = s.replace(
  'function toggleDrawer()',
  'function mobTab(el){var tab=el.getAttribute("data-tab");showTab(tab,el);closeDrawer();return false;}function toggleDrawer()'
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
