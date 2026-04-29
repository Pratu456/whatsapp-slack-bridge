require('dotenv').config();
const { pool } = require('./src/db');
const { WebClient } = require('@slack/web-api');
pool.query('SELECT id, company_name, slack_bot_token FROM tenants WHERE is_active = TRUE')
.then(async r => {
  for (const t of r.rows) {
    console.log('Tenant:', t.id, t.company_name);
    const slack = new WebClient(t.slack_bot_token);
    const members = await slack.users.list();
    const humans = members.members.filter(m => m.is_bot === false && m.deleted === false && m.id !== 'USLACKBOT');
    humans.forEach(m => console.log(' ', m.id, '-', m.real_name));
  }
  process.exit(0);
});
