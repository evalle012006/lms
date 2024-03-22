import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', `
    _id
    address
    code
    dateAdded
    email
    name
    phoneNumber
`)('branches');


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name, code, phoneNumber, email, address } = req.body;
    let response = {};
    let statusCode = 200;

    let [branch] = await graph.query(
        queryQl(BRANCH_TYPE, {
            where: {
                code: { _eq: code }
            }
        })
    ).then(res => res.branches);

    if(branch) {
        response = {
            error: true,
            fields: ['code'],
            message: `Branch with the code "${code}" already exists`
        };
    } else {
        branch = await graph.mutation(
            insertQl(BRANCH_TYPE, {
                objects: [{
                    _id: '', // todo: generate id here
                    name: name,
                    code: code,
                    email: email,
                    phoneNumber: phoneNumber,
                    address: address,
                    dateAdded: 'now()'
                }]
            })
        ).then(res => res.data.returning?.[0]);
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}