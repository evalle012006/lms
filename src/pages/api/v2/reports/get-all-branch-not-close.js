import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `
branchId,
loanId,
groupId
groupName
loanOfficer {
    firstName
    lastName
}
clientId
fullName
branch {
    name
}
slotNo
dateAdded
`)('cashCollections');

export default apiHandler({
    get: allLoans
});

async function allLoans(req, res) {
    let response;
    let statusCode = 200;

    const { branchIds, branchId, loId } = req.query;

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

    } else if (branchId || branchIds) {
        const branche_ids = [branchId, ... (branchIds ?? [])].filter(b => !!b);
        
        cashCollectionsDraft = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    branchId: { _in: branche_ids },
                    draft: { _eq: true }
                }
            })
        ).then(res => res.data.cashCollections ?? []);

        cashCollectionsPending = await graph.query(
            queryQl(CASH_COLLECTION_TYPE, {
                where: {
                    branchId: { _in: branche_ids },
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
        ).then(res => res.data.cashCollections ?? [])
    }

    const mapToBranch = (c) => ({
        branchName: c.branch.name,
        loanOfficerFirstName: c.loanOfficer?.firstName,
        loanOfficerLastName: c.loanOfficer?.lastName,
        groupId: c.groupId,
        groupName: c.groupName,
        clientId: c.clientId,
        clientName: c.fullName,
        slotNo: c.slotNo,
        loanId: c.loanId,
        dateAdded: c.dateAdded,
    });

    cashCollectionsDraft = cashCollectionsDraft.map(mapToBranch);
    cashCollectionsPending = cashCollectionsPending.map(mapToBranch);

    response = { success: true, cashCollectionsDraft: cashCollectionsDraft, cashCollectionsPending: cashCollectionsPending };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}