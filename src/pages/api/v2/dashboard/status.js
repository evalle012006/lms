// PATCH: src/pages/api/v2/dashboard/status.js
// Adds staleBranches count + list to the existing response, using the same
// query pattern already used for closedBranches. This is the correct home
// for the "closed — needs re-check" signal — NOT BranchNotCloseTool.js,
// which only lists branches that are not yet closed (mutually exclusive
// with stale, which only applies to already-closed branches).

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl, } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE = createGraphType
    ('users', `_id areaId divisionId designatedBranchId regionId root`)
    ('users');
const BRANCH_TYPE = createGraphType
    ('branches', `_id code`)
    ('branches');
const BRANCH_APPR_TYPE = createGraphType
    ('branchApprovals',`_id branchId documentsStale staleReason staleAt`,)
    ('branchApprovals');
const ACTIVE_USER_TYPE = createGraphType
    ('users',`_id`)('users');

const CLIENT_AGG_TYPE = createGraphType
    ('client',`aggregate { count }`)
    ('prospectClients');
const CASH_ON_HAND_TYPE = createGraphType
    ('management_transactions',`branch_id total_balance date_added inserted_date _id`)
    ('cashOnHandTransactions');

const CASH_ON_HAND_ACCOUNT_ID = '18252917-bdee-4dfe-8bd7-2e5cabb59070';

const BANK_OPENING_TYPE = createGraphType
    ('cash_in_bank_opening_balances',`branch_id bank_no balance_month opening_balance`)
    ('bankOpenings');

const BANK_ENTRY_TYPE = createGraphType
    ('cash_in_bank_entries',`branch_id bank_no transaction_date deposit net_interest withdrawal`)
    ('bankEntries');

export default apiHandler({
    get: getDashboardStatus,
});

const findUserByID = async (id) => {
    const [user] = await graph
        .query(queryQl(USER_TYPE, { where: { _id: { _eq: id } } }))
        .then((res) =>
            (res.data?.users ?? []).map((u) => ({
                ...u,
                areaId: 
                    u.root ? null : 
                    u.areaId,
                divisionId:
                    u.root ? null : 
                    u.divisionId,
                designatedBranchId:
                    u.root ? null : 
                    u.designatedBranchId,
                regionId:
                    u.root ? null : 
                    u.regionId,
            }))
        );
    return user;
};

