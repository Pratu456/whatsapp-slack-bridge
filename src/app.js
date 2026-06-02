// src/app.js
require('dotenv').config();
const { pool } = require('./db');
const express = require('express');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const whatsappRoute = require('./routes/whatsapp');
const { connect: connectRedis } = require('./cache/redis');
// ✅ CHANGED: replaced twilioService with metaService
const { sendWhatsAppMessage, sendWhatsAppMedia } = require('./services/metaService');
const { getWaNumberForTenant } = require('./services/tenantService');
const { logMessage } = require('./services/messageLogger');
const path = require('path');
const crypto = require('crypto');
const { WebClient } = require('@slack/web-api');

const authRoute = require('./routes/auth');
const onboardingRoute = require('./routes/onboarding');
const adminRoute = require('./routes/admin');
const dashboardRoute = require('./routes/dashboard');
const commandsRoute = require('./routes/commands');
const slackCommandsRoute = require('./routes/slackCommands');
const { router: metaWebhookRoute } = require('./routes/metaWebhook');
const stripeRoute = require('./routes/stripe');
const { sendWaitlistConfirmationEmail } = require('./services/emailService');
const { migrateAdminSettings } = require('./services/adminSettings');
const server = express();
server.set('trust proxy', 1);
// Session configured after Redis connects — see below
let sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'syncora-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  });
server.use((req, res, next) => sessionMiddleware(req, res, next));

// ✅ STEP 1 — raw body parser for Slack MUST come before express.json()
server.post('/slack/events', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    const parsed = JSON.parse(rawBody);

    // URL verification — respond immediately
    if (parsed.type === 'url_verification') {
      console.log('[SLACK] Challenge received ✓');
      return res.status(200).json({ challenge: parsed.challenge });
    }

    // Respond to Slack within 3 seconds
    res.status(200).end();

    // Validate signature
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig  = req.headers['x-slack-signature'];
    if (!timestamp || !slackSig) {
      console.error('[SLACK] Missing signature headers');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.warn('[SLACK] Stale request rejected');
      return;
    }

    const sigBase = `v0:${timestamp}:${rawBody}`;
    const hmac    = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
    hmac.update(sigBase);
    const mySig = `v0=${hmac.digest('hex')}`;

    if (mySig !== slackSig) {
      console.error('[SLACK] Signature mismatch');
      return;
    }

    console.log('[SLACK EVENT]', parsed.event?.type, '| channel:', parsed.event?.channel);

    if (parsed.event) {
      handleSlackEvent(parsed.event).catch(err =>
        console.error('[SLACK EVENT ERROR]', err.message)
      );
    }

  } catch (err) {
    console.error('[SLACK EVENTS ROUTE ERROR]', err.message);
    if (!res.headersSent) res.status(500).end();
  }
});

// ✅ STEP 2 — all other middleware comes AFTER Slack events route
server.use('/stripe/webhook', express.raw({ type: "application/json" }));
server.use('/stripe', express.json(), stripeRoute);
server.use(express.urlencoded({ extended: false }));
server.use(express.json());
server.use(express.static(path.join(__dirname, '../public')));
server.use((req, res, next) => { res.setHeader('Accept-Ranges', 'bytes'); next(); });

server.get('/', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '../index.html'));
});
server.use('/whatsapp', whatsappRoute);
server.use('/auth', authRoute);
server.use('/onboarding', onboardingRoute);
server.use('/admin', adminRoute);
server.use('/dashboard', dashboardRoute);
server.get('/auth/logout', (req, res) => { req.session.destroy(); res.redirect('/auth/login'); });
server.use('/commands', commandsRoute);
server.use('/slack', slackCommandsRoute);
server.use('/webhook/meta', metaWebhookRoute);

server.get('/auth/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName, email: req.session.userEmail });
  } else {
    res.json({ loggedIn: false });
  }
});
server.get('/health', (req, res) => res.json({ status: 'ok' }));
server.use('/media', express.static(path.join(__dirname, 'tmp')));

  
  
  // TEMPORARY — remove after confirming
  server.get('/debug-env', (req, res) => {
    res.json({
      twilio_sid_present:  !!process.env.TWILIO_ACCOUNT_SID,
      slack_bot_present:   !!process.env.SLACK_BOT_TOKEN,
      resend_present:      !!process.env.RESEND_API_KEY,
      database_present:    !!process.env.DATABASE_URL,
      redis_present:       !!process.env.REDIS_URL,
    });
  });

