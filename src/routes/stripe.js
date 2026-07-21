// src/routes/stripe.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { pool } = require('../db');
const PDFDocument = require('pdfkit');
const { sendUpgradeEmail, sendCancellationEmail } = require('../services/emailService');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro:      { name: 'pro',      priceId: process.env.STRIPE_PRO_PRICE_ID },
  business: { name: 'business', priceId: process.env.STRIPE_BUSINESS_PRICE_ID },
};

const auth = (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};


// ── GET checkout redirect (from Slack OAuth flow) ────────
router.get('/create-checkout', auth, async (req, res) => {
  try {
    const plan = req.query.plan;
    if (!PLANS[plan]) return res.redirect('/dashboard');
    const r1 = await pool.query(
      'SELECT t.* FROM tenants t JOIN users u ON u.email = t.email WHERE u.id = $1 LIMIT 1',
      [req.session.userId]
    );
    const tenant = r1.rows[0];
    if (!tenant) return res.redirect('/dashboard');
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name:  tenant.company_name,
        metadata: { tenant_id: String(tenant.id) },
      });
      customerId = customer.id;
      await pool.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customerId, tenant.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      mode:                 'subscription',
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      success_url: process.env.APP_URL + '/dashboard?payment=success',
      cancel_url:  process.env.APP_URL + '/dashboard?payment=cancelled',
      metadata: { tenant_id: String(tenant.id), plan },
    });
    res.redirect(session.url);
  } catch (err) {
    console.error('[STRIPE] GET Checkout error:', err.message);
    res.redirect('/dashboard');
  }
});

