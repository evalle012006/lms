import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment'
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { AREA_FIELDS, BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';


const graph = new GraphProvider();

const USER_TYPE = (alias) => createGraphType('users', '_id')( alias ?? 'users');
const BRANCH_TYPE = (alias) => createGraphType('branches', '_id')( alias ?? 'branches');

const AREA_TYPE = (alias) => createGraphType('areas', `
${AREA_FIELDS}
managers (where: {
    role: {
        _contains: {
            shortCode: "area_admin"
        }
    }
}) {
    ${USER_FIELDS}
}
branches { 
    ${BRANCH_FIELDS}
}

`)(alias ?? 'areas');

export default apiHandler({
    post: save
});

async function save(req, res) {
    const area = req.body;

    const areas = await graph.query(
        queryQl(AREA_TYPE(), {
            where: { name: { _eq: area.name } }
        })
    ).then(res => res.data.areas);

    let response = {};
    let statusCode = 200;

    if (areas.length > 0) {
        response = {
            error: true,
            fields: ['name'],
            message: `Area with the name "${area.name}" already exists`
        };
    } else {
        const areaId = generateUUID();
        const [areaResp] = await graph.mutation(
            insertQl(AREA_TYPE(), {
                objects: [{
                    _id: areaId,
                    name: area.name,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            }),
            updateQl(USER_TYPE(), {
                set: { areaId, },
                where: { _id: { _in: area.managerIds } }
            }),
            updateQl(BRANCH_TYPE(), {
                set: { areaId, },
                where: { _id: { _in: area.branchIds } }
            }),
        ).then(res => res.data.areas.returning);

        response = {
            success: true,
            area: areaResp
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}