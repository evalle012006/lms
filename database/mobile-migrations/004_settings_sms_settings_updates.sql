-- Adds granular SMS controls alongside the existing smsEnabled column.
-- smsEnabled becomes the MASTER switch (unchanged meaning — off means
-- nothing sends, full stop). The two new *Enabled columns are sub-switches
-- checked only when the master is already on. Defaulting them to true
-- preserves current behavior on upgrade — every existing SMS type keeps
-- sending exactly as before until someone deliberately narrows one off.
--
-- Sender name: smsSenderName is the default/fallback; the two per-category
-- overrides are optional and only apply if non-empty (see sms-service.js).

ALTER TABLE settings ADD COLUMN IF NOT EXISTS "smsSenderName" text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "smsNotificationsEnabled" boolean NOT NULL DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "smsNotificationsSenderName" text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "smsOtpEnabled" boolean NOT NULL DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "smsOtpSenderName" text;

-- After running: reload Hasura metadata for the `settings` table so these
-- new columns are exposed in the GraphQL schema (SETTINGS_FIELDS already
-- lists them, but Hasura needs to see the actual columns first).