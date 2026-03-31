-- src/db/schema.sql

CREATE TABLE IF NOT EXISTS tenants (
  id                SERIAL PRIMARY KEY,
  company_name      VARCHAR(100) NOT NULL,
  email             VARCHAR(100),
  twilio_number     VARCHAR(20),                
  slack_bot_token   TEXT,
  slack_team_id     VARCHAR(50),
  slack_team_name   VARCHAR(100),
  is_active         BOOLEAN      DEFAULT FALSE,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id            SERIAL PRIMARY KEY,
  wa_number     VARCHAR(20)  NOT NULL,
  slack_channel VARCHAR(30)  NOT NULL,
  display_name  VARCHAR(100),
  tenant_id     INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  blocked       BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (wa_number, tenant_id)                 
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  contact_id  INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id   INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  body        TEXT,
  direction   VARCHAR(10)  CHECK (direction IN ('inbound','outbound')),
  status      VARCHAR(20)  DEFAULT 'sent',
  twilio_sid  VARCHAR(50),
  slack_ts    VARCHAR(30),
  media_url   TEXT,
  media_type  VARCHAR(50),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_files (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  file_url    TEXT,
  file_type   VARCHAR(50),
  file_name   VARCHAR(100),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_wa       ON contacts (wa_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant   ON contacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_cid      ON messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant   ON messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_date     ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_active    ON tenants (is_active);