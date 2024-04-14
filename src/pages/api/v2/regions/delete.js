import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import { REGION_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const REGION_TYPE = (alias) => createGraphType('regions', `
${REGION_FIELDS}
areas {
    _id
}
`)(alias ?? 'regions');

export default apiHandler({
    post: deleteRegion
});

async function deleteRegion(req, res) {

    let statusCode = 200;
    let response = {};
    const { _id } = req.body;

    const [region] = await graph.query(
        queryQl(REGION_TYPE(), {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.regions);
    
    if (!!region) {
        const areas = region.areas;

        if (areas.length > 0) {
            response = {
                error: true,
                message: `Can't delete ${region.name} it is currently link to a area.`
            };
        } else {
            await graph.mutation(
                deleteQl(REGION_TYPE(), {
                    _id: { _eq: _id }
                })
            );

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Region with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}