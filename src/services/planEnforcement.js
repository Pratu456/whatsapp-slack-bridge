const { pool } = require('../db');

const PLANS = {
  starter:  { messagesPerDay: 50,  workspaces: 1, freeAgents: 0,  extraAgentPrice: 0, groupChat: false },
  pro:      { messagesPerDay: -1,  workspaces: 1, freeAgents: 5,  extraAgentPrice: 2, groupChat: false },
  business: { messagesPerDay: -1,  workspaces: 1, freeAgents: 10, extraAgentPrice: 1, groupChat: true  },
};

const TRIAL_DAILY_LIMIT = 50;
const TRIAL_DAYS = 14;

// Check if message is allowed based on plan limits
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
    // During trial — enforce 50 msg/day limit
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

  // Paid — check plan message limit
  const planConfig = PLANS[plan] || PLANS.starter;
  const limit = planConfig.messagesPerDay;
  if (limit === -1) return { allowed: true };

  const result = await pool.query(
    "SELECT COUNT(*) as count FROM messages WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'",
    [tenantId]
  );
  const used = parseInt(result.rows[0].count);
  if (used >= limit) return { allowed: false, reason: 'limit_reached', used, limit, plan };
  return { allowed: true, used, limit, plan };
};

// Check if group chat is allowed for this tenant's plan
const checkGroupChatAllowed = async (tenantId) => {
  const { rows } = await pool.query('SELECT plan, paid FROM tenants WHERE id = $1', [tenantId]);
  if (!rows.length) return false;
  const { plan, paid } = rows[0];
  if (!paid) return false; // No group chat on trial
  const planConfig = PLANS[plan] || PLANS.starter;
  return planConfig.groupChat;
};

// Check agent limit for a tenant
const checkAgentLimit = async (tenantId) => {
  const { rows } = await pool.query('SELECT plan, paid FROM tenants WHERE id = $1', [tenantId]);
  if (!rows.length) return { allowed: false };
  const { plan, paid } = rows[0];
  const planConfig = PLANS[plan] || PLANS.starter;

  const agentCount = await pool.query(
    'SELECT COUNT(*) as count FROM tenant_agents WHERE tenant_id = $1',
    [tenantId]
  );
  const used = parseInt(agentCount.rows[0].count);
  const freeLimit = planConfig.freeAgents;

  return {
    allowed: true,
    used,
    freeLimit,
    extraAgentPrice: planConfig.extraAgentPrice,
    isOverFreeLimit: used > freeLimit,
    plan,
  };
};

// Get trial status for dashboard
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

module.exports = { checkMessageLimit, checkGroupChatAllowed, checkAgentLimit, getTrialStatus, PLANS, TRIAL_DAILY_LIMIT };
