const fs = require('fs');
let s = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
s = s.replace(
  "const { logMessage }                        = require('../services/messageLogger');",
  "const { logMessage }                        = require('../services/messageLogger');\nconst { checkMessageLimit } = require('../services/planEnforcement');"
);
fs.writeFileSync('src/routes/whatsapp.js', s);
console.log('done:', s.includes('planEnforcement'));
