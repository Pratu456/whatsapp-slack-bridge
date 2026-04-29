const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');
const lines = s.split('\n');

// Line 285 (index 284) - remove the div with "Upgrade to add more"
const l285 = lines[284];
const ternaryIdx285 = l285.lastIndexOf(': `<div');
if (ternaryIdx285 > -1) {
  lines[284] = l285.slice(0, ternaryIdx285) + ': ""}';
  console.log('Fixed line 285');
}

// Line 298 (index 297) - remove the anchor with "Upgrade to add more"
const l298 = lines[297];
const ternaryIdx298 = l298.lastIndexOf(': `<a');
if (ternaryIdx298 > -1) {
  lines[297] = l298.slice(0, ternaryIdx298) + ': ""}';
  console.log('Fixed line 298');
}

fs.writeFileSync('src/routes/dashboard.js', lines.join('\n'));
console.log('done');
