const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

// 1. Add mobile company cards before the tbl-wrap
const marker = s.indexOf("      <div class=\"tbl-wrap\">\n        <table>\n          <thead><tr><th>Company</th>");
if (marker === -1) {
  // try alternate whitespace
  const alt = s.indexOf('<div class="tbl-wrap">\n        <table>\n          <thead><tr><th>Company</th>');
  console.log('marker1:', marker, 'alt:', alt);
} else {
  console.log('Found companies table at:', marker);
}

// Find the companies tbl-wrap by looking for the unique companies thead
const compMarker = s.indexOf('<thead><tr><th>Company</th><th>Plan</th>');
if (compMarker > -1) {
  // Find the start of the tbl-wrap div before it
  const tblStart = s.lastIndexOf('<div class="tbl-wrap">', compMarker);
  console.log('tbl-wrap start:', tblStart);
  
  const mobileCards = `<div id="mob-companies" style="display:none">
          \${tenants.map(t => \`
          <div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px;margin-bottom:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:9px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#25D366">\${t.company_name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style="font-size:14px;font-weight:700;color:#fff">\${t.company_name}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,.3)">\${t.email||''}</div>
                </div>
              </div>
              \${t.is_active ? '<span class=\\"badge-green\\">Active</span>' : '<span class=\\"badge-yellow\\">Pending</span>'}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <code style="background:rgba(37,211,102,.08);color:#25D366;padding:3px 10px;border-radius:6px;font-size:13px;border:1px solid rgba(37,211,102,.15)">\${t.claim_code||'-'}</code>
              <select onchange=\\"updatePlan(\${t.id},this.value)\\" style=\\"background:#16161f;border:1px solid rgba(255,255,255,.1);color:#fff;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif\\">
                <option value=\\"starter\\" \${(t.plan||'starter')==='starter'?'selected':''}>Starter</option>
                <option value=\\"pro\\" \${t.plan==='pro'?'selected':''}>Pro</option>
                <option value=\\"business\\" \${t.plan==='business'?'selected':''}>Business</option>
              </select>
            </div>
            <div style="display:flex;gap:8px">
              \${!t.is_active
                ? \`<button onclick=\\"activate(\${t.id},'\${t.email||''}')\\" class=\\"btn-xs btn-xs-green\\" style=\\"flex:1;padding:8px\\">Activate</button>\`
                : \`<button onclick=\\"deactivate(\${t.id})\\" class=\\"btn-xs btn-xs-orange\\" style=\\"flex:1;padding:8px\\">Deactivate</button>\`}
              <button onclick=\\"deleteTenant(\${t.id})\\" class=\\"btn-xs btn-xs-red\\" style=\\"flex:1;padding:8px\\">Delete</button>
            </div>
          </div>\`).join('')}
        </div>\n        `;

  s = s.slice(0, tblStart) + mobileCards + s.slice(tblStart);
  console.log('Mobile company cards inserted');
}

// 2. Add JS to toggle mobile/desktop view
s = s.replace(
  'function show(name,el){',
  '(function(){var mc=document.getElementById("mob-companies");var dt=document.querySelector("#p-companies .tbl-wrap");if(mc&&dt){var m=window.innerWidth<700;mc.style.display=m?"block":"none";dt.style.display=m?"":"";}}());function show(name,el){'
);

// 3. Fix waitlist Send invite button - make it smaller
s = s.replace('">Send invite →</button>', '">Invite →</button>');

fs.writeFileSync('src/routes/admin.js', s);
console.log('All done');