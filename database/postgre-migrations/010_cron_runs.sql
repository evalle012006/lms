-- 010_cron_runs.sql
-- Run log + lock for the Hasura cron jobs (clean-up-logs, clean-up-loan-history,
-- update-advance-days-loan, update-group-clients). One row per run.
-- The partial unique index guarantees only ONE 'running' row per job across all app containers.
-- Run BEFORE deploying the code, then in Hasura: Data > track table cron_runs.

CREATE TABLE IF NOT EXISTS cron_runs (
  _id          text PRIMARY KEY,
  job_name     text NOT NULL,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped')),
  trigger      text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  stats        jsonb,
  error        text
);

CREATE UNIQUE INDEX IF NOT EXISTS cron_runs_one_running ON cron_runs (job_name) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS cron_runs_job_started ON cron_runs (job_name, started_at DESC);
