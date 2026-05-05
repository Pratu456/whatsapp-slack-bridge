const { pool } = require('../db');

const PLANS = {
  starter:  { messagesPerDay: 200, workspaces: 1   },
  pro:      { messagesPerDay: -1,  workspaces: 3   },
  business: { messagesPerDay: -1,  workspaces: 999 },
};

const TRIAL_DAILY_LIMIT = 50;
const TRIAL_DAYS = 14;

const checkMessageLimit = async (tenantId) => {
  const tenant = await pool.query(
    'SELECT plan, trial_ends_at, paid FROM tenants WHERE id = $1',
    [tenantId]
  );
  if (!tenant.rows.length) return { allowed: false };

  const { plan, trial_ends_at, paid } = tenant.rows[0];

  // Check trial expiry
  if (trial_ends_at && !paid) {
    const trialEnd = new Date(trial_ends_at);
    const now = new Date();
    if (now > trialEnd) {
      console.log('[TRIAL EXPIRED] tenant:', tenantId);
      return { allowed: false, reason: 'trial_expired', trialEndedAt: trialEnd };
    }

    // During trial — enforce 50 msg/day limit regardless of plan
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
      [tenantId]
    );
    const used = parseInt(result.rows[0].count);
    if (used >= TRIAL_DAILY_LIMIT) {
      return { allowed: false, reason: 'trial_limit_reached', used, limit: TRIAL_DAILY_LIMIT };
    }
    return { allowed: true, used, limit: TRIAL_DAILY_LIMIT, isTrial: true };
  }

  // Paid — check plan limit
  const limit = PLANS[plan] ? PLANS[plan].messagesPerDay : 200;
  if (limit === -1) return { allowed: true };

  const result = await pool.query(
    "SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
    [tenantId]
  );
  const used = parseInt(result.rows[0].count);
  if (used >= limit) return { allowed: false, reason: 'limit_reached', used, limit, plan };
  return { allowed: true, used, limit, plan };
};

// Check trial status for dashboard
const getTrialStatus = async (tenantId) => {
  const { rows } = await pool.query(
    'SELECT trial_ends_at, paid, plan FROM tenants WHERE id = $1',
    [tenantId]
  );
  if (!rows.length) return null;
  const { trial_ends_at, paid, plan } = rows[0];
  if (paid) return { status: 'paid', plan };
  if (!trial_ends_at) return { status: 'active', plan };

  const now = new Date();
  const trialEnd = new Date(trial_ends_at);
  const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

  if (now > trialEnd) return { status: 'expired', daysLeft: 0, trialEnd };
  return { status: 'trial', daysLeft, trialEnd, dailyLimit: TRIAL_DAILY_LIMIT };
};

module.exports = { checkMessageLimit, getTrialStatus, PLANS, TRIAL_DAILY_LIMIT };
