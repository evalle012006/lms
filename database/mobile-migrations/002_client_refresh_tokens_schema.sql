-- Apply after 001_client_accounts_schema.sql
-- _id text, app-generated — see the note at the top of 001_ for why.

CREATE TABLE client_refresh_tokens (
    _id                 text PRIMARY KEY,
    client_account_id  text NOT NULL REFERENCES client_accounts(_id),

    -- SHA-256, not bcrypt — this is a high-entropy random token (not a
    -- guessable 6-digit OTP), so bcrypt's deliberate slowness buys nothing
    -- here and would just make every refresh call slower for no reason.
    token_hash          text NOT NULL,

    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,

    -- Set when a refresh rotates this token out, pointing at its replacement.
    -- Lets us tell "expired naturally" apart from "already used" if the same
    -- old token shows up again — the second case means it may have leaked.
    replaced_by_id       text REFERENCES client_refresh_tokens(_id),

    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_refresh_tokens_lookup_idx ON client_refresh_tokens (token_hash);
CREATE INDEX client_refresh_tokens_account_idx ON client_refresh_tokens (client_account_id);