import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getDashboardData
});

let statusCode = 200;
let response = {};
let success = true;

async function getDashboardData(req, res) {
    const filter = req.query.filter || 'daily';
    const counts = await getTestsFilter(filter);
    const reccomendations = await getRecommendationData(filter);
    const programs = await getProgramsList();

    response = { ...response, success, counts, reccomendations, programs };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const getTestsFilter = async (filter) => {
    const { db } = await connectToDatabase();
    const options = {
        daily: '$dayOfYear',
        weekly: '$week',
        monthly: '$month'
    }

    // query for soil test
    const soil = await db.collection('tests')
        .aggregate([
            { $match: { testType: "soil" } },
            {
                $group: {
                    _id: { [options[filter]]: { $dateFromString: { dateString: '$dateAdded' } } },
                    count: { $sum: 1 }
                }
            },
        ]).toArray();
    // query for leaf test
    const leaf = await db.collection('tests')
        .aggregate([
            { $match: { testType: "leaf" } },
            {
                $group: {
                    _id: { [options[filter]]: { $dateFromString: { dateString: '$dateAdded' } } },
                    count: { $sum: 1 }
                }
            },
        ]).toArray();

    return { soil, leaf };
}

const getRecommendationData = () => {

}

const getProgramsList = async () => {
    const { db } = await connectToDatabase();
    const data = await db.collection('programs')
        .aggregate([
            { $addFields: { jid: { $toObjectId: "$jobId" } } },
            {
                $lookup: {
                    from: "jobs",
                    localField: "jid",
                    foreignField: "_id",
                    as: "job"
                }
            },
            { $unwind: { path: "$job" } },
            {
                $addFields: {
                    "cid": {
                        $map: {
                            input: "$job.collaborators",
                            as: "collaborator",
                            in: { $toObjectId: "$$collaborator" }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "cid",
                    foreignField: "_id",
                    pipeline: [
                        { $project: { password: 0 } }
                    ],
                    as: "collaborators"
                }
            },
        ])
        .project({ jobId: 0, cid: 0 })
        .limit(10)
        .toArray();

    return data;
}