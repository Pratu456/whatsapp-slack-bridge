const fs = require('fs');
let s = fs.readFileSync('src/routes/admin.js', 'utf8');
const lines = s.split('\n');

// Find the waitlist innerHTML line
let targetLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('waitlist-content') && lines[i].includes('tbl-wrap') && lines[i].includes('d.rows.map')) {
    targetLine = i;
    break;
  }
}

if (targetLine === -1) { console.log('NOT FOUND'); process.exit(1); }
console.log('Found at line:', targetLine + 1);

const original = lines[targetLine];

// Build mobile block using string concatenation only (no template literals)
const mobileBlock = "    if (window.innerWidth < 700) {\n"
  + "      var wl_html = '<div>';\n"
  + "      d.rows.forEach(function(row) {\n"
  + "        var wl_dt = new Date(row.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});\n"
  + "        wl_html += '<div style=\"background:#111118;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:10px\">';\n"
  + "        wl_html += '<div style=\"font-size:13px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:10px\">' + row.email + '</div>';\n"
  + "        wl_html += '<div style=\"display:flex;align-items:center;justify-content:space-between\">';\n"
  + "        wl_html += '<span style=\"font-size:11px;color:rgba(255,255,255,.3)\">' + wl_dt + '</span>';\n"
  + "        wl_html += '<button data-email=\"' + row.email + '\" onclick=\"sendInvite(this.dataset.email,this)\" style=\"background:rgba(37,211,102,.1);color:#4ade80;border:1px solid rgba(37,211,102,.2);padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer\">Invite</button>';\n"
  + "        wl_html += '</div></div>';\n"
  + "      });\n"
  + "      wl_html += '</div>';\n"
  + "      document.getElementById('waitlist-content').innerHTML = wl_html;\n"
  + "    } else {\n"
  + original + "\n"
  + "    }";

lines[targetLine] = mobileBlock;
const result = lines.join('\n');
fs.writeFileSync('src/routes/admin.js', result);
console.log('Done');