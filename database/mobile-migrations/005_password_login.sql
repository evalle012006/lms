-- Adds password-based login alongside existing OTP. OTP remains fully
-- functional as the backup/recovery path — see the design note in
-- login-password.js on why a password lockout does NOT suspend the account
-- the way OTP lockout does.

ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
-- Gate for password login specifically: failed_password_attempts >= 3 blocks
-- the login-password endpoint only. There's no separate lockout timestamp —
-- the only way to clear this is setting a new password (via the OTP-backed
-- set-password flow), which resets the counter to 0. OTP itself is
-- completely unaffected by this counter.
ALTER TABLE client_accounts ADD COLUMN IF NOT EXISTS failed_password_attempts integer NOT NULL DEFAULT 0;

-- Feature toggle, same flat-column convention as the SMS settings — lets
-- staff turn password login on/off system-wide without a deploy.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "passwordLoginEnabled" boolean NOT NULL DEFAULT true;

-- After running: reload Hasura metadata so password_hash etc. and
-- passwordLoginEnabled are exposed in the GraphQL schema.