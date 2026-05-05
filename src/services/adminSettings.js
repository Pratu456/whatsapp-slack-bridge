
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
async function migrateAdminSettings() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Load saved password if exists
    const { rows } = await pool.query("SELECT value FROM admin_settings WHERE key = 'admin_password'");
    if (rows.length && rows[0].value) {
      process.env.ADMIN_PASSWORD = rows[0].value;
      console.log('[ADMIN] Password loaded from DB');
    } else if (process.env.ADMIN_PASSWORD) {
      // Save current env password to DB
      await pool.query(
        "INSERT INTO admin_settings (key, value) VALUES ('admin_password', $1) ON CONFLICT (key) DO NOTHING",
        [process.env.ADMIN_PASSWORD]
      );
      console.log('[ADMIN] Password saved to DB from env');
    }
  } catch(e) {
    console.error('[ADMIN] Settings migration error:', e.message);
  }
}
module.exports = { migrateAdminSettings };
