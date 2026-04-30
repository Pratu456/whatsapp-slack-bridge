const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://syncora_db_user:8MyfwBst7ZtUnvM4yUcMynpnIgFZtX59@dpg-d79oc4vkijhs7391ffog-a.oregon-postgres.render.com/syncora_db',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const NEW_TOKEN = process.argv[2];
  const client = await pool.connect();
  const result = await client.query('UPDATE tenants SET slack_bot_token = $1', [NEW_TOKEN]);
  console.log('✅ Updated ' + result.rowCount + ' tenant(s) with token: ' + NEW_TOKEN.slice(0,25) + '...');
  client.release();
  await pool.end();
}
run().catch(console.error);
