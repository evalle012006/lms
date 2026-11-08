//database/dcs-cashbook-transactions-migration/005_update_dcs_summary_transactions.sql

CREATE OR REPLACE FUNCTION public.fn_get_dcs_summary(_branch_id text, _lo_id text, _selected_date date)
 RETURNS TABLE(beginning_balance numeric, rcpt_mcbu numeric, rcpt_csf numeric, rcpt_regular_loan numeric, rcpt_other_loan numeric, rcpt_admin_fees numeric, rcpt_lrf numeric, rcpt_cbhb numeric, rcpt_add_hospi numeric, rcpt_other_income_passbook numeric, rcpt_other_income numeric, rcpt_other_income_csf numeric, rcpt_other_receipts_picture numeric, rcpt_staff_cbu numeric, rcpt_staff_principal numeric, rcpt_wtax numeric, rcpt_other_receipts_gl numeric, rcpt_gl_detail jsonb, rcpt_mcbu_unclaimed_in numeric, rcpt_fund_transfer_in numeric, rcpt_bank_withdrawal numeric, total_receipts numeric, pay_loan_release_no integer, pay_loan_release_amount numeric, pay_mcbu_withdrawal numeric, pay_csf_withdrawal numeric, pay_mcbu_return numeric, pay_csf_return numeric, pay_staff_loan_release numeric, pay_mngt_expenses numeric, pay_cbhb_disbursed numeric, pay_rebates numeric, pay_other_payments numeric, pay_gl_detail jsonb, pay_mcbu_unclaimed_out numeric, pay_fund_transfer_out numeric, pay_bank_deposits numeric, total_payments numeric, closing_balance numeric, loan_release_per_lo jsonb, denomination_summary jsonb)
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- ── COH (beginning balance) ─────────────────────────────
    v_beginning_balance         numeric := 0;

    -- ── Dashboard collection totals ─────────────────────────
    v_mcbu numeric := 0;
    v_csf numeric := 0;
    v_loan_daily numeric := 0;
    v_loan_weekly numeric := 0;
    v_admission numeric := 0;
    v_lrf numeric := 0;
    v_cbhb numeric := 0;
    v_add_hospi numeric := 0;
    v_passbook numeric := 0;
    v_other_income numeric := 0;
    v_csf_in numeric := 0;
    v_picture numeric := 0;
    v_loan_release_no integer := 0;
    v_loan_release_amount numeric := 0;
    v_mcbu_wd numeric := 0;
    v_csf_wd numeric := 0;
    v_mcbu_ret numeric := 0;
    v_csf_ret numeric := 0;
	v_wtax_transactions numeric := 0;
	v_rebates_transactions numeric := 0;

	-- ── Fund Transfer (Giver & Receiver ) ────────────────────────────────────────────
	v_fund_transfer_receipts numeric := 0;
	v_fund_transfer_payments numeric := 0;

    -- ── GL totals ────────────────────────────────────────────
    v_staff_cbu numeric := 0;
    v_staff_principal numeric := 0;
    v_wtax numeric := 0;
    v_other_receipts_gl numeric := 0;
	v_other_receipts_transactions numeric := 0;
    v_staff_loan_release numeric := 0;
    v_mngt_expenses numeric := 0;
	v_mngt_expenses_transactions numeric := 0;

	-- CBHB disbursements from saved transaction vouchers
	v_cbhb_disbursed numeric := 0;
	v_cbhb_transactions numeric := 0;

	v_rebates numeric := 0;
    v_other_payments numeric := 0;
    v_bank_withdrawal numeric := 0;  -- Cash In Bank credit
    v_bank_deposits numeric := 0;  -- Cash In Bank debit
    v_rcpt_gl_detail jsonb := '[]'::jsonb;
    v_pay_gl_detail jsonb := '[]'::jsonb;

    -- ── MCBU unclaimed ───────────────────────────────────────
    v_mcbu_unclaimed_in numeric := 0;
    v_mcbu_unclaimed_out numeric := 0;

    -- ── Fund transfers ───────────────────────────────────────
    v_ft_in numeric := 0;
    v_ft_out numeric := 0;

    -- ── Computed totals ──────────────────────────────────────
    v_total_receipts numeric := 0;
    v_total_payments numeric := 0;
    v_closing_balance numeric := 0;
