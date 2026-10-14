BEGIN;

-- ============================================================
-- DCS TRANSACTIONS
-- Petty Cash Voucher / Transaction Header
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dcs_transactions (
    id BIGSERIAL PRIMARY KEY,

    branch_id VARCHAR NOT NULL,
    created_by VARCHAR NOT NULL,

    paid_to VARCHAR(255) NOT NULL,
    address TEXT,

    transaction_date DATE NOT NULL,
    voucher_no VARCHAR(100) NOT NULL,

    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount_words TEXT,

    cashier_in_charge VARCHAR(255),
    supervisor VARCHAR(255),
    received_by VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dcs_transactions_branch
        FOREIGN KEY (branch_id)
        REFERENCES public.branches(_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_dcs_transactions_created_by
        FOREIGN KEY (created_by)
        REFERENCES public.users(_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_dcs_transaction_cashier_receiver
        CHECK (
            cashier_in_charge IS NULL
            OR received_by IS NULL
            OR LOWER(TRIM(cashier_in_charge))
               <> LOWER(TRIM(received_by))
        ),

    CONSTRAINT uq_dcs_transaction_branch_voucher
        UNIQUE (branch_id, voucher_no)
);


-- ============================================================
-- DCS TRANSACTION ITEMS
-- Multiple accounting entries under one voucher
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dcs_transaction_items (
    id BIGSERIAL PRIMARY KEY,

    transaction_id BIGINT NOT NULL,

    category VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    account_title VARCHAR(255) NOT NULL,
    description TEXT,

    amount NUMERIC(15,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dcs_transaction_items_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES public.dcs_transactions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_dcs_transaction_item_amount
        CHECK (amount > 0)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dcs_transactions_branch
    ON public.dcs_transactions(branch_id);

CREATE INDEX IF NOT EXISTS idx_dcs_transactions_date
    ON public.dcs_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_dcs_transactions_created_by
    ON public.dcs_transactions(created_by);

CREATE INDEX IF NOT EXISTS idx_dcs_transaction_items_transaction
    ON public.dcs_transaction_items(transaction_id);

-- ============================================================
-- OTHER INCOME / MISCELLANEOUS INCOME TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public."otherIncomeMiscTransactions" (
    "_id" character varying NOT NULL,
    "branchId" character varying NOT NULL,
    "transactionDate" date NOT NULL,

    "description" text,

    "othersAmount" numeric DEFAULT 0,
    "interestFromBank" numeric DEFAULT 0,
    "ackpNonAgentCsf" numeric DEFAULT 0,
    "badDebtCollection" numeric DEFAULT 0,

    "motorcycleAdvance" numeric DEFAULT 0,
    "salaryAdvance" numeric DEFAULT 0,

    "newClientPassbook" numeric DEFAULT 0,
    "replacementPassbook" numeric DEFAULT 0,

    "staffExcessRemittance" numeric DEFAULT 0,
    "penalties" numeric DEFAULT 0,

    "insertedBy" character varying,
    "insertedByName" character varying,
    "insertedDateTime" timestamp with time zone DEFAULT now(),

    "modifiedBy" character varying,
    "modifiedByName" character varying,
    "modifiedDateTime" timestamp with time zone,

    CONSTRAINT "otherIncomeMiscTransactions_pkey"
        PRIMARY KEY ("_id"),

    CONSTRAINT "otherIncomeMiscTransactions_branchId_fkey"
        FOREIGN KEY ("branchId")
        REFERENCES public.branches("_id")
);

CREATE INDEX IF NOT EXISTS "idx_otherIncomeMiscTransactions_branchId"
    ON public."otherIncomeMiscTransactions" ("branchId");

CREATE INDEX IF NOT EXISTS "idx_otherIncomeMiscTransactions_transactionDate"
    ON public."otherIncomeMiscTransactions" ("transactionDate");

CREATE INDEX IF NOT EXISTS "idx_otherIncomeMiscTransactions_branch_date"
    ON public."otherIncomeMiscTransactions" ("branchId", "transactionDate");

COMMIT;