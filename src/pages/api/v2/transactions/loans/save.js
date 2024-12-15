import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import { GraphProvider } from '@/lib/graph/graph.provider'
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util'
import { CASH_COLLECTIONS_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields'
import { generateUUID } from '@/lib/utils'
import { filterGraphFields } from '@/lib/graph.functions';
import { savePendingLoans } from '../cash-collections/update-pending-loans';

const graph = new GraphProvider();
const loansType = createGraphType("loans", LOAN_FIELDS)
const cashCollectionsType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS)
const groupType =createGraphType("groups", GROUP_FIELDS)

export default apiHandler({
    post: save
});

async function save(req, res) {
    const user_id = req?.auth?.sub;
    const mutationList = [];
    const addToMutationList = addToList => mutationList.push(addToList(`bulk_update_${mutationList.length}`));
    let response = {};

    const loanData = req.body;
    const group = loanData.group;

    let mode;
    let oldLoanId;

    const currentDate = loanData.currentDate;

    delete loanData.currentDate;
    delete loanData.group;
    delete loanData.groupStatus;
    delete loanData.pendings;
    delete loanData.origin;

    // TODO: confirm with donie, migrated data has mixed types
    // the mixed type from mongo during migration
    loanData.coMaker = loanData.coMaker?.toString();

    if (loanData.hasOwnProperty('mode')) {
        mode = loanData.mode;
        oldLoanId = loanData.oldLoanId;
        delete loanData.mode;
        delete loanData.oldLoanId;
        delete loanData.groupCashCollections;
        delete loanData.loanOfficer;
    }

    logger.debug({user_id, page: `Saving Loan: ${loanData.clientId}`, mode: mode, data: loanData});
    const spotExist = (await graph.query(queryQl(loansType(), {
      where: {
        slotNo: { _eq: loanData.slotNo },
        groupId: { _eq: loanData.groupId },
        status: { _in: ['active', 'completed', 'pending']}
      }
    }))).data?.loans;

    const pendingExist = (await graph.query(queryQl(loansType(), {
      where: {
        slotNo: { _eq: loanData.slotNo },
        clientId: { _eq: loanData.clientId },
        status: { _eq: 'pending' }
      }
    }))).data?.loans;
      
    const groupCashCollections = (await graph.query(queryQl(cashCollectionsType(), {
      where: {
        groupId: { _eq: loanData.groupId },
        dateAdded: { _eq: currentDate },
      }
    }))).data?.cashCollections;

    let groupStatus = 'pending';
    let hasExistingCC = false;
    if (groupCashCollections.length > 0) {
        const groupStatuses = groupCashCollections.filter(cc => cc.groupStatus === 'pending');
        if (groupStatuses.length === 0) {
            groupStatus = 'closed';
        }

        const existingCC = groupCashCollections.find(cc => cc.clientId === loanData.clientId && cc.status === 'completed');
        hasExistingCC = existingCC ? true : false;
    }

    if ((mode !== 'reloan' && mode !== 'advance' && mode !== 'active') && spotExist.length > 0) {
        response = {
            error: true,
            fields: [['slotNo']],
            message: `Slot Number ${loanData.slotNo} is already taken in group ${loanData.groupName}`
        };
    } else if (pendingExist.length > 0) {
        response = {
            error: true,
            fields: [['clientId']],
            message: `Client has a PENDING release already!`
        };
    } else {
        const loans = (await graph.query(queryQl(loansType(), {
          where: {
            clientId: { _eq: loanData.clientId },
            status: { _eq: 'active' }
          }
        }))).data?.loans;

        if (loans.length > 0 && mode !== 'advance') {
            response = {
                error: true,
                fields: ['clientId'],
                message: `Client ${loanData.fullName} already have an active loan`
            };
        } else {
            let finalData = {...loanData};
            if (finalData.occurence === 'weekly') {
                if (finalData.loanCycle === 1) {
                    finalData.mcbu = 50;
                    finalData.mcbuCollection = 50;
                }
                finalData.mcbuTarget = 50;
            }

            if (mode === 'reloan') {
                finalData.modifiedDateTime = new Date();
            }

            delete finalData.currentReleaseAmount;
            delete finalData.currentDate;
            // if (finalData?.loanFor == 'tomorrow') {
            //     let dateOfRelease = finalData.dateOfRelease;
            //     const dayName = moment(dateOfRelease).format('dddd');
                // if (dayName == 'Saturday') {
                //     dateOfRelease = moment(dateOfRelease).add(2, 'days').format('YYYY-MM-DD');
                // } else if (dayName == 'Sunday') {
                //     dateOfRelease = moment(dateOfRelease).add(1, 'days').format('YYYY-MM-DD');
                // }
                
            //     // finalData.dateOfRelease = tomorrowDate;
            //     finalData.admissionDate = dateOfRelease;
            //     finalData.dateGranted = dateOfRelease;
            // } else {
            //     finalData.dateOfRelease = finalData.admissionDate;
            // }

            finalData.prevLoanId = oldLoanId;

            if (mode == 'advance' || mode == 'active') {
                finalData.advanceTransaction = true;
            }

            logger.debug({user_id, page: `Saving Loan: ${loanData.clientId}`, message: 'Final Data', data: finalData});

            const loanId = generateUUID();
            addToMutationList(alias => insertQl((loansType(alias)), {
                objects: [filterGraphFields(LOAN_FIELDS, {
                  ...finalData,
                  _id: loanId,
                  dateGranted: currentDate,
                  insertedDateTime: new Date()
                })]
              }));

            if (mode === 'reloan') {
                await updateLoan(user_id, oldLoanId, finalData, currentDate, mode, addToMutationList);
            } else if (mode === 'advance' || mode === 'active') {
                await updateLoan(user_id, oldLoanId, finalData, currentDate, mode, addToMutationList);
            } else if (!hasExistingCC) {
                await updateGroup(user_id, loanData, addToMutationList, loanId);
            }

            if (mode !== 'advance' && mode !== 'active' && finalData?.loanFor !== 'tomorrow' && finalData.loanCycle > 1) {
                const reloan = mode === 'reloan';
                await saveCashCollection(user_id, loanData, reloan, group, loanId, currentDate, groupStatus, addToMutationList);
            }
            console.log('saving....')
            await graph.mutation(
                ... mutationList
            );

            const [loan] = (await graph.query(queryQl(loansType(), { where: { _id: { _eq: loanId } } }))).data.loans;

            if (hasExistingCC) {
                await savePendingLoans(user_id, [finalData], loanId);
            }

            response = {
                success: true,
                loan: loan
            }
        }
    }

    res.send(response);
}


