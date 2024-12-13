import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';

const graph = new GraphProvider();

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { areaId, divisionId, regionId, branchId, loId } = req.query;
    const [result] = await graph.apollo.query({
        query: gql`
        query get_dashboard_data ($args: get_dashboard_data_arguments!){
            get_dashboard_data(args: $args) {
                data
            }
        }
        `,
        variables: {
            args: {
                areaId: areaId ?? null,
                divisionId: divisionId ?? null,
                regionId: regionId ?? null,
                branchId: branchId ?? null,
                loId: loId ?? null
            }
        }
    }).then(res => res.data.get_dashboard_data.map(c => c.data));

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));
}