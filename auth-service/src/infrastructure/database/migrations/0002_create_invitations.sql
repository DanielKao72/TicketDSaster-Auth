-- PA-01, PA-03: single-use invitation codes. The 5-minute validity window is
-- kept in Redis, not here.
CREATE TABLE invitations (
  code       TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('VENUE_OWNER', 'ORGANIZER')),
  used       BOOLEAN NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
