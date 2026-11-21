-- 009_face_uniqueness_setting.sql — System Settings switch "Enforce Face Uniqueness" (default ON).
-- Run BEFORE deploying the code: SETTINGS_FIELDS now selects this column, so a missing column
-- would fail every settings read in the app. After running: reload Hasura metadata.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "enforceFaceUniqueness" boolean NOT NULL DEFAULT true;
