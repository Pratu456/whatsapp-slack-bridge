const { pool } = require('../db');

const GRACE_DAYS = 31;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

async function purgeOnce() {
  try {
    const due = await pool.query(
      "SELECT id, email, deletion_requested_at FROM users WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at < NOW() - INTERVAL '" + GRACE_DAYS + " days'"
    );

    if (!due.rows.length) {
      console.log('[PURGE] Nothing due');
      return;
    }

    for (const u of due.rows) {
      const email = (u.email || '').toLowerCase();
      const t = await pool.query(
        "DELETE FROM tenants WHERE LOWER(email) = $1 AND deletion_requested_at IS NOT NULL RETURNING id",
        [email]
      );
      await pool.query('DELETE FROM users WHERE id = $1 AND deletion_requested_at IS NOT NULL', [u.id]);
      console.warn('[PURGE] Permanently deleted user', u.id, '| tenants removed:', t.rowCount, '| requested', u.deletion_requested_at);
    }
  } catch (e) {
    console.error('[PURGE] Failed:', e.message);
  }
}

function start() {
  // first sweep shortly after boot, then daily
  setTimeout(purgeOnce, 60 * 1000);
  setInterval(purgeOnce, INTERVAL_MS);
  console.log('[PURGE] Scheduler started — grace period ' + GRACE_DAYS + ' days');
}

module.exports = { start, purgeOnce };
