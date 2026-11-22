-- 013_spaces_cleanup.sql
-- Orphan-file cleanup for DigitalOcean Spaces (admin page /settings/spaces-cleanup).
--   spaces_cleanup_runs        one row per manual scan (status + live progress in stats)
--   spaces_cleanup_candidates  one row per unreferenced object found; also the ledger for
--                              quarantine / restore / purge, so we never have to re-list to-delete/.
-- Run BEFORE deploying the code, then in Hasura: Data > track both tables.
-- Hasura admin secret is used by the app, so no role permissions are needed.

CREATE TABLE IF NOT EXISTS spaces_cleanup_runs (
  _id          text PRIMARY KEY,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  trigger      text,
  triggered_by text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  stats        jsonb,
  error        text
);
CREATE INDEX IF NOT EXISTS idx_spaces_cleanup_runs_started ON spaces_cleanup_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS spaces_cleanup_candidates (
  _id            text PRIMARY KEY,
  run_id         text NOT NULL,
  object_key     text NOT NULL,
  prefix         text NOT NULL,                -- grouping label, e.g. 'lms/laf-photos' or 'temp'
  size_bytes     bigint NOT NULL DEFAULT 0,
  last_modified  timestamptz,
  status         text NOT NULL DEFAULT 'orphan'
                 CHECK (status IN ('orphan','quarantined','restored','purged','excluded')),
  quarantine_key text,
  note           text,
  acted_by       text,
  acted_at       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spaces_cleanup_candidates_object_key_key UNIQUE (object_key)
);
CREATE INDEX IF NOT EXISTS idx_scc_status_prefix ON spaces_cleanup_candidates (status, prefix);
CREATE INDEX IF NOT EXISTS idx_scc_status_acted  ON spaces_cleanup_candidates (status, acted_at);