BEGIN

    -- ============================================================
    -- 1. BEGINNING BALANCE — "branchCOH" (COH)
    --    Hasura model branchCOH maps to table "branchCOH" in PostgreSQL.
    --    Uses the PREVIOUS day's COH entry as today's opening balance.
    --    If your system stores today's opening directly, change the
    --    date filter to: = _selected_date
    -- ============================================================
    SELECT COALESCE(SUM(bc.amount), 0)
    INTO v_beginning_balance
    FROM "branchCOH" bc
    WHERE bc."branchId" = _branch_id
    AND bc."dateAdded"::date = (_selected_date - INTERVAL '1 day')::date;

    -- ============================================================
    -- 2. DASHBOARD DATA — from cashCollections directly
    --    (matches fn_get_cash_collection_with_filter_v2 aggregation)
    -- ============================================================
    SELECT
        COALESCE(SUM(cc."mcbuCol"), 0),
        COALESCE(SUM(cc."csfCollection"), 0),
        COALESCE(SUM(cc."paymentCollection") FILTER (WHERE cc.occurence = 'daily'), 0),
        COALESCE(SUM(cc."paymentCollection") FILTER (WHERE cc.occurence = 'weekly'), 0),
        COALESCE(SUM(cc."admissionCollection"), 0),
        COALESCE(SUM(cc."lrfCollection"), 0),
        COALESCE(SUM(cc."cbhbCollection"), 0),
        COALESCE(SUM(cc."addHospitalization"), 0),
        COALESCE(SUM(cc."otherPassbookCollection"), 0),
        COALESCE(SUM(cc."otherPassbookCollection" + cc."otherPictureCollection"), 0),
        COALESCE(SUM(cc."csfIn"), 0),
        COALESCE(SUM(cc."otherPictureCollection"), 0),
        -- Loan Release (tomorrow status, not transfer)
        COALESCE(SUM(CASE WHEN cc.status = 'tomorrow' AND cc.transfer IS NOT TRUE THEN 1 ELSE 0 END), 0)::integer,
        COALESCE(SUM(CASE WHEN cc.status = 'tomorrow' AND cc.transfer IS NOT TRUE THEN cc."currentReleaseAmount" ELSE 0 END), 0),
        -- MCBU & CSF Withdrawals
        COALESCE(SUM(cc."mcbuWithdrawal"), 0),
        COALESCE(SUM(cc."csfWithdrawal"), 0),
        -- MCBU & CSF Return
        COALESCE(SUM(cc."mcbuReturnAmt"), 0),
        COALESCE(SUM(cc."csfReturnAmt"), 0)
    INTO
        v_mcbu, v_csf, v_loan_daily, v_loan_weekly,
        v_admission, v_lrf, v_cbhb, v_add_hospi,
        v_passbook, v_other_income, v_csf_in, v_picture,
        v_loan_release_no, v_loan_release_amount,
        v_mcbu_wd, v_csf_wd, v_mcbu_ret, v_csf_ret
    FROM "cashCollections" cc
    WHERE cc."branchId" = _branch_id
    AND cc."dateAdded"::date = _selected_date
    AND cc.status != 'reject'
    AND cc.transferred IS NOT TRUE
    AND (_lo_id IS NULL OR cc."loId" = _lo_id);

    -- ============================================================
    -- 3. GENERAL LEDGER — management_transactions
    --    NOTE: Verify type_code values match your management_account_types table.
    --    Adjust type_code strings below to match your actual DB values.
    --
    --    RECEIPTS (credit side):
    --      STAFF_CBU        → Staff Collection CBU / Cash Bond
    --      STAFF_PRINCIPAL  → Staff Principal Loan Collection
    --      WTAX             → W/Tax, EE&ER (Employee/Employer Contribution)
    --      OTHER_RECEIPTS   → Other Receipts (Receipts Tab)
    --      CASH_IN_BANK     → Bank Withdrawal (Credit = money coming IN from bank)
    --
    --    PAYMENTS (debit side):
    --      STAFF_LOAN_RELEASE → Staff Loan Release / Staff CBU Withdrawal
    --      MNGT_EXPENSES      → Management Expenses
    --      CBHB_DISBURSED     → CBHB Disbursement
    --      REBATES            → Rebates
    --      OTHER_PAYMENTS     → Other Payments Tab
    --      CASH_IN_BANK       → Bank Deposits (Debit = money going OUT to bank)
    -- ============================================================

    -- GL Receipts (credit transactions)
    SELECT
        COALESCE(SUM(mt.credit) FILTER (WHERE mat.type_code = 'STAFF_CBU'),         0),
        COALESCE(SUM(mt.credit) FILTER (WHERE mat.type_code = 'STAFF_PRINCIPAL'),    0),
        COALESCE(SUM(mt.credit) FILTER (WHERE mat.type_code = 'WTAX'),               0),
        COALESCE(SUM(mt.credit) FILTER (WHERE mat.type_code = 'OTHER_RECEIPTS'),     0),
        COALESCE(SUM(mt.credit) FILTER (WHERE mat.type_code = 'CASH_IN_BANK'),       0),
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id',          mt._id,
                    'accountName', ma.account_name,
                    'typeCode',    mat.type_code,
                    'typeName',    mat.type_name,
                    'debit',       COALESCE(mt.debit, 0),
                    'credit',      COALESCE(mt.credit, 0),
                    'remarks',     mt.remarks
                )
            ) FILTER (WHERE mt.transaction_type = 'credit'),
            '[]'::jsonb
        )
    INTO
        v_staff_cbu, v_staff_principal, v_wtax,
        v_other_receipts_gl, v_bank_withdrawal,
        v_rcpt_gl_detail
    FROM management_transactions mt
    JOIN management_accounts ma   ON ma._id  = mt.account_id
    JOIN management_account_types mat ON mat._id = ma.account_type_id
    WHERE mt.branch_id   = _branch_id
    AND mt.date_added::date = _selected_date
    AND mt.transaction_type = 'credit';

    -- GL Payments (debit transactions)
    SELECT
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'STAFF_LOAN_RELEASE'), 0),
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'MNGT_EXPENSES'),      0),
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'CBHB_DISBURSED'),     0),
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'REBATES'),            0),
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'OTHER_PAYMENTS'),     0),
        COALESCE(SUM(mt.debit) FILTER (WHERE mat.type_code = 'CASH_IN_BANK'),       0),
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id',          mt._id,
                    'accountName', ma.account_name,
                    'typeCode',    mat.type_code,
                    'typeName',    mat.type_name,
                    'debit',       COALESCE(mt.debit, 0),
                    'credit',      COALESCE(mt.credit, 0),
                    'remarks',     mt.remarks
                )
            ) FILTER (WHERE mt.transaction_type = 'debit'),
            '[]'::jsonb
        )
    INTO
        v_staff_loan_release, v_mngt_expenses,
        v_cbhb_disbursed, v_rebates, v_other_payments,
        v_bank_deposits,
        v_pay_gl_detail
    FROM management_transactions mt
    JOIN management_accounts ma   ON ma._id  = mt.account_id
    JOIN management_account_types mat ON mat._id = ma.account_type_id
    WHERE mt.branch_id   = _branch_id
    AND mt.date_added::date = _selected_date
    AND mt.transaction_type = 'debit';

    -- ============================================================
    -- 4. MCBU UNCLAIMED (In/Out)
    --    IN  = cashCollections with remarks 'offset-unclaimed' on this date
    --          that have NOT yet been claimed (no matching unclaimed_amount_transactions
    --          with status='claimed')
    --    OUT = unclaimed_amount_transactions with status='claimed' on this date
    --          (branch paid out a previously unclaimed amount today)
    -- ============================================================

    -- MCBU Unclaimed IN
    SELECT COALESCE(SUM(ABS(cc."mcbuReturnAmt") + ABS(cc."csfReturnAmt") - COALESCE(cc."paymentCollection", 0)), 0)
    INTO v_mcbu_unclaimed_in
    FROM "cashCollections" cc
    WHERE cc."branchId" = _branch_id
    AND cc."dateAdded"::date = _selected_date
    AND cc.remarks->>'value' = 'offset-unclaimed'
    AND (_lo_id IS NULL OR cc."loId" = _lo_id)
    AND NOT EXISTS (
        SELECT 1 FROM unclaimed_amount_transactions uat
        WHERE uat.cash_collection_id = cc._id
        AND uat.status = 'claimed'
    );

    -- MCBU Unclaimed OUT (paid out today)
    SELECT COALESCE(SUM(ABS(cc."mcbuReturnAmt") + ABS(cc."csfReturnAmt") - COALESCE(cc."paymentCollection", 0)), 0)
    INTO v_mcbu_unclaimed_out
    FROM unclaimed_amount_transactions uat
    JOIN "cashCollections" cc ON cc._id = uat.cash_collection_id
    WHERE uat.branch_id = _branch_id
    AND uat.modified_date::date = _selected_date
    AND uat.status = 'claimed'
    AND (_lo_id IS NULL OR cc."loId" = _lo_id);

    -- ============================================================
    -- 5. FUND TRANSFERS
    --    IN  = approved transfers where THIS branch is the receiver
    --    OUT = approved transfers where THIS branch is the giver
    --    Filter: status = 'approved' AND date matches
    -- ============================================================

    SELECT
        COALESCE(SUM(ft.amount) FILTER (WHERE ft."receiverBranchId" = _branch_id), 0),
        COALESCE(SUM(ft.amount) FILTER (WHERE ft."giverBranchId"    = _branch_id), 0)
    INTO v_ft_in, v_ft_out
    FROM "fund_transfer" ft
    WHERE (ft."giverBranchId" = _branch_id OR ft."receiverBranchId" = _branch_id)
    AND ft.status = 'approved'
    AND ft.deleted IS NOT TRUE
    AND (
        ft."approvedRejectedDate"::date = _selected_date
        OR ft."insertedDate"::date = _selected_date  -- fallback if approval date not set
    );

	-- =====================================================
	-- TRANSACTION VOUCHERS - W/TAX, EE & ER
	-- =====================================================

	SELECT COALESCE(SUM(dti.amount), 0)
	INTO v_wtax_transactions
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE dt.branch_id = _branch_id
	  AND dt.transaction_date::date = _selected_date
	  AND LOWER(TRIM(dti.category)) = 'management expenses'
	  AND TRIM(dti.code) = '055'
	  AND LOWER(TRIM(dti.account_title)) IN (
	      'employers contribution (er)',
	      'employers contribution (ee)',
	      'witheld tax'
	  );

	v_wtax := v_wtax + v_wtax_transactions;


	-- ============================================================
	-- TRANSACTION VOUCHERS - OTHER RECEIPTS
	-- ============================================================

	SELECT
	    COALESCE(SUM(dti.amount), 0)
	INTO
	    v_other_receipts_transactions
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE
	    dt.branch_id = _branch_id
	    AND dt.transaction_date::date = _selected_date
	    AND LOWER(TRIM(dti.category)) = 'other receipts'
		AND COALESCE(TRIM(dti.code), '') <> '036';

	v_other_receipts_gl :=
	    v_other_receipts_gl + v_other_receipts_transactions;

	-- =====================================================
	-- FUND TRANSFER FROM TRANSACTION VOUCHERS
	-- =====================================================

	SELECT COALESCE(SUM(dti.amount), 0)
	INTO v_fund_transfer_receipts
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE dt.branch_id = _branch_id
	  AND dt.transaction_date::date = _selected_date
	  AND LOWER(TRIM(dti.category)) = 'other receipts'
	  AND TRIM(dti.code) = '036';


	SELECT COALESCE(SUM(dti.amount), 0)
	INTO v_fund_transfer_payments
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE dt.branch_id = _branch_id
	  AND dt.transaction_date::date = _selected_date
	  AND LOWER(TRIM(dti.category)) = 'other payments'
	  AND TRIM(dti.code) = '036';

	-- ============================================================
	-- CONNECT TRANSACTION VOUCHERS TO DCS FUND TRANSFER
	-- ============================================================

	v_ft_in := v_ft_in + v_fund_transfer_receipts;
	v_ft_out := v_ft_out + v_fund_transfer_payments;

	-- ============================================================
	-- TRANSACTION VOUCHERS - MANAGEMENT EXPENSES
	-- ============================================================

	SELECT COALESCE(SUM(dti.amount), 0)
	INTO v_mngt_expenses_transactions
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE dt.branch_id = _branch_id
	  AND dt.transaction_date::date = _selected_date
	  AND LOWER(TRIM(dti.category)) = 'management expenses'

	  -- Exclude W/Tax, EE & ER items already handled separately
	  AND NOT (
	      TRIM(dti.code) = '055'
	      AND LOWER(TRIM(dti.account_title)) IN (
	          'employers contribution (er)',
	          'employers contribution (ee)',
	          'witheld tax'
	      )
	  );

	-- Add voucher expenses to existing GL Management Expenses
	v_mngt_expenses :=
	    COALESCE(v_mngt_expenses, 0)
	    + COALESCE(v_mngt_expenses_transactions, 0);

	-- ============================================
	-- TRANSACTION VOUCHERS - REBATES
	-- ============================================

		SELECT COALESCE(SUM(dti.amount), 0)
		INTO v_rebates_transactions
		FROM public.dcs_transaction_items dti
		INNER JOIN public.dcs_transactions dt
		    ON dt.id = dti.transaction_id
		WHERE dt.branch_id = _branch_id
		  AND dt.transaction_date::date = _selected_date
		  AND LOWER(TRIM(dti.category)) = 'other payments'
		  AND (
		      LOWER(TRIM(dti.account_title)) = 'rebates'
		      OR TRIM(dti.code) ~ '^045([^0-9]|$)'
		  );

		-- Add Transaction voucher Rebates to the existing GL Rebates
		v_rebates := COALESCE(v_rebates, 0)
		           + COALESCE(v_rebates_transactions, 0);
	-- ============================================================
	-- TRANSACTION VOUCHERS - CBHB DISBURSEMENTS
	-- ============================================================
	-- Connects the nine CBHB accounts from saved transaction
	-- vouchers to DCS Summary -> PAYMENTS -> CBHB Disbursed.
	--
	-- Includes:
	-- 1. Scholarship Grant Program
	-- 2. Medical Mission Program
	-- 3. Business Development Program
	-- 4. Disaster/Calamity Assistance
	-- 5. Financial Assistance for Disaster Victims
	-- 6. Client Hospitalization Benefits
	-- 7. ADD Hospitalization Benefits
	-- 8. Financial Assistance (Animal Bite)
	-- 9. Financial Assistance (Dental)
	-- ============================================================

	SELECT
	    COALESCE(SUM(dti.amount), 0)
	INTO
	    v_cbhb_transactions
	FROM public.dcs_transaction_items dti
	INNER JOIN public.dcs_transactions dt
	    ON dt.id = dti.transaction_id
	WHERE
	    dt.branch_id = _branch_id
	    AND dt.transaction_date::date = _selected_date

	    -- Only saved Other Payments transactions
	    AND LOWER(TRIM(dti.category)) = 'other payments'

	    -- Match CBHB account titles
	    AND LOWER(TRIM(dti.account_title)) IN (
	        'scholarship grant program',
	        'medical mission program (health care)',
	        'business development program',
	        'calamity benefits: (relief & disaster assistance)',
	        'financial assistance for calamity/disaster victim',
	        'client hospitalization & beneficiary (c.b.h.b)',
	        'add hospitalization & health benefits (additional beneficiaries)',
	        'financial assistance (animal bite)',
	        'financial assistance (dental)'
	    );

	-- Add saved CBHB vouchers to existing GL CBHB disbursements
	v_cbhb_disbursed :=
	    COALESCE(v_cbhb_disbursed, 0)
	    + COALESCE(v_cbhb_transactions, 0);

    -- ============================================================
    -- 6. COMPUTE TOTALS
    -- ============================================================

    v_total_receipts :=
        v_mcbu + v_csf +
        v_loan_daily + v_loan_weekly +
        v_admission + v_lrf + v_cbhb + v_add_hospi +
        v_passbook + v_csf_in +
        v_picture +
        v_staff_cbu + v_staff_principal +
        v_wtax +
        v_mcbu_unclaimed_in +
        v_other_receipts_gl +
        v_ft_in +
        v_bank_withdrawal;

    v_total_payments :=
        v_loan_release_amount +
        v_mcbu_wd + v_csf_wd +
        v_mcbu_ret + v_csf_ret +
        v_staff_loan_release +
        v_mngt_expenses +
        v_cbhb_disbursed +
        v_mcbu_unclaimed_out +
        v_rebates +
        v_other_payments +
        v_ft_out +
        v_bank_deposits;



    v_closing_balance := v_beginning_balance + v_total_receipts - v_total_payments;

    -- ============================================================
    -- 7. RETURN RESULT
    -- ============================================================
    RETURN QUERY
    WITH loan_release_lo AS (
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'loId',          lo_grp."loId",
                        'loName',        CONCAT(u."firstName", ' ', u."lastName"),
                        'loNo',          u."loNo",
                        'noClients',     lo_grp.no_clients,
                        'releaseAmount', lo_grp.release_amount
                    )
                    ORDER BY u."loNo"
                ),
                '[]'::jsonb
            ) AS lo_releases
        FROM (
            SELECT cc."loId",
                COUNT(*)::integer               AS no_clients,
                SUM(cc."currentReleaseAmount")  AS release_amount
            FROM "cashCollections" cc
            WHERE cc."branchId" = _branch_id
            AND cc."dateAdded"::date = _selected_date
            AND cc.status = 'tomorrow'
            AND cc.transfer IS NOT TRUE
            AND (_lo_id IS NULL OR cc."loId" = _lo_id)
            GROUP BY cc."loId"
            HAVING SUM(cc."currentReleaseAmount") > 0
        ) lo_grp
        JOIN users u ON u._id = lo_grp."loId"
    ),
    -- Pre-aggregate denomination per LO (SUM cannot be nested inside jsonb_agg)
    denom_agg AS (
        SELECT
            d.lo_id,
            CONCAT(u."firstName", ' ', u."lastName")  AS lo_name,
            u."loNo"                                    AS lo_no,
            COALESCE(SUM(d.morning_remittance),   0)    AS morning_remittance,
            COALESCE(SUM(d.afternoon_remittance), 0)    AS afternoon_remittance,
            COALESCE(SUM(d.total_net_collection), 0)    AS total_net_collection,
            COALESCE(SUM(d.bcc_vs_remittances),   0)    AS bcc_vs_remittances,
            MAX(d.status)                               AS status
        FROM denomination d
        JOIN users u ON u._id = d.lo_id
        WHERE d.branch_id = _branch_id
        AND   d.date_added  = _selected_date
        AND   (_lo_id IS NULL OR d.lo_id = _lo_id)
        GROUP BY d.lo_id, u."firstName", u."lastName", u."loNo"
    ),
    denom_lo AS (
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'loId',                da.lo_id,
                        'loName',              da.lo_name,
                        'loNo',                da.lo_no,
                        'morningRemittance',   da.morning_remittance,
                        'afternoonRemittance', da.afternoon_remittance,
                        'totalNetCollection',  da.total_net_collection,
                        'bccVsRemittances',    da.bcc_vs_remittances,
                        'status',              da.status
                    )
                    ORDER BY da.lo_no
                ),
                '[]'::jsonb
            ) AS denom_rows
        FROM denom_agg da
    )
    SELECT
        -- Beginning Balance
        v_beginning_balance,
        -- RECEIPTS Dashboard
        v_mcbu,
        v_csf,
        v_loan_daily,
        v_loan_weekly,
        v_admission,
        v_lrf,
        v_cbhb,
        v_add_hospi,
        v_passbook,
        v_other_income,
        v_csf_in,
        v_picture,
        -- RECEIPTS GL
        v_staff_cbu,
        v_staff_principal,
        v_wtax,
        v_other_receipts_gl,
        v_rcpt_gl_detail,
        -- RECEIPTS Unclaimed / FT / Bank
        v_mcbu_unclaimed_in,
        v_ft_in,
        v_bank_withdrawal,
        -- Total Receipts
        v_total_receipts,
        -- PAYMENTS Dashboard
        v_loan_release_no,
        v_loan_release_amount,
        v_mcbu_wd,
        v_csf_wd,
        v_mcbu_ret,
        v_csf_ret,
        -- PAYMENTS GL
        v_staff_loan_release,
        v_mngt_expenses,
        v_cbhb_disbursed,
        v_rebates,
        v_other_payments,
        v_pay_gl_detail,
        -- PAYMENTS Unclaimed / FT / Bank
        v_mcbu_unclaimed_out,
        v_ft_out,
        v_bank_deposits,
        -- Total Payments
        v_total_payments,
        -- Closing Balance
        v_closing_balance,
        -- Loan Release per LO
        (SELECT lo_releases FROM loan_release_lo),
        -- Denomination summary per LO
        (SELECT denom_rows FROM denom_lo);
END;
$function$;