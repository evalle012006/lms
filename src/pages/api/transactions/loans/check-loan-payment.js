import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: processActiveLoan
});

async function processActiveLoan(req, res) {
    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const loans = await db.collection('loans').find({ status: 'active' }).toArray();
    const currentDate = moment().format('YYYY-MM-DD');

    if (loans.length > 0) {
        loans.map(loan => {
            const loanId = loan._id + '';
            const lastUpdated = loan.lastUpdated;
            const temp = {...loan};
            if (lastUpdated) {
                if (lastUpdated !== currentDate) {
                    getCashCollections(loanId).then(collection => {
                        if (collection.length > 0) {
                            // automate mispayments
                            const lastPayment = collection[collection.length - 1];
                            const lastDatePayment = moment(lastPayment.dateAdded).add(1, 'days').format('YYYY-MM-DD');
                            const diff = getWeekDaysCount(new Date(lastDatePayment), new Date());
                            if (diff > 1) {
                                temp.mispayments = temp.mispayments + diff;
                                temp.lastUpdated = moment().format('YYYY-MM-DD');
                            }
            
                            updateLoan(temp);
                            // automate dilenquent clients if loan is not paid for how many days?
                        } else {
                            const dateGranted = moment(loan.dateGranted).add(1, 'days').format('YYYY-MM-DD');
                            const diff = getWeekDaysCount(new Date(dateGranted), new Date());
                            if (diff > 0) {
                                temp.mispayments = diff;
                                temp.lastUpdated = moment().format('YYYY-MM-DD');
                            }

                            updateLoan(temp);
                        }
                    });
                }
            } else {
                // automate mispayments
                const dateGranted = moment(loan.dateGranted).add(1, 'days').format('YYYY-MM-DD');
                const diff = getWeekDaysCount(new Date(dateGranted), new Date());
                if (diff > 0) {
                    temp.mispayments = diff;
                    temp.lastUpdated = moment().format('YYYY-MM-DD');
                }

                updateLoan(temp);
            }
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
            { _id: ObjectId(loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false });

    return loanResp;
}