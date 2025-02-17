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
        query get_dashboard_summary ($args: get_dashboard_summary_arguments!){
            get_dashboard_summary(args: $args) {
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
    }).then(res => res.data.get_dashboard_summary.map(c => c.data));

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));
}