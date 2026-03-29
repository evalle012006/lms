// src/components/transactions/daily-collection-sheet/DCSTable.js
// Columns: MCBU (Target|Actual) | CSF Collection | Regular Loan (Tgt|Adv|Act) | Other Loan (Tgt|Adv|Act)
//          | Admission (No|Amt) | LRF | CBHB (No|₱200) | Add Hospi | Other Income | Total
//          | MCBU WD | MCBU Ret (No|Amt) | CSF WD | CSF Ret (No|Amt) | NET
//          | Renewal (No|Amt) | Offset (No|Amt) | Clients

import React from 'react';
import moment from 'moment';
import { FileSpreadsheet } from 'lucide-react';
import { formatPricePhp } from '@/lib/utils';

const th = (extra = '') =>
    `border border-gray-300 px-1.5 py-1 text-center text-xs font-semibold bg-gray-100 ${extra}`;
const DCSTable = ({ data, branchData, totals, isAdminAllBranches, selectedDate }) => {
    const hasDetailData = data?.length > 0;
    const hasBranchData = branchData?.length > 0;

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
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th className={th('sticky left-0 z-10 bg-gray-100 min-w-[40px]')} rowSpan={3}>No.</th>
                                <th className={th('sticky left-[40px] z-10 bg-gray-100 min-w-[120px]')} rowSpan={3}>Branch</th>
                                <th className={th()} colSpan={2}>MCBU</th>
                                <th className={th()} rowSpan={3}>CSF Col.</th>
                                <th className={th()} colSpan={3}>Regular Loan</th>
                                <th className={th()} colSpan={3}>Other Loan</th>
                                <th className={th()} colSpan={2}>Admission</th>
                                <th className={th()} rowSpan={3}>LRF</th>
                                <th className={th()} colSpan={2}>CBHB</th>
                                <th className={th()} rowSpan={3}>Add Hospi</th>
                                <th className={th()} rowSpan={3}>Other Inc.</th>
                                <th className={th('font-bold')} rowSpan={3}>Total</th>
                                <th className={th()} rowSpan={3}>MCBU WD</th>
                                <th className={th()} colSpan={2}>MCBU Ret</th>
                                <th className={th()} rowSpan={3}>CSF WD</th>
                                <th className={th()} colSpan={2}>CSF Ret</th>
                                <th className={th('font-bold text-teal-700')} rowSpan={3}>NET</th>
                                <th className={th()} colSpan={2}>Renewal</th>
                                <th className={th()} colSpan={2}>Offset</th>
                                <th className={th()} rowSpan={3}>Clients</th>
                            </tr>
                            <tr>
                                <th className={th()}>Tgt</th><th className={th()}>Act</th>
                                <th className={th()}>Tgt</th><th className={th()}>Adv</th><th className={th()}>Act</th>
                                <th className={th()}>Tgt</th><th className={th()}>Adv</th><th className={th()}>Act</th>
                                <th className={th()}>No.</th><th className={th()}>Amt</th>
                                <th className={th()}>No.</th><th className={th()}>₱200</th>
                                <th className={th()}>No.</th><th className={th()}>Amt</th>
                                <th className={th()}>No.</th><th className={th()}>Amt</th>
                                <th className={th()}>No.</th><th className={th()}>Amt</th>
                                <th className={th()}>No.</th><th className={th()}>Amt</th>
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
                                    <td className="border px-1.5 py-1 text-center sticky left-0 bg-yellow-50" colSpan={2}>TOTAL</td>
                                    <BranchCells item={totals} fmt={fmt} />
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
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">
                    <thead>
                        {/* Row 1 */}
                        <tr>
                            <th className={th('sticky left-0 z-10 min-w-[32px]')} rowSpan={3}>No.</th>
                            <th className={th('sticky left-[32px] z-10 min-w-[110px]')} rowSpan={3}>LO</th>
                            <th className={th('min-w-[90px]')} rowSpan={3}>Group</th>
                            {/* MCBU */}
                            <th className={th()} colSpan={2}>MCBU Col.</th>
                            {/* CSF */}
                            <th className={th()} rowSpan={3}>CSF Col.</th>
                            {/* Loan */}
                            <th className={th()} colSpan={6}>CLIENT'S LOAN COLLECTION</th>
                            {/* Admission */}
                            <th className={th()} colSpan={2}>Admission</th>
                            {/* LRF */}
                            <th className={th()} rowSpan={3}>LRF</th>
                            {/* CBHB */}
                            <th className={th()} colSpan={2}>C.B.H.B</th>
                            {/* Add Hospi */}
                            <th className={th()} rowSpan={3}>Add Hospi</th>
                            {/* Other */}
                            <th className={th()} rowSpan={3}>Other Inc.</th>
                            {/* Total */}
                            <th className={th('font-bold')} rowSpan={3}>TOTAL</th>
                            {/* Less Returns */}
                            <th className={th()} rowSpan={3}>MCBU WD</th>
                            <th className={th()} colSpan={2}>MCBU Ret.</th>
                            <th className={th()} rowSpan={3}>CSF WD</th>
                            <th className={th()} colSpan={2}>CSF Ret.</th>
                            {/* NET */}
                            <th className={th('font-bold text-teal-700')} rowSpan={3}>NET</th>
                            {/* Full Payment */}
                            <th className={th()} colSpan={2}>Renewal</th>
                            <th className={th()} colSpan={2}>Offset</th>
                            <th className={th()} rowSpan={3}>Clients</th>
                        </tr>
                        {/* Row 2 */}
                        <tr>
                            {/* MCBU sub */}
                            <th className={th()} rowSpan={2}>Tgt</th>
                            <th className={th()} rowSpan={2}>Act</th>
                            {/* CSF — already rowspan=3 above */}
                            {/* Loan sub */}
                            <th className={th()} colSpan={3}>Regular (60d)</th>
                            <th className={th()} colSpan={3}>Other (Wkly)</th>
                            {/* Admission sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amt</th>
                            {/* CBHB sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>₱200</th>
                            {/* MCBU Ret sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amt</th>
                            {/* CSF Ret sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amt</th>
                            {/* Renewal sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amt</th>
                            {/* Offset sub */}
                            <th className={th()} rowSpan={2}>No.</th>
                            <th className={th()} rowSpan={2}>Amt</th>
                        </tr>
                        {/* Row 3 */}
                        <tr>
                            <th className={th()}>Tgt</th><th className={th()}>Adv</th><th className={th()}>Act</th>
                            <th className={th()}>Tgt</th><th className={th()}>Adv</th><th className={th()}>Act</th>
                        </tr>
                    </thead>

                    <tbody>
                        {data.map((item, index) => (
                            <tr key={`${item.loId}-${item.groupId}-${index}`} className="hover:bg-gray-50">
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
                                <td className="border border-gray-200 px-1.5 py-1 text-left whitespace-nowrap">{item.groupName}</td>
                                {/* MCBU */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuTarget)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuActual)}</td>
                                {/* CSF Collection */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfCollection)}</td>
                                {/* Regular Loan */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanTarget)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanAdvance)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanActual)}</td>
                                {/* Other Loan */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanTarget)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanAdvance)}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanActual)}</td>
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
                                {/* Total */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right font-semibold">{fmt(item.totalCollection)}</td>
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
                                {/* NET */}
                                <td className="border border-gray-200 px-1.5 py-1 text-right font-bold text-teal-700">{fmt(item.netCollection)}</td>
                                {/* Renewal */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.renewalNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.renewalAmount)}</td>
                                {/* Offset */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.offsetNo}</td>
                                <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.offsetAmount)}</td>
                                {/* Clients */}
                                <td className="border border-gray-200 px-1.5 py-1 text-center">{item.fullPaymentClients}</td>
                            </tr>
                        ))}
                    </tbody>

                    {totals && (
                        <tfoot>
                            <tr className="bg-yellow-50 font-bold text-red-700 text-xs">
                                <td className="border px-1.5 py-1.5 text-center sticky left-0 bg-yellow-50" colSpan={2}>TOTAL</td>
                                <td className="border px-1.5 py-1.5"></td>
                                {/* MCBU */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.mcbuActual)}</td>
                                {/* CSF */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.csfCollection)}</td>
                                {/* Regular */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanAdvance)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.regularLoanActual)}</td>
                                {/* Other */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanTarget)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanAdvance)}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.otherLoanActual)}</td>
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
                                {/* Total */}
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.totalCollection)}</td>
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
                                {/* NET */}
                                <td className="border px-1.5 py-1.5 text-right text-teal-700">{fmt(totals.netCollection)}</td>
                                {/* Renewal */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.renewalNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.renewalAmount)}</td>
                                {/* Offset */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.offsetNo}</td>
                                <td className="border px-1.5 py-1.5 text-right">{fmt(totals.offsetAmount)}</td>
                                {/* Clients */}
                                <td className="border px-1.5 py-1.5 text-center">{totals.fullPaymentClients}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

// Shared cell renderer for admin all-branches row
const BranchCells = ({ item, fmt }) => (
    <>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuActual)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanAdvance)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.regularLoanActual)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanTarget)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanAdvance)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherLoanActual)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.admissionNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.admissionAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.lrfCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.cbhbNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.cbhbAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.addHospitalization)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.otherIncome)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right font-semibold">{fmt(item.totalCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuWithdrawal)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.mcbuReturnNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.mcbuReturnAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfWithdrawal)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.csfReturnNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.csfReturnAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right font-bold text-teal-700">{fmt(item.netCollection)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.renewalNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.renewalAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.offsetNo}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-right">{fmt(item.offsetAmount)}</td>
        <td className="border border-gray-200 px-1.5 py-1 text-center">{item.fullPaymentClients}</td>
    </>
);

export default DCSTable;