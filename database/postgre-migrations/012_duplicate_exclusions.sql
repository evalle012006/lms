-- 012_duplicate_exclusions.sql
-- "Not the same person": a reviewer's pair-level decision that two client records are DIFFERENT people.
-- The duplicate scan treats an excluded pair as a hard conflict, so the two records never share a group again
-- (a group-level "Not a duplicate" cannot express "these 4 are one person, that 5th is someone else").
-- Run BEFORE deploying the code, then in Hasura: Data > track table duplicate_client_exclusions.

CREATE TABLE IF NOT EXISTS duplicate_client_exclusions (
  _id              text PRIMARY KEY,                 -- 'clientA|clientB' with clientA < clientB
  client_a         text NOT NULL,
  client_b         text NOT NULL,
  note             text,
  created_by       text,
  created_by_name  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (client_a < client_b)
);

CREATE INDEX IF NOT EXISTS idx_dce_client_a ON duplicate_client_exclusions (client_a);
CREATE INDEX IF NOT EXISTS idx_dce_client_b ON duplicate_client_exclusions (client_b);
