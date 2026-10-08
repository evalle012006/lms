-- New Postgres-native tables. Snake_case columns per project convention.
-- Primary keys are `_id text`, generated in application code via
-- generateUUID() from src/lib/utils.js (uuid v4 as a string) — NOT a
-- Postgres-native `uuid` column with a DB-generated default. This matches
-- every existing table in this codebase, old and new alike (see
-- pages/api/public/laf/submit.js and pages/api/v2/transactions/mcbu-withdrawal/bulk-approve.js):
-- the app always supplies `_id` explicitly on insert.
--
-- Apply manually against the target DB, then in Hasura: track each table,
-- set up relationships to `client` (legacy _id is text, NOT uuid — see
-- note below), and reload metadata before deploying the API code that
-- reads/writes these.

-- ── client_accounts ──────────────────────────────────────────────────────
-- One row per client who has activated app access. Deliberately NOT 1:1 by
-- trigger — a client row can exist in `client` for years before anyone
-- enrolls, or never enroll at all.
CREATE TABLE client_accounts (
    _id                 text PRIMARY KEY,

    -- `client._id` is a legacy Mongo-migrated string id, not a uuid — match its type.
    client_id           text NOT NULL REFERENCES client(_id),

    -- Normalized to +63XXXXXXXXXX. This is the number OTPs are sent to;
    -- it is copied from client.contactNumber at enrollment time and can
    -- drift from it afterwards (a client can update their app contact
    -- number without needing a branch visit) — the two are intentionally
    -- decoupled after enrollment.
    contact_number      text NOT NULL,

    status              text NOT NULL DEFAULT 'pending_verification'
                         CHECK (status IN ('pending_verification', 'active', 'suspended', 'deactivated')),

    enrollment_method    text NOT NULL
                         CHECK (enrollment_method IN ('auto_contact_match', 'staff_activated', 'self_registered_id_verified')),

    enrolled_by_user_id text REFERENCES users(_id),  -- set only for staff_activated

    failed_otp_attempts  integer NOT NULL DEFAULT 0,
    otp_locked_until     timestamptz,

    last_login_at        timestamptz,
    verified_at           timestamptz,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

-- One active/pending account per client — prevents a second enrollment
-- attempt from creating a duplicate row while one is already pending or active.
CREATE UNIQUE INDEX client_accounts_client_id_active_uq
    ON client_accounts (client_id)
    WHERE status IN ('pending_verification', 'active');

CREATE INDEX client_accounts_contact_number_idx ON client_accounts (contact_number);

-- ── client_otp_codes ─────────────────────────────────────────────────────
-- Short-lived login codes. Never store the raw code — hash it exactly like
-- passwords are hashed elsewhere in this codebase (bcrypt).
CREATE TABLE client_otp_codes (
    _id                 text PRIMARY KEY,
    contact_number      text NOT NULL,
    purpose             text NOT NULL CHECK (purpose IN ('login', 'enrollment')),
    -- Resolved at request-otp time (matters when purpose='enrollment' and the
    -- number was ambiguous across clients) — verify-otp trusts THIS, not a
    -- fresh lookup, so the disambiguation decision can't be replayed differently.
    client_id           text REFERENCES client(_id),
    code_hash           text NOT NULL,
    expires_at          timestamptz NOT NULL,
    consumed_at         timestamptz,
    attempt_count       integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_otp_codes_lookup_idx
    ON client_otp_codes (contact_number, purpose, consumed_at);

-- ── client_enrollment_requests ───────────────────────────────────────────
-- Path 3 (self-registration with ID verification) and the record trail for
-- path 2 (staff activation), so both flows are auditable the same way LAF is.
CREATE TABLE client_enrollment_requests (
    _id                      text PRIMARY KEY,
    client_id                text REFERENCES client(_id),  -- nullable: self-reg may not resolve a match yet
    method                   text NOT NULL CHECK (method IN ('self_registered_id_verified', 'staff_activated')),
    contact_number           text NOT NULL,
    government_id_type       text,
    government_id_number     text,
    government_id_photo_key  text,   -- DO Spaces key, signed-URL pattern (same as client/LAF photos)
    selfie_photo_key         text,
    face_match_score         numeric,  -- against client.faceTemplate, if the client has one on file
    status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by_user_id      text REFERENCES users(_id),
    reviewed_at              timestamptz,
    rejection_reason         text,
    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_enrollment_requests_status_idx ON client_enrollment_requests (status);