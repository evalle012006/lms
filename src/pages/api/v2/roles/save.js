import { apiHandler } from '@/services/api-handler';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment'
import { GraphProvider } from '@/lib/graph/graph.provider';
import { aggregateQl, createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { ROLE_FIELDS } from '@/lib/graph.fields';


const graph = new GraphProvider();
const ROLE_TYPE = createGraphType('roles', `
${ROLE_FIELDS}
`)

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name, shortCode } = req.body;

    const {roles, nextRoleRep} = await graph.query(
        queryQl(ROLE_TYPE('roles'), {
            where: {
                shortCode: { _eq: shortCode }
            }
        }),
        aggregateQl(ROLE_TYPE('lastRoleRep'), `aggregate { max { rep } }`)
    ).then(res => ({
        ... res.data,
        nextRoleRep: res.data.lastRoleRep.aggregate.max.rep + 1
    }));

    let response = {};
    let statusCode = 200;

    if (roles.length > 0) {
        response = {
            error: true,
            fields: ['shortCode'],
            message: `Role with the short code "${shortCode}" already exists`
        };
    } else {

        const role = await graph.mutation(
            insertQl(ROLE_TYPE, {
                objects: [{
                    name: name,
                    shortCode: shortCode,
                    rep: nextRoleRep,
                    system: false,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            })
        )

        response = {
            success: true,
            rep: nextRoleRep,
            role: role
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}