import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";
import { GraphProvider } from '@/lib/graph/graph.provider';
import { updateQl } from '@/lib/graph/graph.util';
import { badDebtCollectionsType } from '@/pages/api/v2/other-transactions/badDebtCollection/common';

const graph = new GraphProvider();

export default apiHandler({
  get: getData,
  post: updateData,
});

async function getData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const data = await db
        .collection('badDebtCollections')
        .aggregate([
            { $match: { _id: new ObjectId(_id) } },
            {
                $addFields: {
                    clientIdObj: { $toObjectId: '$clientId' },
                    loIdObj: { $toObjectId: '$loId' },
                    branchIdObj: { $toObjectId: '$branchId' },
                    groupIdObj: { $toObjectId: '$groupId' },
                    loanIdObj: { $toObjectId: '$loanId' }
                }
            },
            {
                $lookup: {
                    from: 'client',
                    localField: 'clientIdObj',
                    foreignField: '_id',
                    pipeline: [
                        { $project: { name: '$fullName' } }
                    ],
                    as: 'client'
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "loIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { firstName: '$firstName', lastName: '$lastName' } }
                    ],
                    as: "lo"
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { name: '$name' } }
                    ],
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { name: '$name' } }
                    ],
                    as: "group"
                }
            },
            {
                $lookup: {
                    from: "loans",
                    localField: "loanIdObj",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { pastDue: '$pastDue' } }
                    ],
                    as: "loan"
                }
            },
            { $project: { clientIdObj: 0, branchIdObj: 0, loIdObj: 0, groupIdObj: 0, loanIdObj: 0 } }
        ])
        .toArray();

    response = { success: true, data: data[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateData(req, res) {
    const { _id, ...payload } = req.body;
    const { data } = await graph.mutation(
      updateQl(badDebtCollectionsType, {
        set: payload,
        where: { _id: { _eq: _id } },
      })
    );
    res.send({ success: true, data: data?.returning?.badDebtCollections?.[0] });
}