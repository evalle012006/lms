-- 015_users_date_modified_backfill.sql
-- users."dateModified" existed but was never written. The user list now sorts by it (latest first), and
-- the user create/update APIs now set it. Existing rows start from their creation date so old users do not sort as "never".
-- Run before the code deploy. No Hasura reload needed (column already tracked).
UPDATE users SET "dateModified" = "dateAdded" WHERE "dateModified" IS NULL;

-- Rollback: nothing to undo structurally; the values are only a starting point.
