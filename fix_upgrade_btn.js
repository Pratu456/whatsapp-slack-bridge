const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Remove the "Upgrade to add more" button from workspaces tab header
s = s.replace(
  `: '<a href="/#pricing" style="background:rgba(37,211,102,.1);color:#4ade80;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;text-decoration:none;border:1px solid rgba(37,211,102,.2)">Upgrade to add more \u2192</a>'`,
  `: ''`
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('done:', !s.includes('Upgrade to add more'));
