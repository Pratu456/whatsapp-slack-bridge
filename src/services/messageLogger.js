// src/services/messageLogger.js
const { pool } = require('../db');

const logMessage = async ({ waNumber, body, direction, twilioSid, slackTs }) => {
  const contact = await pool.query(
    'SELECT id FROM contacts WHERE wa_number = $1',
    [waNumber]
  );

  if (!contact.rows.length) return;

  await pool.query(
    `INSERT INTO messages
      (contact_id, body, direction, twilio_sid, slack_ts)
     VALUES ($1, $2, $3, $4, $5)`,
    [contact.rows[0].id, body, direction, twilioSid, slackTs]
  );
};

module.exports = { logMessage };