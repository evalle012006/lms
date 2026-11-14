BEGIN;

CREATE TABLE IF NOT EXISTS public.dcs_other_income_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT dcs_other_income_type_check
    CHECK (
        transaction_type IN (
            'penalty',
            'excess_remittance',
            'passbook',
            'bank_deposit'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_dcs_other_income_branch_date
    ON public.dcs_other_income_transactions (
        branch_id,
        transaction_date
    );

COMMIT;