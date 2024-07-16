import { BRANCH_COH_FIELDS, BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const BRANCH_TYPE = (date) => createGraphType('branches', `
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

    cashOnHand: branchCOHs (where: { dateAdded: { _eq: "${date}" } }){
        ${BRANCH_COH_FIELDS}
    }
`)('branches');

export default apiHandler({
    get: getBranch,
    post: updateBranch
});

async function getBranch(req, res) {
    const { _id = null, code = null, date } = req.query;

    let statusCode = 200;
    let response = {};
    const where = _id ? { _id: { _eq: _id } } : { code: { _eq: code } }

    const branch = await graph.query(
        queryQl(BRANCH_TYPE(date), {
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
    let statusCode = 200;
    let response = {};

    const branch = req.body;
    const branchId = branch._id;
    delete branch._id;

    const resp = await graph.mutation(
        updateQl(createGraphType('branches', `_id`), {
            set: {
                ... branch
            },
            where: {
                _id: { _eq: branchId }
            }
        })
    );

    response = { success: true, branch: resp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}