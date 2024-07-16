import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider'
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util'
import { CASH_COLLECTIONS_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields'
import { generateUUID } from '@/lib/utils'
import { filterGraphFields } from '@/lib/graph.functions';

const graph = new GraphProvider();
const loansType = createGraphType("loans", LOAN_FIELDS)();
const cashCollectionsType = createGraphType("cashCollections", CASH_COLLECTIONS_FIELDS)();

export default apiHandler({
    post: save
});

async function save(req, res) {
    let response = {};

    const loanData = req.body;
    const group = loanData.group;

    let mode;
    let oldLoanId;
    let reloan = false;

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

    logger.debug({page: `Saving Loan: ${loanData.clientId}`, mode: mode, data: loanData});
    const spotExist = (await graph.query(queryQl(loansType, {
      where: {
        slotNo: { _eq: loanData.slotNo },
        groupId: { _eq: loanData.groupId },
        status: { _in: ['active', 'completed', 'pending']}
      }
    }))).data?.loans;

    const pendingExist = (await graph.query(queryQl(loansType, {
      where: {
        slotNo: { _eq: loanData.slotNo },
        clientId: { _eq: loanData.clientId },
        status: { _eq: 'pending' }
      }
    }))).data?.loans;
      
    const groupCashCollections = (await graph.query(queryQl(cashCollectionsType, {
      where: {
        groupId: { _eq: loanData.groupId },
        dateAdded: { _eq: currentDate },
      }
    }))).data?.cashCollections;

    let groupStatus = 'pending';
    if (groupCashCollections.length > 0) {
        const groupStatuses = groupCashCollections.filter(cc => cc.groupStatus === 'pending');
        if (groupStatuses.length === 0) {
            groupStatus = 'closed';
        }
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
        const loans = (await graph.query(queryQl(loansType, {
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
            logger.debug({page: `Saving Loan: ${loanData.clientId}`, message: 'Final Data', data: finalData});
            delete finalData.currentReleaseAmount;
            delete finalData.currentDate;
            if (finalData?.loanFor == 'tomorrow') {
                let tomorrowDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
                const dayName = moment(tomorrowDate).format('dddd');
                if (dayName == 'Saturday') {
                    tomorrowDate = moment(tomorrowDate).add(2, 'days').format('YYYY-MM-DD');
                } else if (dayName == 'Sunday') {
                    tomorrowDate = moment(tomorrowDate).add(1, 'days').format('YYYY-MM-DD');
                }
                
                finalData.dateOfRelease = tomorrowDate;
                finalData.admissionDate = tomorrowDate;
                finalData.dateGranted = tomorrowDate;
            }

            const loanId = generateUUID();
            const loan = (await graph.mutation(insertQl(loansType, {
              objects: [filterGraphFields(LOAN_FIELDS, {
                ...finalData,
                _id: loanId,
                dateGranted: currentDate,
                insertedDateTime: new Date()
              })]
            }))).data?.loans?.returning?.[0];

            if (mode === 'reloan') {
                reloan = true;
                await updateLoan(oldLoanId, finalData, currentDate);
            } else if (mode === 'advance' || mode === 'active') {
                await updateLoan(oldLoanId, finalData, currentDate, mode, groupStatus);
            } else {
                await updateGroup(loanData);
            }

            if (mode !== 'advance' && mode !== 'active' && finalData?.loanFor !== 'tomorrow') {
                await saveCashCollection(loanData, reloan, group, loanId, currentDate, groupStatus);
                // await updateUser(loanData);
            }

            response = {
                success: true,
                loan: loan
            }
        }
    }

    res.send(response);
}

// this will reflect on next login
async function updateUser(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let user = await db.collection('users').find({ _id: new ObjectId(loan.loId) }).toArray();
    if (user.length > 0) {
        user = user[0];
        
        if (!user.hasOwnProperty('transactionType')) {
            user.transactionType = loan.occurence;

            delete user._id;
            await db.collection('users').updateOne(
                {  _id: new ObjectId(loan.loId) },
                {
                    $set: { ...user }
                }, 
                { upsert: false }
            );
        }
    }
}


async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];
        group.noOfClients = group.noOfClients ? group.noOfClients : 0;

        group.availableSlots = group.availableSlots.filter(s => s !== loan.slotNo);
        group.noOfClients = group.noOfClients + 1;

        if (group.noOfClients === group.capacity) {
            group.status = 'full';
        }

        delete group._id;
        await db.collection('groups').updateOne(
            {  _id: new ObjectId(loan.groupId) },
            {
                $set: { ...group }
            }, 
            { upsert: false }
        );
    }
}

async function updateLoan(loanId, loanData, currentDate, mode) {
    let loan = (await graph.query(queryQl(loansType, { where: { _id: { _eq: loanId }}}))).data?.loans;
    logger.debug({page: `Updating Old Loan: ${loanId}`, mode: mode, data: loan});
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
            logger.debug({page: `Updating Cash Collection: ${loanId}`, data: loan});
            await graph.mutation(updateQl(cashCollectionsType, {
              set: { status: 'closed' },
              where: {
                loanId: { _eq: loanId },
                dateAdded: { _eq: currentDate },
              }
            }));
        }

        await graph.mutation(updateQl(loansType, {
          set: filterGraphFields(LOAN_FIELDS, { ...loan }),
          where: { _id: { _eq: loanId } },
        }))
    }
}

async function saveCashCollection(loan, reloan, group, loanId, currentDate, groupStatus) {
    const currentReleaseAmount = loan.amountRelease;

    const cashCollection = (await graph.query(queryQl(cashCollectionsType, {
      where: {
        clientId: { _eq: loan.clientId },
        dateAdded: { _eq: currentDate }
      }
    }))).data?.cashCollections;

    logger.debug({page: `Saving Cash Collection: ${loanId}`, cashCollection: cashCollection});
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
        logger.debug({page: `Saving Cash Collection: ${loan.clientId}`, data: data});
        await graph.mutation(insertQl(cashCollectionsType, { objects: [filterGraphFields(CASH_COLLECTIONS_FIELDS, {
            ...data,
            _id: generateUUID(),
        })]}));
    } else {
        logger.debug({page: `Updating Loan: ${loan.clientId}`});
        await graph.mutation(updateQl(cashCollectionsType, {
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