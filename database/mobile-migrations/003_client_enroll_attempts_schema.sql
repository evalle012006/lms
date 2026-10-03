-- Apply after 002_client_refresh_tokens.sql
-- _id text, app-generated — see the note at the top of 001_ for why.
--
-- Modeled after face_verify_attempts: an append-mostly log of every
-- registration/activation attempt regardless of outcome, so staff can see
-- what's failing and why — not just a queue of items still pending action.

CREATE TABLE client_enrollment_attempts (
    _id                 text PRIMARY KEY,

    method              text NOT NULL
                        CHECK (method IN ('auto_contact_match', 'staff_activated', 'self_registered_id_verified')),

    outcome             text NOT NULL CHECK (outcome IN (
                            'otp_sent',
                            'no_client_found',
                            'disambiguation_required',
                            'staff_required',
                            'success',
                            'otp_failed',
                            'pending_review',
                            'approved',
                            'rejected'
                        )),

    contact_number      text NOT NULL,
    client_id           text REFERENCES client(_id),
    enrollment_request_id text REFERENCES client_enrollment_requests(_id),
    detail              text,
    reviewed_by_user_id text REFERENCES users(_id),

    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_enrollment_attempts_created_idx ON client_enrollment_attempts (created_at DESC);
CREATE INDEX client_enrollment_attempts_outcome_idx ON client_enrollment_attempts (outcome);
CREATE INDEX client_enrollment_attempts_method_idx ON client_enrollment_attempts (method);