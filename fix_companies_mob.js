const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');

// Add mobileCompanyRows after tenantRows
const insertAfter = "const inactiveRows = inactiveTenants.rows.length === 0";
const mobileRows = `const mobileCompanyRows = tenants.map(t => \`
  <div style="background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;border-radius:8px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#25D366">\${t.company_name.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#fff">\${t.company_name}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.3)">\${t.email||''}</div>
        </div>
      </div>
      \${t.is_active ? '<span class="badge-green">Active</span>' : '<span class="badge-yellow">Pending</span>'}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <code style="background:rgba(37,211,102,.08);color:#25D366;padding:3px 10px;border-radius:6px;font-size:13px;border:1px solid rgba(37,211,102,.15)">\${t.claim_code||'-'}</code>
      <select onchange="updatePlan(\${t.id},this.value)" style="background:#16161f;border:1px solid rgba(255,255,255,.1);color:#fff;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer">
        <option value="starter" \${(t.plan||'starter')==='starter'?'selected':''}>Starter</option>
        <option value="pro" \${t.plan==='pro'?'selected':''}>Pro</option>
        <option value="business" \${t.plan==='business'?'selected':''}>Business</option>
      </select>
    </div>
    <div style="display:flex;gap:8px">
      \${!t.is_active
        ? \`<button onclick="activate(\${t.id},'\${t.email||''}')" class="btn-xs btn-xs-green" style="flex:1;padding:8px;text-align:center">Activate</button>\`
        : \`<button onclick="deactivate(\${t.id})" class="btn-xs btn-xs-orange" style="flex:1;padding:8px;text-align:center">Deactivate</button>\`}
      <button onclick="deleteTenant(\${t.id})" class="btn-xs btn-xs-red" style="flex:1;padding:8px;text-align:center">Delete</button>
    </div>
  </div>\`).join('');
`;

s = s.replace(insertAfter, mobileRows + insertAfter);

// Add mobile div and show/hide logic in companies panel
s = s.replace(
  '<div class="tbl-wrap">\n      <table>\n        <thead><tr><th>Company</th>',
  '<div id="mob-co" style="display:none">${mobileCompanyRows}</div>\n      <div class="tbl-wrap" id="desk-co">\n      <table>\n        <thead><tr><th>Company</th>'
);

// Add JS to toggle on load
s = s.replace(
  'window.history.pushState({}',
  '(function(){var m=window.innerWidth<700;var mc=document.getElementById("mob-co");var dc=document.getElementById("desk-co");if(mc&&dc){mc.style.display=m?"block":"none";dc.style.display=m?"none":"";}})();\nwindow.history.pushState({}'
);

fs.writeFileSync('src/routes/admin.js', s);
console.log('done');
