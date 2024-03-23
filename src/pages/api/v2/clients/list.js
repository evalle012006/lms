import { GROUP_FIELDS, LOAN_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const CLIENT_TYPE = (loanCondition = {}) => createGraphType('client', `
${CLIENT_FIELDS}
loans (where: ) {
    ${LOAN_FIELDS}
}
lo {
    ${USER_FIELDS}
}
group {
    ${GROUP_FIELDS}
}
`)('clients');

export default apiHandler({
    get: list
});

async function list(req, res) {

    const {mode = null, groupId = null, branchId = null, loId = null, status = null, branchCodes = null, currentDate = null} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;


    if (mode === 'view_offset' && status === 'offset') {

        clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where:{
                    status: { _eq: status },
                    branchId: { _eq: branchId },
                    oldLoId: { _eq: loId },
                    oldGroupId: { _eq: groupId },
                }
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_active_by_group' && groupId) {

        clients = await graph.query(
            queryQl(CLIENT_TYPE, {
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
            queryQl(CLIENT_TYPE, {
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
            queryQl(CLIENT_TYPE, {
                where:{
                    logId: { _eq: loId },
                    status: { status }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_all_by_branch' && branchId) {
        clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where:{
                    branchId: { _eq: branchId },
                    status: { status }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_all_by_branch_codes' && branchCodes) {
        const codes = branchCodes?.trim()?.split(",");
        clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where:{
                   code: { _in: codes }
                }
            })
        ).then(res => res.data.clients);
    } else if (mode === 'view_only_no_exist_loan') {
        if (status === 'active') {
            clients = await graph.query(
                queryQl(CLIENT_TYPE, {
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
                queryQl(CLIENT_TYPE, {
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
            clients = await db
                .collection('loans')
                .aggregate([
                    { $match: {$expr: {$and: [{$eq: ['$status', 'active']}, {$eq: ['$groupId', groupId]}]} } },
                    {
                        $addFields: {
                            "clientIdObj": { $toObjectId: "$clientId" }
                        }
                    },
                    {
                        $lookup: {
                            from: "client",
                            localField: "clientIdObj",
                            foreignField: "_id",
                            pipeline: [
                                { $match: {status: 'active'} }
                            ],
                            as: "client"
                        }
                    },
                    {
                        $unwind: "$client"
                    },
                    {
                        $addFields: {
                            "loIdObj": {$toObjectId: "$client.loId"}
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "loIdObj",
                            foreignField: "_id",
                            as: "lo"
                        }
                    },
                    {
                        $lookup: {
                            from: "loans",
                            localField: "clientId",
                            foreignField: "clientId",
                            pipeline: [
                                { $match: {status: 'pending'} }
                            ],
                            as: "loans"
                        }
                    },
                    {
                        "$match": { "loans.0": { "$exists": false } }
                    },
                    { $project: { clientIdObj: 0, loIdObj: 0 } }
                ])
                .toArray();
        
    } else if (mode === 'view_all_by_group_for_transfer' && groupId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { groupId: groupId } },
                { $addFields: { "clientIdStr": { $toString: "$_id" } } },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientIdStr",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
                        ],
                        as: "loans"
                    }
                }, 
                {
                    $lookup: {
                        from: "cashCollections",
                        localField: "clientIdStr",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: { $expr: { $and: [ {$eq: ['$dateAdded', currentDate]}, {$ne: ['$draft', true]} ] } } },
                            { $project: { status: '$status' } }
                        ],
                        as: "cashCollections"
                    }
                }
            ])
            .toArray();
        // clients = await db
        //     .collection('client')
        //     .aggregate([
        //         { $match: { groupId: groupId } },
        //         { $addFields: { "clientIdStr": { $toString: "$_id" } } },
        //         {
        //             $lookup: {
        //                 from: "loans",
        //                 localField: "clientIdStr",
        //                 foreignField: "clientId",
        //                 pipeline: [
        //                     { $match: {$expr: {$or: [{$eq: ['$status', 'pending']}, {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} }
        //                 ],
        //                 as: "loans"
        //             }
        //         }
        //     ])
        //     .toArray();
    } else {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { status: status } },
                {
                    $addFields: {
                        "clientId": { $toString: "$_id" },
                        "loIdObj": {$toObjectId: "$loId"}
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "loIdObj",
                        foreignField: "_id",
                        as: "lo"
                    }
                },
                {
                    $lookup: {
                        from: "loans",
                        localField: "clientId",
                        foreignField: "clientId",
                        as: "loans"
                    }
                },
                { $project: { clientId: 0, loIdObj: 0 } }
            ])
            .toArray();
    }
    
    response = {
        success: true,
        clients: clients
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