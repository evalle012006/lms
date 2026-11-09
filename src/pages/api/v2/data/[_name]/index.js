//src/pages/api/v2/data/[name]/index.js
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

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

const PROTECTED_DCS_FUNCTIONS = [
    'get_daily_collection_sheet_v2',
    'get_daily_collection_summary',
];

export default apiHandler({
    get: getData,
});

async function getData(req, res) {
    const { _name, _limit, _offset, ...args } = req.query;

    try {
        if (PROTECTED_DCS_FUNCTIONS.includes(_name)) {
            const userId = req?.auth?.sub;
            const branchId = args.branch_id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized.',
                });
            }

            if (!branchId || Array.isArray(branchId)) {
                return res.status(400).json({
                    success: false,
                    message: 'branch_id is required.',
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
                            _id: { _eq: branchId },
                        },
                        limit: 1,
                    })
                );

                const branch = branchResult.data?.branches?.[0];

                if (
                    !branch ||
                    !branch.areaId ||
                    String(branch.areaId) !==
                        String(currentUser.areaId)
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
                        String(branchId)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            'You can only view DCS data from your designated branch.',
                    });
                }

                if (
                    isLoanOfficer &&
                    String(args.lo_id || '') !== String(currentUser._id)
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

            if (args.lo_id) {
                const loResult = await graph.query(
                    queryQl(USER_TYPE, {
                        where: {
                            _id: { _eq: args.lo_id },
                        },
                        limit: 1,
                    })
                );

                const loanOfficer = loResult.data?.users?.[0];

                if (
                    !loanOfficer ||
                    Number(loanOfficer.role?.rep) !== 4 ||
                    String(loanOfficer.designatedBranchId) !==
                        String(branchId)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            'The selected Loan Officer does not belong to this branch.',
                    });
                }
            }
        }

        const { status, result } = await graph.apollo.query({
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
                    ...args,
                },
                offset: isNaN(+_offset) ? null : +_offset,
                limit: isNaN(+_limit) ? null : +_limit,
            },
        }).then((response) => ({
            status: response.errors?.length ? 500 : 200,
            result: response.errors?.length
                ? response.errors
                : response.data.results.map((item) => item.data),
        }));

        return res
            .status(status)
            .setHeader('Content-Type', 'application/json')
            .end(
                JSON.stringify({
                    data: result,
                })
            );
    } catch (error) {
        console.error('Get DCS data error:', error);

        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to load data.',
        });
    }
}