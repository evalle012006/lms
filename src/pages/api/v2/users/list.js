import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode, branchId, loOnly, selectedLoGroup, page = 1, size = 20, } = req.query;

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
                            root: { _is_null: true },
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
                            root: { _is_null: true },
                            role: { _contains: { rep: 4 } },
                            designatedBranch: { _eq: branchCode },
                            loNo: { _lt: 10 }
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
                        root: { _is_null: true },
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
                        root: { _is_null: true },
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
                    root: { _is_null: true },
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
                    root: { _is_null: true }
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
