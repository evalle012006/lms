// src/components/transactions/daily-collection-sheet/DCSTable.js
// Columns: MCBU (Target|Actual) | CSF Collection | Regular Loan (Tgt|Adv|Act) | Other Loan (Tgt|Adv|Act)
//          | Admission (No|Amt) | LRF | CBHB (No|₱200) | Add Hospi | Other Income | Total
//          | MCBU WD | MCBU Ret (No|Amt) | CSF WD | CSF Ret (No|Amt) | NET
//          | Full Payment (No|Amt)

import React from 'react';
import moment from 'moment';
import { FileSpreadsheet } from 'lucide-react';
import { formatPricePhp } from '@/lib/utils';

const th = (extra = '') =>
    `border border-gray-300 px-1.5 py-1 text-center text-xs font-semibold bg-gray-100 ${extra}`;

const toAmount = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
};

// Fields to total for each Loan Officer
const LO_TOTAL_FIELDS = [
    'releaseWithoutSCNo',
    'releaseWithoutSC',

    'mcbuTarget',
    'mcbuActual',

    'csfCollection',
    'csfIn',

    'regularLoanTarget',
    'regularLoanAdvance',
    'regularLoanActual',

    'otherLoanTarget',
    'otherLoanAdvance',
    'otherLoanActual',

    'weekly12Target',
    'weekly12Advance',
    'weekly12Actual',

    'admissionNo',
    'admissionAmount',

    'lrfCollection',

    'cbhbNo',
    'cbhbAmount',

    'addHospitalization',
    'otherIncome',

    'mcbuWithdrawal',
    'mcbuReturnNo',
    'mcbuReturnAmount',

    'csfWithdrawal',
    'csfReturnNo',
    'csfReturnAmount',

    'renewalNo',
    'renewalAmount',
];

// Calculate subtotal for one Loan Officer
const calculateLoTotals = (rows) => {
    const totals = {};

    LO_TOTAL_FIELDS.forEach((field) => {
        totals[field] = rows.reduce(
            (sum, item) => sum + toAmount(item[field]),
            0
        );
    });

    return totals;
};

const calculateCollection = (item) => {
    const totalCollection =
        toAmount(item.mcbuActual) +
        toAmount(item.csfCollection) +
        toAmount(item.csfIn) +
        toAmount(item.regularLoanActual) +
        toAmount(item.otherLoanActual) +
        toAmount(item.weekly12Actual) +
        toAmount(item.admissionAmount) +
        toAmount(item.lrfCollection) +
        toAmount(item.cbhbAmount) +
        toAmount(item.addHospitalization) +
        toAmount(item.otherIncome);

    const totalWithdrawalsAndReturns =
        toAmount(item.mcbuWithdrawal) +
        toAmount(item.mcbuReturnAmount) +
        toAmount(item.csfWithdrawal) +
        toAmount(item.csfReturnAmount);

    const netCollection =
        totalCollection - totalWithdrawalsAndReturns;

    return {
        totalCollection: Math.round(totalCollection * 100) / 100,
        netCollection: Math.round(netCollection * 100) / 100,
    };
};

