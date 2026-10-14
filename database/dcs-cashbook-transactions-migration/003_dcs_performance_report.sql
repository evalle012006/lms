-- ============================================================
-- MIGRATION 003: DCS PERFORMANCE REPORT
-- ============================================================
-- Daily              = 60-day repayment
-- Weekly Standard    = 24-week repayment
-- Weekly Accelerated = 12-week repayment
-- Consolidated       = Daily + Weekly + Accelerated
--
-- This migration does not modify existing tables or functions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_dcs_performance_report(
    p_report_date date,
    p_division_id text DEFAULT NULL,
    p_region_id text DEFAULT NULL,
    p_area_id text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_lo_id text DEFAULT NULL
)
RETURNS TABLE (
    category text,
    "activeClients" numeric,
    mcbu numeric,
    csf numeric,
    "totalLoanRelease" numeric,
    "totalLoanBalance" numeric,
    "activeBorrowers" numeric,
    "pastDuePerson" numeric,
    "pastDueMcbu" numeric,
    "pastDueLoanRelease" numeric,
    "pastDueLoanBalance" numeric,
    "pastDueNetRisk" numeric,
    "noOfExcuses" numeric,
    "excusesMcbu" numeric,
    "excusesLoanRelease" numeric,
    "excusesLoanBalance" numeric,
    "netLoanBalance" numeric
)
LANGUAGE sql
STABLE
AS $$
WITH classified_collections AS (
    SELECT
        CASE
            WHEN u."transactionType" = 'daily'
                THEN 'daily'

            WHEN u."transactionType" = 'weekly'
                 AND u."weeklyScheduleType" = 'standard'
                THEN 'weekly'

            WHEN u."transactionType" = 'weekly'
                 AND u."weeklyScheduleType" = 'accelerated'
                THEN 'accelerated'

            ELSE 'unclassified'
        END AS dcs_category,

        cc.status,
        cc.mcbu,
        cc.csf,
        cc."loanRelease",
        cc."loanBalance",
        cc."loanCycle",
        cc."pastDue",
        cc."activeLoan",
        cc.remarks,
        cc.excused

    FROM public."cashCollections" cc

    INNER JOIN public."users" u
        ON u."_id" = cc."loId"

    INNER JOIN public."branches" b
        ON b."_id" = cc."branchId"

    WHERE
        cc."dateAdded" = p_report_date

        AND cc.status IS DISTINCT FROM 'reject'

        AND cc.transferred IS NOT TRUE

        AND (
            p_division_id IS NULL
            OR b."divisionId" = p_division_id
        )

        AND (
            p_region_id IS NULL
            OR b."regionId" = p_region_id
        )

        AND (
            p_area_id IS NULL
            OR b."areaId" = p_area_id
        )

        AND (
            p_branch_id IS NULL
            OR b."_id" = p_branch_id
        )

        AND (
            p_lo_id IS NULL
            OR cc."loId" = p_lo_id
        )
),

