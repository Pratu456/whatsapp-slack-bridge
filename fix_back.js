const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

s = s.replace(
  'window.addEventListener("popstate",function(){showTab("overview",null);});',
  'window.history.pushState({},"","/dashboard");window.addEventListener("popstate",function(){window.history.pushState({},"","/dashboard");showTab("overview",null);});'
);

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('done:', s.includes('pushState'));
