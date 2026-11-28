BEGIN;

-- ============================================================
-- 021 - DCS Effective Beginning Balance
--
-- Move the carry-forward calculation from JavaScript
-- into PostgreSQL to reduce repeated Hasura requests.
--
-- Preserve:
--   1. Manual beginning balance overrides
--   2. DCS collection adjustments
--   3. Separate MCBU and CSF returns
--   4. All supported Other Receipts transaction types
--   5. Existing weekday carry-forward behavior
-- ============================================================


-- ============================================================
-- 1. DAILY CASH MOVEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_dcs_daily_cash_movement(
    _branch_id text,
    _selected_date date
)
RETURNS TABLE (
    receipts numeric,
    payments numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$

    WITH summary_data AS (
        SELECT *
        FROM public.fn_get_dcs_summary(
            _branch_id,
            NULL::text,
            _selected_date
        )
    ),

    dcs_totals AS (
        SELECT
            COALESCE(SUM(d.mcbu_actual), 0) AS mcbu_actual,

            COALESCE(SUM(d.csf_collection), 0) AS csf_collection,

            COALESCE(SUM(d.regular_loan_actual), 0)
                AS regular_loan_actual,

            COALESCE(SUM(d.other_loan_actual), 0)
                AS other_loan_actual,

            COALESCE(
                SUM(
                    COALESCE(
                        (d.data->>'weekly12Actual')::numeric,
                        0
                    )
                ),
                0
            ) AS weekly12_actual,

            COALESCE(SUM(d.mcbu_return_amount), 0)
                AS mcbu_return_amount,

            COALESCE(SUM(d.csf_return_amount), 0)
                AS csf_return_amount

        FROM public.fn_get_daily_collection_sheet_v2(
            _branch_id,
            NULL::text,
            _selected_date
        ) d
    ),

    other_receipts AS (
        SELECT
            ROUND(
                COALESCE(SUM(t.amount), 0),
                2
            ) AS total

        FROM public.dcs_other_receipts_transactions t

        WHERE t.branch_id = _branch_id

          AND t.transaction_date = _selected_date

          AND t.amount > 0

          AND t.transaction_type IN (
              'bad_debt_collection',
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
              'special_advance'
          )
    )

    SELECT

        -- Corrected daily receipts
        ROUND(
            COALESCE(s.total_receipts, 0)

            + (
                d.mcbu_actual
                - COALESCE(s.rcpt_mcbu, 0)
            )

            + (
                d.csf_collection
                - COALESCE(s.rcpt_csf, 0)
            )

            + (
                d.regular_loan_actual
                - COALESCE(s.rcpt_regular_loan, 0)
            )

            + (
                d.other_loan_actual
                + d.weekly12_actual
                - COALESCE(s.rcpt_other_loan, 0)
            )

            + o.total,

            2
        ) AS receipts,

        -- Corrected daily payments
        ROUND(
            COALESCE(s.total_payments, 0)

            + (
                d.mcbu_return_amount
                - COALESCE(s.pay_mcbu_return, 0)
            )

            + (
                d.csf_return_amount
                - COALESCE(s.pay_csf_return, 0)
            ),

            2
        ) AS payments

    FROM summary_data s

    CROSS JOIN dcs_totals d

    CROSS JOIN other_receipts o;

$function$;


-- ============================================================
-- 2. EFFECTIVE BEGINNING BALANCE
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_dcs_effective_beginning_balance(
    _branch_id text,
    _selected_date date
)
RETURNS TABLE (
    beginning_balance numeric,
    source text,
    has_override boolean,
    carried_from date
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $function$

DECLARE

    v_override_date date;

    v_override_balance numeric;

    v_effective_balance numeric;

    v_date date;

    v_receipts numeric;

    v_payments numeric;

BEGIN

    -- Validate required parameters.

    IF _branch_id IS NULL
       OR TRIM(_branch_id) = ''
       OR _selected_date IS NULL
    THEN
        RAISE EXCEPTION
            'Branch ID and selected date are required.';
    END IF;


    -- Find the latest manual beginning balance override.

    SELECT
        b.balance_date,
        b.beginning_balance

    INTO
        v_override_date,
        v_override_balance

    FROM public.dcs_beginning_balances b

    WHERE b.branch_id = _branch_id

      AND b.balance_date <= _selected_date

    ORDER BY b.balance_date DESC

    LIMIT 1;


    -- No manual override.
    -- Preserve existing historical fallback behavior.

    IF NOT FOUND THEN

        RETURN QUERY

        SELECT
            NULL::numeric,
            'historical'::text,
            FALSE,
            NULL::date;

        RETURN;

    END IF;


    -- Selected date has its own manual override.

    IF v_override_date = _selected_date THEN

        RETURN QUERY

        SELECT
            ROUND(v_override_balance, 2),
            'manual'::text,
            TRUE,
            NULL::date;

        RETURN;

    END IF;


    -- Start from the latest manual beginning balance.

    v_effective_balance := v_override_balance;


    -- Calculate movements from the override date
    -- until the day before the selected date.
    --
    -- Always include the override date.
    -- Exclude Saturdays and Sundays on subsequent dates.

    FOR v_date IN

        SELECT dates.day::date

        FROM generate_series(
            v_override_date::timestamp,
            (_selected_date - 1)::timestamp,
            INTERVAL '1 day'
        ) AS dates(day)

        WHERE dates.day::date = v_override_date

           OR EXTRACT(ISODOW FROM dates.day)
                BETWEEN 1 AND 5

        ORDER BY dates.day

    LOOP

        SELECT
            movement.receipts,
            movement.payments

        INTO STRICT
            v_receipts,
            v_payments

        FROM public.fn_get_dcs_daily_cash_movement(
            _branch_id,
            v_date
        ) movement;


        -- Previous closing balance becomes
        -- the next day's beginning balance.

        v_effective_balance := ROUND(
            v_effective_balance
            + COALESCE(v_receipts, 0)
            - COALESCE(v_payments, 0),
            2
        );

    END LOOP;


    -- Return the calculated beginning balance.

    RETURN QUERY

    SELECT
        ROUND(v_effective_balance, 2),
        'carried_forward'::text,
        FALSE,
        v_override_date;

END;

$function$;


-- Restrict direct execution by PUBLIC.
-- Grant execution to the authorized Hasura database role
-- separately when configuring the integration.

REVOKE EXECUTE ON FUNCTION
    public.fn_get_dcs_daily_cash_movement(text, date)
FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION
    public.fn_get_dcs_effective_beginning_balance(text, date)
FROM PUBLIC;


COMMIT;