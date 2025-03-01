import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const { areaId, divisionId, regionId, branchId, loId, filter, selectedDate } = req.query;

    const current = moment(new Date());
    const selected = moment(selectedDate);

    const year = filter === 'daily' ? selected.year() : current.year();
    const quarter = filter === 'daily' ? selected.quarter() : current.quarter();
    const month =  filter === 'daily' ?  selected.month() : current.month();

    const week = filter === 'daily' ? selected.week() : current.week();
    const day = filter === 'daily' ? selected.date() : null;

    const [result] = await graph.apollo.query({
        query: gql`
        query get_dashboard_summary_view ($args: get_dashboard_summary_view_arguments!){
            get_dashboard_summary_view(args: $args) {
                data
            }
        }`,
        variables: {
            args: {
                year: year ?? null,
                quarter: quarter ?? null,
                month: month + 1,
                week: week,
                day: day ?? null,
                area_id: areaId ?? null,
                division_id: divisionId ?? null,
                region_id: regionId ?? null,
                branch_id: branchId ?? null,
                user_id: loId ?? null
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