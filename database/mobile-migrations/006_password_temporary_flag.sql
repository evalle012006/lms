-- A staff-generated password (from activation or a reset) is always
-- temporary until the client changes it themselves — this flag is what
-- forces that on next login. Defaults false so nothing changes for any
-- account whose password was already set through normal means before this
-- column existed.
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS password_is_temporary boolean NOT NULL DEFAULT false;