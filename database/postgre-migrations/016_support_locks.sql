-- 016_support_locks.sql
-- Support Transaction Editor: a short-lived lock on a GROUP while support repairs its clients/loans/collections,
-- so BMs / LOs cannot save over the same records at the same time. Locks expire on their own (expires_at).
-- Run BEFORE the code deploy, then in Hasura: track table support_locks (+ reload metadata).
-- The app uses the admin secret; do NOT grant any Hasura role access to this table.
-- The save APIs fail OPEN if this table is missing or unreachable, so a missed migration never blocks collections.

CREATE TABLE IF NOT EXISTS support_locks (
  group_id    text PRIMARY KEY,
  locked_by   text NOT NULL,
  user_name   text,
  reason      text,
  locked_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_locks_expires ON support_locks (expires_at);
