const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Replace showTab to use pushState
s = s.replace(
  'function showTab(name, el) {\n  document.querySelectorAll(\'.panel\').forEach(p => p.classList.remove(\'on\'));\n  document.querySelectorAll(\'.sb-link\').forEach(l => l.classList.remove(\'on\'));\n  document.getElementById(\'tab-\' + name).classList.add(\'on\');\n  if (el) el.classList.add(\'on\');\n  var titles = {overview:\'Overview\', workspaces:\'Workspaces\', messages:\'Messages\', contacts:\'Contacts\', account:\'Account\'};\n  document.getElementById(\'topbar-title\').textContent = titles[name] || name;\n  if (name === \'messages\') loadMessages();\n  if (name === \'contacts\') loadContacts();\n}',
  'function showTab(name, el, noPush) {\n  document.querySelectorAll(\'.panel\').forEach(p => p.classList.remove(\'on\'));\n  document.querySelectorAll(\'.sb-link\').forEach(l => l.classList.remove(\'on\'));\n  document.getElementById(\'tab-\' + name).classList.add(\'on\');\n  if (el) el.classList.add(\'on\');\n  var titles = {overview:\'Overview\', workspaces:\'Workspaces\', messages:\'Messages\', contacts:\'Contacts\', account:\'Account\'};\n  document.getElementById(\'topbar-title\').textContent = titles[name] || name;\n  if (name === \'messages\') loadMessages();\n  if (name === \'contacts\') loadContacts();\n  if (!noPush) window.history.pushState({tab:name}, \'\', \'/dashboard?tab=\' + name);\n}\nwindow.addEventListener(\'popstate\', function(e) {\n  var tab = (e.state && e.state.tab) || \'overview\';\n  showTab(tab, null, true);\n});'
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('done:', s.includes('popstate'));
