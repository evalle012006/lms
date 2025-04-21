import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount, getCurrentDate } from '@/lib/date-utils';
import moment from 'moment';

export default apiHandler({
    post: processActiveLoan
});
// not in used
async function processActiveLoan(req, res) {
    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const loans = await db.collection('loans').find( {$expr: {$or: [{$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}]}} ).toArray();
    const currentDate = getCurrentDate();

    if (loans.length > 0) {
        loans.map(loan => {
            const loanId = loan._id + '';
            const lastUpdated = loan.lastUpdated;
            const temp = {...loan};
            if (loan.status === 'active') {
                if (lastUpdated) {
                    if (lastUpdated !== moment(currentDate).format('YYYY-MM-DD')) {
                        getCashCollections(loanId).then(collection => {
                            if (collection.length > 0) {
                                // automate mispayments
                                const lastPayment = collection[collection.length - 1];
                                const lastDatePayment = moment(lastPayment.dateAdded).add(1, 'days').format('YYYY-MM-DD');
                                const diff = getWeekDaysCount(new Date(lastDatePayment), currentDate);
                                if (diff > 1) {
                                    temp.mispayment = temp.mispayment + diff;
                                    temp.lastUpdated = moment(currentDate).format('YYYY-MM-DD');
                                }
                
                                updateLoan(temp);
                                // automate dilenquent clients if loan is not paid for how many days?
                            } else {
                                const diff = getWeekDaysCount(new Date(loan.startDate), currentDate);
                                if (diff > 0) {
                                    temp.mispayment = diff;
                                    temp.lastUpdated = moment(currentDate).format('YYYY-MM-DD');
                                }
    
                                updateLoan(temp);
                            }
                        });
                    }
                } else {
                    // automate mispayments
                    const diff = getWeekDaysCount(new Date(loan.startDate), currentDate);
                    if (diff > 0) {
                        temp.mispayment = diff;
                        temp.lastUpdated = moment(currentDate).format('YYYY-MM-DD');
                    }
    
                    updateLoan(temp);
                }
            } 
            // else if (loan.status === 'completed' && loan.loanBalance <= 0) {
            //     const fiveDaysFromNow = moment(loan.fullPaymentDate).add(5, 'days').format('YYYY-MM-DD');

            //     if (currentDate === fiveDaysFromNow) {
            //         loan.status = 'close';
            //         updateLoan(loan);
            //         updateGroup(loan);
            //     }
            // }
        });
    }

    response = { success: true, loans: loans };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getCashCollections(loanId) {
    const { db } = await connectToDatabase();

    const collection = await db.collection('cashCollections').find({ loanId: loanId }).toArray();
    
    return collection;
}

async function updateLoan(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const loanId = loan._id;
    delete loan._id;

    const loanResp = await db
        .collection('loans')
        .updateOne(
            { _id: new ObjectId(loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false });

    return loanResp;
}

async function updateGroup(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let group = await db.collection('groups').find({ _id: new ObjectId(loan.groupId) }).toArray();
    if (group.length > 0) {
        group = group[0];

        if (group.status === 'full') {
            group.status = 'available';
        }

        group.availableSlots.push(loan.slotNo);
        group.availableSlots.sort((a, b) => { return a - b; });
        group.noOfClients = group.noOfClients - 1;

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