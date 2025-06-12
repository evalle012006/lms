import { CASH_COLLECTIONS_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import { savePendingLoans } from './update-pending-loans';
import { findGroups } from '@/lib/graph.functions';

const graph = new GraphProvider();
const COLLECTION_TYPE = createGraphType('cashCollections', '_id')
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)
const CLIENT_TYPE = createGraphType('client', `${CLIENT_FIELDS}`);
const GROUP_TYPE = createGraphType('groups', `${GROUP_FIELDS}`)

export default apiHandler({
    post: save
});

async function save(req, res) {
    const user_id = req?.auth?.sub;
    let response = {};
    let statusCode = 200;
    let data = req.body;
    const currentDate = data.currentDate;
    const currentTime = data.currentTime;
    data.collection = JSON.parse(data.collection);

    const mutationQl = [];

    if (data.collection.length > 0) {
        let existCC = [];
        let newCC = [];
        // let prevCommpleted = [];
        
        logger.debug({user_id, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`});
        const promiseData = data.collection.map(async cc => {
            if (cc.status !== "totals") {

                const collection = JSON.parse(JSON.stringify(cc))// clone entry to avoid reference update
                delete collection.reverted;

                // get loan snapshot 
                let [loan] = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
                const loan_history = {
                    loan_id: loan._id,
                    client_id: loan.clientId,
                    user_id: user_id,
                    data: loan
                };

                mutationQl.push(
                    insertQl(createGraphType('loans_history', `_id`)('loans_history_' + (mutationQl.length + 1)), {
                        objects: [loan_history]
                    })
                );

                const timeArgs = currentTime.split(" ");
                // put this in the config settings should be by hour and minute?
                // collection.latePayment = (timeArgs[1] == 'PM' && timeArgs[0].startsWith('6')) ? true : false;
                collection.timeAdded = currentTime;

                if (cc.occurence === "weekly") {
                    if (collection.remarks && (collection.remarks.value?.startsWith('excused-') || collection.remarks.value === 'delinquent')) {
                        collection.mcbuTarget = 0;
                    } else {
                        collection.mcbuTarget = 50;
                    }
                }

                if (collection.status === 'completed' && collection.loanBalance <= 0 && collection?.remarks?.value !== 'offset-matured-pd') {
                    collection.pastDue = 0;
                }

                if (collection.remarks?.value == 'matured-past due') {
                    collection.mispayment = false;
                }

                if (!collection.transferId) {
                    collection.transfer = false;
                    collection.transferred = false;
                }

                if (collection.loanBalance <= 0) {
                    if (collection.occurence == 'daily') {
                        collection.noOfPayments = 60;
                        // if (collection.mcbu % 600 !== 0 && collection.remarks?.value == 'reloaner-cont'
                        //     && !collection.mcbuWithdrawalFlag && collection.mcbuWithdrawal == 0 
                        //     && collection.fullPaymentDate == currentDate) {
                        //     const remainder = collection.mcbu % 600;
                        //     collection.mcbu += (600 - remainder);
                        // }

                        if (!collection.mcbuInterestFlag) {
                            collection.mcbuInterest = 0;
                        }
                    } else {
                        collection.noOfPayments = 24;
                    }
                }
                
                // possible issue with completed and null loan and reloan fullpayment date 
                if (collection.status === 'completed' || (collection.status == 'pending' && collection.loanCycle > 1) || collection.status === 'closed') {
                    collection.fullPaymentDate = (collection.fullPaymentDate || collection.fullPaymentDate == "") ? collection.fullPaymentDate : currentDate;
                }

                if (collection.status === 'completed' && (collection?.remarks?.value?.startsWith('offset') || collection.mcbuReturnAmt > 0)) {
                    collection.status = "closed";
                }

                let activeLoan = collection?.activeLoan;
                if (collection.status != 'pending' && collection.activeLoan == 0) {
                    activeLoan = collection?.prevData?.activeLoan ? collection.prevData?.activeLoan : 0;
                }

                logger.debug({user_id, page: `Saving Cash Collection - Group ID: ${data.collection[0]?.groupId}`, currentDate: currentDate, data: collection});
                if (collection.hasOwnProperty('_id') && collection._id != collection?.loanId) {
                    collection.modifiedDateTime = new Date();
                    const existCollection = {...assignNullValues(collection)};
                    delete existCollection.mcbuHistory;

                    existCollection = await fixCashCollectionReference(existCollection);
                    existCC.push(existCollection);
                } else {
                    collection.insertedDateTime = new Date();
                    const newCollection = {...assignNullValues(collection)};
                    delete newCollection.mcbuHistory;

                    collection = await fixCashCollectionReference(collection);
                    newCC.push(collection);
                }
                
                if (collection.status !== "tomorrow" && collection.status !== "pending" && !collection.draft) {
                    await updateLoan(user_id, mutationQl, collection, currentDate)
                    await updateClient(user_id, mutationQl, collection);
                }

                if (collection.status == 'tomorrow' && collection.mcbuWithdrawal > 0 && !collection.hasMcbuWithdrawal) {
                    await updateLoanMcbuWithdrawal(user_id, mutationQl, collection)
                }
            }
        });

        await Promise.all(promiseData);

        if (newCC.length > 0) {
            await saveCollection(mutationQl, newCC, currentDate);
        }

        if (existCC.length > 0) {
            await updateCollection(mutationQl, existCC);
        }

        // save all changes in one request
        await graph.mutation(
            ... mutationQl
        );

        const reverted = data.collection.filter(c => c.fromReverted && !c.advance);
        if (reverted.length == 0) {
            const pendingLoans = data.collection.filter(c => (c.status === 'pending' || c.status === 'closed') && c.advance == true);
            if (pendingLoans.length > 0) {
                await savePendingLoans(user_id, pendingLoans);
            }
        }
    }

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function fixCashCollectionReference(cashCollection) {
    // fix cashCollection loId and use the groupId cashCollection
    if(!cashCollection.groupId) {
        throw { message: 'No group id for cashCollection loanId = ' + cashCollection.loanId };
    }

    const [group] = await findGroups({ _id: { _eq: cashCollection.groupId }});

    if(!group) {
        throw { message: 'No group found = ' + cashCollection.loanId };
    }

    // set the cashCollection loId from group loanOfficerId
    if(group.loanOfficerId) {
        cashCollection.loId = group.loanOfficerId;
    }
}

function cleanUpCollection(c) {
    const fields = CASH_COLLECTIONS_FIELDS.split('\n').map(f => f.trim()).filter(f => !!f);

    const allow_fields = Object.keys(c).filter(c => fields.includes(c));
    
    // console.log(allow_fields);
    const cc = allow_fields.reduce((g, f) => ({
        ... g,
        [f]: c[f],
    }), {});


    // console.log(cc);

    return ({
        ... cc,
        loanTerms: `${c.loanTerms}`,
        coMaker: c.coMaker === '-' ? null : +c.coMaker,
        noOfPayments: c.noOfPayments === '-' ? 0 : +c.noOfPayments,
    });
}

async function saveCollection(mutationQL, collections, currentDate) {
    const objects = collections.map(c => ({
        ... cleanUpCollection(c),
        _id: generateUUID(),
        dateAdded: currentDate,
    }))

    mutationQL.push(
        insertQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)),{
                objects: objects
            }
        )
    )
}

async function updateCollection(mutationQL, collections) {

    collections.map(c => {
        const collectionId = c._id;
        delete c._id;
        if (c?.origin === 'pre-save') {
            delete c.origin;
        }

        mutationQL.push(
            updateQl(COLLECTION_TYPE('collections_' + (mutationQL.length + 1)), {
                set: {
                    ... cleanUpCollection(c),
                    origin: null,
                    reverted: null,
                },
                where: { _id: { _eq: collectionId } }
            })
        );
    });
}

async function updateLoan(user_id, mutationQL, collection, currentDate) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan: ${collection.loanId}`});
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        loan.loanBalance = collection.loanBalance;
        loan.modifiedDateTime = new Date();

        if (collection?.revertedDate) {
            loan.revertedDateTime = collection.revertedDate;
        }

        if (collection.remarks && collection.remarks.value === 'matured-past due') {
            loan.activeLoan = 0;
            loan.maturedPD = true;
            loan.maturedPDDate = currentDate;
        }
        
        loan.amountRelease = collection.amountRelease;
        loan.noOfPayments = collection.noOfPayments !== '-' ? collection.noOfPayments : 0;
        loan.status = collection.status;
        loan.pastDue = collection.pastDue;
        loan.advanceDays = collection?.advanceDays ? collection.advanceDays : 0;

        loan.mcbuTarget = collection.mcbuTarget;
        loan.mcbu = collection.mcbu < 0 ? 0 : collection.mcbu;
        if (!loan.mcbuCollection || loan.mcbuCollection < 0) {
            loan.mcbuCollection = 0;
        }
        loan.mcbuCollection = loan.mcbuCollection ? loan.mcbuCollection + parseFloat(collection.mcbuCol) : parseFloat(collection.mcbuCol);

        if (!collection?.hasMcbuWithdrawal) {
            if (loan.occurence == 'daily' && collection.remarks) {
                if (collection.remarks.value == 'reloaner-wd') {
                    loan.mcbuWithdrawal = collection.mcbuWithdrawal;
                } else if (collection.remarks.value == 'reloaner-cont') {
                    loan.mcbuWithdrawal = 0;
                }
            } else {
                loan.mcbuWithdrawal = loan.mcbuWithdrawal ? loan.mcbuWithdrawal + parseFloat(collection.mcbuWithdrawal) : collection.mcbuWithdrawal ? parseFloat(collection.mcbuWithdrawal) : 0;
            }

            if (collection.mcbuWithdrawalFlag) {
                loan.mcbuWithdrawal = collection.mcbuWithdrawal;
            }
        }

        // if (collection?.mcbuDailyWithdrawal > 0) {
        //     if (loan.hasOwnProperty('mcbuDailyWithdrawal')) {
        //         loan.mcbuDailyWithdrawal += collection.mcbuDailyWithdrawal;
        //     } else {
        //         loan.mcbuDailyWithdrawal = collection.mcbuDailyWithdrawal;
        //     }
        // }

        if (collection.hasOwnProperty('mcbuInterest')) {
            loan.mcbuInterest = loan.mcbuInterest ? loan.mcbuInterest + collection.mcbuInterest : collection.mcbuInterest !== '-' ? collection.mcbuInterest : 0;
        }
        
        if (collection.remarks && collection.remarks.value === "past due") {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue + 1 : 1;
        } else {
            loan.noPastDue = loan.noPastDue ? loan.noPastDue : 0;
        }

        if (collection.mcbuInterest > 0) {
            loan.mcbuInterest = collection.mcbuInterest;
        }

        if (collection.mcbuReturnAmt > 0) {
            loan.mcbuReturnAmt = collection.mcbuReturnAmt;
        } else {
            loan.mcbuReturnAmt = 0;
        }

        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        if (collection.mispayment) {
            loan.mispayment = loan.mispayment + 1;
        }

        if (collection.hasOwnProperty('maturedPastDue')) {
            loan.maturedPastDue = collection.maturedPastDue;
            loan.mispayment = 0;
        }

        loan.history = collection.history;

        if (collection.loanBalance <= 0) {
            loan.status = collection.status;
            if (collection.status === 'tomorrow') {
                loan.status = 'active';
            }
            
            loan.activeLoan = 0;
            if (!loan.fullPaymentDate) {
                loan.fullPaymentDate = collection.fullPaymentDate;
            }
            
            loan.amountRelease = 0;
            if (collection?.remarks?.value !== 'offset-matured-pd') {
                loan.noPastDue = 0;
                loan.pastDue = 0;
            }

            if (collection.status == 'closed') {
                loan.loanCycle = 0;
                loan.remarks = collection.closeRemarks;
                loan.status = 'closed';
                loan.closedDate = currentDate;
                loan.dateModified = currentDate;
            }
        }

        loan.lastUpdated = currentDate;
        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        )

        return { success: true }
    }
}

