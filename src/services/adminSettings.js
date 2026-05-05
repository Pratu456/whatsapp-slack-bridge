const { pool } = require('../db');

async function migrateAdminSettings() {
  try {
    // Load saved password if exists
    const { rows } = await pool.query(
      'SELECT admin_password FROM admin_settings LIMIT 1'
    );
    if (rows.length && rows[0].admin_password) {
      process.env.ADMIN_PASSWORD = rows[0].admin_password;
      console.log('[ADMIN] Password loaded from DB');
    } else if (process.env.ADMIN_PASSWORD) {
      // Save current env password to DB
      const existing = await pool.query('SELECT id FROM admin_settings LIMIT 1');
      if (existing.rows.length) {
        await pool.query(
          'UPDATE admin_settings SET admin_password=$1 WHERE id=$2',
          [process.env.ADMIN_PASSWORD, existing.rows[0].id]
        );
      }
      console.log('[ADMIN] Password saved to DB from env');
    }
  } catch(e) {
    console.error('[ADMIN] Settings migration error:', e.message);
  }
}

module.exports = { migrateAdminSettings };
