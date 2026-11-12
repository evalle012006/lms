CREATE OR REPLACE FUNCTION public.fn_get_cashbook_loan_releases(
    _branch_id text,
    _selected_date date
)
RETURNS TABLE (
    regular_loan_release_persons integer,
    regular_loan_release_principal numeric,
    other_loan_release_persons integer,
    other_loan_release_principal numeric
)
LANGUAGE sql
STABLE
AS $function$

    WITH eligible_releases AS (
        SELECT
            COALESCE(
                NULLIF(LOWER(TRIM(cc.occurence)), ''),
                NULLIF(LOWER(TRIM(l.occurence)), '')
            ) AS loan_type,

            l."principalLoan" AS principal

        FROM public."cashCollections" cc

        INNER JOIN public.loans l
            ON l._id::text = cc."loanId"::text

        WHERE cc."branchId" = _branch_id

          AND cc."dateAdded"::date = _selected_date

          AND cc.status = 'tomorrow'

          AND cc.transfer IS NOT TRUE

          AND cc.transferred IS NOT TRUE

          AND l."principalLoan" > 0
    )

    SELECT

        COUNT(*) FILTER (
            WHERE loan_type = 'daily'
        )::integer AS regular_loan_release_persons,

        COALESCE(
            SUM(principal) FILTER (
                WHERE loan_type = 'daily'
            ),
            0
        ) AS regular_loan_release_principal,

        COUNT(*) FILTER (
            WHERE loan_type = 'weekly'
        )::integer AS other_loan_release_persons,

        COALESCE(
            SUM(principal) FILTER (
                WHERE loan_type = 'weekly'
            ),
            0
        ) AS other_loan_release_principal

    FROM eligible_releases;

$function$;