// src/pages/api/v2/reports/get-all-low-loan-balance.js
//
// Low Loan Balance — a CONFIG for the shared drill-down engine (src/lib/api/hierarchical-report.js).
// Identity, role scoping, levels, sorting, paging, timing and error handling all live there.
//
// Query params:  amount + amountOperator, noOfPayments + noOfPaymentsOperator (see low-balance-filters.js),
//                branchId | loId, sortBy, sortDir, search, page, limit, all=1   (no param = all rows)
//
// Changed from the old endpoint: plain params instead of JSON-in-a-querystring (amountOption /
// noOfPaymentsOption); values are validated here instead of throwing inside JSON.parse; the
// `currentUserId`, `loId` and `branchId` the client sends are no longer trusted for access.

import { gql } from 'node_modules/apollo-boost/lib/index';
import { createHierarchicalReport, clean, num } from '@/lib/api/hierarchical-report';
import { LOW_BALANCE_DEFAULTS, OPERATOR_VALUES } from '@/lib/reports/low-balance-filters';
import { apiHandler } from '@/services/api-handler';

// ── Hasura SQL-function queries ──────────────────────────────────────────────
const LB_BY_USER = gql`
    query get_all_low_balance_by_branches ($userId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
        collections: get_all_low_balance_by_branches(args: {
            userId: $userId, amount: $amount, amountOperator: $amountOperator,
            noOfPaymentsOperator: $noOfPaymentsOperator, noOfPayments: $noOfPayments
        }) { _id data }
    }`;

const LB_BY_BRANCH = gql`
    query get_all_low_loan_balance_by_branch_los ($branchId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
        collections: get_all_low_loan_balance_by_branch_los(args: {
            branchId: $branchId, amount: $amount, amountOperator: $amountOperator,
            noOfPaymentsOperator: $noOfPaymentsOperator, noOfPayments: $noOfPayments
        }) { _id data }
    }`;

const LB_BY_LO = gql`
    query all_low_loan_balance_by_lo ($loId: String!, $amount: numeric!, $noOfPayments: numeric!, $amountOperator: String!, $noOfPaymentsOperator: String!) {
        collections: get_all_low_loan_balance_by_lo(args: {
            loId: $loId, amount: $amount, amountOperator: $amountOperator,
            noOfPaymentsOperator: $noOfPaymentsOperator, noOfPayments: $noOfPayments
        }) { _id data }
    }`;

const filterVars = (f) => ({
    amount: f.amount,
    amountOperator: f.amountOperator,
    noOfPayments: f.noOfPayments,
    noOfPaymentsOperator: f.noOfPaymentsOperator,
});

// ── Row builders ─────────────────────────────────────────────────────────────
function sumLoans(loans) {
    return (loans ?? []).reduce((acc, l) => {
        acc.noOfClients += num(l?.totalClients);
        acc.totalAmountRelease += num(l?.totalAmountRelease);
        acc.totalLoanBalance += num(l?.totalLoanBalance);
        acc.totalMCBU += num(l?.totalMCBU);
        return acc;
    }, { noOfClients: 0, totalAmountRelease: 0, totalLoanBalance: 0, totalMCBU: 0 });
}

// The by-branches function sometimes wraps its object in a one-element array.
const toBranchRows = (raw) => raw
    .map(entry => (Array.isArray(entry) ? entry[0] : entry))
    .filter(Boolean)
    .map(b => ({ _id: b._id, code: b.code, name: b.name, ...sumLoans(b.loans) }));

const toLoRows = (raw) => raw.map(lo => ({
    _id: lo._id,
    loName: `${lo.firstName ?? ''} ${lo.lastName ?? ''}`.trim(),
    ...sumLoans(lo.loans),
}));

function toClientRows(groups) {
    const rows = [];
    for (const group of groups) {
        for (const loan of group.loans ?? []) {
            const client = loan.client?.[0];
            rows.push({
                groupId: group._id,
                groupName: group.name,
                slotNo: loan.slotNo,
                loanId: loan._id ?? null,
                clientId: loan.clientId ?? client?._id ?? null,
                clientName: client ? (client.fullName ?? `${client.lastName}, ${client.firstName}`) : null,
                loanCycle: loan.loanCycle,
                amountRelease: num(loan.amountRelease),
                loanBalance: num(loan.loanBalance),
                mcbu: num(loan.mcbu),
                noOfPayments: loan.noOfPayments,
                // The old API never filled this although the old view had a "Mispayments" column (it was
                // always blank). null when the SQL function doesn't return it; the UI hides an all-null column.
                noOfMispayments: loan.noOfMispayments ?? null,
                delinquent: client?.delinquent == true ? 'Yes' : 'No',
            });
        }
    }
    return rows;
}

