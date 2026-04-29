const fs = require('fs');
const src = fs.readFileSync('src/routes/auth.js', 'utf8');

// Insert redirect at offset 27124 (before the res.send block)
const insertAt = 27124;

// Verify what's there
console.log('At offset:', JSON.stringify(src.slice(insertAt, insertAt + 30)));

const newSrc = src.slice(0, insertAt) + "    return res.redirect('/dashboard');\n\n" + src.slice(insertAt);
fs.writeFileSync('src/routes/auth.js', newSrc);
console.log('Done — redirect inserted');
