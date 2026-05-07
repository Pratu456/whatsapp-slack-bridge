const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  const info = await transporter.sendMail({
    from: '"Syncora" <' + process.env.GMAIL_USER + '>',
    to,
    subject,
    html,
  });
  console.log('[EMAIL] Sent to', to, '| id:', info.messageId);
  return info;
};

const sendVerificationEmail = async ({ to, fullName, verifyToken }) => {
  const verifyUrl = process.env.APP_URL + '/auth/verify?token=' + verifyToken;
  await sendEmail({
    to,
    subject: 'Verify your Syncora account',
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">
        <h2 style="color:#111;margin-bottom:12px">Verify your email</h2>
        <p style="color:#555;margin-bottom:20px">Hi ${fullName}, click below to verify your Syncora account.</p>
        <a href="${verifyUrl}" style="background:#25D366;color:#000;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block">Verify email →</a>
        <p style="margin-top:24px;font-size:12px;color:#999">If you didn't create an account, ignore this email.</p>
      </div>
    </body></html>`
  });
};

const sendActivationEmail = async ({ to, companyName, claimCode, twilioNumber }) => {
  await sendEmail({
    to,
    subject: 'Your Syncora workspace is ready!',
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">
        <h2 style="color:#111;margin-bottom:12px">🎉 Your workspace is active!</h2>
        <p style="color:#555;margin-bottom:20px">Hi ${companyName}, your Syncora workspace is ready.</p>
        <div style="background:#f4f4f4;border-radius:10px;padding:20px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;color:#777">YOUR WHATSAPP NUMBER</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#111">${twilioNumber}</p>
        </div>
        <div style="background:#f0fff4;border:1px solid #25D366;border-radius:10px;padding:20px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;color:#777">YOUR CLAIM CODE</p>
          <p style="margin:0;font-size:24px;font-weight:900;color:#25D366;letter-spacing:4px">${claimCode}</p>
        </div>
        <p style="color:#555;font-size:13px">Share this claim code with your customers. They send it to your WhatsApp number to connect.</p>
        <p style="margin-top:24px;font-size:12px;color:#999">Powered by Syncora</p>
      </div>
    </body></html>`
  });
};

const sendWaitlistConfirmationEmail = async ({ to }) => {
  await sendEmail({
    to,
    subject: "You're on the Syncora waitlist!",
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">
        <h2 style="color:#111;margin-bottom:12px">You're on the list! 🎉</h2>
        <p style="color:#555">Thanks for joining the Syncora waitlist. We'll be in touch soon.</p>
        <p style="margin-top:24px;font-size:12px;color:#999">Powered by Syncora</p>
      </div>
    </body></html>`
  });
};

const sendInviteEmail = async ({ to, companyName, waLink, groupName, type }) => {
  const subject = type === 'group'
    ? 'You are invited to join ' + groupName + ' on WhatsApp'
    : companyName + ' wants to chat with you on WhatsApp';

  const body = type === 'group'
    ? '<p>You have been invited to join <strong>' + groupName + '</strong> group chat by <strong>' + companyName + '</strong>.</p><p>Click the button below to join:</p>'
    : '<p><strong>' + companyName + '</strong> wants to connect with you on WhatsApp.</p><p>Click below to start chatting:</p>';

  await sendEmail({
    to,
    subject,
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">
        <h2 style="color:#111;margin-bottom:12px">${subject}</h2>
        ${body}
        <a href="${waLink}" style="display:inline-block;margin-top:20px;background:#25D366;color:#000;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">
          💬 Open WhatsApp Chat →
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">Powered by Syncora</p>
      </div>
    </body></html>`
  });
};

module.exports = {
  sendVerificationEmail,
  sendActivationEmail,
  sendWaitlistConfirmationEmail,
  sendInviteEmail,
};
