import { BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment'

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    ${BRANCH_FIELDS}
`)('branches');


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name = null, code = null, phoneNumber = null, email = null, address = null } = req.body;
    let response = {};
    let statusCode = 200;

    let [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: {
                code: { _eq: code }
            }
        })
    ).then(res => res.data.branches);

    if(branch) {
        response = {
            error: true,
            fields: ['code'],
            message: `Branch with the code "${code}" already exists`
        };
    } else {
        [branch] = await graph.mutation(
            insertQl(BRANCH_TYPE, {
                objects: [{
                    _id: generateUUID(), // todo: generate id here
                    name: name,
                    code: code,
                    email: email,
                    phoneNumber: phoneNumber,
                    address: address,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            })
        ).then(res => res.data.branches.returning);

        response = {
            success: true,
            branch: branch
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}