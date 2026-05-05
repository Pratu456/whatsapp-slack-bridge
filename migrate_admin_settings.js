const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://syncora_db_user:8MyfwBst7ZtUnvM4yUcMynpnIgFZtX59@dpg-d79oc4vkijhs7391ffog-a.oregon-postgres.render.com/syncora_db',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const client = await pool.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ admin_settings table created');

  // Save current password
  const currentPassword = 'syncora123'; // change this to your actual current password
  await client.query(
    "INSERT INTO admin_settings (key, value) VALUES ('admin_password', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [currentPassword]
  );
  console.log('✅ Password saved to DB');

  client.release();
  await pool.end();
}
run().catch(console.error);
