//src/pages/api/v2/dcs/index.js
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'apollo-boost';

const graph = new GraphProvider();

const USER_TYPE = createGraphType(
    'users',
    `
        _id
        areaId
        designatedBranchId
        role
    `
)('users');

const BRANCH_TYPE = createGraphType(
    'branches',
    `
        _id
        areaId
    `
)('branches');

const ALLOWED_DCS_QUERIES = [
    'get_daily_collection_sheet_v2',
    'get_daily_collection_summary',
    'get_cashbook_loan_releases',
];

const isValidDcsDate = (value) => {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
};

export default apiHandler({
    get: getData,
});

async function getData(req, res) {
    try {
        const {
            _name,
            _limit,
            _offset,
            branch_id,
            lo_id,
            selected_date,
        } = req.query;

        if (!ALLOWED_DCS_QUERIES.includes(_name)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid DCS query.',
            });
        }

        const userId = req.auth?.sub;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.',
            });
        }

        if (
            !branch_id ||
            Array.isArray(branch_id) ||
            typeof branch_id !== 'string' ||
            Array.isArray(lo_id) ||
            (lo_id != null && typeof lo_id !== 'string') ||
            !isValidDcsDate(selected_date)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid DCS request parameters.',
            });
        }

        const userResult = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    _id: { _eq: userId },
                },
                limit: 1,
            })
        );

        const currentUser = userResult.data?.users?.[0];

        if (!currentUser) {
            return res.status(403).json({
                success: false,
                message: 'User account not found.',
            });
        }

        const roleRep = Number(currentUser.role?.rep);

        const isAdmin = roleRep === 1;

        const isAreaManager =
            roleRep === 2 &&
            String(currentUser.role?.shortCode || '')
                .trim()
                .toLowerCase() === 'area_admin';

        const isBranchManager = roleRep === 3;
        const isLoanOfficer = roleRep === 4;

        if (isAreaManager) {
            if (!currentUser.areaId) {
                return res.status(403).json({
                    success: false,
                    message: 'Area Manager has no assigned area.',
                });
            }

            const branchResult = await graph.query(
                queryQl(BRANCH_TYPE, {
                    where: {
                        _id: { _eq: branch_id },
                    },
                    limit: 1,
                })
            );

            const branch = branchResult.data?.branches?.[0];

            if (
                !branch ||
                String(branch.areaId) !== String(currentUser.areaId)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'You can only view DCS data from branches assigned to your area.',
                });
            }
        } else if (isBranchManager || isLoanOfficer) {
            if (
                !currentUser.designatedBranchId ||
                String(currentUser.designatedBranchId) !==
                    String(branch_id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'You can only view DCS data from your designated branch.',
                });
            }

            if (
                isLoanOfficer &&
                String(lo_id || '') !== String(currentUser._id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Loan Officers can only view their own DCS data.',
                });
            }
        } else if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message:
                    'You do not have permission to view DCS data.',
            });
        }

        if (lo_id) {
            const loResult = await graph.query(
                queryQl(USER_TYPE, {
                    where: {
                        _id: { _eq: lo_id },
                    },
                    limit: 1,
                })
            );

            const loanOfficer = loResult.data?.users?.[0];

            if (
                !loanOfficer ||
                Number(loanOfficer.role?.rep) !== 4 ||
                String(loanOfficer.designatedBranchId) !==
                    String(branch_id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'The selected Loan Officer does not belong to this branch.',
                });
            }
        }

        if (_name === 'get_cashbook_loan_releases') {
            const loanReleaseResponse = await graph.apollo.query({
                query: gql`
                    query GetCashbookLoanReleases(
                        $branch_id: String!
                        $selected_date: String!
                    ) {
                        get_cashbook_loan_releases(
                            args: {
                                branch_id: $branch_id
                                selected_date: $selected_date
                            }
                        ) {
                            regular_loan_release_persons
                            regular_loan_release_principal
                            other_loan_release_persons
                            other_loan_release_principal
                        }
                    }
                `,
                variables: {
                    branch_id,
                    selected_date,
                },
                fetchPolicy: 'no-cache',
            });

            if (loanReleaseResponse.errors?.length) {
                console.error(
                    'Cashbook loan-release GraphQL errors:',
                    loanReleaseResponse.errors
                );

                return res.status(500).json({
                    success: false,
                    message: 'Failed to retrieve Cashbook loan releases.',
                });
            }

            return res.status(200).json({
                data:
                    loanReleaseResponse.data
                        ?.get_cashbook_loan_releases || [],
            });
        }

        const response = await graph.apollo.query({
            query: gql`
                query ${_name} (
                    $args: ${_name}_arguments!,
                    $limit: Int,
                    $offset: Int
                ) {
                    results: ${_name}(
                        args: $args,
                        limit: $limit,
                        offset: $offset
                    ) {
                        data
                    }
                }
            `,
            variables: {
                args: {
                    branch_id,
                    lo_id: lo_id || null,
                    selected_date,
                },
                offset:
                    _offset == null || _offset === '' || isNaN(+_offset)
                        ? null
                        : +_offset,
                limit:
                    _limit == null || _limit === '' || isNaN(+_limit)
                        ? null
                        : +_limit,
            },
        });

        if (response.errors?.length) {
            console.error('DCS GraphQL errors:', response.errors);

            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve DCS data.',
            });
        }

        return res.status(200).json({
            data: (response.data?.results || []).map((item) => item.data),
        });
    } catch (error) {
        console.error('DCS API error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load DCS data.',
        });
    }
}