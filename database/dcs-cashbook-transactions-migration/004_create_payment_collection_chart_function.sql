CREATE OR REPLACE FUNCTION public.fn_get_payment_collection_chart(
    p_start_date date,
    p_end_date date,
    p_division_id text DEFAULT NULL,
    p_region_id text DEFAULT NULL,
    p_area_id text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_lo_id text DEFAULT NULL
)
RETURNS TABLE (
    report_date date,
    "newMember" numeric,
    "totalReloaner" numeric,
    "mcbuWithdrawals" numeric,
    "csfWithdrawals" numeric,
    "mcbuReturnPerson" numeric,
    "mcbuCsfReturnAmount" numeric,
    "mcbuInterest" numeric,
    "fullyPaymentPerson" numeric,
    "fullyPaymentAmount" numeric
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        d.report_date::date,

        COALESCE(t."currentReleasePerson_New", 0)::numeric,
        COALESCE(t."currentReleasePerson_Rel", 0)::numeric,

        COALESCE(t."mcbuWithdrawal", 0)::numeric,
        COALESCE(t."csfWithdrawal", 0)::numeric,

        COALESCE(t."mcbuReturnNo", 0)::numeric,

        (
            COALESCE(t."mcbuReturn", 0) +
            COALESCE(t."csfReturnAmt", 0)
        )::numeric,

        COALESCE(t."mcbuInterest", 0)::numeric,

        COALESCE(t."fullPaymentPerson", 0)::numeric,
        COALESCE(t."fullPaymentAmount", 0)::numeric

    FROM generate_series(
        p_start_date,
        p_end_date,
        INTERVAL '1 day'
    ) AS d(report_date)

    LEFT JOIN LATERAL (
        SELECT *
        FROM public.fn_get_cash_collection_with_filter_v3(
            'all',
            '_total',
            d.report_date::date,
            d.report_date::date,
            p_lo_id,
            NULL,
            p_branch_id,
            p_area_id,
            p_division_id,
            p_region_id
        )
    ) AS t ON TRUE;
$$;