async function updateLoanMcbuWithdrawal(user_id, mutationQL, collection) {
    let loan = await graph.query(queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: collection.loanId } } })).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal: ${collection.loanId}`});
    if (loan.length > 0) {
        loan = loan[0];
        delete loan.groupStatus;
        
        delete loan.groupCashCollections;
        delete loan.loanOfficer;
        delete loan.loanReleaseStr;
        delete loan.reverted;
        
        loan.mcbu = collection.mcbu;
        loan.mcbuWithdrawal = collection.mcbuWithdrawal;

        logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Due to Withdrawal`, data: loan});
        const loanId = loan._id;
        delete loan._id;

        mutationQL.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQL.length + 1)), {
                set: {
                    ... assignNullValues(loan)
                },
                where: {
                    _id: { _eq: loanId }
                }
            })
        )

        return { success: true }
    }
}

async function updateClient(user_id, mutationQl, loan) {

    let client = await graph.query(queryQl(CLIENT_TYPE('client'), { where: { _id: { _eq: loan.clientId } } })).then(res => res.data.client);
    if (client.length > 0) {
        client = client[0];

        client.status = loan.clientStatus;

        if (client.status === 'offset') {
            client.oldLoId = client.loId;
            client.oldGroupId = client.groupId;
            client.groupId = null;
            client.loId = null;
        }

        // let mcbuHistory = [];
        // const currentMonth = moment(currentDate).month() + 1;
        // const currentYear = moment(currentDate).year();
        // if (client.hasOwnProperty('mcbuHistory')) {
        //     mcbuHistory = [...client.mcbuHistory];
        //     const yearIndex = mcbuHistory.findIndex(h => h.year === currentYear);
        //     if (yearIndex > -1) {
        //         let mcbuMonths = mcbuHistory[yearIndex].mcbuMonths;
        //         const monthIndex = mcbuMonths.findIndex(m => m.month === currentMonth);
        //         if (monthIndex > -1) {
        //             let mcbuMonth = {...mcbuMonths[monthIndex]};
        //             mcbuMonth.mcbu = loan.mcbu;
        //             mcbuMonths[monthIndex] = mcbuMonth;
        //         } else {
        //             mcbuMonths.push({ month: currentMonth, mcbu: loan.mcbu });
        //         }

        //         mcbuHistory[yearIndex] = mcbuMonths;
        //     } else {
        //         mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
        //     }
        // } else {
        //     mcbuHistory.push({ year: currentYear, mcbuMonths: [ {month: currentMonth, mcbu: loan.mcbu} ] });
        // }

        // client.mcbuHistory = mcbuHistory;

        if ((loan.remarks && loan.remarks.value?.startsWith('delinquent') && loan.delinquent)) {
            client.delinquent = true;
        }


        mutationQl.push(
            updateQl(CLIENT_TYPE('clients_' + (mutationQl.length + 1)), {
                set: {
                    ... assignNullValues(client, 'client')
                },
                where: {
                    _id: { _eq: loan.clientId }
                }
            })
        )
        
        if (loan.remarks && loan.remarks.value?.startsWith('offset')) {
            // await updateLoanClose(mutationQl, loan, currentDate);
            await updateGroup(user_id, mutationQl, loan);
        }
    }
}

