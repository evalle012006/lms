DO $$
BEGIN

    ALTER TABLE public.unclaimed_amount_transactions
        ADD COLUMN IF NOT EXISTS source_type
            VARCHAR(30) NOT NULL DEFAULT 'offset',

        ADD COLUMN IF NOT EXISTS entry_date
            DATE,

        ADD COLUMN IF NOT EXISTS lo_id
            VARCHAR,

        ADD COLUMN IF NOT EXISTS mcbu_amount
            NUMERIC(18,2) NOT NULL DEFAULT 0,

        ADD COLUMN IF NOT EXISTS csf_amount
            NUMERIC(18,2) NOT NULL DEFAULT 0,

        ADD COLUMN IF NOT EXISTS remarks
            TEXT;

    ALTER TABLE public.unclaimed_amount_transactions
        ALTER COLUMN cash_collection_id DROP NOT NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_unclaimed_source_type'
        AND conrelid =
            'public.unclaimed_amount_transactions'::regclass
    ) THEN

        ALTER TABLE public.unclaimed_amount_transactions
            ADD CONSTRAINT chk_unclaimed_source_type
            CHECK (
                source_type IN ('offset', 'manual')
            );

    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_unclaimed_source_reference'
        AND conrelid =
            'public.unclaimed_amount_transactions'::regclass
    ) THEN

        ALTER TABLE public.unclaimed_amount_transactions
            ADD CONSTRAINT chk_unclaimed_source_reference
            CHECK (
                (
                    source_type = 'offset'
                    AND cash_collection_id IS NOT NULL
                )
                OR
                (
                    source_type = 'manual'
                    AND cash_collection_id IS NULL
                    AND entry_date IS NOT NULL
                    AND branch_id IS NOT NULL
                    AND lo_id IS NOT NULL
                    AND mcbu_amount >= 0
                    AND csf_amount >= 0
                    AND (mcbu_amount + csf_amount) > 0
                )
            );

    END IF;

    CREATE INDEX IF NOT EXISTS idx_unclaimed_manual_branch_date
    ON public.unclaimed_amount_transactions (
        branch_id,
        entry_date
    )
    WHERE source_type = 'manual';

    CREATE UNIQUE INDEX IF NOT EXISTS
        idx_unclaimed_unique_cash_collection
    ON public.unclaimed_amount_transactions (
        cash_collection_id
    )
    WHERE cash_collection_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS
        idx_unclaimed_unique_manual_entry
    ON public.unclaimed_amount_transactions (
        client_id,
        branch_id,
        entry_date,
        mcbu_amount,
        csf_amount
    )
    WHERE source_type = 'manual';

    ALTER TABLE public.dcs_other_receipts_transactions
    DROP CONSTRAINT dcs_other_receipts_type_check,
    ADD CONSTRAINT dcs_other_receipts_type_check
    CHECK (
        transaction_type IN (
            'staff_loan_collection',
            'staff_loan_interest',
            'staff_cbu_collection',
            'staff_cashbond_collection',
            'staff_sbf_utility_collection',
            'mpl_contribution',
            'sss_contribution',
            'ap_payroll',
            'overstated_management_expenses',
            'salary_advance',
            'motorcycle_loan',
            'cash_advance',
            'special_advance',
            'bad_debt_collection'
        )
    );

    RAISE NOTICE 'MCBU / CSF In and Other Receipts database setup completed successfully.';

    END;
    $$;