const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Add pushState + popstate handler right after the showTab function
s = s.replace(
  'function showTab(name, el) {',
  'window.history.pushState({tab:"overview"},"","/dashboard");\nwindow.addEventListener("popstate",function(e){var tab=(e.state&&e.state.tab)||"overview";showTab(tab,null,true);});\nfunction showTab(name, el, noPush) {'
);

// Add pushState call inside showTab
s = s.replace(
  "  if (name === 'messages') loadMessages();\n  if (name === 'contacts') loadContacts();\n}",
  "  if (name === 'messages') loadMessages();\n  if (name === 'contacts') loadContacts();\n  if (!noPush) window.history.pushState({tab:name},'','/dashboard');\n}"
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('pushState added:', s.includes('pushState'));
