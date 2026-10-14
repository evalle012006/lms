-- =========================================================
-- CASH IN BANK
-- =========================================================

CREATE TABLE IF NOT EXISTS public.cash_in_bank_accounts (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL,
    bank_no INTEGER NOT NULL CHECK (bank_no BETWEEN 1 AND 3),
    bank_name VARCHAR(150),
    account_no VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (branch_id, bank_no)
);


CREATE TABLE IF NOT EXISTS public.cash_in_bank_entries (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL,
    bank_no INTEGER NOT NULL CHECK (bank_no BETWEEN 1 AND 3),
    transaction_date DATE NOT NULL,

    deposit NUMERIC(15,2) DEFAULT 0,
    net_interest NUMERIC(15,2) DEFAULT 0,
    withdrawal NUMERIC(15,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (branch_id, bank_no, transaction_date)
);


CREATE TABLE IF NOT EXISTS public.cash_in_bank_opening_balances (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR NOT NULL,
    bank_no INTEGER NOT NULL CHECK (bank_no BETWEEN 1 AND 3),
    balance_month DATE NOT NULL,
    opening_balance NUMERIC(15,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (branch_id, bank_no, balance_month)
);


CREATE INDEX IF NOT EXISTS idx_cash_in_bank_entries_branch_date
ON public.cash_in_bank_entries (branch_id, transaction_date);


CREATE INDEX IF NOT EXISTS idx_cash_in_bank_opening_branch_month
ON public.cash_in_bank_opening_balances (branch_id, balance_month);