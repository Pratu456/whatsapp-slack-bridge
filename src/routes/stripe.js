// src/routes/stripe.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { pool } = require('../db');
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
            const amount = s.metadata.plan === 'pro' ? '€29.00' : '€79.00';
            await sendUpgradeEmail({ to: t.email, companyName: t.company_name, plan: s.metadata.plan, amount, nextBillingDate: nextBilling }).catch(e => console.warn('[STRIPE] Upgrade email failed:', e.message));
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
            const invAmount = s.metadata.plan === 'pro' ? '€29.00' : '€79.00';
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
