import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

const AUTH_USER_TYPE = createGraphType(
    'users',
    `
        _id
        areaId
        designatedBranchId
        role
    `
)('users');

const BRANCH_ACCESS_TYPE = createGraphType(
    'branches',
    `
        _id
        code
        areaId
    `
)('branches');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode, branchId, loOnly, selectedLoGroup, page = 1, size = 20, } = req.query;

    // ==========================================
    // AUTHENTICATED USER
    // ==========================================

    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized.',
        });
    }

    const authResult = await graph.query(
        queryQl(AUTH_USER_TYPE, {
            where: {
                _id: { _eq: userId },
            },
            limit: 1,
        })
    );

    const currentUser = authResult.data?.users?.[0];

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

    // ==========================================
    // BRANCH ACCESS VALIDATION
    // ==========================================

    if (!isAdmin) {
        if (!branchId && !branchCode) {
            return res.status(403).json({
                success: false,
                message: 'A branch filter is required for your account.',
            });
        }

        const branchWhere = branchId
            ? { _id: { _eq: branchId } }
            : { code: { _eq: branchCode } };

        const branchResult = await graph.query(
            queryQl(BRANCH_ACCESS_TYPE, {
                where: branchWhere,
                limit: 1,
            })
        );

        const requestedBranch = branchResult.data?.branches?.[0];

        if (!requestedBranch) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found.',
            });
        }

        if (isAreaManager) {
            if (
                !currentUser.areaId ||
                !requestedBranch.areaId ||
                String(currentUser.areaId) !==
                    String(requestedBranch.areaId)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'You can only view users from branches assigned to your area.',
                });
            }
        } else if (isBranchManager || isLoanOfficer) {
            if (
                !currentUser.designatedBranchId ||
                String(currentUser.designatedBranchId) !==
                    String(requestedBranch._id)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'You can only view users from your designated branch.',
                });
            }
        } else {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this user list.',
            });
        }
    }

    // const offset = (page * size) - size;
    // const limit = size;

    const offset = undefined;
    const limit = undefined;

    let users;

    if (branchCode) {
        if (selectedLoGroup && selectedLoGroup !== 'all') {
            if (selectedLoGroup == 'main') {
                users = await graph.query(
                    queryQl(USER_TYPE, {
                        where: {
                            root: { _eq: false },
                            role: { _contains: { rep: 4 } },
                            designatedBranch: { _eq: branchCode },
                            loNo: { _lt: 11 }
                        },
                        order_by: [{
                            loNo: 'asc'
                        }],
                        offset,
                        limit
                    })
                ).then(res => res.data.users);
            } else if (selectedLoGroup == 'ext') {
                users = await graph.query(
                    queryQl(USER_TYPE, {
                        where: {
                            root: { _eq: false },
                            role: { _contains: { rep: 4 } },
                            designatedBranch: { _eq: branchCode },
                            loNo: { _gt: 10 }
                        },
                        order_by: [{
                            loNo: 'asc'
                        }],
                        offset,
                        limit
                    })
                ).then(res => res.data.users);
            }
        } else if (loOnly) {
            users = await graph.query(
                queryQl(USER_TYPE, {
                    where: {
                        root: { _eq: false },
                        role: { _contains: { rep: 4 } },
                        designatedBranch: { _eq: branchCode }
                    },
                    order_by: [{
                        loNo: 'asc'
                    }],
                    offset,
                    limit
                })
            ).then(res => res.data.users);
        } else {
            users = await graph.query(
                queryQl(USER_TYPE, {
                    where: {
                        root: { _eq: false },
                        designatedBranch: { _eq: branchCode }
                    },
                    order_by: [{
                        loNo: 'asc'
                    }],
                    offset,
                    limit
                })
            ).then(res => res.data.users);
        }
    } else if (branchId) {
        users = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    root: { _eq: false },
                    role: { _contains: { rep: 4 } },
                    designatedBranchId: { _eq: branchId }
                },
                order_by: [{
                    loNo: 'asc'
                }],
                offset,
                limit
            })
        ).then(res => res.data.users);
    } else {
        users = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    root: { _eq: false },
                },
                order_by: [{
                    loNo: 'asc'
                }],
                offset,
                limit
            })
        ).then(res => res.data.users);
    }

    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