// Loan Officer subtotal row
const LoTotalRow = ({ loName, rows, fmt }) => {
    const totals = calculateLoTotals(rows);

    const cellClass =
        'border border-red-300 bg-red-50 px-1.5 py-1.5 text-right font-bold text-red-900';

    const countClass =
        'border border-red-300 bg-red-50 px-1.5 py-1.5 text-center font-bold text-red-900';

    const moneyCell = (field) => (
        <td className={cellClass}>
            {fmt(totals[field])}
        </td>
    );

    const countCell = (field) => (
        <td className={countClass}>
            {totals[field] || 0}
        </td>
    );

    const collection = calculateCollection(totals);

    return (
        <tr className="bg-red-50 border-t-2 border-red-400">
            {/* No. + LO + Group */}
            <td
                colSpan={3}
                className="border border-red-300 bg-red-100 px-2 py-2 text-left font-extrabold text-red-900 whitespace-nowrap"
            >
                {loName} - TOTAL
            </td>

            {/* Release Without SC */}
            {countCell('releaseWithoutSCNo')}
            {moneyCell('releaseWithoutSC')}

            {/* MCBU */}
            {moneyCell('mcbuTarget')}
            {moneyCell('mcbuActual')}

            {/* CSF */}
            {moneyCell('csfCollection')}
            {moneyCell('csfIn')}

            {/* Regular Loan */}
            {moneyCell('regularLoanTarget')}
            {moneyCell('regularLoanAdvance')}
            {moneyCell('regularLoanActual')}

            {/* Weekly 24 Weeks */}
            {moneyCell('otherLoanTarget')}
            {moneyCell('otherLoanAdvance')}
            {moneyCell('otherLoanActual')}

            {/* Weekly 12 Weeks */}
            {moneyCell('weekly12Target')}
            {moneyCell('weekly12Advance')}
            {moneyCell('weekly12Actual')}

            {/* Admission */}
            {countCell('admissionNo')}
            {moneyCell('admissionAmount')}

            {/* LRF */}
            {moneyCell('lrfCollection')}

            {/* CBHB */}
            {countCell('cbhbNo')}
            {moneyCell('cbhbAmount')}

            {/* Additional Hospitalization */}
            {moneyCell('addHospitalization')}

            {/* Other Income */}
            {moneyCell('otherIncome')}

            {/* TOTAL Collection */}
            <td className="border border-amber-400 bg-amber-200 px-1.5 py-1.5 text-right font-extrabold text-amber-900">
                {fmt(collection.totalCollection)}
            </td>

            {/* MCBU Withdrawal */}
            {moneyCell('mcbuWithdrawal')}

            {/* MCBU Return */}
            {countCell('mcbuReturnNo')}
            {moneyCell('mcbuReturnAmount')}

            {/* CSF Withdrawal */}
            {moneyCell('csfWithdrawal')}

            {/* CSF Return */}
            {countCell('csfReturnNo')}
            {moneyCell('csfReturnAmount')}

            {/* NET Collection */}
            <td className="border border-emerald-400 bg-emerald-200 px-1.5 py-1.5 text-right font-extrabold text-emerald-900">
                {fmt(collection.netCollection)}
            </td>

            {/* Full Payment */}
            {countCell('renewalNo')}
            {moneyCell('renewalAmount')}
        </tr>
    );
};

