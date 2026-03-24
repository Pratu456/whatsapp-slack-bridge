-- src/db/schema.sql
CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  wa_number     VARCHAR(20)  NOT NULL UNIQUE,
  slack_channel VARCHAR(30)  NOT NULL,
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  contact_id  INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  direction   VARCHAR(10) CHECK (direction IN ('inbound','outbound')),
  status      VARCHAR(20) DEFAULT 'sent',
  twilio_sid  VARCHAR(50),
  slack_ts    VARCHAR(30),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_wa   ON contacts (wa_number);
CREATE INDEX IF NOT EXISTS idx_messages_cid  ON messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages (created_at DESC);