async function getDashboardStatus(req, res) {
    const { date } = req.query;
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);
        if (!user) {    
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

    // ── Branch scope (exclude B000) ──────────────────────────────
    const branchAnd = [{ code:{ _neq: 'B000' } }];
        if (user.areaId)
            branchAnd.push({ areaId:{ _eq: user.areaId } });
        if (user.regionId)
            branchAnd.push({ regionId:{ _eq: user.regionId } });
        if (user.divisionId)
            branchAnd.push({ divisionId:{ _eq: user.divisionId } });
        if (user.designatedBranchId)
            branchAnd.push({ _id:{ _eq: user.designatedBranchId } });

    const branches = await graph
        .query(queryQl(BRANCH_TYPE, { where: { _and: branchAnd } }))
        .then((res) => res.data.branches ?? []);

    const branchIds = branches.map((b) => b._id);
    const totalBranches = branchIds.length;

    // ── Bank Balance ────────────────────────────────────────
    let bankBalance = 0;

    if (branchIds.length > 0) {
        const [openingResult, entryResult] = await Promise.all([
            graph.query(
                queryQl(BANK_OPENING_TYPE, {
                    where: {
                        branch_id: { _in: branchIds },
                        balance_month: { _lte: date },
                    },
                    order_by: [
                        { balance_month: 'desc' },
                    ],
                })
            ),
            graph.query(
                queryQl(BANK_ENTRY_TYPE, {
                    where: {
                        branch_id: { _in: branchIds },
                        transaction_date: { _lte: date },
                    },
                })
            ),
        ]);

        const openings = openingResult.data?.bankOpenings ?? [];
        const entries = entryResult.data?.bankEntries ?? [];

        // Keep the latest opening balance for each branch and bank.
        const latestOpenings = new Map();

        for (const opening of openings) {
            const key = `${opening.branch_id}:${opening.bank_no}`;

            if (!latestOpenings.has(key)) {
                latestOpenings.set(key, opening);
            }
        }

        // Add opening balances.
        for (const opening of latestOpenings.values()) {
            bankBalance += Number(opening.opening_balance ?? 0);
        }

        // Apply transactions occurring after the selected opening date.
        for (const entry of entries) {
            const key = `${entry.branch_id}:${entry.bank_no}`;
            const opening = latestOpenings.get(key);

            if (!opening) {
                continue;
            }

            if (entry.transaction_date < opening.balance_month) {
                continue;
            }

            bankBalance +=
                Number(entry.deposit ?? 0) +
                Number(entry.net_interest ?? 0) -
                Number(entry.withdrawal ?? 0);
        }
    }

    // ── Total Cash on Hand ──────────────────────────────────
    let cashOnHand = 0;

    if (branchIds.length > 0) {
        const cashResult = await graph.query(
            queryQl(CASH_ON_HAND_TYPE, {
                where: {
                    _and: [
                        {
                            branch_id: {
                                _in: branchIds,
                            },
                        },
                        {
                            account_id: {
                                _eq: CASH_ON_HAND_ACCOUNT_ID,
                            },
                        },
                        {
                            date_added: {
                                _lte: date,
                            },
                        },
                    ],
                },
                order_by: [
                    { date_added: 'desc' },
                    { inserted_date: 'desc' },
                    { _id: 'desc' },
                ],
            })
        );

        const cashTransactions =
            cashResult.data?.cashOnHandTransactions ?? [];

        const latestBranchBalances = new Map();

        for (const transaction of cashTransactions) {
            if (!latestBranchBalances.has(transaction.branch_id)) {
                latestBranchBalances.set(
                    transaction.branch_id,
                    Number(transaction.total_balance ?? 0)
                );
            }
        }

        cashOnHand = Array.from(
            latestBranchBalances.values()
        ).reduce((total, balance) => total + balance, 0);
    }

    // ── Total Prospect Clients ───────────────────────────────
    let totalProspectClients = 0;

    if (branchIds.length > 0) {
        const result = await graph.query(
            aggregateQl(
                CLIENT_AGG_TYPE,
                `aggregate { count }`,
                {
                    _and: [
                        {
                            status: {
                                _eq: 'pending',
                            },
                        },
                        {
                            branchId: {
                                _in: branchIds,
                            },
                        },
                    ],
                }
            )
        );

        totalProspectClients =
            result.data?.prospectClients?.aggregate?.count ?? 0;
    }

    // ── Closed branches count for the given date ─────────────────
    let closedBranches = 0;
    // ADDED
    let staleBranches = [];
    if (branchIds.length > 0 && date) {
        const closedList = await graph
            .query(
                queryQl(BRANCH_APPR_TYPE, {
                    where: {
                        branchId:{ _in: branchIds },
                        dateFor:{ _eq: date },
                        status:{ _eq: 'closed' },
                    },
                })
            )
            .then((res) => res.data.branchApprovals ?? []);
        closedBranches = closedList.length;
        staleBranches = closedList.filter((b) => b.documentsStale);
    }

    // ── Active users in scope ────────────────────────────────────
    const userAnd = [{ status: { _neq: 'inactive' } }];
        if (user.areaId)
            userAnd.push({ areaId:{ _eq: user.areaId } });
        if (user.regionId)
            userAnd.push({ regionId:{ _eq: user.regionId } });
        if (user.divisionId)
            userAnd.push({ divisionId: { _eq: user.divisionId } });

        if (user.designatedBranchId)
            userAnd.push({
                designatedBranchId: {
                    _eq: user.designatedBranchId
                }
            });

    const activeUsers = await graph
        .query(
            aggregateQl(
                ACTIVE_USER_TYPE,
                `aggregate { count }`,
                { _and: userAnd }
            )
        )
        .then(
            (res) => res.data?.users?.aggregate?.count ?? 0
        );

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(
            JSON.stringify({
                success: true,
                data: {
                    closedBranches,
                    totalBranches,
                    activeUsers,
                    staleBranchesCount: staleBranches.length,
                    staleBranches: staleBranches.map(b => ({
                        branchId: b.branchId,
                        staleReason: b.staleReason,
                        staleAt: b.staleAt,
                    })),
                    totalProspectClients,
                    cashOnHand,
                    bankBalance,
                    managementExpenses: 0,
                },
            })
        );
}