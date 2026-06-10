const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, attachments }) => {
  // Use Resend API (works on Render, no SMTP needed)
  const payload = {
    from: 'Syncora <noreply@syncora.one>',
    to: process.env.NODE_ENV === 'production' ? to : process.env.GMAIL_USER,
    subject,
    html,
  };
  if (attachments && attachments.length) payload.attachments = attachments;
  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(JSON.stringify(error));
  console.log('[EMAIL] Sent | id:', data?.id);
  return data;
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

const sendActivationEmail = async ({ to, companyName }) => {
  await sendEmail({
    to,
    subject: 'Your Syncora workspace is ready!',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px"><span style="font-size:22px;font-weight:900;color:#25D366">Syncora</span></div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 12px;color:#111;font-size:24px">&#x1F389; Welcome to Syncora!</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + companyName + ', your workspace has been successfully activated. You are all set to start managing WhatsApp conversations from Slack.</p>'
      + '<div style="background:#f0fff4;border:1px solid #c6f6d5;border-radius:12px;padding:20px;margin-bottom:24px">'
      + '<p style="margin:0;font-size:14px;color:#276749;line-height:1.6">&#x2705; Your Syncora account is active. Login to your dashboard to connect your WhatsApp Business number and start receiving messages in Slack.</p>'
      + '</div>'
      + '<div style="text-align:center;margin:28px 0">'
      + '<a href="' + (process.env.APP_URL || 'https://syncora-ar26.onrender.com') + '/dashboard" style="display:inline-block;background:#25D366;color:#000;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">Go to Dashboard &rarr;</a>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora</p>'
      + '</div></div></body></html>'
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


const sendUpgradeEmail = async ({ to, companyName, plan, amount, nextBillingDate, pdfBuffer, invoiceNumber }) => {
  const planFeatures = {
    pro: [
      '3 Slack workspaces',
      'Unlimited messages',
      'Real-time WhatsApp routing',
      'Media forwarding',
      'Full message history',
      'Priority support'
    ],
    business: [
      'Unlimited Slack workspaces',
      'Unlimited messages',
      'Real-time WhatsApp routing',
      'Media forwarding',
      'Full message history',
      'Priority support',
      'Dedicated onboarding',
      'Custom integrations',
      'SLA guarantee'
    ]
  };
  const features = planFeatures[plan] || [];
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const featureRows = features.map(f =>
    '<tr><td style="padding:6px 0;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0">&#10003; ' + f + '</td></tr>'
  ).join('');

  const emailPayload = {
    to,
    subject: 'Your Syncora ' + planLabel + ' plan is now active',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px;display:flex;align-items:center">'
      + '<span style="font-size:22px;font-weight:900;color:#25D366;letter-spacing:-0.5px">Syncora</span>'
      + '<span style="margin-left:8px;font-size:12px;background:#25D366;color:#000;padding:2px 8px;border-radius:20px;font-weight:700">' + planLabel + '</span>'
      + '</div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 8px;color:#111;font-size:22px">Payment confirmed</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + companyName + ', your upgrade to <strong>' + planLabel + '</strong> is now active.</p>'
      + '<div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:24px">'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:13px;color:#777">Plan</span>'
      + '<span style="font-size:13px;font-weight:700;color:#111">Syncora ' + planLabel + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:13px;color:#777">Amount</span>'
      + '<span style="font-size:13px;font-weight:700;color:#111">' + amount + '/month</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:12px">'
      + '<span style="font-size:13px;color:#777">Next billing date</span>'
      + '<span style="font-size:13px;font-weight:700;color:#111">' + nextBillingDate + '</span>'
      + '</div>'
      + '</div>'
      + '<p style="font-size:13px;color:#777;margin:0 0 12px">Included in your plan:</p>'
      + '<table style="width:100%;border-collapse:collapse">' + featureRows + '</table>'
      + '<div style="margin-top:24px;padding-top:24px;border-top:1px solid #eee;text-align:center">'
      + '<a href="' + process.env.APP_URL + '/dashboard" style="display:inline-block;background:#25D366;color:#000;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Go to Dashboard &rarr;</a>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora &middot; To manage your subscription visit your dashboard</p>'
      + '</div></div>'
      + '</body></html>'
  };
  if (pdfBuffer) {
    emailPayload.attachments = [{
      filename: 'syncora-invoice-' + invoiceNumber + '.pdf',
      content: pdfBuffer.toString('base64'),
    }];
  }
  await sendEmail(emailPayload);
};

const sendCancellationEmail = async ({ to, companyName, planEnd }) => {
  await sendEmail({
    to,
    subject: 'Your Syncora subscription has been cancelled',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px">'
      + '<span style="font-size:22px;font-weight:900;color:#25D366;letter-spacing:-0.5px">Syncora</span>'
      + '</div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 8px;color:#111;font-size:22px">Subscription cancelled</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + companyName + ', your Syncora subscription has been cancelled.</p>'
      + '<div style="background:#fff8f0;border:1px solid #fbd38d;border-radius:12px;padding:20px;margin-bottom:24px">'
      + '<p style="margin:0;font-size:14px;color:#92400e">Your plan will remain active until <strong>' + planEnd + '</strong>. After that your account will revert to the free Starter plan.</p>'
      + '</div>'
      + '<p style="font-size:14px;color:#555">On the Starter plan you will have:</p>'
      + '<ul style="color:#555;font-size:14px;padding-left:20px">'
      + '<li>1 Slack workspace</li>'
      + '<li>50 messages/day</li>'
      + '<li>Basic WhatsApp routing</li>'
      + '</ul>'
      + '<div style="margin-top:24px;padding-top:24px;border-top:1px solid #eee;text-align:center">'
      + '<a href="' + process.env.APP_URL + '/dashboard" style="display:inline-block;background:#25D366;color:#000;padding:12px 28px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Reactivate plan &rarr;</a>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora</p>'
      + '</div></div>'
      + '</body></html>'
  });
};


const sendLoginCredentialsEmail = async ({ to, companyName, loginEmail, loginPassword, loginUrl }) => {
  await sendEmail({
    to,
    subject: 'Your Syncora login credentials',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px">'
      + '<span style="font-size:22px;font-weight:900;color:#25D366;letter-spacing:-0.5px">Syncora</span>'
      + '</div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 8px;color:#111;font-size:22px">Your login credentials</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + companyName + ', here are your Syncora dashboard login details.</p>'
      + '<div style="background:#f0f4ff;border:1px solid #c7d7ff;border-radius:12px;padding:24px;margin-bottom:24px">'
      + '<table style="width:100%;border-collapse:collapse">'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#555;width:80px;border-bottom:1px solid #e5e5e5">Login URL</td>'
      + '<td style="padding:8px 0;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e5e5">' + loginUrl + '</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#555;border-bottom:1px solid #e5e5e5">Email</td>'
      + '<td style="padding:8px 0;font-size:13px;font-weight:600;color:#111;border-bottom:1px solid #e5e5e5">' + loginEmail + '</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#555">Password</td>'
      + '<td style="padding:8px 0;font-size:18px;font-weight:900;color:#4A154B;font-family:monospace;letter-spacing:4px">' + loginPassword + '</td></tr>'
      + '</table>'
      + '</div>'
      + '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:14px;margin-bottom:24px">'
      + '<p style="margin:0;font-size:13px;color:#856404">Please change your password after your first login for security.</p>'
      + '</div>'
      + '<div style="text-align:center">'
      + '<a href="' + loginUrl + '" style="display:inline-block;background:#4A154B;color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">Login to Dashboard &rarr;</a>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora</p>'
      + '</div></div>'
      + '</body></html>'
  });
};


const sendConnectWorkspaceEmail = async ({ to, companyName }) => {
  const installUrl = process.env.APP_URL + '/auth/slack?company=' + encodeURIComponent(companyName) + '&email=' + encodeURIComponent(to);
  await sendEmail({
    to,
    subject: 'Connect your Slack workspace to Syncora',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px">'
      + '<span style="font-size:22px;font-weight:900;color:#25D366;letter-spacing:-0.5px">Syncora</span>'
      + '</div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 8px;color:#111;font-size:22px">Welcome to Syncora!</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + companyName + ', your Syncora account has been created. The next step is to connect your Slack workspace.</p>'
      + '<div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:24px">'
      + '<p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#111">How it works:</p>'
      + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">'
      + '<span style="background:#25D366;color:#000;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">1</span>'
      + '<p style="margin:0;font-size:13px;color:#555">Click the button below to connect your Slack workspace</p></div>'
      + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">'
      + '<span style="background:#25D366;color:#000;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">2</span>'
      + '<p style="margin:0;font-size:13px;color:#555">Approve Syncora access to your Slack workspace</p></div>'
      + '<div style="display:flex;align-items:flex-start;gap:12px">'
      + '<span style="background:#25D366;color:#000;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">3</span>'
      + '<p style="margin:0;font-size:13px;color:#555">You will receive your login credentials and claim code after connecting</p></div>'
      + '</div>'
      + '<div style="text-align:center;margin:24px 0">'
      + '<a href="' + installUrl + '" style="display:inline-block;background:#4A154B;color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">Connect Slack Workspace &rarr;</a>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora</p>'
      + '</div></div>'
      + '</body></html>'
  });
};


const sendPasswordResetEmail = async ({ to, fullName, resetUrl }) => {
  await sendEmail({
    to,
    subject: 'Reset your Syncora password',
    html: '<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">'
      + '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
      + '<div style="background:#111;padding:28px 32px">'
      + '<span style="font-size:22px;font-weight:900;color:#25D366;letter-spacing:-0.5px">Syncora</span>'
      + '</div>'
      + '<div style="padding:32px">'
      + '<h2 style="margin:0 0 8px;color:#111;font-size:22px">Reset your password</h2>'
      + '<p style="color:#555;margin:0 0 24px;font-size:14px">Hi ' + fullName + ', we received a request to reset your Syncora password. Click the button below to set a new password.</p>'
      + '<div style="text-align:center;margin:28px 0">'
      + '<a href="' + resetUrl + '" style="display:inline-block;background:#25D366;color:#000;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:15px">Reset Password &rarr;</a>'
      + '</div>'
      + '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:14px;margin-bottom:24px">'
      + '<p style="margin:0;font-size:13px;color:#856404">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>'
      + '</div>'
      + '<p style="margin-top:24px;font-size:11px;color:#bbb;text-align:center">Powered by Syncora</p>'
      + '</div></div>'
      + '</body></html>'
  });
};

module.exports = {
  sendVerificationEmail,
  sendActivationEmail,
  sendWaitlistConfirmationEmail,
  sendInviteEmail,
  sendUpgradeEmail,
  sendCancellationEmail,
  sendLoginCredentialsEmail,
  sendConnectWorkspaceEmail,
  sendPasswordResetEmail,
};
