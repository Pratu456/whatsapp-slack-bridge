const fs = require('fs');
let content = fs.readFileSync('src/routes/dashboard.js', 'utf8');

const OLD = `      <!-- Danger zone -->
      <div class="card" style="border-color:rgba(239,68,68,.15)">`;

const NEW = `      <!-- Pricing plans -->
      ${plan !== 'business' ? `
      <div class="card">
        <div class="card-title">⚡ Upgrade your plan</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:8px">
          
          <div style="border:2px solid ${plan === 'starter' ? '#25D366' : 'rgba(255,255,255,.08)'};border-radius:14px;padding:20px;background:${plan === 'starter' ? 'rgba(37,211,102,.05)' : 'rgba(255,255,255,.02)'}">
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Starter</div>
            <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:4px">€0 <span style="font-size:13px;color:rgba(255,255,255,.35);font-weight:400">/mo</span></div>
            <div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;line-height:1.8">
              ✓ 200 messages/day<br>
              ✓ 1 workspace<br>
              ✓ Basic support
            </div>
            ${plan === 'starter' ? '<div style="text-align:center;padding:8px;border-radius:8px;background:rgba(37,211,102,.1);color:#25D366;font-size:12px;font-weight:700">Current plan</div>' : ''}
          </div>

          <div style="border:2px solid ${plan === 'pro' ? '#25D366' : 'rgba(255,255,255,.08)'};border-radius:14px;padding:20px;background:${plan === 'pro' ? 'rgba(37,211,102,.05)' : 'rgba(255,255,255,.02)'}">
            <div style="font-size:11px;font-weight:700;color:#25D366;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Pro ⭐</div>
            <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:4px">€29 <span style="font-size:13px;color:rgba(255,255,255,.35);font-weight:400">/mo</span></div>
            <div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;line-height:1.8">
              ✓ Unlimited messages<br>
              ✓ 3 workspaces<br>
              ✓ Priority support<br>
              ✓ Group chats
            </div>
            ${plan === 'pro' 
              ? '<div style="text-align:center;padding:8px;border-radius:8px;background:rgba(37,211,102,.1);color:#25D366;font-size:12px;font-weight:700">Current plan</div>'
              : '<button onclick="upgradePlan(\'pro\')" style="width:100%;padding:10px;border-radius:8px;background:#25D366;color:#000;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:inherit">Upgrade to Pro →</button>'
            }
          </div>

          <div style="border:2px solid ${plan === 'business' ? '#60a5fa' : 'rgba(255,255,255,.08)'};border-radius:14px;padding:20px;background:${plan === 'business' ? 'rgba(96,165,250,.05)' : 'rgba(255,255,255,.02)'}">
            <div style="font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Business 🚀</div>
            <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:4px">€79 <span style="font-size:13px;color:rgba(255,255,255,.35);font-weight:400">/mo</span></div>
            <div style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:16px;line-height:1.8">
              ✓ Unlimited messages<br>
              ✓ Unlimited workspaces<br>
              ✓ Dedicated support<br>
              ✓ Group chats<br>
              ✓ Custom integrations
            </div>
            ${plan === 'business'
              ? '<div style="text-align:center;padding:8px;border-radius:8px;background:rgba(96,165,250,.1);color:#60a5fa;font-size:12px;font-weight:700">Current plan</div>'
              : '<button onclick="upgradePlan(\'business\')" style="width:100%;padding:10px;border-radius:8px;background:#60a5fa;color:#000;font-size:13px;font-weight:700;cursor:pointer;border:none;font-family:inherit">Upgrade to Business →</button>'
            }
          </div>
        </div>
      </div>` : ''}

      <!-- Danger zone -->
      <div class="card" style="border-color:rgba(239,68,68,.15)">`;

if (content.includes('<!-- Danger zone -->')) {
  content = content.replace(OLD, NEW);
  fs.writeFileSync('src/routes/dashboard.js', content);
  console.log('✅ Added pricing cards to account tab');
} else {
  console.log('❌ Pattern not found');
}