async function updateLoanClose(user_id, mutationQl, loanData, currentDate) {
    let loan = await graph.query(
        queryQl(LOAN_TYPE('loans'), { where: { _id: { _eq: loanData.loanId } } })
    ).then(res => res.data.loans);
    logger.debug({user_id, page: `Saving Cash Collection - Updating Loan Close`, loanSize: loan.length});
    if (loan.length > 0) {
        loan = loan[0];

        loan.loanCycle = 0;
        loan.remarks = loanData.closeRemarks;
        loan.status = 'closed';
        loan.closedDate = currentDate;
        loan.dateModified = currentDate;
        loan.fullPaymentDate = currentDate;
        
        delete loan._id;
        logger.debug({page: `Saving Cash Collection - Updating Loan Close`, data: loan});

        mutationQl.push(
            updateQl(LOAN_TYPE('loans_' + (mutationQl.length + 1)), {
                set: assignNullValues(loan),
                where: {
                    _id: { _eq: loanData.loanId }
                }
            })
        );
    }
}

async function updateGroup(user_id, mutationQl, loan) {
    let group = await graph.query(
        queryQl(GROUP_TYPE('groups'), {where: { _id: { _eq: loan.groupId } }})
    ).then(res => res.data.groups);

    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        const slotNo = parseInt(loan.slotNo)
        if (!group.availableSlots.includes(slotNo)) {
            group.availableSlots.push(slotNo);
            group.availableSlots.sort((a, b) => { return a - b; });
            group.noOfClients = group.noOfClients - 1;
        } else {
            const index = group.availableSlots.indexOf(slotNo);
            if (index > -1) {
                group.availableSlots.splice(index, slotNo);
                group.availableSlots.sort((a, b) => { return a - b; });
                group.noOfClients = group.noOfClients + 1;
            }
        }

        // group.submitted = true;

        delete group._id;

        mutationQl.push(
            updateQl(GROUP_TYPE('groups_' + (mutationQl.length + 1)), {
                set: {
                    ... group
                },
                where: {
                    _id: { _eq: loan.groupId }
                }
            })
        );
    }
}

const assignNullValues = (obj, origin) => {
    let cc = { ...obj };

    if (origin == 'client') {
        cc.delinquent = cc.delinquent ? cc.delinquent : false;
        cc.duplicate = cc.duplicate ? cc.duplicate : false;

        return cc;
    }

    cc.reverted = cc.reverted ? cc.reverted : false;
    cc.revertedTransfer = cc.revertedTransfer ? cc.revertedTransfer : false;
    cc.ldfApproved = cc.ldfApproved ? cc.ldfApproved : false;
    cc.maturedPD = cc.maturedPD ? cc.maturedPD : false;
    cc.transfer = cc.transfer ? cc.transfer : false;
    cc.transferred = cc.transferred ? cc.transferred : false;
    cc.advance = cc.advance ? cc.advance : false;
    cc.transferredReleased = cc.transferredReleased ? cc.transferredReleased : false;
    cc.advanceTransaction =  cc.advanceTransaction ? cc.advanceTransaction : false;

    return cc;
}
