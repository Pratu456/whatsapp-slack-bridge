const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  // Use Resend API (works on Render, no SMTP needed)
  const { data, error } = await resend.emails.send({
    from: 'Syncora <onboarding@resend.dev>',
    to: process.env.NODE_ENV === 'production' ? to : process.env.GMAIL_USER,
    subject,
    html,
  });
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

const sendActivationEmail = async ({ to, companyName, claimCode, whatsappNumber }) => {
  await sendEmail({
    to,
    subject: 'Your Syncora workspace is ready!',
    html: `<!DOCTYPE html><html><body style="font-family:Inter,sans-serif;background:#f9f9f9;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px">
        <h2 style="color:#111;margin-bottom:12px">🎉 Your workspace is active!</h2>
        <p style="color:#555;margin-bottom:20px">Hi ${companyName}, your Syncora workspace is ready.</p>
        <div style="background:#f4f4f4;border-radius:10px;padding:20px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;color:#777">YOUR WHATSAPP NUMBER</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#111">${whatsappNumber}</p>
        </div>
        <div style="background:#f0fff4;border:1px solid #25D366;border-radius:10px;padding:20px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;color:#777">YOUR CLAIM CODE</p>
          <p style="margin:0;font-size:24px;font-weight:900;color:#25D366;letter-spacing:4px">${claimCode}</p>
        </div>
        <p style="color:#555;font-size:13px">Share this claim code with your customers. They send it to your WhatsApp number to connect.</p>
        <div style="background:#f8f8f8;border-radius:10px;padding:20px;margin:24px 0;border:1px solid #e5e5e5">
          <p style="margin:0 0 8px;font-size:13px;color:#777">STEP 1 — INSTALL SYNCORA IN YOUR SLACK WORKSPACE</p>
          <p style="margin:0 0 16px;font-size:13px;color:#555">Click below to add Syncora to your Slack workspace. Takes a few seconds.</p>
          <a href="${process.env.APP_URL}/auth/slack" style="display:inline-block;background:#4A154B;color:#fff;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px">Add to Slack →</a>
        </div>
        <div style="background:#f0fff4;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #25D366">
          <p style="margin:0;font-size:13px;color:#555">📱 <strong>STEP 2</strong> — Ask your customers to message <strong>${whatsappNumber}</strong> on WhatsApp with code <strong style="color:#25D366">${claimCode}</strong> to connect.</p>
        </div>
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


const sendUpgradeEmail = async ({ to, companyName, plan, amount, nextBillingDate }) => {
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

  await sendEmail({
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
  });
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

module.exports = {
  sendVerificationEmail,
  sendActivationEmail,
  sendWaitlistConfirmationEmail,
  sendInviteEmail,
  sendUpgradeEmail,
  sendCancellationEmail,
};
