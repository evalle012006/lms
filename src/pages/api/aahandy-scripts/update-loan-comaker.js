import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: updateLoanData
});

async function updateLoanData(req, res) {
    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    // 64e4656019c68ece88171858
    // 64e4656019c68ece88171859
    // 64e4656019c68ece8817185a
    // 64e4656019c68ece8817185b
    // 64e4656019c68ece8817185f
    // 64e4659719c68ece88171872
    // 64e4659719c68ece88171873
    // 64e4659719c68ece88171874
    // 64e4659719c68ece88171875
    // 64e468f219c68ece88171954
    // 64e468f219c68ece88171955
    // 64e468f219c68ece88171956
    // 64e468f219c68ece88171957
    // 64e468f219c68ece88171958
    // 64e468f219c68ece88171959
    // 64e468f219c68ece8817195a
    // 64e4691919c68ece88171970
    // 64e4691919c68ece88171971
    // 64e46b3619c68ece881719f4
    // 64e46b3619c68ece881719f5
    // 64e46b3619c68ece881719f6
    // 64e46b3619c68ece881719f7
    // 64e46b3619c68ece881719f8
    // 64e46b3619c68ece881719f9
    // 64e46b6019c68ece88171a01
    // 64e46b6019c68ece88171a02
    // 64e46b6019c68ece88171a03
    // 64e46b6019c68ece88171a04
    // 64e46b6019c68ece88171a05
    // 64e46b6019c68ece88171a06
    // 64e46d9219c68ece88171ab0
    // 64e46d9219c68ece88171ab1
    // 64e46d9219c68ece88171ab2
    // 64e46dab19c68ece88171ac4
    // 64e46dab19c68ece88171ac5
    // 64e46dab19c68ece88171ac6
    // 64e46ddf19c68ece88171ad9
    // 64e46ddf19c68ece88171ada
    // 64e46ddf19c68ece88171adb
    // 64e46ddf19c68ece88171adc

    const loans = await db.collection('loans').find({ groupId: "64e46dab19c68ece88171ac5" }).toArray();

    loans.map(async loan => {
        let temp = {...loan};

        if (temp.coMaker && typeof temp.coMaker === 'string' && temp.coMaker?.trim()) {
            const arr = temp?.coMaker?.split(' ');
            if (arr.length > 1) {
                let client = await db.collection('client').find({groupId: loan.groupId, firstName: arr[0], lastName: arr[1]}).toArray();
                if (client && client.length > 0) {
                    temp.origCoMaker = temp.coMaker;
                    temp.coMaker = client[0]._id + '';
                    await updateLoan(temp);
                }
            }
        }
    });

    response = { success: true, loans: loans };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
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
