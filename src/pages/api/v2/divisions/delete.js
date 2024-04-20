import { DIVISION_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const DIVISION_TYPE = (alias) => createGraphType('divisions', `
${DIVISION_FIELDS}
regions { _id }
`)(alias ?? 'divisions');

export default apiHandler({
    post: deleteDivision
});

async function deleteDivision(req, res) {
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const [division] = await graph.query(
        queryQl(DIVISION_TYPE(), {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.divisions);

    if (!!division) {
        const regions = division.regions

        if (regions.length > 0) {
            response = {
                error: true,
                message: `Can't delete ${division.name} it is currently link to a regions.`
            };
        } else {
            await graph.mutation(
                deleteQl(DIVISION_TYPE(), { _id: { _eq: _id } })
            );
            
            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Division with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}