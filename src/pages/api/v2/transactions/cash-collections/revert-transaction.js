import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';



const graph = new GraphProvider();
const CASH_COLLECTION_TYPE = createGraphType('cashCollections', `${CASH_COLLECTIONS_FIELDS}`)
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)
const CLIENT_TYPE = createGraphType('client', `${CLIENT_FIELDS}`);
const GROUP_TYPE = createGraphType('groups', `${GROUP_FIELDS}`)

export default apiHandler({
    post: revert,
});

let statusCode = 200;
let response = {};

const getClientById = (_id) => graph.query(queryQl(CLIENT_TYPE('client'), { where: { _id: { _eq: _id } } })).then(res => res.data.clients);
const getLoanById = (_id) => graph.query(queryQl(LOAN_TYPE('loans'), {where: { _id: { _eq: _id } }})).then(res =>  res.data.loans);

async function revert(req, res) {
    const cashCollections = req.body;

    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(cashCollections.map(async (cc) => {
            let cashCollection = {...cc};
            logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, data: cashCollection});
            let loanId = cashCollection.loanId;
            let cashCollectionId = cashCollection._id;
            if (cashCollection.status == 'closed') {
                loanId = cashCollection._id;
                const closedCC = cashCollection?.current[0];
                cashCollectionId = closedCC._id;
            }

            let client =  await getClientById(cashCollection.clientId);
            let previousLoanId = cashCollection?.prevLoanId;
            let currentLoan = [];
            let previousLoan = [];

            if ((cashCollection.status == 'pending' || cashCollection.status == 'tomorrow') && cashCollection.loanCycle > 1) {
                previousLoan = await getLoanById(previousLoanId);
            } else {
                currentLoan = await getLoanById(loanId);
            }

            let previousCC = await graph.query(
                queryQl(CASH_COLLECTION_TYPE('cashCollections'), {
                    where: { clientId: { _eq: cashCollection.clientId } },
                    // order_by: [{ natural: 'desc' }], -- need to find alternative for this revert
                    limit: 2
                })
            ).then(res => res.data.cashCollections);
            
            logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, clientSize: client.length, previousLoanSize: previousLoan.length, previousCCSize: previousCC.length });
            // NEED TO ACCOMODATE REVERT FOR NEW CLIENT PENDING/TOMORROW
            // - delete cashcollection
            // - set loan to rejected
            if (client.length > 0 && previousCC.length == 2) {
                client = client[0];
                previousCC = previousCC[1];
                // delete current transaction
                await graph.mutation(deleteQl(CASH_COLLECTION_TYPE('cashCollections'), { _id: { _eq: cashCollectionId } }));
                logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, previousCC: previousCC });
                if (previousLoan.length > 0) { // pending, tomorrow
                    previousLoan = previousLoan[0];
                    delete previousLoan._id;
                    await graph.mutation(deleteQl(LOAN_TYPE('loans'), { _id: { _eq: loanId } }));
                    // there are cases wherein the advance loan were not deleted....need proper steps
                    if (previousCC.status == 'completed') {
                        previousLoan.activeLoan = 0;
                        previousLoan.amountRelease = 0;
                        previousLoan.loanBalance = 0;
                        previousLoan.mcbu = previousCC.mcbu;
                        previousLoan.mcbuCollection = previousCC.mcbu;
                        previousLoan.mcbuReturnAmt = 0;
                        previousLoan.mcbuWithdrawal = 0;
                        previousLoan.noOfPayments = previousCC.noOfPayments;
                        previousLoan.advanceDays = 0;
                        previousLoan.history = previousCC.history;
                        previousLoan.status = 'completed';
                    } else if (previousCC.status == 'closed') {
                        // do nothing
                    } else if (previousCC.status == 'pending') {
                        // do nothing
                    } else {
                        previousLoan.activeLoan = previousCC.activeLoan > 0 ? previousCC.activeLoan : previousCC.history?.activeLoan;
                        previousLoan.amountRelease = previousCC.amountRelease;
                        previousLoan.loanBalance = previousCC.loanBalance;
                        previousLoan.mcbu = previousCC.mcbu;
                        previousLoan.mcbuCollection = previousCC.mcbu;
                        previousLoan.mcbuReturnAmt = 0;
                        previousLoan.mcbuWithdrawal = 0;
                        previousLoan.noOfPayments = previousCC.noOfPayments;
                        previousLoan.advanceDays = previousCC.advanceDays;
                        previousLoan.history = previousCC.history;
                        previousLoan.status = 'active';
                        previousLoan.fullPaymentDate = null;
                    }
                    
                    if (previousCC.status !== 'closed') {
                        previousLoan.reverted = true;
                        previousLoan.revertedDate = currentDate;
                        delete previousLoan.advance;
                        delete previousLoan.advanceDate;
                        logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, previousLoan: previousLoan });
                        await graph.mutation(
                            updateQl(LOAN_TYPE('loans'), {
                                set: {
                                    ... previousLoan,
                                    advance: null,
                                    advanceDate: null
                                },
                                where: {
                                    _id: { _eq: previousLoanId }
                                }
                            })
                        )
                        // await db.collection('loans').updateOne({ _id: new ObjectId(previousLoanId) }, { $unset: {advance: 1, advanceDate: 1}, $set: {...previousLoan} });
                    }
                } else if (currentLoan.length > 0) { // active, completed, closed
                    currentLoan = currentLoan[0];
                    delete currentLoan._id;
                    logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, previousCCStatus: previousCC.status, currentLoan: currentLoan });
                    if (previousCC.status == 'tomorrow') {
                        if (currentLoan.loanCycle > 1) {
                            currentLoan.amountRelease = previousCC.currentReleaseAmount;
                            currentLoan.loanBalance = previousCC.currentReleaseAmount;
                            currentLoan.mcbu = 0;
                            currentLoan.mcbuCollection = 0;
                            currentLoan.mcbuReturnAmt = 0;
                            currentLoan.mcbuWithdrawal = 0;
                            currentLoan.noOfPayments = 0;
                            currentLoan.advanceDays = 0;
                            currentLoan.status = 'active';
                            currentLoan.fullPaymentDate = null;
                        } else {
                            delete currentLoan.startDate;
                            delete currentLoan.endDate;
                            currentLoan.status = 'pending';
                        }
                    } else if (previousCC.status == 'completed') {
                        currentLoan.activeLoan = 0;
                        currentLoan.amountRelease = 0;
                        currentLoan.loanBalance = 0;
                        currentLoan.mcbu = previousCC.mcbu;
                        currentLoan.mcbuCollection = previousCC.mcbu;
                        currentLoan.mcbuReturnAmt = previousCC.mcbuReturnAmt;
                        currentLoan.mcbuWithdrawal = previousCC.mcbuWithdrawal;
                        currentLoan.noOfPayments = previousCC.noOfPayments;
                        currentLoan.advanceDays = previousCC.advanceDays;
                        currentLoan.history = previousCC.history;
                        currentLoan.status = 'completed';
                        currentLoan.fullPaymentDate = previousCC.fullPaymentDate;
                    } else {
                        currentLoan.activeLoan = previousCC.activeLoan > 0 ? previousCC.activeLoan : previousCC.history?.activeLoan;
                        currentLoan.amountRelease = previousCC.amountRelease;
                        currentLoan.loanBalance = previousCC.loanBalance;
                        currentLoan.mcbu = previousCC.mcbu;
                        currentLoan.mcbuCollection = previousCC.mcbu;
                        currentLoan.mcbuReturnAmt = 0;
                        currentLoan.mcbuWithdrawal = 0;
                        currentLoan.noOfPayments = previousCC.noOfPayments;
                        currentLoan.advanceDays = previousCC.advanceDays;
                        currentLoan.history = previousCC.history;
                        currentLoan.status = 'active';
                        currentLoan.fullPaymentDate = null;
                    }

                    currentLoan.reverted = true;
                    currentLoan.revertedDate = currentDate;
                    currentLoan.revertedDateTime = new Date();

                    if (cashCollection.status == 'closed') {
                        // update client
                        delete client._id;
                        client.status = 'active';
                        client.groupId = client.oldGroupId;
                        client.loId = client.oldLoId;
                        client.oldGroupId = null;
                        client.oldLoId =  null;
                        delete client.oldGroupId;
                        delete client.oldLoId;
                        await graph.mutation(
                            updateQl(CLIENT_TYPE('client'), {
                                set: {
                                    ... client,
                                    oldGroupId: null,
                                    oldLoId: null
                                },
                                where: {
                                    _id: cashCollection.clientId
                                }
                            })
                        );
                        // await db.collection('client').updateOne({ _id: new ObjectId(cashCollection.clientId) }, { $unset: { oldGroupId: 1, oldLoId: 1 }, $set: { ...client } });

                        // update group
                        await updateGroup(cashCollection.group, cashCollection.slotNo);

                        // update loan
                        currentLoan.loanCycle = previousCC.loanCycle;
                        delete currentLoan.closedDate;
                        delete currentLoan.remarks;
                        logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, updatedCurrentLoan: currentLoan });
                        await graph.mutation(
                            updateQl(LOAN_TYPE('loans'), {
                                set: { ... currentLoan, closedDate: null, remarks:  null },
                                where: { _id: { _eq: loanId } }
                            })
                        );
                        // await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $unset: { closedDate: 1, remarks: 1 }, $set: {...currentLoan} });
                    } else {
                        logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, currentLoan: currentLoan });
                        if (currentLoan.status == 'pending' && cc.status == 'tomorrow') {
                            await graph.mutation(
                                updateQl(LOAN_TYPE('loans'), {
                                    set: { ... currentLoan, startDate: null, endDate:  null },
                                    where: { _id: { _eq: loanId } }
                                })
                            );
                            // await db.collection('loans').updateOne({ _id: new ObjectId(loanId) }, { $unset: {startDate: 1, endDate: 1}, $set: {...currentLoan} });
                        } else if (cc.status == 'pending') {
                            await graph.mutation(deleteQl(LOAN_TYPE('loans'), { _id: { _eq: loanId } }));
                            await updateGroup(cashCollection.group, cashCollection.slotNo);
                        } else {
                            await graph.mutation(
                                updateQl(LOAN_TYPE('loans'), {
                                    set: { ... currentLoan  },
                                    where: { _id: { _eq: loanId } }
                                })
                            );
                        }
                    }
                }
            } else if (client.length > 0 && previousCC.length == 1) {
                // this is for new client, balik clients
                previousCC = previousCC[0];
                currentLoan = currentLoan[0];
                logger.debug({page: `Reverting Transaction Loan: ${cashCollection.clientId}`, previousCC: previousCC, currentLoan: currentLoan });
                // delete current transaction
                await graph.mutation(deleteQl(CASH_COLLECTION_TYPE('cashCollections'), { _id: { _eq: previousCC._id } }));
                await graph.mutation(deleteQl(LOAN_TYPE('loans'), { _id: { _eq: currentLoan._id } }));
                await updateGroup(cashCollection.group, currentLoan.slotNo);
            }
        }));

        resolve(response);
    });

    if (promise) {
        response = { success: true };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateGroup(groupData, slotNo) {
    let group = {...groupData};
    group.availableSlots = group.availableSlots.filter(s => s !== slotNo);
    group.noOfClients = group.noOfClients + 1;
    if (group.capacity == group.noOfClients) {
        group.status = 'full';
    } else {
        group.status = 'available';
    }
    const groupId = group._id;
    delete group._id;
    await graph.mutation(
        updateQl(GROUP_TYPE('groups'),
        {
            set: {
                ... group
            },
            where: {
                _id: { _eq: groupId }
            }
        })
    );

    // await db.collection('groups').updateOne({ _id: new ObjectId(groupId) }, {$set: { ...group }});
}