import { findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

export default apiHandler({
    get: getSummary
});

async function getSummary(req, res) {
    const user = await findUserById(req.auth.sub);

    let { areaId, divisionId, regionId, branchId, loId, filter, date, year, quarter, month, week } = req.query;

    let selectedDate = moment(date);
    let day = null;
    
    if (filter === 'daily') {
        day = selectedDate.date()
        year = selectedDate.year();
        month = selectedDate.month() + 1;
        quarter = selectedDate.quarter();
        week = selectedDate.week();
    }

    console.log(user, 'day=', day, 'week=', week, 'month=', month, 'quarter=', quarter, 'year=', year);

    const [result] = await graph.apollo.query({
        query: gql`
        query get_dashboard_summary_view ($args: get_dashboard_summary_view_arguments!){
            get_dashboard_summary_view(args: $args) {
                data
            }
        }`,
        variables: {
            args: {
                year: year ? +year : null,
                quarter: quarter ? +(quarter) : null,
                month: month ? +(month) : null,
                week: week ? +(week) : null,
                day: day ? +(day) : null,
                area_id: user.areaId ?? areaId ?? null,
                division_id: user.divisionId ?? divisionId ?? null,
                region_id: user.regionId ?? regionId ?? null,
                branch_id: user.branchId ?? branchId ?? null,
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