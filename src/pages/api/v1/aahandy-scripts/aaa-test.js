import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'node_modules/moment/moment';

export default apiHandler({
    post: testOnly
});

async function testOnly(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    const branchId = "64eeddf3b0c8b322fb57f9de";
    const currentDate = "2024-08-05";

    const result = await db.collection("loans")
                        .aggregate([
                            { $match: { 
                                branchId: branchId,
                                admissionDate: currentDate
                            } },
                            {
                                $project: {
                                  datePart: { $substr: ["$pnNumber", 5, 5] },
                                  numberPart: { 
                                    $convert: { input: {$substr: ["$pnNumber", 11, 4]}, to: "int", onError: '',onNull: '' }
                                  }
                                }
                              },
                              {
                                $group: {
                                  _id: "$datePart",
                                  maxNumber: { $max: "$numberPart" }
                                }
                              },
                              {
                                $sort: { 
                                  _id: -1,
                                  maxNumber: -1
                                }
                              },
                              {
                                $limit: 1
                              },
                              {
                                $project: {
                                  _id: 0,
                                  datePart: "$_id",
                                  maxNumber: 1
                                }
                              }
                        ]).toArray();

    response = { success: true, data: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// async function testOnly(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;
//     let response;
//     let statusCode = 200;

//     const clientId = '650ba7e4b65f13c10205a6a7';

//     const result = await db.collection("cashCollections")
//                         .find({ clientId: clientId })
//                         .sort({ $natural: -1 })
//                         .limit(1)
//                         .toArray();

//     response = { success: true, data: result };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }