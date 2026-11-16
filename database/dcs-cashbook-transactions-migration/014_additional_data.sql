BEGIN;

ALTER TABLE public.dcs_other_income_transactions
    DROP CONSTRAINT IF EXISTS dcs_other_income_type_check;

ALTER TABLE public.dcs_other_income_transactions
    ADD CONSTRAINT dcs_other_income_type_check
    CHECK (
        transaction_type IN (
            'penalty',
            'excess_remittance',
            'passbook',
            'bank_deposit',
            'bank_withdrawal'
        )
    );

CREATE TABLE IF NOT EXISTS public.dcs_other_receipts_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    branch_id UUID NOT NULL,
    transaction_date DATE NOT NULL,

    transaction_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,

    created_by UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT dcs_other_receipts_type_check
    CHECK (
        transaction_type IN (
            'staff_loan_collection',
            'staff_cbu_collection',
            'staff_cashbond_collection',
            'staff_sbf_utility_collection',
            'mpl_contribution',
            'sss_contribution',
            'ap_payroll'
        )
    ),

    CONSTRAINT dcs_other_receipts_amount_check
    CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_dcs_other_receipts_branch_date
ON public.dcs_other_receipts_transactions (
    branch_id,
    transaction_date
);


ALTER TABLE public.dcs_other_receipts_transactions
    ALTER COLUMN branch_id TYPE TEXT
    USING branch_id::TEXT;

ALTER TABLE public.dcs_other_receipts_transactions
    ALTER COLUMN created_by TYPE TEXT
    USING created_by::TEXT;

COMMIT;