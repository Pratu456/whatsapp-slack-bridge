// src/services/emailService.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendActivationEmail = async ({ to, companyName, claimCode, twilioNumber }) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%">

  <tr>
    <td style="background:#060608;padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px;font-family:Arial,sans-serif">SYNC<span style="color:#ffffff">ORA</span></div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px">You're live on Syncora! 🎉</div>
      <div style="color:rgba(255,255,255,.45);font-size:14px">Your workspace has been activated</div>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 32px">
      <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.6">
        Hi <strong>${companyName}</strong>,<br/><br/>
        Great news — your Syncora workspace has been activated. You can now receive WhatsApp messages directly in your Slack workspace.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fdf9;border:1px solid #c3e6cb;border-radius:10px;margin-bottom:20px">
        <tr>
          <td width="140" style="padding:12px 16px;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid #d4edda">Company</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a3c2a;border-bottom:1px solid #d4edda">${companyName}</td>
        </tr>
        <tr>
          <td width="140" style="padding:12px 16px;font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.8px">WhatsApp No.</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a3c2a">${twilioNumber}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060608;border-radius:10px;margin-bottom:20px">
        <tr>
          <td style="padding:20px;text-align:center">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:8px">Your claim code</div>
            <div style="font-size:34px;font-weight:900;color:#25D366;letter-spacing:6px;font-family:'Courier New',monospace">${claimCode}</div>
          </td>
        </tr>
      </table>

      <p style="font-size:14px;font-weight:700;color:#111;margin:0 0 14px">How to get started:</p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000">1</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Save this WhatsApp number: <strong>${twilioNumber}</strong>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000">2</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Share this number with your customers and ask them to send your claim code <strong>${claimCode}</strong> as their first message
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000">3</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Their messages will appear instantly in a dedicated Slack channel in your workspace
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:4px">
        <tr>
          <td width="32" valign="top">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000">4</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Reply directly from Slack — your customer receives it on WhatsApp
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0">
      <div style="font-size:20px;font-weight:900;color:#25D366;margin-bottom:8px;font-family:Arial,sans-serif">SYNC<span style="color:#555">ORA</span></div>
      <p style="font-size:12px;color:#888;line-height:1.6;margin:0">
        © 2026 Syncora · WhatsApp ↔ Slack Bridge
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from:    'Syncora <onboarding@resend.dev>',
    to,
    subject: `🎉 Your Syncora workspace is live — ${companyName}`,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(error.message);
  }

  console.log(`Activation email sent to ${to} — id: ${data.id}`);
};

// ── Waitlist confirmation email ───────────────────────────
const sendWaitlistConfirmationEmail = async ({ to }) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%">

  <tr>
    <td style="background:#060608;padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px;font-family:Arial,sans-serif">SYNC<span style="color:#ffffff">ORA</span></div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px">You're on the list! 🎉</div>
      <div style="color:rgba(255,255,255,.45);font-size:14px">We'll be in touch soon</div>
    </td>
  </tr>

  <tr>
    <td style="padding:32px">
      <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.7">
        Thanks for signing up for early access to Syncora.<br/><br/>
        We're onboarding teams one by one to make sure everything runs smoothly. When it's your turn, we'll send you a personal invite with everything you need to get started.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060608;border-radius:10px;margin-bottom:24px">
        <tr>
          <td style="padding:24px;text-align:center">
            <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:16px;line-height:1.6">Here's what Syncora does:</div>
            <div style="font-size:15px;font-weight:700;color:#25D366;margin-bottom:6px">WhatsApp messages → Slack</div>
            <div style="font-size:13px;color:rgba(255,255,255,.5)">Your customers message you on WhatsApp.<br/>Your team replies from Slack — instantly.</div>
          </td>
        </tr>
      </table>

      <p style="font-size:14px;color:#555;line-height:1.7;margin:0">
        In the meantime, if you have any questions feel free to reply to this email.<br/><br/>
        Talk soon,<br/>
        <strong style="color:#111">The Syncora Team</strong>
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0">
      <div style="font-size:20px;font-weight:900;color:#25D366;margin-bottom:8px;font-family:Arial,sans-serif">SYNC<span style="color:#555">ORA</span></div>
      <p style="font-size:12px;color:#888;line-height:1.6;margin:0">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from:    'Syncora <onboarding@resend.dev>',
    to,
    subject: `You're on the Syncora waitlist 🎉`,
    html,
  });

  if (error) {
    console.error('Resend waitlist confirmation error:', error);
    throw new Error(error.message);
  }

  console.log(`Waitlist confirmation sent to ${to} — id: ${data.id}`);
};