category_totals AS (
    SELECT
        dcs_category AS category,

        SUM(
            CASE
                WHEN status NOT IN ('pending', 'closed')
                    THEN 1
                WHEN status = 'pending'
                     AND "loanCycle" > 1
                    THEN 1
                ELSE 0
            END
        )::numeric AS "activeClients",

        COALESCE(SUM(mcbu), 0)::numeric AS mcbu,

        COALESCE(SUM(csf), 0)::numeric AS csf,

        COALESCE(
            SUM(
                CASE
                    WHEN status NOT IN ('pending', 'tomorrow')
                        THEN "loanRelease"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "totalLoanRelease",

        COALESCE(
            SUM(
                CASE
                    WHEN status NOT IN ('pending', 'tomorrow')
                        THEN "loanBalance"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "totalLoanBalance",

        SUM(
            CASE
                WHEN status <> 'pending'
                     AND "loanBalance" > 0
                    THEN 1

                WHEN status = 'tomorrow'
                     AND COALESCE("loanBalance", 0) = 0
                    THEN 1

                ELSE 0
            END
        )::numeric AS "activeBorrowers",

        SUM(
            CASE
                WHEN COALESCE("pastDue", 0) > 0
                    THEN 1
                ELSE 0
            END
        )::numeric AS "pastDuePerson",

        COALESCE(
            SUM(
                CASE
                    WHEN COALESCE("pastDue", 0) > 0
                        THEN mcbu
                    ELSE 0
                END
            ),
            0
        )::numeric AS "pastDueMcbu",

        COALESCE(
            SUM(
                CASE
                    WHEN COALESCE("pastDue", 0) > 0
                        THEN "loanRelease"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "pastDueLoanRelease",

        COALESCE(
            SUM(
                CASE
                    WHEN COALESCE("pastDue", 0) > 0
                        THEN "loanBalance"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "pastDueLoanBalance",

        SUM(
            CASE
                WHEN
                    remarks->>'value' LIKE 'excused-%'
                    OR remarks->>'value' = 'excused advance payment'
                    OR excused IS TRUE
                THEN 1
                ELSE 0
            END
        )::numeric AS "noOfExcuses",

        COALESCE(
            SUM(
                CASE
                    WHEN
                        remarks->>'value' LIKE 'excused-%'
                        OR remarks->>'value' = 'excused advance payment'
                        OR excused IS TRUE
                    THEN mcbu
                    ELSE 0
                END
            ),
            0
        )::numeric AS "excusesMcbu",

        COALESCE(
            SUM(
                CASE
                    WHEN
                        remarks->>'value' LIKE 'excused-%'
                        OR remarks->>'value' = 'excused advance payment'
                        OR excused IS TRUE
                    THEN "loanRelease"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "excusesLoanRelease",

        COALESCE(
            SUM(
                CASE
                    WHEN
                        remarks->>'value' LIKE 'excused-%'
                        OR remarks->>'value' = 'excused advance payment'
                        OR excused IS TRUE
                    THEN "loanBalance"
                    ELSE 0
                END
            ),
            0
        )::numeric AS "excusesLoanBalance"

    FROM classified_collections

    WHERE dcs_category IN (
        'daily',
        'weekly',
        'accelerated'
    )

    GROUP BY dcs_category
),

categories AS (
    SELECT 'daily'::text AS category
    UNION ALL
    SELECT 'weekly'::text
    UNION ALL
    SELECT 'accelerated'::text
),

complete_totals AS (
    SELECT
        c.category,

        COALESCE(t."activeClients", 0) AS "activeClients",
        COALESCE(t.mcbu, 0) AS mcbu,
        COALESCE(t.csf, 0) AS csf,
        COALESCE(t."totalLoanRelease", 0) AS "totalLoanRelease",
        COALESCE(t."totalLoanBalance", 0) AS "totalLoanBalance",
        COALESCE(t."activeBorrowers", 0) AS "activeBorrowers",
        COALESCE(t."pastDuePerson", 0) AS "pastDuePerson",
        COALESCE(t."pastDueMcbu", 0) AS "pastDueMcbu",
        COALESCE(t."pastDueLoanRelease", 0) AS "pastDueLoanRelease",
        COALESCE(t."pastDueLoanBalance", 0) AS "pastDueLoanBalance",
        COALESCE(t."noOfExcuses", 0) AS "noOfExcuses",
        COALESCE(t."excusesMcbu", 0) AS "excusesMcbu",
        COALESCE(t."excusesLoanRelease", 0) AS "excusesLoanRelease",
        COALESCE(t."excusesLoanBalance", 0) AS "excusesLoanBalance"

    FROM categories c

    LEFT JOIN category_totals t
        ON t.category = c.category
),

all_totals AS (
    SELECT * FROM complete_totals

    UNION ALL

    SELECT
        'consolidated'::text,

        SUM("activeClients"),
        SUM(mcbu),
        SUM(csf),
        SUM("totalLoanRelease"),
        SUM("totalLoanBalance"),
        SUM("activeBorrowers"),
        SUM("pastDuePerson"),
        SUM("pastDueMcbu"),
        SUM("pastDueLoanRelease"),
        SUM("pastDueLoanBalance"),
        SUM("noOfExcuses"),
        SUM("excusesMcbu"),
        SUM("excusesLoanRelease"),
        SUM("excusesLoanBalance")

    FROM complete_totals
)

SELECT
    category,

    "activeClients",
    mcbu,
    csf,
    "totalLoanRelease",
    "totalLoanBalance",
    "activeBorrowers",
    "pastDuePerson",
    "pastDueMcbu",
    "pastDueLoanRelease",
    "pastDueLoanBalance",

    (
        "pastDueLoanBalance" - "pastDueMcbu"
    )::numeric AS "pastDueNetRisk",

    "noOfExcuses",
    "excusesMcbu",
    "excusesLoanRelease",
    "excusesLoanBalance",

    (
        "totalLoanBalance" - mcbu
    )::numeric AS "netLoanBalance"

FROM all_totals

ORDER BY
    CASE category
        WHEN 'daily' THEN 1
        WHEN 'weekly' THEN 2
        WHEN 'accelerated' THEN 3
        WHEN 'consolidated' THEN 4
    END;
$$;