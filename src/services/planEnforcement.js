const { pool } = require('../db');

const PLANS = {
  starter:  { messagesPerDay: 200, workspaces: 1   },
  pro:      { messagesPerDay: -1,  workspaces: 3   },
  business: { messagesPerDay: -1,  workspaces: 999 },
};

const checkMessageLimit = async (tenantId) => {
  const tenant = await pool.query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);
  const plan = tenant.rows[0] ? tenant.rows[0].plan : 'starter';
  const limit = PLANS[plan] ? PLANS[plan].messagesPerDay : 200;
  if (limit === -1) return { allowed: true };
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
    [tenantId]
  );
  const used = parseInt(result.rows[0].count);
  if (used >= limit) return { allowed: false, used: used, limit: limit, plan: plan };
  return { allowed: true, used: used, limit: limit, plan: plan };
};

module.exports = { checkMessageLimit, PLANS };
