import { AREA_FIELDS, REGION_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

const graph = new GraphProvider();
const USER_TYPE = (alias) => createGraphType('users', `_id`)(alias ?? 'users');
const AREA_TYPE = (alias) => createGraphType('areas', `_id`)(alias ?? 'areas');
const BRANCH_TYPE = (alias) => createGraphType('branches', `_id`)(alias ?? 'branches');
const REGION_TYPE = (alias) => createGraphType('regions', `
${REGION_FIELDS}
areas {
    ${AREA_FIELDS}
}
managers (where: {
    role: {
        _contains: {
            shortCode: "regional_manager"
        }
    }
}) {

    ${USER_FIELDS}
}
`)(alias ?? 'regions');

export default apiHandler({
    post: save
});

async function save(req, res) {

    let response = {};
    let statusCode = 200;

    const input = req.body;

    const [region] = await graph.query(
        queryQl(REGION_TYPE(), {
            where: {
                name: { _eq: input.name }
            }
        })
    ).then(res => res.data.regions);


    if (!!region) {
        response = {
            error: true,
            fields: ['name'],
            message: `Region with the name "${input.name}" already exists`
        };
    } else {
        const _id = generateUUID();
        const [resp] = await graph.mutation(
            insertQl(REGION_TYPE(), {
                objects: [{
                    _id,
                    name: input.name,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            }),
            updateQl(USER_TYPE(), {
                set: {
                    regionId: _id
                },
                where: {
                    _id: { _in: input.managerIds }
                }
            }),
            updateQl(AREA_TYPE(), {
                set: {
                    regionId: _id
                },
                where: {
                    _id: { _in: input.areaIds }
                }
            }),
            updateQl(BRANCH_TYPE(), {
                set: {
                    regionId: _id
                },
                where: {
                    areaId: { _in: input.areaIds }
                }
            }),

        ).then(res => res.data.regions.returning);
        
        
        response = {
            success: true,
            region: resp
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}