const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://syncora_db_user:8MyfwBst7ZtUnvM4yUcMynpnIgFZtX59@dpg-d79oc4vkijhs7391ffog-a.oregon-postgres.render.com/syncora_db',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  const client = await pool.connect();
  const { rows } = await client.query('SELECT * FROM wa_group_members WHERE group_id = 1');
  console.log('Group members:');
  rows.forEach(r => console.log(' -', r.wa_number, '|', r.display_name));
  client.release();
  await pool.end();
}
run().catch(console.error);
