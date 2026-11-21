-- 006_duplicate_review.sql
-- Phase 3: reviewer decisions on stored duplicate groups.
-- Run BEFORE deploying the code (after 005), then reload Hasura metadata.
-- Review columns are deliberately NOT part of the scan's upsert, so a re-scan never wipes a decision.

ALTER TABLE duplicate_client_clusters
  ADD COLUMN IF NOT EXISTS review_status        text CHECK (review_status IN ('confirmed','not_duplicate')),
  ADD COLUMN IF NOT EXISTS review_note          text,
  ADD COLUMN IF NOT EXISTS reviewed_by          text,
  ADD COLUMN IF NOT EXISTS reviewed_by_name     text,
  ADD COLUMN IF NOT EXISTS reviewed_at          timestamptz,
  -- member ids at review time: if a NEW record later joins a 'not_duplicate' group, the scan clears the review
  ADD COLUMN IF NOT EXISTS reviewed_member_ids  jsonb;

CREATE INDEX IF NOT EXISTS idx_dcc_review ON duplicate_client_clusters (view, status, review_status);
