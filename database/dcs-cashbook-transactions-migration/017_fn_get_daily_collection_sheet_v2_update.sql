-- DROP FUNCTION public.fn_get_daily_collection_sheet_v2(text, text, date);

CREATE OR REPLACE FUNCTION public.fn_get_daily_collection_sheet_v2(_branch_id text, _lo_id text, _selected_date date)
 RETURNS TABLE(row_no integer, lo_id text, lo_name text, group_id text, group_name text, mcbu_target numeric, mcbu_actual numeric, csf_collection numeric, regular_loan_target numeric, regular_loan_advance numeric, regular_loan_actual numeric, other_loan_target numeric, other_loan_advance numeric, other_loan_actual numeric, admission_no integer, admission_amount numeric, lrf_collection numeric, cbhb_no integer, cbhb_amount numeric, add_hospitalization numeric, other_income numeric, total_collection numeric, mcbu_withdrawal numeric, mcbu_return_no integer, mcbu_return_amount numeric, csf_withdrawal numeric, csf_return_no integer, csf_return_amount numeric, net_collection numeric, renewal_no integer, renewal_amount numeric, offset_no integer, offset_amount numeric, full_payment_clients integer, other_loan_weekly_fp numeric, active_clients integer, active_borrowers integer, total_loan_balance numeric, mcbu_balance numeric, csf_balance numeric, past_due_no integer, past_due_amount numeric, mispay_count integer, pending_clients integer, transfer_clients integer, current_release_new integer, current_release_rel integer, current_release_amount numeric, morning_remittance numeric, afternoon_remittance numeric, denom_net_collection numeric, data jsonb)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH lo_data AS (
        SELECT
            u._id as lo_id,
            CONCAT(u."firstName", ' ', u."lastName") as lo_name,
            u."loNo",
            u."designatedBranchId" as branch_id
        FROM users u
        WHERE (_branch_id IS NULL OR u."designatedBranchId" = _branch_id)
        AND u.role->>'rep' = '4'
        AND CASE WHEN _lo_id IS NOT NULL THEN u._id = _lo_id ELSE TRUE END
        ORDER BY u."loNo"
    ),
    collection_data AS (
        SELECT
            cc."loId",
            cc."groupId",
            g.name as group_name,
            -- MCBU
            SUM(CASE
                WHEN cc.occurence = 'weekly' AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
                THEN COALESCE(cc."mcbuTarget"::numeric, 0)
                ELSE 0
            END) as mcbu_target,
            SUM(COALESCE(cc."mcbuCol", 0)) as mcbu_actual,
            -- CSF Collection
            SUM(COALESCE(cc."csfCollection", 0)) as csf_collection,
            -- Regular Loan (Daily/60 Days)
            SUM(CASE
                WHEN cc.occurence = 'daily' AND l.status != 'pending' AND cc.status != 'pending' AND cc.transfer IS NOT TRUE
                THEN CASE
                    WHEN cc."activeLoan" = 0 AND cc."fullPaymentDate" = cc."dateAdded"
                    THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
                    WHEN cc.remarks->>'value' IN ('delinquent', 'delinquent-mcbu', 'excused advance payment')
                         OR cc.remarks->>'value' LIKE 'excused-%' THEN 0
                    WHEN cc.status != 'tomorrow' THEN cc."activeLoan"
                    WHEN cc.status = 'tomorrow' AND cc."activeLoan" > 0
                    THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
                    ELSE 0
                END
                ELSE 0
            END) as regular_loan_target,
            SUM(CASE WHEN cc.occurence = 'daily' THEN COALESCE(cc.excess, 0) ELSE 0 END) as regular_loan_advance,
            SUM(CASE WHEN cc.occurence = 'daily' THEN COALESCE(cc."paymentCollection", 0) ELSE 0 END) as regular_loan_actual,
            -- Other Loan (Weekly)
            SUM(CASE
                WHEN cc.occurence = 'weekly'
				     AND l."loanTerms" = 24
				     AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
                     AND l.status != 'pending' AND cc.status != 'pending' AND cc.transfer IS NOT TRUE
                THEN CASE
                    WHEN cc."activeLoan" = 0 AND cc."fullPaymentDate" = cc."dateAdded"
                    THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
                    WHEN cc.remarks->>'value' IN ('delinquent', 'delinquent-mcbu', 'excused advance payment')
                         OR cc.remarks->>'value' LIKE 'excused-%' THEN 0
                    WHEN cc.status != 'tomorrow' THEN cc."activeLoan"
                    WHEN cc.status = 'tomorrow' AND cc."activeLoan" > 0
                    THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
                    ELSE 0
                END
                ELSE 0
            END) as other_loan_target,
            SUM(CASE
                WHEN cc.occurence = 'weekly'
			     AND l."loanTerms" = 24
			     AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
                THEN COALESCE(cc.excess, 0)
                ELSE 0
            END) as other_loan_advance,
            SUM(
			    CASE
			        WHEN cc.occurence = 'weekly'
			             AND l."loanTerms" = 24
			        THEN COALESCE(cc."paymentCollection", 0)
			        ELSE 0
			    END
			) AS other_loan_actual,
			-- =====================================================
			-- WEEKLY (12 WEEKS)
			-- =====================================================
			
			-- Target
			SUM(
			    CASE
			        WHEN cc.occurence = 'weekly'
			             AND l."loanTerms" = 12
			             AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
			             AND l.status != 'pending'
			             AND cc.status != 'pending'
			             AND cc.transfer IS NOT TRUE
			        THEN
			            CASE
			                WHEN cc."activeLoan" = 0
			                     AND cc."fullPaymentDate" = cc."dateAdded"
			                THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
			
			                WHEN cc.remarks->>'value' IN (
			                    'delinquent',
			                    'delinquent-mcbu',
			                    'excused advance payment'
			                )
			                OR cc.remarks->>'value' LIKE 'excused-%'
			                THEN 0
			
			                WHEN cc.status != 'tomorrow'
			                THEN COALESCE(cc."activeLoan", 0)
			
			                WHEN cc.status = 'tomorrow'
			                     AND cc."activeLoan" > 0
			                THEN COALESCE(cc.history->>'activeLoan', '0')::numeric
			
			                ELSE 0
			            END
			        ELSE 0
			    END
			) AS weekly12_target,
			
			-- Advance
			SUM(
			    CASE
			        WHEN cc.occurence = 'weekly'
			             AND l."loanTerms" = 12
			             AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
			        THEN COALESCE(cc.excess, 0)
			        ELSE 0
			    END
			) AS weekly12_advance,
			
			-- Actual
			SUM(
			    CASE
			        WHEN cc.occurence = 'weekly'
			             AND l."loanTerms" = 12
			        THEN COALESCE(cc."paymentCollection", 0)
			        ELSE 0
			    END
			) AS weekly12_actual,
            -- Admission Fee
            SUM(CASE
                WHEN cc.status = 'tomorrow' AND cc.transfer IS NOT TRUE AND cc."loanCycle" = 1
                THEN 1 ELSE 0
            END)::integer as admission_no,
            SUM(COALESCE(cc."admissionCollection", 0)) as admission_collection,
            -- LRF
            SUM(COALESCE(cc."lrfCollection", 0)) as lrf_collection,
            -- CBHB Collection
            SUM(COALESCE(cc."cbhbCollection", 0)) as cbhb_collection,
            -- Additional Hospitalization
            SUM(COALESCE(cc."addHospitalization", 0)) as add_hospitalization,
            -- Other Income
            SUM(COALESCE(cc."otherPassbookCollection", 0) + COALESCE(cc."otherPictureCollection", 0)) as other_income,
            -- MCBU Withdrawal
            SUM(COALESCE(cc."mcbuWithdrawal", 0)) as mcbu_withdrawal,
            -- MCBU Return
            SUM(CASE WHEN cc.remarks->>'value' LIKE 'offset%' THEN 1 ELSE 0 END)::integer as mcbu_return_no,
            SUM(COALESCE(cc."mcbuReturnAmt", 0)) as mcbu_return_amount,
            -- CSF Withdrawal
            SUM(COALESCE(cc."csfWithdrawal", 0)) as csf_withdrawal,
            -- CSF Return
            SUM(CASE WHEN cc."csfReturnAmt" > 0 THEN 1 ELSE 0 END)::integer as csf_return_no,
            SUM(COALESCE(cc."csfReturnAmt", 0)) as csf_return_amount,
            -- Full Payment - Renewal (Regular)
            SUM(CASE
                WHEN cc."fullPaymentDate" = cc."dateAdded" AND cc.occurence = 'daily'
                THEN 1 ELSE 0
            END)::integer as renewal_no,
            SUM(CASE
                WHEN cc."fullPaymentDate" = cc."dateAdded" AND cc.occurence = 'daily'
                THEN COALESCE(cc."fullPayment", 0) ELSE 0
            END) as renewal_amount,
            -- Full Payment - Offset (Regular)
            SUM(CASE
                WHEN cc.remarks->>'value' LIKE 'offset%'
                THEN 1 ELSE 0
            END)::integer as offset_no,
            SUM(COALESCE(cc."mcbuReturnAmt", 0)) as offset_amount,
            -- Full Payment - No. of Clients
            SUM(CASE WHEN cc."fullPaymentDate" = cc."dateAdded" THEN 1 ELSE 0 END)::integer as full_payment_clients,
            -- Other Loan Weekly Full Payment
            SUM(CASE
                WHEN cc."fullPaymentDate" = cc."dateAdded" AND cc.occurence = 'weekly'
                     AND cc."groupDay" = LOWER(TO_CHAR(cc."dateAdded", 'FMDay'))
                THEN COALESCE(cc."fullPayment", 0) ELSE 0
            END) as other_loan_weekly_fp,
            -- Summary fields
            SUM(CASE
                WHEN cc.status != 'pending' AND cc.status != 'closed' THEN 1
                WHEN cc.status = 'pending' AND cc."loanCycle" > 1 THEN 1
                ELSE 0
            END)::integer as active_clients,
            SUM(CASE
                WHEN cc.status != 'pending' AND cc."loanBalance" > 0 THEN 1
                WHEN cc.status != 'pending' AND cc.status = 'tomorrow'
                     AND (cc."loanBalance" = 0 OR cc."loanBalance" IS NULL) THEN 1
                ELSE 0
            END)::integer as active_borrowers,
            SUM(CASE
                WHEN cc.status = 'tomorrow' AND cc.transfer IS NOT TRUE THEN cc."currentReleaseAmount"
                WHEN cc.status != 'pending' AND cc.status != 'tomorrow' THEN cc."loanBalance"
                ELSE 0
            END) as total_loan_balance,
            SUM(COALESCE(cc.mcbu, 0)) as mcbu_balance,
            SUM(COALESCE(cc.csf, 0)) as csf_balance,
            SUM(CASE WHEN cc."pastDue" > 0 THEN 1 ELSE 0 END)::integer as past_due_no,
            SUM(COALESCE(cc."pastDue", 0)) as past_due_amount,
            SUM(CASE WHEN cc."mispayment" IS TRUE THEN 1 ELSE 0 END)::integer as mispay_count,
            SUM(CASE WHEN cc.status IN ('completed') AND cc.transferred IS NOT TRUE THEN 1 ELSE 0 END)::integer as pending_clients,
            SUM(CASE WHEN cc.transfer = TRUE THEN 1 ELSE 0 END)::integer as transfer_clients,
            
			-- Current Release (Existing: New / Repeat)
            SUM(CASE
                WHEN cc.status = 'tomorrow'
                     AND cc.transfer IS NOT TRUE
                     AND cc."loanCycle" = 1
                THEN 1 ELSE 0
            END)::integer AS current_release_new,

            SUM(CASE
                WHEN cc.status = 'tomorrow'
                     AND cc.transfer IS NOT TRUE
                     AND cc."loanCycle" > 1
                THEN 1 ELSE 0
            END)::integer AS current_release_rel,

            SUM(CASE
                WHEN cc.status = 'tomorrow'
                     AND cc.transfer IS NOT TRUE
                THEN COALESCE(cc."currentReleaseAmount", 0)
                ELSE 0
            END) AS current_release_amount,

            -- Release Without Service Charge
			-- Combined principal amount for 60 Days, 24 Weeks, and 12 Weeks
			COALESCE(
			    SUM(
			        CASE
			            WHEN cc.status = 'tomorrow'
			                 AND cc.transfer IS NOT TRUE
			                 AND cc.transferred IS NOT TRUE
			                 AND l."principalLoan" > 0
			                 AND l."loanTerms" IN (12, 24, 60)
			            THEN l."principalLoan"
			            ELSE 0
			        END
			    ),
			    0
			) AS release_without_sc
        FROM "cashCollections" cc
        INNER JOIN loans l ON l._id = cc."loanId"
        LEFT JOIN groups g ON g._id = cc."groupId"
        WHERE (_branch_id IS NULL OR cc."branchId" = _branch_id)
        AND cc."dateAdded"::date = _selected_date
        AND cc.status != 'reject'
        AND CASE WHEN _lo_id IS NOT NULL THEN cc."loId" = _lo_id ELSE TRUE END
        GROUP BY cc."loId", cc."groupId", g.name
    ),
    denom_data AS (
        SELECT
            d.lo_id,
            SUM(COALESCE(d.morning_remittance, 0)) as morning_remittance,
            SUM(COALESCE(d.afternoon_remittance, 0)) as afternoon_remittance,
            SUM(COALESCE(d.total_net_collection, 0)) as denom_net_collection
        FROM denomination d
        WHERE (_branch_id IS NULL OR d.branch_id = _branch_id)
        AND d.date_added = _selected_date
        AND CASE WHEN _lo_id IS NOT NULL THEN d.lo_id = _lo_id ELSE TRUE END
        GROUP BY d.lo_id
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY ld."loNo", cd.group_name)::integer as row_no,
        ld.lo_id::text,
        ld.lo_name::text,
        cd."groupId"::text as group_id,
        COALESCE(cd.group_name, '-')::text as group_name,
        -- MCBU
        COALESCE(cd.mcbu_target, 0)::numeric,
        COALESCE(cd.mcbu_actual, 0)::numeric,
        -- CSF Collection
        COALESCE(cd.csf_collection, 0)::numeric,
        -- Regular Loan
        COALESCE(cd.regular_loan_target, 0)::numeric,
        COALESCE(cd.regular_loan_advance, 0)::numeric,
        COALESCE(cd.regular_loan_actual, 0)::numeric,
        -- Other Loan
        COALESCE(cd.other_loan_target, 0)::numeric,
        COALESCE(cd.other_loan_advance, 0)::numeric,
        COALESCE(cd.other_loan_actual, 0)::numeric,
        -- Admission
        COALESCE(cd.admission_no, 0)::integer,
        COALESCE(cd.admission_collection, 0)::numeric,
        -- LRF
        COALESCE(cd.lrf_collection, 0)::numeric,
        -- CBHB
        COALESCE(cd.admission_no, 0)::integer as cbhb_no,
        COALESCE(cd.cbhb_collection, 0)::numeric,
        -- Add Hospitalization
        COALESCE(cd.add_hospitalization, 0)::numeric,
        -- Other Income
        COALESCE(cd.other_income, 0)::numeric,
        -- Total Collection (includes CSF)
        (COALESCE(cd.mcbu_actual, 0) +
         COALESCE(cd.csf_collection, 0) +
         COALESCE(cd.regular_loan_actual, 0) +
         COALESCE(cd.other_loan_actual, 0) +
         COALESCE(cd.admission_collection, 0) +
         COALESCE(cd.lrf_collection, 0) +
         COALESCE(cd.cbhb_collection, 0) +
         COALESCE(cd.add_hospitalization, 0) +
         COALESCE(cd.other_income, 0))::numeric as total_collection,
        -- MCBU Less Returns
        COALESCE(cd.mcbu_withdrawal, 0)::numeric,
        COALESCE(cd.mcbu_return_no, 0)::integer,
        COALESCE(cd.mcbu_return_amount, 0)::numeric,
        -- CSF Less Returns
        COALESCE(cd.csf_withdrawal, 0)::numeric,
        COALESCE(cd.csf_return_no, 0)::integer,
        COALESCE(cd.csf_return_amount, 0)::numeric,
        -- Net Collection (CSF included, CSF withdrawals/returns deducted)
        (COALESCE(cd.mcbu_actual, 0) +
         COALESCE(cd.csf_collection, 0) +
         COALESCE(cd.regular_loan_actual, 0) +
         COALESCE(cd.other_loan_actual, 0) +
         COALESCE(cd.admission_collection, 0) +
         COALESCE(cd.lrf_collection, 0) +
         COALESCE(cd.cbhb_collection, 0) +
         COALESCE(cd.add_hospitalization, 0) +
         COALESCE(cd.other_income, 0) -
         COALESCE(cd.mcbu_withdrawal, 0) -
         COALESCE(cd.mcbu_return_amount, 0) -
         COALESCE(cd.csf_withdrawal, 0) -
         COALESCE(cd.csf_return_amount, 0))::numeric as net_collection,
        -- Full Payment Info
        COALESCE(cd.renewal_no, 0)::integer,
        COALESCE(cd.renewal_amount, 0)::numeric,
        COALESCE(cd.offset_no, 0)::integer,
        COALESCE(cd.offset_amount, 0)::numeric,
        COALESCE(cd.full_payment_clients, 0)::integer,
        COALESCE(cd.other_loan_weekly_fp, 0)::numeric,
        -- Summary
        COALESCE(cd.active_clients, 0)::integer,
        COALESCE(cd.active_borrowers, 0)::integer,
        COALESCE(cd.total_loan_balance, 0)::numeric,
        COALESCE(cd.mcbu_balance, 0)::numeric,
        COALESCE(cd.csf_balance, 0)::numeric,
        COALESCE(cd.past_due_no, 0)::integer,
        COALESCE(cd.past_due_amount, 0)::numeric,
        COALESCE(cd.mispay_count, 0)::integer,
        COALESCE(cd.pending_clients, 0)::integer,
        COALESCE(cd.transfer_clients, 0)::integer,
        -- Current Release
        COALESCE(cd.current_release_new, 0)::integer,
        COALESCE(cd.current_release_rel, 0)::integer,
        COALESCE(cd.current_release_amount, 0)::numeric,
        -- Denomination per LO
        COALESCE(dd.morning_remittance, 0)::numeric,
        COALESCE(dd.afternoon_remittance, 0)::numeric,
        COALESCE(dd.denom_net_collection, 0)::numeric,
        -- JSONB data
        jsonb_build_object(
            'loId', ld.lo_id,
            'loName', ld.lo_name,
            'groupId', cd."groupId",
            'groupName', cd.group_name,

            -- Release Without Service Charge
			'releaseWithoutSC', COALESCE(cd.release_without_sc, 0),
            'mcbuTarget', COALESCE(cd.mcbu_target, 0),
            'mcbuActual', COALESCE(cd.mcbu_actual, 0),
            'csfCollection', COALESCE(cd.csf_collection, 0),
            'regularLoanTarget', COALESCE(cd.regular_loan_target, 0),
            'regularLoanAdvance', COALESCE(cd.regular_loan_advance, 0),
            'regularLoanActual', COALESCE(cd.regular_loan_actual, 0),
            'otherLoanTarget', COALESCE(cd.other_loan_target, 0),
            'otherLoanAdvance', COALESCE(cd.other_loan_advance, 0),
            'otherLoanActual', COALESCE(cd.other_loan_actual, 0),
			-- Weekly (12 Weeks)
			'weekly12Target', COALESCE(cd.weekly12_target, 0),
			'weekly12Advance', COALESCE(cd.weekly12_advance, 0),
			'weekly12Actual', COALESCE(cd.weekly12_actual, 0),
            'admissionNo', COALESCE(cd.admission_no, 0),
            'admissionAmount', COALESCE(cd.admission_collection, 0),
            'lrfCollection', COALESCE(cd.lrf_collection, 0),
            'cbhbNo', COALESCE(cd.admission_no, 0),
            'cbhbAmount', COALESCE(cd.cbhb_collection, 0),
            'addHospitalization', COALESCE(cd.add_hospitalization, 0),
            'otherIncome', COALESCE(cd.other_income, 0),
            'mcbuWithdrawal', COALESCE(cd.mcbu_withdrawal, 0),
            'mcbuReturnNo', COALESCE(cd.mcbu_return_no, 0),
            'mcbuReturnAmount', COALESCE(cd.mcbu_return_amount, 0),
            'csfWithdrawal', COALESCE(cd.csf_withdrawal, 0),
            'csfReturnNo', COALESCE(cd.csf_return_no, 0),
            'csfReturnAmount', COALESCE(cd.csf_return_amount, 0),
            'renewalNo', COALESCE(cd.renewal_no, 0),
            'renewalAmount', COALESCE(cd.renewal_amount, 0),
            'offsetNo', COALESCE(cd.offset_no, 0),
            'offsetAmount', COALESCE(cd.offset_amount, 0),
            'fullPaymentClients', COALESCE(cd.full_payment_clients, 0),
            'activeClients', COALESCE(cd.active_clients, 0),
            'activeBorrowers', COALESCE(cd.active_borrowers, 0),
            'totalLoanBalance', COALESCE(cd.total_loan_balance, 0),
            'mcbuBalance', COALESCE(cd.mcbu_balance, 0),
            'csfBalance', COALESCE(cd.csf_balance, 0),
            'pastDueNo', COALESCE(cd.past_due_no, 0),
            'pastDueAmount', COALESCE(cd.past_due_amount, 0),
            'mispayCount', COALESCE(cd.mispay_count, 0),
            'pendingClients', COALESCE(cd.pending_clients, 0),
            'transferClients', COALESCE(cd.transfer_clients, 0),
            'morningRemittance', COALESCE(dd.morning_remittance, 0),
            'afternoonRemittance', COALESCE(dd.afternoon_remittance, 0),
            'denomNetCollection', COALESCE(dd.denom_net_collection, 0)
        ) as data
    FROM lo_data ld
    LEFT JOIN collection_data cd ON cd."loId" = ld.lo_id
    LEFT JOIN denom_data dd ON dd.lo_id = ld.lo_id
    WHERE cd."loId" IS NOT NULL
    ORDER BY ld."loNo", cd.group_name;
END;
$function$
;
