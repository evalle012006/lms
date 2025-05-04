import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getLastPNNumber
});

async function getLastPNNumber(req, res) {
    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const { branchId, currentDate } = req.query;

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