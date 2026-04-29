const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Fix Workspaces - remove the broken onclick from previous attempt
s = s.replace(
  '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"',
  '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"'
);

// Also remove any lingering broken onclick on Workspaces from first attempt
s = s.replace(
  /<div onclick="showTab\('workspaces'[^"]*\)"[^>]*style="background:#0c0c12[^>]*>/g,
  '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer">'
);

// Fix Total messages - uses #0c0c12 but may have different border
const tmIdx = s.indexOf('>Total messages</div>');
if (tmIdx > -1) {
  const divStart = s.lastIndexOf('<div ', tmIdx);
  const divEnd = s.indexOf('>', divStart) + 1;
  s = s.slice(0, divStart) + '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer">' + s.slice(divEnd);
  console.log('Fixed Total messages');
}

// Fix Today
const tdIdx = s.indexOf('>Today</div>');
if (tdIdx > -1) {
  const divStart = s.lastIndexOf('<div ', tdIdx);
  const divEnd = s.indexOf('>', divStart) + 1;
  s = s.slice(0, divStart) + '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer">' + s.slice(divEnd);
  console.log('Fixed Today');
}

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
