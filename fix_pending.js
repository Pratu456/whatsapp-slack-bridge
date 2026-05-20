const fs = require('fs');
let c = fs.readFileSync('src/routes/admin.js', 'utf8');

const oldQuery = "inactiveTenants = await pool.query(`\r\n      SELECT t.id, t.company_name, t.slack_team_name, MAX(m.created_at) as last_msg\r\n      FROM tenants t LEFT JOIN messages m ON m.tenant_id = t.id\r\n      WHERE t.is_active = TRUE\r\n      GROUP BY t.id, t.company_name, t.slack_team_name\r\n      HAVING MAX(m.created_at) < NOW() - INTERVAL '14 days' OR MAX(m.created_at) IS NULL\r\n    `).catch(() => ({ rows: [] }));";

const newQuery = "inactiveTenants = await pool.query(`\r\n      SELECT id, company_name, email FROM tenants WHERE is_active = FALSE\r\n    `).catch(() => ({ rows: [] }));";

if (c.includes(oldQuery)) {
  c = c.replace(oldQuery, newQuery);
  fs.writeFileSync('src/routes/admin.js', c);
  console.log('Done');
} else {
  console.log('ERROR: still not found');
}
