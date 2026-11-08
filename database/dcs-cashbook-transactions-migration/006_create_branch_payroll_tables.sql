-- ============================================================
-- MIGRATION 006
-- CREATE BRANCH PAYROLL TABLES
-- Matches development Hasura database schema
-- ============================================================

BEGIN;

-- ============================================================
-- BRANCH PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    branch_id TEXT NOT NULL,

    payroll_month INTEGER NOT NULL,
    payroll_year INTEGER NOT NULL,

    created_by TEXT,
    updated_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT branch_payroll_unique_month
        UNIQUE (branch_id, payroll_month, payroll_year)
);

-- ============================================================
-- BRANCH PAYROLL EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_payroll_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    payroll_id UUID NOT NULL,

    row_order INTEGER NOT NULL DEFAULT 0,

    family_name TEXT,
    first_name TEXT,
    middle_name TEXT,
    employee_id TEXT,
    position TEXT,
    date_regularized DATE,

    basic_salary NUMERIC NOT NULL DEFAULT 0,
    ecola NUMERIC NOT NULL DEFAULT 0,

    employer_hdmf NUMERIC NOT NULL DEFAULT 0,
    employer_sss NUMERIC NOT NULL DEFAULT 0,
    employer_ph NUMERIC NOT NULL DEFAULT 0,

    employee_hdmf NUMERIC NOT NULL DEFAULT 0,
    employee_sss NUMERIC NOT NULL DEFAULT 0,
    employee_ph NUMERIC NOT NULL DEFAULT 0,

    withholding_tax NUMERIC NOT NULL DEFAULT 0,
    utility_charge NUMERIC NOT NULL DEFAULT 0,
    cbu NUMERIC NOT NULL DEFAULT 0,
    cash_bond NUMERIC NOT NULL DEFAULT 0,

    salary_advance NUMERIC NOT NULL DEFAULT 0,
    special_advance NUMERIC NOT NULL DEFAULT 0,
    cash_advance NUMERIC NOT NULL DEFAULT 0,
    other_receivables NUMERIC NOT NULL DEFAULT 0,

    pagibig_mpl NUMERIC NOT NULL DEFAULT 0,
    sss_loan NUMERIC NOT NULL DEFAULT 0,
    staff_accounts_payable NUMERIC NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT branch_payroll_employees_payroll_id_fkey
        FOREIGN KEY (payroll_id)
        REFERENCES public.branch_payroll(id)
        ON DELETE CASCADE
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_branch_payroll_branch
ON public.branch_payroll(branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_payroll_period
ON public.branch_payroll(payroll_year, payroll_month);

CREATE INDEX IF NOT EXISTS idx_branch_payroll_employees_payroll
ON public.branch_payroll_employees(payroll_id);

COMMIT;