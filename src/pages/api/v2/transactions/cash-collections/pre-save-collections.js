import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    post: save
});

async function save(req, res) {
    let response = {};
    let statusCode = 200;
    const { loId, currentDate } = req.body;

    const loans = await graph.apollo.query({
        query: gql`
        query groups ($where:pre_save_collection_model_bool_exp_bool_exp,  $args: get_pre_save_collection_data_arguments!) {
            collections: get_pre_save_collection_data(args: $args, where: $where) {
              _id,
              loan
              group
            }
        }
        `,
        variables: {
           args: {
                loId,
                curr_date: currentDate
           }
        }
    }).then(res => res.data.collections.map(c => ({
        ... c.loan,
        groupIdObj: null,
        group: c.group,
    })));

    console.log('loansSize: ', loans.length)

    const cashCollections = loans.map(loan => ({
        _id: generateUUID(),
        loanId: loan._id + '',
        branchId: loan.branchId,
        groupId: loan.groupId,
        groupName: loan.groupName,
        loId: loan.loId,
        clientId: loan.clientId,
        slotNo: loan.slotNo,
        loanCycle: loan.loanCycle,
        mispayment: false,
        // mispaymentStr: 'No',
        // collection: 0,
        excess: 0,
        total: 0,
        noOfPayments: 0,
        activeLoan: loan.activeLoan,
        targetCollection: loan.activeLoan, 
        amountRelease: loan.amountRelease,
        loanBalance: loan.loanBalance,
        paymentCollection: 0,
        occurence: loan.group.occurence,
        currentReleaseAmount: 0,
        mcbuTarget: 50,
        groupDay: loan.group.day,
        fullPayment: 0,
        mcbu: loan.mcbu,
        mcbuCol: 0,
        mcbuWithdrawal: 0,
        mcbuReturnAmt: 0,
        remarks: '',
        status: loan.status,
        dateAdded: currentDate,
        groupStatus: "pending",
        insertedDateTime: new Date(),
        origin: 'pre-save'
    }));



    await graph.mutation(
        insertQl(createGraphType('cashCollections', '_id')('collections'), {
            objects: cashCollections
        })
    );

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}