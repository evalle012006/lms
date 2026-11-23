-- 013_stale_application_cleanup.sql
-- Stale prospect application cleanup (cron: /api/v2/cronjobs/clean-up-stale-applications).
--   Pending prospect  > 7 days  -> wiped (row, CI investigation, uploaded files)
--   CI approved prospect > 14 days (since approval) -> status 'ci_declined' + excluded
--   Excluded > 1 month -> wiped the same way
-- "excluded" (applications) = excludedAt is set.
-- The client stage (src/lib/stale-clients-job.js) needs NO new columns: it uses client.archived /
-- archivedBy / archivedDate, the same fields as the manual "Exclude Client" action. Run BEFORE deploying the code, then in Hasura:
-- Data > temporaryLoanApplications > reload metadata so the new columns are exposed.

ALTER TABLE "temporaryLoanApplications"
  ADD COLUMN IF NOT EXISTS "excludedAt"     timestamptz,
  ADD COLUMN IF NOT EXISTS "excludedReason" text;

-- the job's three scans
CREATE INDEX IF NOT EXISTS idx_tla_excluded_at
  ON "temporaryLoanApplications" ("excludedAt") WHERE "excludedAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tla_stale_scan
  ON "temporaryLoanApplications" ("status", "clientType", "submittedAt");
