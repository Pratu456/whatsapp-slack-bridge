// src/services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const sendActivationEmail = async ({ to, companyName, claimCode, twilioNumber }) => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f0;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%">

  <!-- HEADER -->
  <tr>
    <td style="background:#060608;padding:28px 32px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px;font-family:Arial,sans-serif">SYNC<span style="color:#ffffff">ORA</span></div>
      <div style="color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px">You're live on Syncora! 🎉</div>
      <div style="color:rgba(255,255,255,.45);font-size:14px">Your workspace has been activated</div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:28px 32px">

      <!-- GREETING -->
      <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.6">
        Hi <strong>${companyName}</strong>,<br/><br/>
        Great news — your Syncora workspace has been activated. You can now receive WhatsApp messages directly in your Slack workspace.
      </p>

      <!-- INFO TABLE -->
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

      <!-- CLAIM CODE -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060608;border-radius:10px;margin-bottom:20px">
        <tr>
          <td style="padding:20px;text-align:center">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:8px">Your claim code</div>
            <div style="font-size:34px;font-weight:900;color:#25D366;letter-spacing:6px;font-family:'Courier New',monospace">${claimCode}</div>
          </td>
        </tr>
      </table>

      <!-- STEPS TITLE -->
      <p style="font-size:14px;font-weight:700;color:#111;margin:0 0 14px">How to get started:</p>

      <!-- STEP 1 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top" style="padding-top:1px">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000;font-family:Arial,sans-serif">1</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Save this WhatsApp number: <strong>${twilioNumber}</strong>
          </td>
        </tr>
      </table>

      <!-- STEP 2 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top" style="padding-top:1px">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000;font-family:Arial,sans-serif">2</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Share this number with your customers and ask them to send your claim code <strong>${claimCode}</strong> as their first message
          </td>
        </tr>
      </table>

      <!-- STEP 3 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px">
        <tr>
          <td width="32" valign="top" style="padding-top:1px">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000;font-family:Arial,sans-serif">3</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Their messages will appear instantly in a dedicated Slack channel in your workspace
          </td>
        </tr>
      </table>

      <!-- STEP 4 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:4px">
        <tr>
          <td width="32" valign="top" style="padding-top:1px">
            <div style="width:24px;height:24px;background:#25D366;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:800;color:#000;font-family:Arial,sans-serif">4</div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#444;line-height:1.5">
            Reply directly from Slack — your customer receives it on WhatsApp
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0">
      <div style="font-size:20px;font-weight:900;color:#25D366;margin-bottom:8px;font-family:Arial,sans-serif">SYNC<span style="color:#555">ORA</span></div>
      <p style="font-size:12px;color:#888;line-height:1.6;margin:0">
        Questions? Reply to this email or contact us at <a href="mailto:${process.env.GMAIL_USER}" style="color:#25D366">${process.env.GMAIL_USER}</a><br/>
        © 2026 Syncora · WhatsApp ↔ Slack Bridge
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>`;

  await transporter.sendMail({
    from: `"Syncora" <${process.env.GMAIL_USER}>`,
    to,
    subject: `🎉 Your Syncora workspace is live — ${companyName}`,
    html,
  });

  console.log(`Activation email sent to ${to}`);
};

module.exports = { sendActivationEmail };