const TransferOfClientTable = () => {
    const headers = [
        'Loan Officer',
        'Group',
        'Client Name',
        'Transfer From',
        'Transfer To',
        'Date of Transfer',
        'Remarks',
    ];

    return (
        <div className="mt-5 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

            {/* Section Title */}
            <div className="bg-slate-200 border-b border-gray-300 px-4 py-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">
                    TRANSFER OF CLIENT
                </h3>
            </div>

            {/* Independent Table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-xs">

                    <thead>
                        <tr className="bg-gray-100">
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    className="border border-gray-300 px-3 py-3 text-center font-bold text-gray-700 whitespace-nowrap"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {[1, 2, 3].map((row) => (
                            <tr key={row} className="hover:bg-gray-50">
                                {headers.map((header) => (
                                    <td
                                        key={header}
                                        className="border border-gray-200 px-3 py-3 h-9"
                                    >
                                        &nbsp;
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>

                </table>
            </div>
        </div>
    );
};

const DCSTable = ({ data, branchData, totals, isAdminAllBranches, selectedDate }) => {
    const hasDetailData = data?.length > 0;
    const hasBranchData = branchData?.length > 0;

    // Group DCS records by Loan Officer for subtotal rows
    const loGroups = [];

    (data || []).forEach((item) => {
        const loId = item.loId || item.loName;

        let group = loGroups.find(
            (entry) => entry.loId === loId
        );

        if (!group) {
            group = {
                loId,
                loName: item.loName,
                rows: [],
            };

            loGroups.push(group);
        }

        group.rows.push(item);
    });

    const fmt = (v) => formatPricePhp(v || 0);
    const num = (v) => (v || 0).toLocaleString();

    if (!hasDetailData && !hasBranchData) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-lg">
                <FileSpreadsheet className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">No data available</p>
                <p className="text-gray-400 text-sm mt-2">
                    No collection records found for {moment(selectedDate).format('MMMM D, YYYY')}
                </p>
            </div>
        );
    }

    // ── Admin all-branches view ──────────────────────────────────────────────
    if (isAdminAllBranches && hasBranchData) {
        return (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-auto max-h-[70vh]">
                    <table className="min-w-full text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-30 bg-gray-100">
                            <tr>
                                <th className={th('sticky left-0 z-40 bg-gray-100 min-w-[40px]')} rowSpan={3}>No.</th>
                                <th className={th('sticky left-[40px] z-40 bg-gray-100 min-w-[120px]')} rowSpan={3}>Branch</th>
                                <th className={th()} colSpan={2}>MCBU</th>
                                <th className={th()} rowSpan={3}>CSF Collection</th>
                                <th className={th()} rowSpan={3}>CSF IN</th>
                                <th className={th()} colSpan={3}>Regular Loan</th>
                                <th className={th()} colSpan={3}>Weekly (24 Weeks)</th>
                                <th className={th()} colSpan={3}>Weekly (12 Weeks)</th>
                                <th className={th()} colSpan={2}>Admission</th>
                                <th className={th()} rowSpan={3}>LRF</th>
                                <th className={th()} colSpan={2}>CBHB</th>
                                <th className={th()} rowSpan={3}>Additional Hospitalization</th>
                                <th className={th()} rowSpan={3}>Other Income (Passbook, Picture)</th>
                                <th
                                    className={th('!bg-amber-200 !text-amber-900 font-bold min-w-[95px]')}
                                    rowSpan={3}
                                >
                                    TOTAL Collection
                                </th>
                                <th className={th()} rowSpan={3}>MCBU Withdraw</th>
                                <th className={th()} colSpan={2}>MCBU Return</th>
                                <th className={th()} rowSpan={3}>CSF Withdraw</th>
                                <th className={th()} colSpan={2}>CSF Return</th>
                                <th className={th('font-bold text-teal-700')} rowSpan={3}>NET Collection</th>
                                <th className={th()} colSpan={2}>Full Payment (Renewal, Offset)</th>
                            </tr>
                            <tr>
                                <th className={th()}>Target</th><th className={th()}>Actual</th>
                                <th className={th()}>Target</th><th className={th()}>Advance</th><th className={th()}>Actual</th>
                                <th className={th()}>Target</th><th className={th()}>Advance</th><th className={th()}>Actual</th>
                                <th className={th()}>Target</th>
                                <th className={th()}>Advance</th>
                                <th className={th()}>Actual</th>
                                <th className={th()}>No.</th><th className={th()}>Amount</th>
                                <th className={th()}>No.</th><th className={th()}>₱200</th>
                                <th className={th()}>No.</th><th className={th()}>Amount</th>
                                <th className={th()}>No.</th><th className={th()}>Amount</th>
                                <th className={th()}>No.</th><th className={th()}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branchData.map((item, idx) => (
                                <tr key={item.branchId || idx} className="hover:bg-gray-50">
                                    <td className="border border-gray-200 px-1.5 py-1 text-center sticky left-0 bg-white">{idx + 1}</td>
                                    <td className="border border-gray-200 px-1.5 py-1 text-left sticky left-[40px] bg-white font-medium">
                                        <span className="text-gray-500 mr-1">{item.branchCode}</span>{item.branchName}
                                    </td>
                                    <BranchCells item={item} fmt={fmt} />
                                </tr>
                            ))}
                        </tbody>
                        {totals && (
                            <tfoot>
                                <tr className="bg-yellow-50 font-bold text-red-700">
                                    <td
                                        className="border px-1.5 py-1 text-center sticky left-0 bg-yellow-50"
                                        colSpan={2}
                                    >
                                        TOTAL
                                    </td>

                                    <BranchCells
                                        item={{
                                            ...totals,

                                            totalCollection: branchData.reduce(
                                                (sum, item) =>
                                                    sum + calculateCollection(item).totalCollection,
                                                0
                                            ),

                                            netCollection: branchData.reduce(
                                                (sum, item) =>
                                                    sum + calculateCollection(item).netCollection,
                                                0
                                            ),
                                        }}
                                        fmt={fmt}
                                    />
                                </tr>
                            </tfoot>
                        )}

                    </table>
                </div>
            </div>
        );
    }

    // ── Per-LO/group detail view ─────────────────────────────────────────────
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
                <table className="min-w-full text-xs border-separate border-spacing-0">
                    <thead className="sticky top-0 z-30 bg-gray-100">
                        {/* Row 1 */}
                        <tr>
                            <th className={th('sticky left-0 z-40 min-w-[32px]')} rowSpan={3}>No.</th>
                            <th className={th('sticky left-[32px] z-40 min-w-[110px]')} rowSpan={3}>LO</th>
                            <th className={th('min-w-[90px]')} rowSpan={3}>Group</th>
                            {/* Release Without Service Charge */}
                            <th className={th()} colSpan={2}>
                                Release Without SC
                            </th>
                            {/* MCBU */}
                            <th className={th()} colSpan={2}>MCBU Collection</th>
                            {/* CSF Collection */}
                            <th className={th()} rowSpan={3}>CSF Collection</th>

                            {/* CSF IN */}
                            <th className={th()} rowSpan={3}>CSF IN</th>
                            {/* Loan */}
                            <th className={th()} colSpan={9}>CLIENT'S LOAN COLLECTION</th>
                            {/* Admission */}
                            <th className={th()} colSpan={2}>Admission</th>
                            {/* LRF */}
                            <th className={th()} rowSpan={3}>LRF</th>
                            {/* CBHB */}
                            <th className={th()} colSpan={2}>C.B.H.B</th>
                            {/* Add Hospi */}
                            <th className={th()} rowSpan={3}>Additional Hospitalization</th>
                            {/* Other */}
                            <th className={th()} rowSpan={3}>Other Income (Passbook, Picture)</th>
                            {/* Total */}
                            <th
                                className={th('!bg-amber-200 !text-amber-900 font-bold min-w-[95px]')}
                                rowSpan={3}
                            >
                                TOTAL Collection
                            </th>
                            {/* Less Returns */}
                            <th className={th()} rowSpan={3}>MCBU Withdraw</th>
                            <th className={th()} colSpan={2}>MCBU Return</th>
                            <th className={th()} rowSpan={3}>CSF Withdraw</th>
                            <th className={th()} colSpan={2}>CSF Return</th>
                            {/* NET */}
                            <th
                                className={th('!bg-emerald-200 !text-emerald-900 font-bold min-w-[95px]')}
                                rowSpan={3}
                            >
                                NET Collection
                            </th>
                            {/* Full Payment */}
                            <th className={th()} colSpan={2}>Full Payment (Renewal, Offset)</th>
                        </tr>
                        {/* Row 2 */}
                        <tr>
                            {/* Release Without SC */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>

                            {/* MCBU sub */}
                            <th className={th()} rowSpan={2}>Target</th>
                            <th className={th()} rowSpan={2}>Actual</th>
                            {/* CSF — already rowspan=3 above */}
                            {/* Loan sub */}
                            <th className={th()} colSpan={3}>Regular (60d)</th>
                            <th className={th()} colSpan={3}>Weekly (24 Weeks)</th>
                            <th className={th()} colSpan={3}>Weekly (12 Weeks)</th>
                            {/* Admission sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>
                            {/* CBHB sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>
                            {/* MCBU Ret sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>
                            {/* CSF Ret sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>
                            {/* Renewal sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amount</th>
                        </tr>
                        {/* Row 3 */}
                        <tr>
                            {/* Regular (60d) */}
                            <th className={th()}>Target</th>
                            <th className={th()}>Advance</th>
                            <th className={th()}>Actual</th>

                            {/* Weekly (24 Weeks) */}
                            <th className={th()}>Target</th>
                            <th className={th()}>Advance</th>
                            <th className={th()}>Actual</th>

                            {/* Weekly (12 Weeks) */}
                            <th className={th()}>Target</th>
                            <th className={th()}>Advance</th>
                            <th className={th()}>Actual</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loGroups.map((loGroup) => (
                            <React.Fragment key={loGroup.loId}>
                                {loGroup.rows.map((item, index) => (
                                    <tr
                                        key={`${item.loId}-${item.groupId}-${index}`}
                                        className="hover:bg-gray-50"
                                    >
                                {/* Row No. */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center sticky left-0 bg-white">
                                    {item.groupNo}
                                </td>
                                {/* LO name — only first row of each LO */}
                                {item.isFirstInLo ? (
                                    <td
                                        className="border border-gray-200 px-1.5 py-1 text-left sticky left-[32px] bg-white font-medium whitespace-nowrap"
                                        rowSpan={item.loRowSpan}
                                    >
                                        {item.loName}
                                    </td>
                                ) : null}
                                {/* Group */}
                                <td className="border border-gray-200 px-1.5 py-1 text-left whitespace-nowrap">
                                    {item.groupName}
                                </td>

                                {/* Release Without Service Charge - No. */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">
                                    {Number(item.releaseWithoutSCNo) || 0}
                                </td>

                                {/* Release Without Service Charge - Amount */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.releaseWithoutSC)}
                                </td>

                                {/* MCBU */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuTarget)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuActual)}</td>
                                {/* CSF Collection */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfCollection)}</td>
                                {/* CSF IN */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfIn)}</td>
                                {/* Regular Loan */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanTarget)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanAdvance)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanActual)}</td>
                                {/* Other Loan */}
                                {/* Weekly (24 Weeks) */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.otherLoanTarget)}
                                </td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.otherLoanAdvance)}
                                </td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.otherLoanActual)}
                                </td>

                                {/* Weekly (12 Weeks) */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.weekly12Target)}
                                </td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.weekly12Advance)}
                                </td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">
                                    {fmt(item.weekly12Actual)}
                                </td>
                                {/* Admission */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.admissionNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.admissionAmount)}</td>
                                {/* LRF */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.lrfCollection)}</td>
                                {/* CBHB */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.cbhbNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.cbhbAmount)}</td>
                                {/* Add Hospi */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.addHospitalization)}</td>
                                {/* Other Income */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherIncome)}</td>
                                {/* TOTAL Collection - Highlighted */}
                                <td className="border border-amber-300 bg-amber-50 px-1.5 py-1 text-right font-bold text-amber-900">{fmt(calculateCollection(item).totalCollection)}</td>
                                {/* MCBU WD */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuWithdrawal)}</td>
                                {/* MCBU Return */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.mcbuReturnNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuReturnAmount)}</td>
                                {/* CSF WD */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfWithdrawal)}</td>
                                {/* CSF Return */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.csfReturnNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfReturnAmount)}</td>
                                {/* NET Collection - Highlighted */}
                                <td className="border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-right font-bold text-emerald-900">{fmt(calculateCollection(item).netCollection)}</td>
                                {/* Renewal */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.renewalNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.renewalAmount)}</td>
                            </tr>
                        ))}

                        {/* TOTAL for this Loan Officer */}
                        <LoTotalRow
                            loName={loGroup.loName}
                            rows={loGroup.rows}
                            fmt={fmt}
                        />
                    </React.Fragment>
                ))}
            </tbody>

                    {totals && (
                        <tfoot>
                            <tr className="bg-yellow-50 font-bold text-red-700 text-xs">
                                <td className="border px-1.5 py-1.5 text-center sticky left-0 bg-yellow-50" colSpan={2}>TOTAL</td>
                                <td className="border px-1.5 py-1.5"></td>

                                {/* Release Without Service Charge Total - No. */}
                                <td className="border px-1.5 py-1.5 text-center">
                                    {Number(totals.releaseWithoutSCNo) || 0}
                                </td>

                                {/* Release Without Service Charge Total - Amount */}
                                <td className="border px-1.5 py-1.5 text-right">
                                    {fmt(totals.releaseWithoutSC)}
                                </td>

                                {/* MCBU */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuActual)}</td>
                                {/* CSF Collection */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.csfCollection)}</td>

                                {/* CSF IN */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.csfIn)}</td>
                                {/* Regular */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanAdvance)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanActual)}</td>
                                {/* Weekly (24 Weeks) */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanAdvance)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanActual)}</td>

                                {/* Weekly (12 Weeks) */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.weekly12Target)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.weekly12Advance)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.weekly12Actual)}</td>
                                {/* Admission */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.admissionNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.admissionAmount)}</td>
                                {/* LRF */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.lrfCollection)}</td>
                                {/* CBHB */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.cbhbNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.cbhbAmount)}</td>
                                {/* Add Hospi */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.addHospitalization)}</td>
                                {/* Other Inc */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherIncome)}</td>
                                {/* TOTAL Collection - Grand Total */}
                                <td className="border border-amber-400 bg-amber-200 px-1.5 py-1.5 text-right font-extrabold text-amber-900">{fmt(
                                    data.reduce(
                                        (sum, item) =>
                                            sum + calculateCollection(item).totalCollection,
                                        0
                                    )
                                )}</td>
                                {/* MCBU WD */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuWithdrawal)}</td>
                                {/* MCBU Ret */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.mcbuReturnNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuReturnAmount)}</td>
                                {/* CSF WD */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.csfWithdrawal)}</td>
                                {/* CSF Ret */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.csfReturnNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.csfReturnAmount)}</td>
                                {/* NET Collection - Grand Total */}
                                <td className="border border-emerald-400 bg-emerald-200 px-1.5 py-1.5 text-right font-extrabold text-emerald-900">{fmt(
                                    data.reduce(
                                        (sum, item) =>
                                            sum + calculateCollection(item).netCollection,
                                        0
                                    )
                                )}</td>
                                {/* Renewal */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.renewalNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.renewalAmount)}</td>
                            </tr>
                        </tfoot>
                    )}

                </table>
            </div>

            <TransferOfClientTable />
        </div>
    );
};

// Shared cell renderer for admin all-branches row
const BranchCells = ({ item, fmt }) => (
    <>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuActual)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfIn)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanAdvance)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanActual)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanAdvance)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanActual)}</td>
        {/* Weekly (12 Weeks) */}
        <td className="border border-gray-200 px-1.5 py-1 text-right">
            {fmt(item.weekly12Target)}
        </td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">
            {fmt(item.weekly12Advance)}
        </td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">
            {fmt(item.weekly12Actual)}
        </td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.admissionNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.admissionAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.lrfCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.cbhbNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.cbhbAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.addHospitalization)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherIncome)}</td>
        <td className="border border-amber-300 bg-amber-50 px-1.5 py-1 text-right font-bold text-amber-900">{fmt(calculateCollection(item).totalCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuWithdrawal)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.mcbuReturnNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuReturnAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfWithdrawal)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.csfReturnNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfReturnAmount)}</td>
        <td className="border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-right font-bold text-emerald-900">{fmt(calculateCollection(item).netCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.renewalNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.renewalAmount)}</td>
    </>
);

export default DCSTable;