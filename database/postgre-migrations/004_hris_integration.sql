-- =============================================================================
-- 004_hris_integration.sql
-- HRIS seat-based account sync. Idempotent: safe to run more than once.
--
-- Concepts
--   * A row in `users` is a SEAT (branch + role). The HRIS person sitting in it
--     is identified by users.employee_no. NULL employee_no + isVacant=false is a
--     legacy account nobody has linked yet. isVacant=true is an open seat.
--   * hris_user_sync     = mirror of HRIS staff data (written by HRIS only)
--   * hris_seat_history  = who held which seat, and when
--
-- Run:  psql "$DATABASE_URL" -f database/postgre-migrations/004_hris_integration.sql
-- Then: Hasura console -> Data -> Reload metadata, and TRACK the two new tables.
-- =============================================================================

BEGIN;

-- 1. users: link to HRIS staff + vacancy marker --------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_no varchar(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isVacant"  boolean NOT NULL DEFAULT false;

-- one person -> at most one seat. Many NULLs are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_no
  ON users (employee_no) WHERE employee_no IS NOT NULL;

-- fast "open seats" lookup for the HRIS dropdown
CREATE INDEX IF NOT EXISTS "ix_users__isVacant"
  ON users ("isVacant") WHERE "isVacant" = true;

-- a vacant seat can never carry a person's employee_no
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_vacant_has_no_employee') THEN
    ALTER TABLE users
      ADD CONSTRAINT ck_users_vacant_has_no_employee
      CHECK (NOT ("isVacant" AND employee_no IS NOT NULL));
  END IF;
END $$;

-- 2. hris_user_sync: mirror of HRIS staff ---------------------------------------
CREATE TABLE IF NOT EXISTS hris_user_sync (
  _id                  varchar PRIMARY KEY,
  hris_id              text        NOT NULL,          -- HRIS staff.id (stable key)
  employee_no          varchar(50),                   -- HRIS staff.employee_no
  company_id           text,                          -- null until HRIS provides it
  first_name           text,
  last_name            text,
  middle_name          text,
  full_name            text,
  email                text,
  contact              text,
  status               text,                          -- 'Active' | 'Inactive'
  position             text,
  department           text,
  area                 text,
  region               text,
  division             text,
  hris_branch_id       integer,
  hris_branch_code     text,
  hris_branch_name     text,
  start_date           date,
  regularization_date  date,
  address              text,
  municipality         text,
  province             text,
  on_leave             boolean     NOT NULL DEFAULT false,
  access_blocked       boolean     NOT NULL DEFAULT false, -- true = HRIS blocked the seat (leave)
  payload_hash         text,                          -- skip rewrite when unchanged
  raw_payload          jsonb,
  last_synced_at       timestamptz NOT NULL DEFAULT now(),
  inserted_date        timestamptz NOT NULL DEFAULT now(),
  modified_date        timestamptz,
  CONSTRAINT hris_user_sync_hris_id_key UNIQUE (hris_id)
);
CREATE INDEX IF NOT EXISTS ix_hris_user_sync__employee_no ON hris_user_sync (employee_no);
CREATE INDEX IF NOT EXISTS ix_hris_user_sync__status      ON hris_user_sync (status);

-- 3. hris_seat_history: who held which seat -------------------------------------
CREATE TABLE IF NOT EXISTS hris_seat_history (
  _id              varchar PRIMARY KEY,
  seat_id          varchar     NOT NULL,              -- users._id
  hris_id          text,
  employee_no      varchar(50),
  staff_name       text,
  role_short_code  text,
  branch_code      text,                              -- users.designatedBranch at the time
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  assigned_by      text,
  vacated_at       timestamptz,
  vacated_reason   text,                              -- inactive | position_changed | branch_changed | ...
  vacated_by       text
);
-- at most one OPEN row per seat
CREATE UNIQUE INDEX IF NOT EXISTS uq_hris_seat_history_open
  ON hris_seat_history (seat_id) WHERE vacated_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_hris_seat_history__seat     ON hris_seat_history (seat_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS ix_hris_seat_history__employee ON hris_seat_history (employee_no);

COMMIT;

-- -----------------------------------------------------------------------------
-- ROLLBACK (manual, only if you must undo this migration):
--   DROP TABLE IF EXISTS hris_seat_history;
--   DROP TABLE IF EXISTS hris_user_sync;
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_vacant_has_no_employee;
--   DROP INDEX IF EXISTS uq_users_employee_no;
--   DROP INDEX IF EXISTS "ix_users__isVacant";
--   ALTER TABLE users DROP COLUMN IF EXISTS "isVacant";
--   ALTER TABLE users DROP COLUMN IF EXISTS employee_no;
-- -----------------------------------------------------------------------------
