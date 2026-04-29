const fs = require('fs');
let s = fs.readFileSync('src/routes/dashboard.js', 'utf8');

// Fix showTab to not push browser history
s = s.replace(
  'function showTab(n,el){',
  'function showTab(n,el){if(!n)return;'
);

// Fix back button — intercept popstate
s = s.replace(
  'function mobTab(el){',
  'window.addEventListener("popstate",function(){showTab("overview",null);});' +
  'function mobTab(el){'
);

// Total messages card should just scroll to workspaces section, not change tab
// Change its data-goto to overview
const tmIdx = s.indexOf('>Total messages</div>');
if (tmIdx > -1) {
  const divStart = s.lastIndexOf('data-goto="workspaces"', tmIdx);
  if (divStart > tmIdx - 300) {
    s = s.slice(0, divStart) + 'data-goto="overview"' + s.slice(divStart + 'data-goto="workspaces"'.length);
    console.log('Fixed Total messages goto');
  }
}

// Today card same
const tdIdx = s.indexOf('>Today</div>');
if (tdIdx > -1) {
  const divStart = s.lastIndexOf('data-goto="workspaces"', tdIdx);
  if (divStart > tdIdx - 300) {
    s = s.slice(0, divStart) + 'data-goto="overview"' + s.slice(divStart + 'data-goto="workspaces"'.length);
    console.log('Fixed Today goto');
  }
}

fs.writeFileSync('src/routes/dashboard.js', s);
console.log('Done');
