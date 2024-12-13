import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const LOAN_TYPE = (alias) => createGraphType('loans', `
${LOAN_FIELDS}
`)(alias ?? 'loans');
const CASH_COLLECTIONS = createGraphType('cashCollections', `
${CASH_COLLECTIONS_FIELDS}
`)('cashCollections');

export default apiHandler({
    post: revert,
});

let statusCode = 200;
let response = {};

async function revert(req, res) {
    const cashCollection = req.body;
    logger.debug({page: 'LOR', message: 'Change Remarks', data: cashCollection});
    const loanId = cashCollection.loanId;

    const currentDate = cashCollection.currentDate;
    const newRemarks = cashCollection.newRemarks;

    const { currentLoan, currentCC } = await graph.query(
        queryQl(LOAN_TYPE(), {
            where: { _id: { _eq: loanId } }
        }),
        queryQl(CASH_COLLECTIONS, {
            where: { clientId: { _eq: cashCollection.clientId, dateAdded: { _eq: currentDate } } }
        })
    ).then(res => ({
        currentLoan: res.data.loans?.[0],
        currentCC: res.data.cashCollections?.[0]
    }));


    if (cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') {
        const [previousLoan] = await graph.query(
            queryQl(LOAN_TYPE(), {
                where: {
                    clientId: { _eq: cashCollection.clientId },
                    loanCycle: { _eq: cashCollection.loanCycle - 1  },
                    status: { _eq: "closed" }
                }
            })
        ).then(res => res.data.loans)
        
        if (!!currentLoan && !!currentCC && previousLoan) {
            const currentCCId = currentCC._id;
            const previousLoanId = previousLoan._id;
            delete currentLoan._id;
            delete currentCC._id;
            delete previousLoan._id;
            
            if (newRemarks.value == 'reloaner-wd' && currentCC.remarks.value == 'reloaner-cont') {
                const mcbuCol = currentCC.mcbuCol;
                const mcbu = currentLoan.mcbu - mcbuCol;

                previousLoan.mcbuCollection = mcbu;
                previousLoan.mcbuWithdrawal = mcbu;
                previousLoan.history.remarks = newRemarks;
                currentLoan.mcbu = 0;
                currentCC.mcbu = 0;
                currentCC.mcbuCol = 0;
                currentCC.mcbuWithdrawal = mcbu;
                currentCC.remarks = newRemarks;
            } else if  (newRemarks.value == 'reloaner-cont' && currentCC.remarks.value == 'reloaner-wd') {
                const excessMcbu = currentCC.excess / currentCC.activeLoan;
                const finalMcbu = (excessMcbu * 10) + 10;
                const mcbu = currentCC.mcbuWithdrawal + finalMcbu;

                previousLoan.mcbuCollection = mcbu;
                previousLoan.mcbuWithdrawal = 0;
                previousLoan.history.remarks = newRemarks;
                currentLoan.mcbu = mcbu;
                currentCC.mcbu = mcbu;
                currentCC.mcbuCol = finalMcbu;
                currentCC.mcbuWithdrawal = 0;
                currentCC.remarks = newRemarks;
            }

            await graph.mutation(
                updateQl(LOAN_TYPE('currentLoan'), {
                    set: {
                        mcbu: currentLoan.mcbu
                    },
                    where: { _id: { _eq: loanId } }
                }),
                updateQl(LOAN_TYPE('previousLoan'), {
                    set: {
                        mcbuCollection: previousLoan.mcbuCollection,
                        mcbuWithdrawal: previousLoan.mcbuWithdrawal,
                    },
                    jsonAppend: {
                        history: {
                            remarks: previousLoan.history?.remarks
                        }
                    },
                    where: { _id: { _eq: previousLoanId } }
                }),
                updateQl(CASH_COLLECTIONS, {
                    set: {
                        mcbu: currentCC.mcbu,
                        mcbuCol: currentCC.mcbuCol,
                        mcbuWithdrawal: currentCC.mcbuWithdrawal,
                        remarks: currentCC.remarks
                    },
                    where: {
                        _id: { _eq: currentCCId }
                    }
                })
            );
        }
    }


    response = { success: true };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}