async function updateGroup(user_id, loan, addToMutationList, loanId) {
    //let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
    logger.debug({user_id, page: `Updating Group For Loan: ${loanId}`, data: loan});
    let group = await graph.query(queryQl(groupType(), { where: { _id: { _eq: loan.groupId } } })).then(res => res.data.groups);
    if (group.length > 0) {
        group = group[0];
        group.noOfClients = group.noOfClients ? group.noOfClients : 0;

        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
        group.noOfClients = group.noOfClients + 1;

        if (group.noOfClients === group.capacity) {
            group.status = 'full';
        }

        addToMutationList(alias => updateQl(groupType(alias), {
                set: {
                    noOfClients: group.noOfClients,
                    availableSlots: group.availableSlots,
                    status: group.status,
                },
                where: {
                    _id: { _eq: loan.groupId }
                }
            })
        );
    }
}

async function updateLoan(user_id, loanId, loanData, currentDate, mode, addToMutationList) {
    let loan = (await graph.query(queryQl(loansType(), { where: { _id: { _eq: loanId }}}))).data?.loans;
    logger.debug({user_id, page: `Updating Old Loan: ${loanId}`, mode: mode, data: loan});
    if (loan.length > 0) {
        loan = loan[0];

        delete loan.loanOfficer;
        delete loan.groupCashCollections;

        if (mode === 'advance' || mode === 'active') {
            loan.advance = true;
            loan.advanceDate = currentDate;
        } else {
            loan.mcbu = loan.mcbu - loanData.mcbu;
            loan.status = 'closed';
            logger.debug({user_id, page: `Updating Cash Collection: ${loanId}`, data: loan});
            console.log(loanId)
            addToMutationList(alias => updateQl(cashCollectionsType(alias), {
                set: { status: 'closed' },
                where: {
                  clientId: { _eq: loan.clientId },
                  dateAdded: { _eq: currentDate },
                }
              }));
        }

        addToMutationList(alias => updateQl(loansType(alias), {
          set: filterGraphFields(LOAN_FIELDS, { ...loan }),
          where: { _id: { _eq: loanId } },
        }));
    }
}

