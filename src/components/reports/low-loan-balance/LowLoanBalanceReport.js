// src/components/reports/low-loan-balance/LowLoanBalanceReport.js
//
// Query Low Loan Balance = a CONFIG for the shared drill-down UI (src/components/reports/DrilldownReport.js).
// Replaces Header.js, ViewLowLoanBalanceByBranch.js, ...ByLO.js, ...ByGroup.js and the pages under
// /reports/low-loan-balance. Layout, URL state, drill-down, role-based breadcrumbs, sorting, search and
// paging live in the engine; the filters' operators and defaults are shared with the API
// (src/lib/reports/low-balance-filters.js).
//
// Filters
//   Loan balance / Payments     two server filters (operator + number); changing one = ONE new request,
//                               after a short pause while typing
//   Include delinquent          browser-side only (client level), exactly as before — never a request
//                               !! default is "include" (show everything). Confirm against the classic page.
//   Group / Cycle               browser-side only (client level); options are the groups / cycles in the list on screen
//   Branch / Loan officer       pickers for lateral moves without going back up (hidden when the role has nothing to pick)

import React from 'react';
import DrilldownReport from '@/components/reports/DrilldownReport';
import { BALANCE_OPERATORS, LOW_BALANCE_DEFAULTS } from '@/lib/reports/low-balance-filters';

const col = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

const SUM_KPIS = [
    ['totalAmountRelease', 'Amount Release', 'money'],
    ['totalLoanBalance', 'Loan Balance', 'money'],
    ['totalMCBU', 'MCBU', 'money'],
];

const SUM_COLUMNS = [
    col('totalAmountRelease', 'Amount Release', 'money'),
    col('totalLoanBalance', 'Loan Balance', 'money'),
    col('totalMCBU', 'MCBU', 'money'),
];

const SUM_METRICS = ['noOfClients', 'totalLoanBalance', 'totalAmountRelease', 'totalMCBU'];

// Options come from the rows on screen: the groups / cycles of THIS loan officer's list.
const groupOptions = (rows) => {
    const seen = new Map();
    rows.forEach(r => { if (r.groupId && !seen.has(r.groupId)) seen.set(r.groupId, r.groupName ?? r.groupId); });
    return [...seen].map(([value, label]) => ({ value, label }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true, sensitivity: 'base' }));
};

const cycleOptions = (rows) => [...new Set(rows.map(r => r.loanCycle).filter(c => c != null))]
    .sort((a, b) => Number(a) - Number(b))
    .map(c => ({ value: String(c), label: `Cycle ${c}` }));

const CONFIG = {
    endpoint: 'reports/get-all-low-loan-balance',

    scopeSelectors: ['branch', 'lo'],

    filters: [
        {
            key: 'amount',
            kind: 'compare',
            label: 'Loan balance',
            operatorKey: 'amountOperator',
            operators: BALANCE_OPERATORS,
            default: { operator: LOW_BALANCE_DEFAULTS.amountOperator, value: LOW_BALANCE_DEFAULTS.amount },
        },
        {
            key: 'noOfPayments',
            kind: 'compare',
            label: 'Payments',
            operatorKey: 'noOfPaymentsOperator',
            operators: BALANCE_OPERATORS,
            default: { operator: LOW_BALANCE_DEFAULTS.noOfPaymentsOperator, value: LOW_BALANCE_DEFAULTS.noOfPayments },
        },
        {
            key: 'groupId', kind: 'dataSelect', label: 'Group', allLabel: 'All groups', levels: ['client'], width: 150,
            options: groupOptions, match: (row, v) => row.groupId === v,
        },
        {
            key: 'cycle', kind: 'dataSelect', label: 'Cycle', allLabel: 'All cycles', levels: ['client'], width: 120,
            options: cycleOptions, match: (row, v) => String(row.loanCycle) === v,
        },
        { key: 'includeDelinquent', kind: 'checkbox', label: 'Include delinquent', default: true, local: true, levels: ['client'] },
    ],

    // Same rule as the classic group view: unchecked hides delinquent clients.
    rowFilter: (row, level, values) => level !== 'client' || values.includeDelinquent || row.delinquent !== 'Yes',

    emptyTitle: () => 'No loans match these filters',

    levels: {
        branch: {
            noun: 'branches',
            searchPlaceholder: 'Search branch…',
            denseMin: 760,
            countKey: 'noOfClients',
            kpis: [['noOfClients', 'Clients', 'int'], ...SUM_KPIS],
            columns: [
                col('code', 'Code', 'text', { track: '72px' }),
                col('name', 'Branch', 'text', { track: 'minmax(0,1.8fr)' }),
                col('noOfClients', '# Clients', 'int'),
                ...SUM_COLUMNS,
            ],
            rowKey: r => r._id,
            searchText: r => `${r.code ?? ''} ${r.name ?? ''}`,
            drill: r => ({ branchId: r._id, loId: undefined }),
            card: { title: r => r.name, subtitle: r => r.code, metrics: SUM_METRICS, chips: [] },
        },
        lo: {
            noun: 'loan officers',
            searchPlaceholder: 'Search loan officer…',
            denseMin: 660,
            countKey: 'noOfClients',
            kpis: [['noOfClients', 'Clients', 'int'], ...SUM_KPIS],
            columns: [
                col('loName', 'Loan Officer', 'text', { track: 'minmax(0,1.8fr)' }),
                col('noOfClients', '# Clients', 'int'),
                ...SUM_COLUMNS,
            ],
            rowKey: r => r._id,
            searchText: r => r.loName ?? '',
            drill: r => ({ loId: r._id }),
            card: { title: r => r.loName, subtitle: () => null, metrics: SUM_METRICS, chips: [] },
        },
        client: {
            noun: 'clients',
            searchPlaceholder: 'Search client or group…',
            denseMin: 1000,
            kpis: [['noOfClients', 'Clients', 'int'], ...SUM_KPIS],
            columns: [
                col('groupName', 'Group', 'text', { track: 'minmax(0,1.1fr)' }),
                col('slotNo', 'Slot', 'text', { track: '52px', align: 'center' }),
                col('clientName', 'Client', 'text', { track: 'minmax(0,1.7fr)' }),
                col('loanCycle', 'Cycle', 'text', { track: '48px', align: 'center' }),
                col('amountRelease', 'Amount Release', 'money'),
                col('loanBalance', 'Loan Balance', 'money'),
                col('mcbu', 'MCBU', 'money'),
                col('noOfPayments', '# Paid', 'int', { track: '72px' }),
                // The old API never filled this (the old column was always blank). Hidden unless the SQL function returns it.
                col('noOfMispayments', 'Mispays', 'int', { track: '72px', hideIfAllNull: true }),
                col('delinquent', 'Delinquent', 'delinquent'),
            ],
            rowKey: r => r.loanId ?? `${r.groupId}:${r.slotNo}`,
            searchText: r => `${r.clientName ?? ''} ${r.groupName ?? ''}`,
            drill: null,
            card: {
                title: r => r.clientName ?? '—',
                subtitle: r => `${r.groupName ?? '—'} · Slot ${r.slotNo ?? '-'}`,
                metrics: ['loanBalance', 'mcbu', 'amountRelease', 'noOfPayments', 'noOfMispayments'],
                chips: ['delinquent'],
            },
        },
    },
};

export default function LowLoanBalanceReport() {
    return <DrilldownReport config={CONFIG} />;
}