const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://syncora_db_user:8MyfwBst7ZtUnvM4yUcMynpnIgFZtX59@dpg-d79oc4vkijhs7391ffog-a.oregon-postgres.render.com/syncora_db',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const [tenantId, token] = process.argv.slice(2);
  const client = await pool.connect();
  await client.query('UPDATE tenants SET slack_bot_token = $1 WHERE id = $2', [token, tenantId]);
  console.log('✅ Updated tenant ' + tenantId);
  client.release();
  await pool.end();
}
run().catch(console.error);
