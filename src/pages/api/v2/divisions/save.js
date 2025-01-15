import { apiHandler } from '@/services/api-handler';
import { generateUUID, getCurrentDate } from '@/lib/utils';
import moment from 'moment'
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { DIVISION_FIELDS } from '@/lib/graph.fields';


const graph = new GraphProvider();

const AREA_TYPE = (alias) => createGraphType('areas', '_id')(alias ?? 'areas');
const BRANCH_TYPE = (alias) => createGraphType('branches', '_id')(alias ?? 'branches');
const USER_TYPE  = (alias) => createGraphType('users', '_id')(alias ?? 'users');
const REGION_TYPE = (alias) => createGraphType('regions', '_id')(alias ?? 'regions');
const DIVISION_TYPE = (alias) => createGraphType('divisions', `
${DIVISION_FIELDS}
regions { _id name }
managers (where: {  
    role: {
        _contains: {
            shortCode: "deputy_director"
        }
    }
}) { _id firstName lastName email }
`)(alias ?? 'divisions');

export default apiHandler({
    post: save
});

async function save(req, res) {
    const division = req.body;

    const divisions = await graph.query(
        queryQl(DIVISION_TYPE(), {
            where: {
                name: { _eq: division.name }
            }
        })
    ).then(res => res.data.divisions);

    let response = {};
    let statusCode = 200;

    if (divisions.length > 0) {
        response = {
            error: true,
            fields: ['name'],
            message: `Division with the name "${division.name}" already exists`
        };
    } else {
        const _id = generateUUID();
        const [resp] = await graph.mutation(
            insertQl(DIVISION_TYPE(), {
                objects: [{
                    _id,
                    name: division.name,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                }]
            }),
            updateQl(USER_TYPE('update_division_managers'), {
                set: { divisionId: _id },
                where: { _id: { _in: division.managerIds } }
            }),
            updateQl(REGION_TYPE('update_division_regions'), {
                set: { divisionId: _id },
                where: { _id: { _in: division.regionIds } }
            }),
            updateQl(AREA_TYPE('update_division_areas'), {
                set: { divisionId: _id },
                where: { regionId: { _in: division.regionIds } }
            }),
            updateQl(BRANCH_TYPE('update_division_branches'), {
                set: { divisionId: _id },
                where: { regionId: { _in: division.regionIds } }
            })
        ).then(res => res.data.divisions.returning)

        response = {
            success: true,
            division: resp
        }

    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}