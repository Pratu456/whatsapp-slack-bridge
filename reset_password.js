const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({
  connectionString: 'postgresql://syncora_db_new_user:E8mC403xZb52rAQdgfedBKZfVBREJCFK@dpg-d7tjbqjrjlhs73avl850-a.oregon-postgres.render.com/syncora_db_new',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const client = await pool.connect();
  const hash = await bcrypt.hash('syncora123', 12);
  await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'deshmukhpratiksha456@gmail.com']);
  console.log('✅ Password reset to: syncora123');
  client.release();
  await pool.end();
}
run().catch(console.error);
