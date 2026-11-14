-- ============================================================
-- MIGRATION 012
-- FIX DCS MCBU UNCLAIMED IN / OUT
--
-- IN:
--   Source: cashCollections
--   Date: Original offset transaction date
--
-- OUT:
--   Source: Saved DCS transaction vouchers
--   Category: Other Payments
--   Code: 026 - Unclaimed Return (Out)
--
-- Affects:
--   DCS Summary
--   Cashbook
--   Total Payments
--   Closing Balance
--
-- Preserves all other existing function calculations.
-- ============================================================

BEGIN;

DO $migration$
DECLARE
    v_function_oid oid;
    v_function_sql text;

    v_start_marker text :=
        '-- 4. MCBU UNCLAIMED';

    v_end_marker text :=
        '-- 5. FUND TRANSFERS';

    v_start_pos integer;
    v_end_pos integer;

    v_new_section text := $section$

    -- ============================================================
    -- 4. MCBU UNCLAIMED (IN / OUT)
    -- ============================================================

    -- ============================================================
    -- MCBU UNCLAIMED IN
    --
    -- Source: Original cash collection offset transactions
    -- Date: Original offset date
    --
    -- Historical IN remains recorded even after a claim.
    -- ============================================================

    SELECT
        COALESCE(
            SUM(
                COALESCE(cc."mcbuReturnAmt", 0)
                + COALESCE(cc."csfReturnAmt", 0)
                - COALESCE(cc."paymentCollection", 0)
            ),
            0
        )
    INTO v_mcbu_unclaimed_in
    FROM public."cashCollections" cc
    WHERE cc."branchId" = _branch_id
      AND cc."dateAdded"::date = _selected_date
      AND cc.remarks->>'value' = 'offset-unclaimed'
      AND (
          _lo_id IS NULL
          OR cc."loId" = _lo_id
      );


    -- ============================================================
    -- MCBU UNCLAIMED OUT
    --
    -- Source: Saved DCS transaction vouchers
    -- Category: Other Payments
    -- Code: 026 - Unclaimed Return (Out)
    --
    -- OUT is recorded only when a voucher exists.
    -- ============================================================

    SELECT
        COALESCE(SUM(dti.amount), 0)
    INTO v_mcbu_unclaimed_out
    FROM public.dcs_transaction_items dti
    INNER JOIN public.dcs_transactions dt
        ON dt.id = dti.transaction_id
    WHERE dt.branch_id = _branch_id
      AND dt.transaction_date::date = _selected_date
      AND LOWER(TRIM(dti.category)) = 'other payments'
      AND TRIM(dti.code) ~ '^026([^0-9]|$)';


    -- ============================================================
    $section$;

BEGIN

    -- ============================================================
    -- STEP 1: VERIFY THE EXISTING FUNCTION
    -- ============================================================

    v_function_oid :=
        to_regprocedure(
            'public.fn_get_dcs_summary(text,text,date)'
        );

    IF v_function_oid IS NULL THEN
        RAISE EXCEPTION
            'Migration 012 failed: fn_get_dcs_summary does not exist.';
    END IF;


    -- ============================================================
    -- STEP 2: RETRIEVE COMPLETE EXISTING FUNCTION
    -- ============================================================

    SELECT pg_get_functiondef(v_function_oid)
    INTO v_function_sql;


    -- ============================================================
    -- STEP 3: LOCATE MCBU UNCLAIMED SECTION
    -- ============================================================

    v_start_pos :=
        POSITION(v_start_marker IN v_function_sql);

    v_end_pos :=
        POSITION(v_end_marker IN v_function_sql);


    IF v_start_pos = 0 OR v_end_pos = 0 THEN
        RAISE EXCEPTION
            'Migration 012 failed: MCBU Unclaimed section markers not found.';
    END IF;

    IF v_end_pos <= v_start_pos THEN
        RAISE EXCEPTION
            'Migration 012 failed: Invalid section order.';
    END IF;


    -- ============================================================
    -- STEP 4: REPLACE ONLY MCBU UNCLAIMED SECTION
    --
    -- Everything before section 4 remains unchanged.
    -- Everything after section 4 remains unchanged.
    -- ============================================================

    v_function_sql :=
        SUBSTRING(
            v_function_sql
            FROM 1
            FOR v_start_pos - 1
        )
        ||
        v_new_section
        ||
        SUBSTRING(
            v_function_sql
            FROM v_end_pos
        );


    -- ============================================================
    -- STEP 5: APPLY UPDATED FUNCTION
    -- ============================================================

    EXECUTE v_function_sql;

    RAISE NOTICE
        'Migration 012 completed: MCBU Unclaimed IN/OUT updated.';

END;
$migration$;

COMMIT;