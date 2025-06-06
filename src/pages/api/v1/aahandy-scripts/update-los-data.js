import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: updateData
});

// async function updateData(req, res) {
//     const { db } = await connectToDatabase();

//     const los = await db.collection('losTotals').aggregate([
//         { $match: { userType: 'lo'} },
//         { $addFields: { loIdObj: { $toObjectId: '$userId' } } },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: 'loIdObj',
//                 foreignField: '_id',
//                 pipeline: [
//                     {
//                         $project: {
//                             officeType: {
//                                 $cond: {
//                                     if: { $lt: ['$loNo', 11] },
//                                     then: 'main',
//                                     else: 'ext'
//                                 }
//                             }
//                         }
//                     }
//                 ],
//                 as: 'officeType'
//             }
//         }
//     ]).toArray();

//     los.map(async los => {
//         let temp = {...los};
        
//         temp.officeType = los.officeType[0].officeType;
//         delete temp._id;
//         delete temp.loIdObj;
//         await db.collection('losTotals').updateOne({ _id: los._id }, { $unset: {loIdObj: 1}, $set: {...temp} });
//     });

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

async function updateData(req, res) {
    const { db } = await connectToDatabase();

    const los = await db.collection('losTotals').aggregate([
        { $addFields: { loIdObj: { $toObjectId: '$userId' } } },
        {
            $lookup: {
                from: "users",
                localField: 'loIdObj',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            officeType: {
                                $cond: {
                                    if: { $eq: ['$role.rep', 3] },
                                    then: 'all',
                                    else: { $cond: {
                                        if: { $lt: ['$loNo', 11] },
                                        then: 'main',
                                        else: 'ext'
                                    } }
                                }
                            }
                        }
                    }
                ],
                as: 'officeType'
            }
        }
    ]).toArray();

    los.map(async los => {
        let temp = {...los};
        temp.officeType = los.officeType[0].officeType;
        delete temp._id;
        delete temp.loIdObj;
        await db.collection('losTotals').updateOne({ _id: los._id }, { $unset: {loIdObj: 1}, $set: {...temp} });
    });

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// async function updateData(req, res) {
//     const { db } = await connectToDatabase();

//     const los = await db.collection('losTotals').find({ userType: 'lo',
//         dateAdded: {$in: ['2023-11-29', '2023-12-22', '2024-01-31']}
//     }).toArray();

//     los.map(async los => {
//         let temp = {...los};
//         temp.data.transferGvr.totalLoanRelease = temp.data.transferGvr.currentReleaseAmount;
//         temp.data.transferGvr.currentReleaseAmount = 0;

//         temp.data.transferRcv.totalLoanRelease = temp.data.transferRcv.currentReleaseAmount;
//         temp.data.transferRcv.currentReleaseAmount = 0;

//         await db.collection('losTotals').updateOne({ _id: temp._id }, { $set: {...temp} });
//     });

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// async function updateData(req, res) {
//     const { db } = await connectToDatabase();

//     const losDaily = await db.collection('losTotals').find({ losType: 'daily'}).toArray();

//     losDaily.map(async los => {
//         let temp = {...los};
//         temp.data.mispaymentPerson = 0;

//         await db.collection('losTotals').updateOne({ _id: temp._id }, { $set: {...temp} });
//     });

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }