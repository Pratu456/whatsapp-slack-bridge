// src/services/messageLogger.js
const { pool } = require('../db');

const logMessage = async ({ waNumber, body, direction, twilioSid, slackTs, mediaUrl, mediaType }) => {
  const contact = await pool.query(
    'SELECT id FROM contacts WHERE wa_number = $1',
    [waNumber]
  );

  if (!contact.rows.length) return;

  const result = await pool.query(
    `INSERT INTO messages
      (contact_id, body, direction, twilio_sid, slack_ts, media_url, media_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [contact.rows[0].id, body, direction, twilioSid, slackTs, mediaUrl || null, mediaType || null]
  );

  return result.rows[0].id;
};

module.exports = { logMessage };