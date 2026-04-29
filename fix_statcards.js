const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Make Workspaces card click → workspaces tab
s = s.replace(
  '<div style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Workspaces</div>',
  '<div onclick="showTab(\'workspaces\',document.querySelector(\'[data-tab=workspaces]\'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer" onmouseover="this.style.borderColor=\'rgba(37,211,102,.3)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.07)\'"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Workspaces</div>'
);

// Make Total Messages card click → workspaces tab  
s = s.replace(
  '<div style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Total messages</div>',
  '<div onclick="showTab(\'workspaces\',document.querySelector(\'[data-tab=workspaces]\'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer" onmouseover="this.style.borderColor=\'rgba(139,92,246,.3)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.07)\'"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Total messages</div>'
);

// Make Today card click → workspaces tab
s = s.replace(
  '<div style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Today</div>',
  '<div onclick="showTab(\'workspaces\',document.querySelector(\'[data-tab=workspaces]\'))" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer" onmouseover="this.style.borderColor=\'rgba(37,211,102,.3)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.07)\'"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);margin-bottom:8px">Today</div>'
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
