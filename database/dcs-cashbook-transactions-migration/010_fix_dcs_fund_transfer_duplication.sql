-- ============================================================
-- MIGRATION 010
-- DCS BEGINNING BALANCE
-- Automatic Carry-Forward with Manual Override
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- CREATE BEGINNING BALANCE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dcs_beginning_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR NOT NULL,
    balance_date DATE NOT NULL,
    beginning_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    updated_by VARCHAR,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT dcs_beginning_balances_branch_date_unique
        UNIQUE (branch_id, balance_date)
);

-- ============================================================
-- INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dcs_beginning_balances_branch_date
ON public.dcs_beginning_balances (
    branch_id,
    balance_date
);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.dcs_beginning_balances IS
'Stores manually entered DCS beginning balances per branch and date. Dates without overrides use the previous closing balance.';

COMMENT ON COLUMN public.dcs_beginning_balances.beginning_balance IS
'Manually entered beginning balance. Subsequent dates automatically carry forward the previous closing balance unless another override exists.';

-- ============================================================
-- ENSURE COLUMN TYPES
-- ============================================================

ALTER TABLE public.dcs_beginning_balances
    ALTER COLUMN branch_id TYPE VARCHAR
        USING branch_id::VARCHAR,
    ALTER COLUMN updated_by TYPE VARCHAR
        USING updated_by::VARCHAR;

-- ============================================================
-- AUTOMATICALLY UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_dcs_beginning_balance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dcs_beginning_balance_updated_at
ON public.dcs_beginning_balances;

CREATE TRIGGER trg_dcs_beginning_balance_updated_at
BEFORE UPDATE ON public.dcs_beginning_balances
FOR EACH ROW
EXECUTE FUNCTION public.fn_dcs_beginning_balance_updated_at();