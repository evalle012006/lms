-- 014_users_role_columns.sql
-- Step 3 of the role clean-up: ADDITIVE. users.role (jsonb copy of a roles row) stays exactly as it is, so every existing
-- `role: { _contains: ... }` Hasura query, every `u.role->>'shortCode'` / `u.role->>'rep'` in native queries and DB functions,
-- and every writer keeps working. These STORED generated columns are derived from it by Postgres, so they can never drift.
--
-- Checked first (2026-11-25, prod): all 2,976 users have jsonb_typeof(role) = 'object' and rep in (1,2,3,4) -> the integer cast is safe.
-- Re-check before running anywhere else:  select count(*) from users where jsonb_typeof(role) is distinct from 'object' or role->>'rep' !~ '^\d+$';
-- Note: a future role whose rep is not a whole number would make the INSERT/UPDATE of that user fail (the roles UI only offers integers).
--
-- Deploy order: run this BEFORE any code that selects the new columns; then Hasura: Data > users > "Reload"
-- (new columns are read-only; Hasura leaves generated columns out of insert/update inputs). Give your Hasura roles select on them where they have it on users.
-- Nothing in the app reads these columns yet (step 4 moves queries over one at a time).
--
-- Rollback:  ALTER TABLE users DROP COLUMN "roleShortCode", DROP COLUMN "roleRep", DROP COLUMN "roleId";

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "roleShortCode" text    GENERATED ALWAYS AS (role->>'shortCode')         STORED,
  ADD COLUMN IF NOT EXISTS "roleRep"       integer GENERATED ALWAYS AS ((role->>'rep')::integer)    STORED,
  ADD COLUMN IF NOT EXISTS "roleId"        text    GENERATED ALWAYS AS (role->>'_id')               STORED;

CREATE INDEX IF NOT EXISTS "ix_users__roleShortCode" ON users ("roleShortCode");
CREATE INDEX IF NOT EXISTS "ix_users__roleRep"       ON users ("roleRep");
-- ix_users__role (btree on jsonb) is useless for containment (@>); drop it later, once nothing depends on it.
