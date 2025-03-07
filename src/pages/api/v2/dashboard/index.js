import { findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const user = await findUserById(req.auth.sub);

    let { areaId, divisionId, regionId, branchId, loId, filter, date_added, type } = req.query;

    const result = await graph.apollo.query({
        query: gql`
        query get_dashboard_summary_view ($args: get_dashboard_summary_view_arguments!){
            get_dashboard_summary_view(args: $args, limit: ${type === 'graph' ? '12' : '2'}) {
                data
            }
        }`,
        variables: {
            args: {
                filter,
                date_added: date_added ?? new Date(),
                area_id: user.areaId ?? areaId ?? null,
                division_id: user.divisionId ?? divisionId ?? null,
                region_id: user.regionId ?? regionId ?? null,
                branch_id: user.designatedBranchId ??  branchId ?? null,
                user_id: user.role.rep === 4 ? user._id : loId ?? null
            }
        }
    })
    .then(res => res.data.get_dashboard_summary_view.map(c => c.data))

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: result
        }));
}