// ── Level config ─────────────────────────────────────────────────────────────
const SUM_KEYS = ['noOfClients', 'totalAmountRelease', 'totalLoanBalance', 'totalMCBU'];
const sums = (keys) => keys.map(k => [k, k]);

const LEVELS = {
    branch: {
        sortable: ['code', 'name', ...SUM_KEYS],
        defaultSort: { field: 'code', dir: 'asc' },
        searchable: ['code', 'name'],
        summary: sums(SUM_KEYS),
    },
    lo: {
        sortable: ['loName', ...SUM_KEYS],
        defaultSort: { field: 'loName', dir: 'asc' },
        searchable: ['loName'],
        summary: sums(SUM_KEYS),
    },
    client: {
        sortable: [
            'groupName', 'slotNo', 'clientName', 'loanCycle', 'amountRelease', 'loanBalance',
            'mcbu', 'noOfPayments', 'noOfMispayments', 'delinquent',
        ],
        defaultSort: { field: 'loanBalance', dir: 'asc' },
        searchable: ['clientName', 'groupName'],
        count: 'noOfClients',
        summary: [
            ['totalAmountRelease', 'amountRelease'],
            ['totalLoanBalance', 'loanBalance'],
            ['totalMCBU', 'mcbu'],
        ],
    },
};

// ── Filters ──────────────────────────────────────────────────────────────────
function parseNumber(raw, fallback, label) {
    const v = clean(raw);
    if (v === null) return { value: fallback };
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { error: `Invalid ${label}. Expected a number of 0 or more.` };
    return { value: n };
}

function parseOperator(raw, fallback, label) {
    const v = clean(raw) ?? fallback;
    return OPERATOR_VALUES.includes(v) ? { value: v } : { error: `Invalid ${label}.` };
}

// ── The report ───────────────────────────────────────────────────────────────
const report = {
    name: 'Low Loan Balance Report',
    levels: LEVELS,
    // no `legacy`: the classic views are replaced, so every response is the full list (+ summary).

    parseFilters(query) {
        const amount = parseNumber(query.amount, LOW_BALANCE_DEFAULTS.amount, 'amount');
        const noOfPayments = parseNumber(query.noOfPayments, LOW_BALANCE_DEFAULTS.noOfPayments, 'noOfPayments');
        const amountOperator = parseOperator(query.amountOperator, LOW_BALANCE_DEFAULTS.amountOperator, 'amountOperator');
        const noOfPaymentsOperator = parseOperator(query.noOfPaymentsOperator, LOW_BALANCE_DEFAULTS.noOfPaymentsOperator, 'noOfPaymentsOperator');

        const bad = [amount, noOfPayments, amountOperator, noOfPaymentsOperator].find(p => p.error);
        if (bad) return { error: bad.error };

        const filters = {
            amount: amount.value,
            amountOperator: amountOperator.value,
            noOfPayments: noOfPayments.value,
            noOfPaymentsOperator: noOfPaymentsOperator.value,
        };
        return { filters, scope: { filters } };
    },

    sources: {
        branch: {
            query: LB_BY_USER,
            // This function needs a real user id even for root (it resolves their scope itself) — unlike
            // the mispay one, which treats null as unrestricted.
            variables: ({ currentUser, filters }) => ({ userId: String(currentUser._id), ...filterVars(filters) }),
            toRows: toBranchRows,
        },
        lo: {
            query: LB_BY_BRANCH,
            variables: ({ branchId, filters }) => ({ branchId, ...filterVars(filters) }),
            toRows: toLoRows,
        },
        client: {
            query: LB_BY_LO,
            variables: ({ loId, filters }) => ({ loId, ...filterVars(filters) }),
            toRows: toClientRows,
        },
    },
};

export default apiHandler({ get: createHierarchicalReport(report) });