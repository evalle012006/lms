import { apiHandler } from '@/services/api-handler';
import { generateUUID, getCurrentDate } from '@/lib/utils';
import moment from 'moment'
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { ROLE_PERMISSION_FIELD } from '@/lib/graph.fields';


const graph = new GraphProvider();
const ROLE_PERMISSION_TYPE = createGraphType('rolesPermission', `
${ROLE_PERMISSION_FIELD}
`)('rolesPermission');


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { role, permissions } = req.body;

    const rolePermissions = await graph.query(
        queryQl(ROLE_PERMISSION_TYPE, {
            where: { role: { _eq: role } }
        })
    ).then(res => res.data.rolesPermissions);

    let response = {};
    let statusCode = 200;

    if (rolePermissions.length > 0) {
        response = {
            error: true,
            fields: ['role'],
            message: `Role permissions already exist`
        };
    } else {
        const [rolePermissions] = await graph.mutation(
            insertQl(ROLE_PERMISSION_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    role: role,
                    permissions: permissions,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            })
        ).then(res => res.data.rolesPermissions.returning);

        response = {
            success: true,
            rolePermission: rolePermission
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}