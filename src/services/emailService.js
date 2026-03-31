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
<html><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f0f0;padding:32px 16px}
  .wrap{max-width:560px;margin:0 auto}
  .card{background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .header{background:#060608;padding:28px 32px;text-align:center}
  .header-logo{font-size:26px;font-weight:900;color:#25D366;letter-spacing:-1px;margin-bottom:12px}
  .header-logo span{color:#ffffff}
  .header h1{color:#ffffff;font-size:20px;font-weight:700;margin-bottom:4px}
  .header p{color:rgba(255,255,255,.45);font-size:14px}
  .body{padding:28px 32px}
  .greeting{font-size:15px;color:#333;margin-bottom:20px;line-height:1.6}
  .info-table{width:100%;border-collapse:collapse;background:#f8fdf9;border:1px solid #c3e6cb;border-radius:10px;overflow:hidden;margin-bottom:20px}
  .info-table td{padding:12px 16px;font-size:14px;border-bottom:1px solid #d4edda}
  .info-table tr:last-child td{border-bottom:none}
  .info-label{font-weight:700;color:#166534;text-transform:uppercase;font-size:11px;letter-spacing:.8px;width:140px}
  .info-value{color:#1a3c2a;font-weight:600}
  .code-box{background:#060608;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px}
  .code-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:8px}
  .code-val{font-size:34px;font-weight:900;color:#25D366;letter-spacing:6px;font-family:'Courier New',monospace}
  .steps-title{font-size:14px;font-weight:700;color:#111;margin-bottom:12px}
  .step{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start}
  .step-num{min-width:24px;height:24px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000;flex-shrink:0;margin-top:1px}
  .step-text{font-size:14px;color:#444;line-height:1.5}
  .footer{background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0}
  .footer-brand{font-size:18px;font-weight:900;color:#25D366;margin-bottom:8px;letter-spacing:-0.5px}
  .footer-brand span{color:#555}
  .footer p{font-size:12px;color:#888;line-height:1.6}
  .footer a{color:#25D366}
</style>
</head>
<body>
<div class="wrap">
<div class="card">

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">SYNC<span>ORA</span></div>
    <h1>You're live on Syncora! 🎉</h1>
    <p>Your workspace has been activated</p>
  </div>

  <!-- BODY -->
  <div class="body">
    <p class="greeting">Hi <strong>${companyName}</strong>,<br/><br/>
    Great news — your Syncora workspace has been activated. You can now receive WhatsApp messages directly in your Slack workspace.</p>

    <!-- INFO TABLE -->
    <table class="info-table">
      <tr>
        <td class="info-label">Company</td>
        <td class="info-value">${companyName}</td>
      </tr>
      <tr>
        <td class="info-label">WhatsApp number</td>
        <td class="info-value">${twilioNumber}</td>
      </tr>
    </table>

    <!-- CLAIM CODE -->
    <div class="code-box">
      <div class="code-label">Your claim code</div>
      <div class="code-val">${claimCode}</div>
    </div>

    <!-- STEPS -->
    <p class="steps-title">How to get started:</p>

    <div class="step">
      <div class="step-num">1</div>
      <div class="step-text">Save this WhatsApp number: <strong>${twilioNumber}</strong></div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-text">Share this number with your customers and ask them to send your claim code <strong>${claimCode}</strong> as their first message</div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-text">Their messages will appear instantly in a dedicated Slack channel in your workspace</div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-text">Reply directly from Slack — your customer receives it on WhatsApp</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-brand">SYNC<span>ORA</span></div>
    <p>Questions? Reply to this email or contact us at <a href="mailto:${process.env.GMAIL_USER}">${process.env.GMAIL_USER}</a><br/>
    © 2026 Syncora · WhatsApp ↔ Slack Bridge</p>
  </div>

</div>
</div>
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