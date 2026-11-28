-- 013_support_edits.sql
-- Support Transaction Editor: field-level trail of every manual correction made by the support team.
-- Run BEFORE deploying the code, then in Hasura: Data > track table support_edits (+ reload metadata).
-- The app writes through the admin secret; do NOT grant any Hasura role insert/update/delete on this table.

CREATE TABLE IF NOT EXISTS support_edits (
  _id              text PRIMARY KEY,
  edited_at        timestamptz NOT NULL DEFAULT now(),
  user_id          text NOT NULL,
  user_name        text,
  entity_type      text NOT NULL,            -- loans | cashCollections | badDebtCollections | mcbu_withdrawals | client
  entity_id        text NOT NULL,
  client_id        text,
  loan_id          text,
  branch_id        text,
  reason           text NOT NULL,
  ticket_ref       text,
  changes          jsonb NOT NULL,           -- [{ field, before, after }]
  before_data      jsonb NOT NULL,           -- full row (editable + context fields) before the edit
  after_data       jsonb NOT NULL,
  warnings         jsonb,                    -- soft validation warnings the editor acknowledged
  ip_address       text
);

CREATE INDEX IF NOT EXISTS idx_support_edits_entity ON support_edits (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_support_edits_client ON support_edits (client_id);
CREATE INDEX IF NOT EXISTS idx_support_edits_loan   ON support_edits (loan_id);
CREATE INDEX IF NOT EXISTS idx_support_edits_user   ON support_edits (user_id, edited_at DESC);

-- New "support" role. Access to the editor is by shortCode ('support'), and rep = 1 mirrors the administrator
-- role so the existing rep-based checks (73 places) treat support like admin.
-- To also get everything that is gated on the users.root flag (Nav shows ALL items, branch scoping is skipped,
-- root-only settings pages/APIs), flag each support user: UPDATE users SET root = true WHERE _id = '<support user id>';
-- (note: root users are hidden from Settings > Users, so they can only be managed in the database.)
INSERT INTO roles (_id, name, "order", "shortCode", system, rep, "dateAdded")
SELECT gen_random_uuid()::text, 'support', 7, 'support', false, 1, now()
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE "shortCode" = 'support');
