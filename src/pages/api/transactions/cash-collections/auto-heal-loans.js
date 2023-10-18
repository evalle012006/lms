import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

let response = {};
let statusCode = 200;


export default apiHandler({
    post: autoHealLoans
});

async function autoHealLoans(req, res) {
    const { db } = await connectToDatabase();

    const { loId, currentDate } = req.body;

    const groups = await db.collection('groups').find({ $expr: { $and: [ {$eq: ['$loanOfficerId', loId]}, {$gt: ['$noOfClients', 0]} ] } }).toArray();

    groups.map(async group => {
        const groupIdStr = group._id + '';
        await removedDoubleCC(groupIdStr, currentDate);
    });
    // setTimeout(async () => {
    //     await syncLoansCashCollections(groupId, currentDate);
    // }, 1000);

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function removedDoubleCC(groupId, currentDate) {
    const { db } = await connectToDatabase();
    
    const cashCollections = await db.collection('cashCollections').find({ groupId: groupId, dateAdded: currentDate }).toArray();

    const uniqueCC = [];
    cashCollections.map(async cc => {
        const existing = uniqueCC.filter(c => {
            if (c.clientId == cc.clientId && c.paymentCollection == c.paymentCollection && c.loanId == cc.loanId && c.loanBalance == cc.loanBalance) {
                return c;
            }
        });

        if (existing.length == 0) {
            uniqueCC.push(cc);
        } else {
            await db.collection('cashCollections').deleteOne({ _id: cc._id });
        }
    });
}

async function syncLoansCashCollections(groupId, currentDate) {
    const { db } = await connectToDatabase();
    
    const cashCollections = await db.collection('cashCollections').find({ groupId: groupId, dateAdded: currentDate, draft: false }).toArray();
    const loans = await db.collection('loans').find({ groupId: groupId, status: "active" }).toArray();

    if (cashCollections && loans) {
        cashCollections.map(async cc => {
            const loan = loans.find(l => l.clientId == cc.clientId);
            if (loan) {
                let update = false;
                let temp = {...loan};
                if (cc.mcbu > loan.mcbu) {
                    temp.mcbu = cc.mcbu;
                    update = true;
                }

                if (cc.loanBalance > loan.loanBalance) {
                    temp.loanBalance = cc.loanBalance;
                    update = true;
                }

                if (cc?.mcbuCol > loan.mcbuCollection) {
                    temp.mcbuCollection = cc.mcbuCol;
                    update = true;
                }

                if (cc.noOfPayments > loan.noOfPayments) {
                    temp.noOfPayments = cc.noOfPayments;
                    update = true;
                }

                if (update) {
                    delete temp._id;
                    await db.collection('loans').updateOne({ _id: loan._id }, { $set: { ...temp } });
                }
            }
        });
    }
}