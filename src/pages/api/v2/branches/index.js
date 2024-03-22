import { BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { connectToDatabase } from '@/lib/mongodb';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    ${BRANCH_FIELDS}
    branchManager: users (where: {
        role: {
          _contains: {
            rep: 3
          }
        }
      }) {
        ${USER_FIELDS}
    },
    noOfLO: users_aggregate(where: {
        role: {
            _contains: {
                rep: 4
            }
        }
    }) {
        aggregate {  count }
    }
`)('branches');

export default apiHandler({
    get: getBranch,
    post: updateBranch
});

async function getBranch(req, res) {
    const { _id = null, code = null } = req.query;

    let statusCode = 200;
    let response = {};
    const where = _id ? { _id: { _eq: _id } } : { code: { _eq: code } }

    const branch = await graph.query(
        queryQl(BRANCH_TYPE, {
            where,
        })
    ).then(res => res.data.branches?.[0])
      .then(res => ({
        ... res,
        branchManager: res.branchManager?.[0],
        noOfLO: {
            count: res.noOfLO.aggregate.count
        },
      }))


    response = { success: true, branch };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const branch = req.body;
    const branchId = branch._id;
    delete branch._id;

    const branchResp = await db
        .collection('branches')
        .updateOne(
            { _id: new ObjectId(branchId) }, 
            {
                $set: { ...branch }
            }, 
            { upsert: false });

    response = { success: true, branch: branchResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}