const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Replace all three stat card divs using index-based approach
const cards = ['Workspaces', 'Total messages', 'Today'];
cards.forEach(function(label) {
  const marker = '>'+label+'</div>';
  const idx = s.indexOf(marker);
  if (idx === -1) { console.log('NOT FOUND:', label); return; }
  // Find the opening div before this marker
  const divStart = s.lastIndexOf('<div style="background:#0c0c12', idx);
  if (divStart === -1) { console.log('div not found for:', label); return; }
  const oldDiv = s.slice(divStart, divStart + 90);
  const newDiv = '<div data-goto="workspaces" onclick="showTab(this.dataset.goto,null)" style="background:#0c0c12;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:18px;position:relative;overflow:hidden;cursor:pointer"';
  s = s.slice(0, divStart) + newDiv + s.slice(divStart + oldDiv.length);
  console.log('Fixed:', label);
});

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
