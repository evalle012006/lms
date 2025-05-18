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

    if(type == 'sumarry') {
        return await graph.apollo.query({
            query: gql`
            query get_dashboard_totals {
                get_dashboard_totals(args: {
                    currentDate: "2025-05-18",
                    dateAdded: "2025-05-18",
                    groupId: null,
                    loId: null,
                    branchId: null,
                    areaId: null,
                    divisionId: null,
                    regionId: null,
                    range: "monthly"
                }) {
                    data
                }
            }
            `,
            variables: {
                args: {
                    areaId: user.areaId ?? areaId ?? null,
                    divisionId: user.divisionId ?? divisionId ?? null,
                    regionId: user.regionId ?? regionId ?? null,
                    groupId: null,
                    loId: user.role.rep === 4 ? user._id : loId ?? null
                }
            }
        }).then(res => res.data.get_dashboard_totals.map(c => c.data))
          .then(totals => totals.map(total => ({
            ... total,
            clientMcbuWithdrawals: total.mcbuWithdrawal,
            prev_clientMcbuWithdrawals: total.prev_mcbuWithdrawal,
            pending: total.pendingClients,
            prev_pending: total.prev_pendingClients,
            clientMcbuReturn: total.mcbuReturn,
            prev_clientMcbuReturn: total.prev_mcbuReturn,
            pastDuePerson: total.pastDueNo,
            prev_pastDuePerson: total.prev_pastDueNo,
            mispaymentPerson: total.mispay,
            prev_mispaymentPerson: total.prev_mispay,
            newMember: total.currentReleasePerson_New,
            prev_newMember: total.prev_currentReleasePerson_New,
            fullPayment: total.fullPaymentPerson,
            prev_fullPayment: total.prev_fullPaymentPerson,
            amount: total.currentReleaseAmount,
            prev_amount: total.prev_currentReleaseAmount,
          })));
    }

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