import { findUserById } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const BRANCHES_TYPE = createGraphType(
    'branches',
    `_id name code areaId regionId divisionId`
)('branches');

export default apiHandler({
    get: getData
});

async function getData(req, res) {
    const user = await findUserById(req.auth.sub);

    const userBranchId =
        user.branchId ??
        user.designatedBranchId ??
        null;

    let {
        areaId,
        divisionId,
        regionId,
        branchId,
        loId,
        filter,
        date_added,
        currentDate,
        type,
        view
    } = req.query;

    const get_data = async (selectedDate, group, overrides = {}) => {
        const [result] = await graph.apollo.query({
            query: gql`
            query get_dashboard_totals_v2 ($args: get_dashboard_totals_v2_arguments!) {
                get_dashboard_totals_v2(args: $args) {
                    data
                }
            }
            `,
            variables: {
                args: {
                    range: filter,
                    dateAdded: selectedDate,
                    currentDate: currentDate,
                    branchId:
                        userBranchId ??
                        overrides.branchId ??
                        branchId ??
                        null,

                    areaId:
                        user.areaId ??
                        overrides.areaId ??
                        areaId ??
                        null,

                    divisionId:
                        user.divisionId ??
                        overrides.divisionId ??
                        divisionId ??
                        null,

                    regionId:
                        user.regionId ??
                        overrides.regionId ??
                        regionId ??
                        null,
                    groupId: null,
                    loId: user.role.rep === 4 ? user._id : loId ?? null
                }
            }
        })
        .then(res => res.data.get_dashboard_totals_v2.map(c => c.data))
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

    if (type === 'performance') {
        try {
            // ─────────────────────────────────────────────
            // BRANCHES VIEW
            // ─────────────────────────────────────────────
            if (view === 'branches') {
                const _and = [];

                // Respect logged-in user's organizational scope
                if (user.divisionId) {
                    _and.push({
                        divisionId: { _eq: user.divisionId }
                    });
                }

                if (user.regionId) {
                    _and.push({
                        regionId: { _eq: user.regionId }
                    });
                }

                if (user.areaId) {
                    _and.push({
                        areaId: { _eq: user.areaId }
                    });
                }

                if (userBranchId) {
                    _and.push({
                        _id: { _eq: userBranchId }
                    });
                }

                // Respect dashboard filters
                if (!user.divisionId && divisionId) {
                    _and.push({
                        divisionId: { _eq: divisionId }
                    });
                }

                if (!user.regionId && regionId) {
                    _and.push({
                        regionId: { _eq: regionId }
                    });
                }

                if (!user.areaId && areaId) {
                    _and.push({
                        areaId: { _eq: areaId }
                    });
                }

                if (!userBranchId && branchId) {
                    _and.push({
                        _id: { _eq: branchId }
                    });
                }

                const branches = await graph.query(
                    queryQl(BRANCHES_TYPE, {
                        where: { _and },
                        order_by: [{ code: 'asc' }]
                    })
                ).then(r => r.data.branches ?? []);

                const rows = await Promise.all(
                    branches.map(async (branch) => {
                        const totals = await get_data(
                            date_added,
                            null,
                            {
                                branchId: branch._id
                            }
                        );

                        const total = totals?.[0] ?? {};

                        const activeClients =
                            Number(total.activeClients || 0);

                        const collection =
                            Number(total.loanCollectionDaily || 0);

                        const releasePerson =
                            Number(total.currentReleasePerson_New || 0) +
                            Number(total.currentReleasePerson_Rel || 0);

                        const releaseAmount =
                            Number(total.currentReleaseAmount || 0);

                        const loanBalance =
                            Number(total.totalLoanBalance || 0);

                        const pastDueAmount =
                            Number(total.pastDueAmount || 0);

                        const par =
                            loanBalance > 0
                                ? (pastDueAmount / loanBalance) * 100
                                : 0;

                        return {
                            _id: branch._id,
                            name: branch.name,
                            branchName: branch.name,
                            code: branch.code,

                            areaId: branch.areaId,
                            regionId: branch.regionId,
                            divisionId: branch.divisionId,

                            activeClients,
                            collection,
                            releasePerson,
                            releaseAmount,
                            loanBalance,
                            pastDueAmount,
                            par
                        };
                    })
                );

                res.status(200)
                    .setHeader('Content-Type', 'application/json')
                    .end(JSON.stringify({
                        success: true,
                        data: rows
                    }));

                return;
            }

            res.status(200)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    success: true,
                    data: []
                }));

            return;

        } catch (error) {
            console.error('Dashboard performance error:', error);

            res.status(500)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    success: false,
                    data: [],
                    message: error.message
                }));

            return;
        }
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

    /*
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
    */

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            data: []
        }));
}