// src/pages/api/v2/reports/get-all-mispays.js
//
// Mispayment List — a CONFIG for the shared drill-down engine (src/lib/api/hierarchical-report.js).
// Identity, role scoping, levels, sorting, paging, timing and error handling all live there.
//
// Query params:  date (YYYY-MM-DD, defaults to system date, not in the future), remarks (default 'all'),
//                branchId | loId, sortBy, sortDir, search, page, limit, all=1
// Modes:         all=1 -> every row | page/limit -> one page | neither -> legacy contract (TOTALS row in data)

import moment from 'moment';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { createHierarchicalReport, clean, num } from '@/lib/api/hierarchical-report';
import { formatPricePhp } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';

// ── Hasura SQL-function queries ──────────────────────────────────────────────
const MISPAY_BY_USER = gql`
    query mispayment_by_user ($userId: String, $dateAdded: date!, $remarks: String!) {
        collections: get_all_misspayment_by_user(args: {
            user_id: $userId, date_added: $dateAdded, remarks: $remarks
        }) { _id data }
    }`;

const MISPAY_BY_BRANCH = gql`
    query mispayment_by_branch ($branchId: String!, $dateAdded: date!, $remarks: String!) {
        collections: get_all_misspayment_by_branch(args: {
            branch_id: $branchId, date_added: $dateAdded, remarks: $remarks
        }) { _id data }
    }`;

const MISPAY_BY_LO = gql`
    query mispayment_by_lo ($loId: String!, $dateAdded: date!, $remarks: String!) {
        collections: get_all_misspayment_by_lo(args: {
            lo_id: $loId, date_added: $dateAdded, remarks: $remarks
        }) { _id data }
    }`;

// ── Row builders ─────────────────────────────────────────────────────────────
function sumLoans(loans) {
    // Accumulate instead of overwrite so a row can never disagree with the grand total.
    return (loans ?? []).reduce((acc, l) => {
        acc.noOfMispays += num(l?.totalMispayments);
        acc.totalAmountRelease += num(l?.totalAmountRelease);
        acc.totalLoanBalance += num(l?.totalLoanBalance);
        acc.totalMCBU += num(l?.totalMCBU);
        acc.totalNet += num(l?.totalNetLoanBalance);
        return acc;
    }, { noOfMispays: 0, totalAmountRelease: 0, totalLoanBalance: 0, totalMCBU: 0, totalNet: 0 });
}

const toBranchRows = (raw) => raw.map(b => ({ _id: b._id, code: b.code, name: b.name, ...sumLoans(b.loans) }));

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
            const clientName = client
                ? (client.fullName ?? `${client.lastName}, ${client.firstName}`)
                : null;

            rows.push({
                groupId: group._id,
                groupName: group.name,
                slotNo: loan.slotNo,
                // null when the SQL function doesn't include them — verify against the function DDL
                loanId: loan._id ?? null,
                clientId: loan.clientId ?? client?._id ?? null,
                clientName,
                loanCycle: loan.loanCycle,
                amountRelease: num(loan.amountRelease),
                loanBalance: num(loan.loanBalance),
                mcbu: num(loan.mcbu),
                netLoanBalance: num(loan.netLoanBalance),
                noOfPayments: loan.noOfPayments,
                delinquent: client?.delinquent == true ? 'Yes' : 'No',
                remarks: loan.remarks,
            });
        }
    }
    return rows;
}

// ── Level config ─────────────────────────────────────────────────────────────
const SUM_KEYS = ['noOfMispays', 'totalAmountRelease', 'totalLoanBalance', 'totalMCBU', 'totalNet'];
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
            'mcbu', 'netLoanBalance', 'noOfPayments', 'delinquent', 'remarks',
        ],
        defaultSort: { field: 'loanBalance', dir: 'asc' },
        searchable: ['clientName', 'groupName', 'remarks'],
        count: 'noOfClients',
        summary: [
            ['totalAmountRelease', 'amountRelease'],
            ['totalLoanBalance', 'loanBalance'],
            ['totalMCBU', 'mcbu'],
            ['totalNet', 'netLoanBalance'],
        ],
    },
};

// ── Legacy contract (classic views): `...Str` strings + a TOTALS row inside `data` ──
const legacy = {
    decorate(level, rows) {
        if (level === 'client') {
            return rows.map(r => ({
                ...r,
                amountReleaseStr: formatPricePhp(r.amountRelease),
                loanBalanceStr: formatPricePhp(r.loanBalance),
                mcbuStr: formatPricePhp(r.mcbu),
                netLoanBalanceStr: formatPricePhp(r.netLoanBalance),
            }));
        }
        return rows.map(r => ({
            ...r,
            totalAmountReleaseStr: formatPricePhp(r.totalAmountRelease),
            totalLoanBalanceStr: formatPricePhp(r.totalLoanBalance),
            totalMCBUStr: formatPricePhp(r.totalMCBU),
            totalNetStr: formatPricePhp(r.totalNet),
        }));
    },
    totalsRow(level, s) {
        if (level === 'client') {
            return {
                groupId: 'TOTALS', groupName: 'TOTALS', slotNo: '-', clientName: s.noOfClients, loanCycle: '-',
                amountReleaseStr: formatPricePhp(s.totalAmountRelease),
                loanBalanceStr: formatPricePhp(s.totalLoanBalance),
                mcbuStr: formatPricePhp(s.totalMCBU),
                netLoanBalanceStr: formatPricePhp(s.totalNet),
                noOfPayments: '-', delinquent: '-', remarks: '-', totalData: true,
            };
        }
        return {
            _id: 'TOTALS',
            // branch view reads `name`, LO view reads `loName` — the old row only set loName.
            code: '', name: 'TOTALS', loName: 'TOTALS',
            noOfMispays: s.noOfMispays,
            totalAmountReleaseStr: formatPricePhp(s.totalAmountRelease),
            totalLoanBalanceStr: formatPricePhp(s.totalLoanBalance),
            totalMCBUStr: formatPricePhp(s.totalMCBU),
            totalNetStr: formatPricePhp(s.totalNet),
            totalData: true,
        };
    },
};

// ── The report ───────────────────────────────────────────────────────────────
const report = {
    name: 'Mispay Report',
    levels: LEVELS,
    legacy,

    parseFilters(query, { systemDate }) {
        const date = clean(query.date) ?? systemDate;
        if (!moment(date, 'YYYY-MM-DD', true).isValid()) return { error: 'Invalid date. Expected YYYY-MM-DD.' };
        if (date > systemDate) return { error: 'Date cannot be in the future.' };   // YYYY-MM-DD compares lexically
        const remarks = clean(query.remarks) ?? 'all';
        return { filters: { date, remarks }, scope: { date, remarks } };
    },

    sources: {
        branch: {
            query: MISPAY_BY_USER,
            // Root/admin keep the legacy behaviour (null user = unrestricted); everyone else is the token's user.
            variables: ({ currentUser, unrestricted, filters }) => ({
                userId: unrestricted ? null : String(currentUser._id),
                dateAdded: filters.date,
                remarks: filters.remarks,
            }),
            toRows: toBranchRows,
        },
        lo: {
            query: MISPAY_BY_BRANCH,
            variables: ({ branchId, filters }) => ({ branchId, dateAdded: filters.date, remarks: filters.remarks }),
            toRows: toLoRows,
        },
        client: {
            query: MISPAY_BY_LO,
            variables: ({ loId, filters }) => ({ loId, dateAdded: filters.date, remarks: filters.remarks }),
            toRows: toClientRows,
        },
    },
};

export default apiHandler({ get: createHierarchicalReport(report) });