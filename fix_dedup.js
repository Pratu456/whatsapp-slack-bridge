const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

// Remove the OLD duplicate mobile block in renderContacts (uses var total/pages/start/slice/cards)
s = s.replace(
  /  if\(window\.innerWidth<700\)\{\s*var total=_contacts[\s\S]*?document\.getElementById\('contacts-content'\)\.innerHTML=cards\+pagerHTML;return;\s*\}/,
  ''
);

// Remove the OLD duplicate mobile block in renderMessages (uses var total/pages/start/slice/rows)  
s = s.replace(
  /  if\(window\.innerWidth<700\)\{\s*var total=_msgs[\s\S]*?document\.getElementById\('msg-content'\)\.innerHTML=cards\+pagerHTML;return;\s*\}/,
  ''
);

fs.writeFileSync('src/routes/admin.js', s);
console.log('contacts dups removed:', (s.match(/if\(window\.innerWidth<700\)/g)||[]).length);
