-- 005_duplicate_clients.sql
-- Stored results of the duplicate-client scan so the admin page reads paginated
-- rows instead of scanning every client on page load.
-- Run BEFORE deploying the code, then in Hasura: track both tables and reload metadata.

-- One row per duplicate group. _id = 'dc_' + oldest member _id, which stays stable
-- across nightly runs while the group's membership grows.
CREATE TABLE IF NOT EXISTS duplicate_client_clusters (
  _id                   text PRIMARY KEY,
  view                  text NOT NULL CHECK (view IN ('active','closed','same_client')),
  confidence            text NOT NULL CHECK (confidence IN ('exact','high','possible')),
  confidence_rank       integer NOT NULL,
  severity              text NOT NULL,
  scenarios             jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons               jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_count          integer NOT NULL DEFAULT 0,
  member_count          integer NOT NULL DEFAULT 0,
  exact_closed_vs_active boolean NOT NULL DEFAULT false,
  -- denormalised for filtering without relationships / joins
  branch_ids            jsonb NOT NULL DEFAULT '[]'::jsonb,
  lo_ids                jsonb NOT NULL DEFAULT '[]'::jsonb,
  group_ids             jsonb NOT NULL DEFAULT '[]'::jsonb,
  search_text           text NOT NULL DEFAULT '',
  members               jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  first_detected_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dcc_view_status
  ON duplicate_client_clusters (view, status, active_count DESC, confidence_rank DESC, member_count DESC);
CREATE INDEX IF NOT EXISTS idx_dcc_last_seen ON duplicate_client_clusters (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_dcc_branch_ids ON duplicate_client_clusters USING gin (branch_ids);
CREATE INDEX IF NOT EXISTS idx_dcc_lo_ids ON duplicate_client_clusters USING gin (lo_ids);
CREATE INDEX IF NOT EXISTS idx_dcc_group_ids ON duplicate_client_clusters USING gin (group_ids);

-- One row per scan (cron or manual); doubles as a lock so two scans never overlap.
CREATE TABLE IF NOT EXISTS duplicate_scan_runs (
  _id          text PRIMARY KEY,
  trigger      text NOT NULL CHECK (trigger IN ('cron','manual')),
  triggered_by text,
  status       text NOT NULL CHECK (status IN ('running','success','failed')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  stats        jsonb,
  error        text
);
CREATE INDEX IF NOT EXISTS idx_dsr_started ON duplicate_scan_runs (started_at DESC);
