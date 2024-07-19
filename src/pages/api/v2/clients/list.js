import { CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const CLIENT_TYPE = (... additionalFields) => {
    return createGraphType('client', `
        ${CLIENT_FIELDS}
        loans (where: { status: { _in: ["active", "completed"] } }) {
            ${LOAN_FIELDS}
        }
        lo {
            ${USER_FIELDS}
        }
        group {
            ${GROUP_FIELDS}
        }
        ${additionalFields.join('\n')}
    `)('clients');
}

export default apiHandler({
    get: list
});

async function list(req, res) {

    const {mode = null, groupId = null, branchId = null, loId = null, status = null, branchCodes = null, currentDate = null} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;

    if (mode === 'view_offset' && status === 'offset') {
        const where = {
            status: { _eq: status },
            branchId: { _eq: branchId ?? '' },
            oldLoId: { _eq: loId ?? '' },
            oldGroupId: { _eq: groupId ?? '' },
        };

        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where
            })
        ).then(res => res.data.clients.map(o => ({
            ... o,
            lo: o.lo ?? [],
        })));

    } else if (mode === 'view_active_by_group' && groupId) {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where:{
                    status: { _eq: 'active' },
                    loans: {
                        status: { _eq: status },
                        branchId: { _eq: branchId },
                    }
                }
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_by_group' && groupId) {

        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where:{
                    loans: {
                        status: { _in: ['completed', 'active', 'pending'] }
                    },
                    groupId: { _eq: groupId }
                }
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_by_lo' && loId) {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where:{
                    loId: { _eq: loId },
                    status: { _eq: status }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_all_by_branch' && branchId) {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where:{
                    branchId: { _eq: branchId },
                    status: { _eq: status }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_all_by_branch_codes' && branchCodes) {
        const codes = branchCodes?.trim()?.split(",");
        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where:{
                   code: { _in: codes }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_only_no_exist_loan') {
        if (status === 'active') {
            clients = await graph.query(
                queryQl(CLIENT_TYPE(), {
                    where:{
                       loans: {
                            status: { _eq: 'completed' },
                            groupId:  { _eq: groupId },
                       },
                       status: {
                            _eq: status
                       }
                    }
                })
            ).then(res => res.data.clients);
        } else {
            clients = await graph.query(
                queryQl(CLIENT_TYPE(), {
                    where:{
                       loId: loId ? { _eq: loId } : { _neq: 'null' },
                       branchId: branchId ? { _eq: branchId }: { _neq: 'null' },
                       groupId: { _eq: groupId },
                       status: { _eq: status },
                       loans: {
                            status: {
                                _in: ['active', 'pending', 'completed']
                            }
                       }
                    }
                })
            ).then(res => res.data.clients);
        }
    } else if (mode === 'view_existing_loan') {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(), {
                where: {
                    status: { _eq: 'active' },
                    groupId: { _eq: groupId },
                    loans: {
                        _and: [
                            {
                                status: { _neq: 'pending' }
                            }
                        ]
                    }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_all_by_group_for_transfer' && groupId) {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(`cashCollections (where: { dateAdded: { _eq: "${currentDate}" }, draft: { _neq: true } }) {
                status
            }`), {
                where: {
                    groupId: { _eq: groupId }
                }
            })
        ).then(res => res.data.clients);
    } else {
        clients = await graph.query(
            queryQl(CLIENT_TYPE(''), {
                where: {
                    status: { _eq: status }
                }
            })
        ).then(res => res.data.clients);
    }
    
    response = {
        success: true,
        clients: clients.map(c => ({
            ... c,
            lo: c.lo ? [c.lo] : [],
            group: c.group ? [c.group] : [],
            cashCollections: c.cashCollections ? c.cashCollections : [],
        }))
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

export const config = {
    api: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
}