// ── Waitlist invite email ─────────────────────────────────
const sendWaitlistInviteEmail = async ({ to }) => {
  const onboardingUrl = `${process.env.APP_URL || 'https://syncora-ar26.onrender.com'}/onboarding`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%">

  <tr>
    <td style="background:#060608;padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px;font-family:Arial,sans-serif">SYNC<span style="color:#ffffff">ORA</span></div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px">Your invite is ready 🚀</div>
      <div style="color:rgba(255,255,255,.45);font-size:14px">Time to connect WhatsApp to Slack</div>
    </td>
  </tr>

  <tr>
    <td style="padding:32px">
      <p style="font-size:15px;color:#333;margin:0 0 24px;line-height:1.7">
        Good news — it's your turn! You've been invited to set up your Syncora workspace.<br/><br/>
        Click the button below to connect your Slack workspace and get started. It takes under 2 minutes.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
        <tr>
          <td align="center">
            <a href="${onboardingUrl}" style="display:inline-block;background:#25D366;color:#000;font-size:15px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif">
              Set up my workspace →
            </a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fdf9;border:1px solid #c3e6cb;border-radius:10px;margin-bottom:24px">
        <tr><td style="padding:16px 20px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#166534;margin-bottom:10px">What happens next</div>
          <div style="font-size:13px;color:#444;line-height:1.8">
            1. Enter your company name and email<br/>
            2. Connect your Slack workspace (one click)<br/>
            3. We assign your WhatsApp number and send your claim code<br/>
            4. Share the number with your customers — you're live!
          </div>
        </td></tr>
      </table>

      <p style="font-size:13px;color:#888;line-height:1.6;margin:0">
        If the button doesn't work, copy this link:<br/>
        <a href="${onboardingUrl}" style="color:#25D366">${onboardingUrl}</a>
      </p>
    </td>
  </tr>

  <tr>
    <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0">
      <div style="font-size:20px;font-weight:900;color:#25D366;margin-bottom:8px;font-family:Arial,sans-serif">SYNC<span style="color:#555">ORA</span></div>
      <p style="font-size:12px;color:#888;line-height:1.6;margin:0">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from:    'Syncora <onboarding@resend.dev>',
    to,
    subject: `Your Syncora invite is ready — let's get started 🚀`,
    html,
  });

  if (error) {
    console.error('Resend invite error:', error);
    throw new Error(error.message);
  }

  console.log(`Waitlist invite sent to ${to} — id: ${data.id}`);
  };
  // ── Email verification ────────────────────────────────────
  const sendVerificationEmail = async ({ to, fullName, verifyToken }) => {
    const verifyUrl = `${process.env.APP_URL || 'https://syncora-ar26.onrender.com'}/auth/verify-email?token=${verifyToken}`;
    const { data, error } = await resend.emails.send({
      from: 'Syncora <onboarding@resend.dev>',
      to,
      subject: 'Verify your Syncora account',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
  <body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 16px">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%">
    <tr><td style="background:#060608;padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px;font-family:Arial,sans-serif">SYNC<span style="color:#ffffff">ORA</span></div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px">Verify your email</div>
      <div style="color:rgba(255,255,255,.45);font-size:14px">One click to get started</div>
    </td></tr>
    <tr><td style="padding:32px">
      <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.7">Hi <strong>${fullName}</strong>,<br/><br/>Thanks for signing up for Syncora. Click the button below to verify your email address and continue to onboarding.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
        <tr><td align="center">
          <a href="${verifyUrl}" style="display:inline-block;background:#25D366;color:#000;font-size:15px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif">Verify my email →</a>
        </td></tr>
      </table>
      <p style="font-size:13px;color:#888;line-height:1.6;margin:0">If the button doesn't work, copy this link:<br/><a href="${verifyUrl}" style="color:#25D366">${verifyUrl}</a></p>
    </td></tr>
    <tr><td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0">
      <p style="font-size:12px;color:#888;line-height:1.6;margin:0">© 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
    </td></tr>
  </table>
  </td></tr>
  </table>
  </body></html>`,
    });
    if (error) throw new Error(error.message);
    console.log(`Verification email sent to ${to}`);
  };
module.exports = { sendActivationEmail, sendWaitlistConfirmationEmail, sendWaitlistInviteEmail, sendVerificationEmail };
const sendInviteEmail = async ({ to, companyName, waLink, groupName, type }) => {
  const subject = type === 'group'
    ? `You're invited to join ${groupName} on WhatsApp`
    : `${companyName} wants to chat with you on WhatsApp`;

  const body = type === 'group'
    ? `<p>You've been invited to join <strong>${groupName}</strong> group chat by <strong>${companyName}</strong>.</p>
       <p>Click the button below to join the group on WhatsApp:</p>`
    : `<p><strong>${companyName}</strong> wants to connect with you on WhatsApp.</p>
       <p>Click the button below to start chatting:</p>`;

  const { data, error } = await resend.emails.send({
    from: 'Syncora <onboarding@resend.dev>',
    to,
    subject,
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <img src="https://syncora-ar26.onrender.com/logo_text.png" style="height:28px;margin-bottom:24px;filter:invert(1)" alt="Syncora"/>
        <h2 style="font-size:22px;font-weight:800;color:#111;margin-bottom:12px">${subject}</h2>
        ${body}
        <a href="${waLink}" style="display:inline-block;margin-top:20px;background:#25D366;color:#000;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">
          💬 Open WhatsApp Chat →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">Powered by Syncora · WhatsApp ↔ Slack Bridge</p>
      </div>
    </body></html>`
  });
  if (error) throw new Error(error.message);
  return data;
};

module.exports = { ...module.exports, sendInviteEmail };
