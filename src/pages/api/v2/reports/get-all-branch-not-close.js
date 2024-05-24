import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `
branchId,
loanId,
groupId
groupName
branch {
    name
}
loanOfficer {
    firstName
    lastName
}
clientId
clientName: fullName
branch {
    name
}
slotNo
dateAdded
${fields.join('\n')}
`)('cashCollections');

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    let response;
    let statusCode = 200;

    const { currentUserId, branchId, loId } = req.query;

    let cashCollectionsDraft;
    let cashCollectionsPending;
    
    if (loId) {

        cashCollectionsDraft = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    loId: { _eq: loId },
                    draft: { _eq: true }
                }
            })
        ).then(res => res.data.cashCollections ?? []);

        cashCollectionsPending = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    loId: { _eq: loId },
                    groupStatus: { _eq: 'pending' }
                }
            })
        ).then(res => res.data.cashCollections ?? []);

    } else if (branchId || currentUserId) {
        let branch_ids = []
        if(branchId) {
            branch_ids = [branchId]
        } else {
            const getBranchIds = async (where) => await graph.query(
                queryQl(createGraphType('branches', '_id')('branches'), {
                    where
                })
            ).then(res => res.data.branches.map(b => b._id));

            const user = await graph.query(queryQl(createGraphType('users', `${USER_FIELDS}`), { where: { _id: { _eq: currentUserId } }})).then(res => res.data.users);
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                branch_ids = await getBranchIds({ areaId: { _eq: user[0].areaId } })
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                branch_ids = await getBranchIds({ regionId: { _eq: user[0].regionId } })
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                branch_ids = await getBranchIds({ divisionId: { _eq: user[0].divisionId } })
            }
        }

        cashCollectionsDraft = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    branchId: { _in: branch_ids },
                    draft: { _eq: true }
                }
            })
        ).then(res => res.data.cashCollections ?? []);

        cashCollectionsPending = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    branchId: { _in: branch_ids },
                    groupStatus: { _eq: 'pending' }
                }
            })
        ).then(res => res.data.cashCollections ?? []);
        
    } else {

        cashCollectionsDraft = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    draft: { _eq: true }
                }
            })
        ).then(res => res.data.cashCollections ?? []);

        cashCollectionsPending = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    groupStatus: { _eq: 'pending' }
                }
            })
        ).then(res => res.data.cashCollections ?? []);
    }

    cashCollectionsDraft = cashCollectionsDraft.map(c => ({
        branchName: c.branch.name,
        loanOfficerFirstName: c.loanOfficer.firstName,
        loanOfficerLastName: c.loanOfficer.lastName,
        groupId: c.groupId,
        groupName: c.groupName,
        clientId: c.clientId,
        clientName: c.clientName,
        slotNo: c.slotNo,
        loanId: c.loanId,
        dateAdded: c.dateAdded,
     }));

     cashCollectionsPending = cashCollectionsPending.map(c => ({
        branchName: c.branch.name,
        loanOfficerFirstName: c.loanOfficer.firstName,
        loanOfficerLastName: c.loanOfficer.lastName,
        groupId: c.groupId,
        groupName: c.groupName,
        clientId: c.clientId,
        clientName: c.clientName,
        slotNo: c.slotNo,
        loanId: c.loanId,
        dateAdded: c.dateAdded,
     }));

    response = { success: true, cashCollectionsDraft: cashCollectionsDraft, cashCollectionsPending: cashCollectionsPending };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}