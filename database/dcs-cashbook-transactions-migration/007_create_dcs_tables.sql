-- ============================================================
-- MIGRATION 007
-- CREATE DCS CASHBOOK DESCRIPTIONS
--
-- DCS transactions and transaction items are already
-- created in migration 001.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.dcs_cashbook_descriptions (

    id BIGSERIAL PRIMARY KEY,

    branch_id TEXT NOT NULL,

    entry_date DATE NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT dcs_cashbook_descriptions_branch_id_entry_date_key
        UNIQUE (branch_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_dcs_cashbook_descriptions_branch_date
ON public.dcs_cashbook_descriptions(branch_id, entry_date);

COMMIT;