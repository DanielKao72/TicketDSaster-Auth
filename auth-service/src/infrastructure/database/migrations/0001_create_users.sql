-- PA-02, PA-05, PA-06: one row per partner. password_hash is filled right after
-- the insert, inside the same transaction (see RegisterPartner), so a committed
-- user always has one.
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL CHECK (role IN ('VENUE_OWNER', 'ORGANIZER')),
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
