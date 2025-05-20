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

    let { areaId, divisionId, regionId, branchId, loId, filter, date_added, currentDate, type } = req.query;

    const get_data = async (selectedDate, group) => {
        const [result] = await graph.apollo.query({
            query: gql`
            query get_dashboard_totals ($args: get_dashboard_totals_arguments!) {
                get_dashboard_totals(args: $args) {
                    data
                }
            }
            `,
            variables: {
                args: {
                    range: filter,
                    dateAdded: selectedDate,
                    currentDate: currentDate,
                    branchId: user.branchId ?? branchId ?? null,
                    areaId: user.areaId ?? areaId ?? null,
                    divisionId: user.divisionId ?? divisionId ?? null,
                    regionId: user.regionId ?? regionId ?? null,
                    groupId: null,
                    loId: user.role.rep === 4 ? user._id : loId ?? null
                }
            }
        })
        .then(res => res.data.get_dashboard_totals.map(c => c.data))
          .then(totals => totals.map(total => ({
            group,
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
            renewals: total.currentReleasePerson_Rel,
            prev_renewals: total.prev_currentReleasePerson_Rel
          })))

        return result;
    }

    if(type == 'summary') {
        const result = await get_data(date_added);
        res.status(200)
          .setHeader('Content-Type', 'application/json')
          .end(JSON.stringify({
              data: [result]
          }));

          return;
    }

    const dates = await graph.apollo.query({
        query: gql`
        query get_dashboard_dates_by_range {
            get_dashboard_dates_by_range(args: {
                date_added: "${date_added}",
                range: "${filter}"
            }) {
                data
            }
        }
        `
    }).then(res => res.data.get_dashboard_dates_by_range.map(o => o.data));

   const results = await Promise.all(dates.map(o => get_data(o.selected_date, o.group)));


    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: results
        }));
}