router.post('/create-checkout', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const r1 = await pool.query(
      'SELECT t.* FROM tenants t JOIN users u ON u.email = t.email WHERE u.id = $1 LIMIT 1',
      [req.session.userId]
    );
    const tenant = r1.rows[0];
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name:  tenant.company_name,
        metadata: { tenant_id: String(tenant.id) },
      });
      customerId = customer.id;
      await pool.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customerId, tenant.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      mode:                 'subscription',
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      success_url: process.env.APP_URL + '/dashboard?payment=success',
      cancel_url:  process.env.APP_URL + '/dashboard?payment=cancelled',
      metadata: { tenant_id: String(tenant.id), plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[STRIPE] Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/portal', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT t.* FROM tenants t JOIN users u ON u.email = t.email WHERE u.id = $1 LIMIT 1',
      [req.session.userId]
    );
    const tenant = result.rows[0];
    if (!tenant || !tenant.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   tenant.stripe_customer_id,
      return_url: process.env.APP_URL + '/dashboard',
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[STRIPE] Portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[STRIPE] Webhook signature failed:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  console.log('[STRIPE] Event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.metadata && s.metadata.tenant_id && s.metadata.plan) {
          await pool.query(
            'UPDATE tenants SET plan = $1, paid = TRUE, stripe_subscription_id = $2 WHERE id = $3',
            [s.metadata.plan, s.subscription, s.metadata.tenant_id]
          );
          console.log('[STRIPE] Tenant', s.metadata.tenant_id, 'upgraded to', s.metadata.plan);
          // Send upgrade email
          const tenantResult = await pool.query('SELECT * FROM tenants WHERE id = $1', [s.metadata.tenant_id]);
          const t = tenantResult.rows[0];
          if (t && t.email) {
            const sub = await stripe.subscriptions.retrieve(s.subscription);
            const nextBilling = new Date(sub.current_period_end * 1000).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
            const amount = s.metadata.plan === 'pro' ? '€19.99' : '€29.99';
            // Generate PDF invoice buffer
            let pdfBuf = null;
            let savedInvNum = null;
            try {
              // Get the invoice we just saved
              const invRes = await pool.query('SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', [t.id]);
              const inv = invRes.rows[0];
              if (inv) {
                savedInvNum = inv.invoice_number;
                pdfBuf = await new Promise((resolve, reject) => {
                  const doc = new PDFDocument({ margin: 50, size: 'A4' });
                  const chunks = [];
                  doc.on('data', c => chunks.push(c));
                  doc.on('end', () => resolve(Buffer.concat(chunks)));
                  doc.on('error', reject);
                  // Header
                  doc.rect(0, 0, doc.page.width, 90).fill('#111827');
                  doc.fontSize(28).fillColor('#25D366').font('Helvetica-Bold').text('Syncora', 50, 28);
                  doc.fontSize(10).fillColor('#9ca3af').font('Helvetica').text('WhatsApp ↔ Slack Bridge', 50, 60);
                  doc.fontSize(18).fillColor('#ffffff').font('Helvetica-Bold').text('INVOICE', 0, 34, { align: 'right', width: doc.page.width - 50 });
                  doc.fontSize(10).fillColor('#9ca3af').font('Helvetica').text('#' + inv.invoice_number, 0, 58, { align: 'right', width: doc.page.width - 50 });
                  let y = 115;
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('INVOICE DATE', 50, y);
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('STATUS', 350, y);
                  y += 14;
                  const invDate = new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                  doc.font('Helvetica').fontSize(11).fillColor('#111827').text(invDate, 50, y);
                  doc.font('Helvetica-Bold').fontSize(11).fillColor('#25D366').text('PAID', 350, y);
                  y += 40;
                  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb'); y += 20;
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('BILLED TO', 50, y); y += 14;
                  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(inv.company_name, 50, y); y += 18;
                  doc.font('Helvetica').fontSize(11).fillColor('#4b5563').text(inv.company_email, 50, y); y += 40;
                  doc.rect(50, y, doc.page.width - 100, 28).fill('#f9fafb');
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('DESCRIPTION', 60, y + 9);
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('PERIOD', 280, y + 9);
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('AMOUNT', 0, y + 9, { align: 'right', width: doc.page.width - 60 });
                  y += 28;
                  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb'); y += 14;
                  const planLabel2 = inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1);
                  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Syncora ' + planLabel2 + ' Plan', 60, y);
                  doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Monthly subscription', 60, y + 16);
                  doc.font('Helvetica').fontSize(11).fillColor('#4b5563').text(inv.billing_period || '', 280, y + 4);
                  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(inv.amount, 0, y + 4, { align: 'right', width: doc.page.width - 60 });
                  y += 55;
                  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb'); y += 16;
                  doc.rect(doc.page.width - 210, y, 160, 42).fill('#f0fdf4');
                  doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280').text('TOTAL PAID', doc.page.width - 200, y + 7);
                  doc.font('Helvetica-Bold').fontSize(16).fillColor('#16a34a').text(inv.amount, doc.page.width - 200, y + 20);
                  y += 70;
                  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke('#e5e7eb'); y += 16;
                  doc.font('Helvetica').fontSize(9).fillColor('#9ca3af').text('Thank you for your business! Questions? Contact us at support@syncora.one', 50, y, { align: 'center', width: doc.page.width - 100 });
                  doc.end();
                });
              }
            } catch(pdfErr) { console.warn('[STRIPE] PDF generation failed:', pdfErr.message); }
            await sendUpgradeEmail({ to: t.email, companyName: t.company_name, plan: s.metadata.plan, amount, nextBillingDate: nextBilling, pdfBuffer: pdfBuf, invoiceNumber: savedInvNum }).catch(e => console.warn('[STRIPE] Upgrade email failed:', e.message));
          }
        }
          // Store invoice in DB
          try {
            await pool.query(`CREATE TABLE IF NOT EXISTS invoices (
              id SERIAL PRIMARY KEY,
              tenant_id INTEGER NOT NULL,
              invoice_number VARCHAR(50) NOT NULL,
              stripe_invoice_id VARCHAR(100),
              plan VARCHAR(50),
              amount VARCHAR(20),
              company_name VARCHAR(255),
              company_email VARCHAR(255),
              billing_period VARCHAR(100),
              created_at TIMESTAMPTZ DEFAULT NOW()
            )`);
            const invNum = 'SYN-' + Date.now();
            const subData = await stripe.subscriptions.retrieve(s.subscription);
            const pStart = new Date(subData.current_period_start * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const pEnd   = new Date(subData.current_period_end   * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const invAmount = s.metadata.plan === 'pro' ? '€19.99' : '€29.99';
            const tRes2 = await pool.query('SELECT * FROM tenants WHERE id = $1', [s.metadata.tenant_id]);
            const tRow2 = tRes2.rows[0];
            if (tRow2) {
              await pool.query(
                'INSERT INTO invoices (tenant_id, invoice_number, stripe_invoice_id, plan, amount, company_name, company_email, billing_period) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
                [tRow2.id, invNum, s.payment_intent || s.subscription, s.metadata.plan, invAmount, tRow2.company_name, tRow2.email, pStart + ' – ' + pEnd]
              );
              console.log('[STRIPE] Invoice saved:', invNum);
            }
          } catch(invErr) { console.warn('[STRIPE] Invoice save failed:', invErr.message); }

        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const tenantId = customer.metadata && customer.metadata.tenant_id;
        if (tenantId) {
          const priceId = sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
          let plan = 'starter';
          if (priceId === process.env.STRIPE_PRO_PRICE_ID)      plan = 'pro';
          if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) plan = 'business';
          const active = sub.status === 'active';
          await pool.query(
            'UPDATE tenants SET plan = $1, paid = $2 WHERE id = $3',
            [active ? plan : 'starter', active, tenantId]
          );
          console.log('[STRIPE] Tenant', tenantId, 'plan ->', plan, sub.status);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        const tenantId = customer.metadata && customer.metadata.tenant_id;
        if (tenantId) {
          await pool.query(
            'UPDATE tenants SET plan = $1, paid = FALSE WHERE id = $2',
            ['starter', tenantId]
          );
          console.log('[STRIPE] Tenant', tenantId, 'downgraded to starter');
          const tResult = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
          const t2 = tResult.rows[0];
          if (t2 && t2.email) {
            const planEnd = new Date(sub.current_period_end * 1000).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
            await sendCancellationEmail({ to: t2.email, companyName: t2.company_name, planEnd }).catch(e => console.warn('[STRIPE] Cancellation email failed:', e.message));
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('[STRIPE] Webhook handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