async function saveCashCollection(user_id, loan, reloan, group, loanId, currentDate, groupStatus, addToMutationList) {
    const currentReleaseAmount = loan.amountRelease;

    const cashCollection = (await graph.query(queryQl(cashCollectionsType(), {
      where: {
        clientId: { _eq: loan.clientId },
        dateAdded: { _eq: currentDate },
      }
    }))).data?.cashCollections;

    logger.debug({user_id, page: `Saving Cash Collection: ${loanId}`, cashCollection: cashCollection});
    if (cashCollection.length === 0) {
        let mcbu = loan.mcbu ? loan.mcbu : 0;
        let mcbuCol = 0;

        if (loan.loanCycle == 1) {
            groupStatus = 'closed';
            if (loan.occurence == 'weekly') {
                mcbu = 50;
                mcbuCol = 50;
            }
        }

        let data = {
            loanId: loanId,
            branchId: loan.branchId,
            groupId: loan.groupId,
            groupName: loan.groupName,
            loId: loan.loId,
            clientId: loan.clientId,
            slotNo: loan.slotNo,
            loanCycle: loan.loanCycle,
            mispayment: 'false', // TODO confirm with donie if needs to be a boolean, migrated data has mixed types
            mispaymentStr: 'No',
            collection: 0,
            excess: loan.excess,
            total: 0,
            noOfPayments: 0,
            activeLoan: 0,
            targetCollection: 0,
            amountRelease: 0,
            loanBalance: 0,
            paymentCollection: 0,
            occurence: group.occurence,
            currentReleaseAmount: currentReleaseAmount,
            fullPayment: loan.fullPayment,
            mcbu: mcbu,
            mcbuCol: mcbuCol,
            mcbuWithdrawal: 0,
            mcbuReturnAmt: 0,
            remarks: '',
            status: loan.status,
            dateAdded: currentDate,
            insertedDateTime: new Date(),
            groupStatus: groupStatus,
            origin: 'automation-loan'
        };

        if (data.occurence === 'weekly') {
            data.mcbuTarget = 50;
            data.groupDay = group.day;

            if (!reloan && data.loanCycle !== 1) {
                data.mcbuCol = loan.mcbu ? loan.mcbu : 0;
            }
        }

        if (loan.status === 'reject') {
            data.rejectReason = loan.rejectReason;
        }
        logger.debug({user_id, page: `Saving Cash Collection: ${loan.clientId}`, data: data});
        addToMutationList(alias => insertQl(cashCollectionsType(alias), { objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, {
            ...data,
            _id: generateUUID(),
        })]}));
    } else {
        logger.debug({user_id, page: `Updating Loan: ${loan.clientId}`});

        addToMutationList(alias => updateQl(cashCollectionsType(alias), {
          set: {
            currentReleaseAmount: currentReleaseAmount,
            status: loan.status,
            modifiedBy: "automation-loan",
            modifiedDateTime: new Date(),
          },
          where: {
            _id: { _eq: cashCollection[0]._id }
          }
        }));
    }
}