// src/routes/stripe.js
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { pool } = require('../db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro:      { name: 'pro',      priceId: process.env.STRIPE_PRO_PRICE_ID },
  business: { name: 'business', priceId: process.env.STRIPE_BUSINESS_PRICE_ID },
};

const auth = (req, res, next) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

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
        }
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
