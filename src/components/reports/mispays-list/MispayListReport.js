// src/components/reports/mispays-list/MispayListReport.js
//
// Mispayment List = a CONFIG for the shared drill-down UI (src/components/reports/DrilldownReport.js).
// Replaces Header.js, ViewByBranch.js, ViewByLO.js, ViewByGroup.js and the pages under /reports/mispay-list.
// To change a column, a filter or a KPI, edit it here; layout, URL state, drill-down, role-based
// breadcrumbs, sorting, search and paging all live in the engine.

import React from 'react';
import DrilldownReport, { formatDate, remarkLabel } from '@/components/reports/DrilldownReport';
import { LOR_MISPAY_REMARKS } from '@/lib/constants';

const col = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

const SUM_KPIS = [
    ['totalAmountRelease', 'Amount Release', 'money'],
    ['totalLoanBalance', 'Loan Balance', 'money'],
    ['totalMCBU', 'MCBU', 'money'],
    ['totalNet', 'Net Loan Balance', 'money'],
];

const SUM_COLUMNS = [
    col('totalAmountRelease', 'Amount Release', 'money'),
    col('totalLoanBalance', 'Loan Balance', 'money'),
    col('totalMCBU', 'MCBU', 'money'),
    col('totalNet', 'Net Loan Bal.', 'money'),
];

const SUM_METRICS = ['noOfMispays', 'totalLoanBalance', 'totalNet', 'totalAmountRelease', 'totalMCBU'];

const CONFIG = {
    endpoint: 'reports/get-all-mispays',

    filters: [
        { key: 'date', kind: 'date', label: 'Date' },
        {
            key: 'remarks',
            kind: 'select',
            label: 'Remarks',
            default: 'all',
            options: [{ label: 'All remarks', value: 'all' }, ...LOR_MISPAY_REMARKS],
        },
    ],

    emptyTitle: (scope) => `No mispayments on ${formatDate(scope.date)}`,

    levels: {
        branch: {
            noun: 'branches',
            searchPlaceholder: 'Search branch…',
            denseMin: 820,
            countKey: 'noOfMispays',
            kpis: [['noOfMispays', 'Mispays', 'int'], ...SUM_KPIS],
            columns: [
                col('code', 'Code', 'text', { track: '72px' }),
                col('name', 'Branch', 'text', { track: 'minmax(0,1.8fr)' }),
                col('noOfMispays', '# Mispays', 'int'),
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
            denseMin: 720,
            countKey: 'noOfMispays',
            kpis: [['noOfMispays', 'Mispays', 'int'], ...SUM_KPIS],
            columns: [
                col('loName', 'Loan Officer', 'text', { track: 'minmax(0,1.8fr)' }),
                col('noOfMispays', '# Mispays', 'int'),
                ...SUM_COLUMNS,
            ],
            rowKey: r => r._id,
            searchText: r => r.loName ?? '',
            drill: r => ({ loId: r._id }),
            card: { title: r => r.loName, subtitle: () => null, metrics: SUM_METRICS, chips: [] },
        },
        client: {
            noun: 'clients',
            searchPlaceholder: 'Search client, group or remarks…',
            denseMin: 1100,
            kpis: [['noOfClients', 'Clients', 'int'], ...SUM_KPIS],
            columns: [
                col('groupName', 'Group', 'text', { track: 'minmax(0,1.1fr)' }),
                col('slotNo', 'Slot', 'text', { track: '52px', align: 'center' }),
                col('clientName', 'Client', 'text', { track: 'minmax(0,1.7fr)' }),
                col('loanCycle', 'Cycle', 'text', { track: '48px', align: 'center' }),
                col('amountRelease', 'Amount Release', 'money'),
                col('loanBalance', 'Loan Balance', 'money'),
                col('mcbu', 'MCBU', 'money'),
                col('netLoanBalance', 'Net Loan Bal.', 'money'),
                col('noOfPayments', '# Paid', 'int', { track: '72px' }),
                col('delinquent', 'Delinquent', 'delinquent'),
                col('remarks', 'Remarks', 'remarks'),
            ],
            rowKey: r => r.loanId ?? `${r.groupId}:${r.slotNo}`,
            searchText: (r) => `${r.clientName ?? ''} ${r.groupName ?? ''} ${remarkLabel(r.remarks)}`,
            drill: null,
            card: {
                title: r => r.clientName ?? '—',
                subtitle: r => `${r.groupName ?? '—'} · Slot ${r.slotNo ?? '-'}`,
                metrics: ['loanBalance', 'mcbu', 'netLoanBalance', 'amountRelease', 'noOfPayments'],
                chips: ['delinquent', 'remarks'],
            },
        },
    },
};

export default function MispayListReport() {
    return <DrilldownReport config={CONFIG} />;
}