const processed = new Set();

// ── Slack event handler ───────────────────────────────────
async function handleSlackEvent(event) {
  if (event.type !== 'message') return;
  if (event.subtype === 'bot_message' || event.bot_id) return;
  if (event.subtype === 'channel_join' || event.subtype === 'channel_leave' || event.subtype === 'channel_topic' || event.subtype === 'channel_purpose') return;
  if (!event.text && (!event.files || event.files.length === 0)) return;

  const eventKey = `${event.channel}:${event.ts}`;
  if (processed.has(eventKey)) return;
  processed.add(eventKey);
  setTimeout(() => processed.delete(eventKey), 60000);

  // Check if this is a GROUP channel
  const groupResult = await pool.query(
    `SELECT g.id as group_id, g.name as group_name,
            t.id as tenant_id, t.company_name, t.slack_bot_token, t.twilio_number
     FROM wa_groups g JOIN tenants t ON t.id = g.tenant_id
     WHERE g.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
    [event.channel]
  );
  if (groupResult.rows.length) {
    if (!event.user) return;
    const row = groupResult.rows[0];
    const grpTenant = { id: row.tenant_id, company_name: row.company_name, slack_bot_token: row.slack_bot_token };
    const groupId = row.group_id;
    console.log("[GROUP REPLY] Broadcasting to group:", row.group_name);
    if (event.text) {
      const { getAllMembers } = require("./services/groupService");
      const members = await getAllMembers(groupId);
      let agentName = "Support";
      try {
        const slack = new WebClient(grpTenant.slack_bot_token);
        const ui = await slack.users.info({ user: event.user });
        agentName = ui.user.profile.display_name || ui.user.real_name || "Support";
      } catch(e) {}
      for (const member of members) {
        try {
          // ✅ CHANGED: sendWhatsApp → sendWhatsAppMessage (no twilioNumber param)
          const msgId = await sendWhatsAppMessage(member.wa_number, "*" + agentName + "*: " + event.text, "group");
          console.log("[GROUP REPLY] Sent to", member.wa_number, msgId);
          await logMessage({ waNumber: member.wa_number, body: event.text, direction: "outbound", twilioSid: msgId, slackTs: event.ts, tenantId: grpTenant.id });
        } catch(e) { console.warn("[GROUP REPLY] Failed:", member.wa_number, e.message); }
      }
    }
    return;
  }

  console.log('[SLACK EVENT] channel:', event.channel, '| text:', event.text?.slice(0, 50));

  const tenantResult = await pool.query(
    `SELECT t.* FROM tenants t
     JOIN contacts c ON c.tenant_id = t.id
     WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
    [event.channel]
  );

  if (!tenantResult.rows.length) {
    console.log('[SLACK EVENT] No tenant found for channel:', event.channel);
    return;
  }

  const tenant = tenantResult.rows[0];
  console.log('[TENANT]', tenant.company_name);

  const waNumber = await getWaNumberForTenant(event.channel, tenant.id);
  if (!waNumber) {
    console.log('[SLACK EVENT] No WA number for channel:', event.channel, 'tenant:', tenant.id);
    return;
  }

  console.log('[OUTBOUND] to WhatsApp:', waNumber);

  // ── Handle file attachments ───────────────────────────
  if (event.files && event.files.length > 0) {
    for (const file of event.files) {
      try {
        const axios = require('axios');
        const fs = require('fs');
        // Download file using Slack token
        const https = require('https');
        const downloadUrl = file.url_private_download || file.url_private;
        const token = tenant.slack_bot_token;
        console.log('[FILE DL] Downloading file:', file.name, '|', file.mimetype);
        const mediaBuffer = await new Promise((resolve, reject) => {
          const options = {
            headers: { Authorization: `Bearer ${token}` }
          };
          https.get(downloadUrl, options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              https.get(res.headers.location, options, (res2) => {
                const chunks = [];
                res2.on('data', c => chunks.push(c));
                res2.on('end', () => resolve(Buffer.concat(chunks)));
                res2.on('error', reject);
              });
            } else {
              const chunks = [];
              res.on('data', c => chunks.push(c));
              res.on('end', () => resolve(Buffer.concat(chunks)));
              res.on('error', reject);
            }
          }).on('error', reject);
        });
        console.log('[FILE DL] Size:', Math.round(mediaBuffer.length/1024), 'KB');
        if (mediaBuffer.length > 100 * 1024 * 1024) {
          const slackWarn = new WebClient(tenant.slack_bot_token);
          await slackWarn.chat.postMessage({ channel: event.channel, text: '⚠️ File too large (max 100MB)' });
          continue;
        }
        if (mediaBuffer.length > 100 * 1024 * 1024) {
          const slack = new WebClient(tenant.slack_bot_token);
          await slack.chat.postMessage({
            channel: event.channel,
            text: '⚠️ File too large to forward to WhatsApp (max 100MB). Please compress the file and try again.',
          });
          continue;
        }
        // Upload directly to Meta Media API
        const FormData = require("form-data");
        const axios2 = require("axios");
        const form = new FormData();
        form.append("file", mediaBuffer, { filename: file.name || "media", contentType: file.mimetype });
        form.append("messaging_product", "whatsapp");
        const uploadResp = await axios2.post(
          `https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/media`,
          form,
          { headers: { ...form.getHeaders(), Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` }, maxContentLength: 100*1024*1024, maxBodyLength: 100*1024*1024 }
        );
        console.log("[META UPLOAD RESP]", JSON.stringify(uploadResp.data));
        const metaMediaId = uploadResp.data.id;
        console.log("[META UPLOAD] Media ID:", metaMediaId);
        const msgId = await sendWhatsAppMedia(waNumber, metaMediaId, event.text || "", file.mimetype, true);

        await logMessage({
          waNumber,
          body:      file.name,
          direction: 'outbound',
          twilioSid: msgId,
          slackTs:   event.ts,
          mediaType: file.mimetype,
          tenantId:  tenant.id,
        });

        console.log('[META MEDIA SENT]', msgId);
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch (e) {} }, 60000);

      } catch (fileErr) {
        console.error('[FILE ERROR]', fileErr.message, fileErr.response?.data ? JSON.stringify(fileErr.response.data) : '');
      }
    }
    return;
  }

  // ── Handle text message ───────────────────────────────
  if (event.text) {
    try {
      // ✅ CHANGED: sendWhatsApp → sendWhatsAppMessage (no twilioNumber param)
      const msgId = await sendWhatsAppMessage(waNumber, event.text, "private");

      await logMessage({
        waNumber,
        body:      event.text,
        direction: 'outbound',
        twilioSid: msgId,
        slackTs:   event.ts,
        tenantId:  tenant.id,
      });

      console.log('[META TEXT SENT]', msgId);
    } catch (err) {
      console.error('[META SEND ERROR]', err.message);
    }
  }
}

// ── Slash commands ────────────────────────────────────────

 
 
 // ── Waitlist signup ───────────────────────────────────────
 server.post('/waitlist', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.json({ success: false, error: 'Invalid email' });
      }
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (existingUser.rows.length) {
        return res.json({ success: false, error: 'An account with this email already exists. Please sign in instead.' });
      }
      const result = await pool.query(
        `INSERT INTO waitlist (email, created_at)
         VALUES ($1, NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [email.trim().toLowerCase()]
      );
      if (result.rows.length) {
        // New signup — send confirmation email
        try {
          await sendWaitlistConfirmationEmail({ to: email.trim().toLowerCase() });
        } catch (emailErr) {
          console.error('[WAITLIST EMAIL ERROR]', emailErr.message);
        }
        console.log('[WAITLIST] New signup:', email);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[WAITLIST ERROR]', err.message);
      res.json({ success: false, error: err.message });
    }
  });

 // ── Slack interactions (button clicks) ───────────────────
server.post('/slack/interactions', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);

    // Respond immediately to Slack
    res.status(200).end();

    if (payload.type === 'view_submission') {
      // Handle modal submission
      const values = payload.view.state.values;
      const replyText = values.reply_input.reply_text.value;
      const waNumber = payload.view.private_metadata;
      const channelId = payload.view.callback_id.replace('reply_modal_', '');

      // Get tenant for this channel
      const tenantResult = await pool.query(
        `SELECT t.* FROM tenants t
         JOIN contacts c ON c.tenant_id = t.id
         WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
        [channelId]
      );
      if (!tenantResult.rows.length) return;
      const tenant = tenantResult.rows[0];

      // ✅ CHANGED: sendWhatsApp → sendWhatsAppMessage (no twilioNumber param)
      const msgId = await sendWhatsAppMessage(waNumber, replyText, "private");
      await logMessage({
        waNumber,
        body: replyText,
        direction: 'outbound',
        twilioSid: msgId,
        tenantId: tenant.id,
      });

      console.log('[REPLY MODAL] Sent to', waNumber, ':', replyText);

      // Post confirmation in Slack
      const { WebClient } = require('@slack/web-api');
      const slack = new WebClient(tenant.slack_bot_token);
      await slack.chat.postMessage({
        channel: channelId,
        text: `✅ *Reply sent to ${waNumber}:*\n${replyText}`,
      });

    } else if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      if (action.action_id === 'reply_to_wa') {
        const waNumber = action.value;
        const channelId = payload.channel.id;
        const triggerId = payload.trigger_id;

        // Get tenant bot token
        const tenantResult = await pool.query(
          `SELECT t.* FROM tenants t
           JOIN contacts c ON c.tenant_id = t.id
           WHERE c.slack_channel = $1 AND t.is_active = TRUE LIMIT 1`,
          [channelId]
        );
        if (!tenantResult.rows.length) return;
        const tenant = tenantResult.rows[0];

        const { WebClient } = require('@slack/web-api');
        const slack = new WebClient(tenant.slack_bot_token);

        // Open reply modal
        await slack.views.open({
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: `reply_modal_${channelId}`,
            private_metadata: waNumber,
            title: { type: 'plain_text', text: 'Reply to WhatsApp' },
            submit: { type: 'plain_text', text: 'Send' },
            close: { type: 'plain_text', text: 'Cancel' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `Replying to *${waNumber}* on WhatsApp`,
                },
              },
              {
                type: 'input',
                block_id: 'reply_input',
                element: {
                  type: 'plain_text_input',
                  action_id: 'reply_text',
                  multiline: true,
                  placeholder: { type: 'plain_text', text: 'Type your reply...' },
                },
                label: { type: 'plain_text', text: 'Message' },
              },
            ],
          },
        });
      }
    }
  } catch (err) {
    console.error('[INTERACTIONS ERROR]', err.message);
  }
});
// ── Contact form ──────────────────────────────────────────
server.post('/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    if (!email || !email.includes('@')) return res.json({ success: false });
    console.log('[CONTACT]', { firstName, lastName, email, subject, message });
    try {
      const { sendEmail } = require('./services/emailService');
      await sendEmail({
        to: 'contact@syncora.one',
        subject: '[Syncora Contact] ' + (subject || 'New message'),
        html: '<div style="font-family:sans-serif;padding:20px"><h2>New contact message</h2><p><b>Name:</b> ' + firstName + ' ' + lastName + '</p><p><b>Email:</b> ' + email + '</p><p><b>Subject:</b> ' + (subject||'—') + '</p><p><b>Message:</b></p><p>' + (message||'—').replace(/
/g,'<br/>') + '</p></div>'
      });
    } catch(emailErr) { console.error('[CONTACT EMAIL]', emailErr.message); }
    res.json({ success: true });
  } catch(err){
    res.json({ success: false });
  }
});
// ── Start ─────────────────────────────────────────────────
const start = async () => {
  try {
    const redisClient = await connectRedis();

    // Upgrade session store to Redis for persistence
    if (redisClient) {
      sessionMiddleware = session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET || 'syncora-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        },
      });
      console.log('Session store: Redis ✅');
    } else {
      console.log('Session store: memory (Redis unavailable)');
    }

    server.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on port ${process.env.PORT || 3000} in HTTP mode`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
