// src/components/transactions/daily-collection-sheet/DCSTable.jsx
// The main DCS collection table (per-LO/Group rows with totals).
// Handles both admin-all-branches view and per-branch/LO view.

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import moment from 'moment';
import { formatPricePhp } from '@/lib/utils';

// ── Admin all-branches summary table ────────────────────────
const BranchSummaryTable = ({ branchData, totals }) => (
    <div className="bg-white rounded-lg shadow-lg">
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th rowSpan={2} className="border px-3 py-2 text-center text-xs">No.</th>
                        <th rowSpan={2} className="border px-3 py-2 text-center text-xs whitespace-nowrap">Branch Code</th>
                        <th rowSpan={2} className="border px-3 py-2 text-center text-xs">Branch Name</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">MCBU</th>
                        <th colSpan={3} className="border px-3 py-2 text-center text-xs">Regular Loan (60 Days)</th>
                        <th colSpan={3} className="border px-3 py-2 text-center text-xs">Other Loan (Weekly)</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">Admission</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">LRF</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">CBHB</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">Add'l Hosp</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">Other Inc</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">TOTAL</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">MCBU WD</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">MCBU Ret.</th>
                        <th rowSpan={2} className="border px-2 py-2 text-center text-xs">NET</th>
                    </tr>
                    <tr className="bg-gray-100">
                        {['Tgt','Act','Tgt','Adv','Act','Tgt','Adv','Act','No.','Amt','No.','₱200','No.','Amt'].map((h,i) => (
                            <th key={i} className="border px-2 py-1 text-center text-xs">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {branchData.map((branch, index) => (
                        <tr key={branch.branchId || index} className="hover:bg-gray-50">
                            <td className="border px-2 py-1 text-center text-xs">{index + 1}</td>
                            <td className="border px-2 py-1 text-center text-xs font-medium">{branch.branchCode}</td>
                            <td className="border px-2 py-1 text-left text-xs font-medium">{branch.branchName}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.mcbuTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.mcbuActual)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.regularLoanTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.regularLoanAdvance)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.regularLoanActual)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.otherLoanTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.otherLoanAdvance)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.otherLoanActual)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{branch.admissionNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.admissionAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.lrfCollection)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{branch.cbhbNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.cbhbAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.addHospitalization)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.otherIncome)}</td>
                            <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(branch.totalCollection)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.mcbuWithdrawal)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{branch.mcbuReturnNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(branch.mcbuReturnAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(branch.netCollection)}</td>
                        </tr>
                    ))}
                </tbody>
                {totals && (
                    <tfoot>
                        <tr className="bg-yellow-50 font-bold">
                            <td colSpan={3} className="border px-3 py-2 text-left text-xs">TOTAL</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuActual)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanAdvance)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanActual)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanAdvance)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanActual)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.admissionNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.admissionAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.lrfCollection)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.cbhbNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.cbhbAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.addHospitalization)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherIncome)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.totalCollection)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuWithdrawal)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.mcbuReturnNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuReturnAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.netCollection)}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    </div>
);

// ── Per-LO / Group detail table ──────────────────────────────
const DetailTable = ({ data, totals }) => (
    <div className="bg-white rounded-lg shadow-lg">
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">No.</th>
                        <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap text-xs">Name of LO</th>
                        <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap text-xs">Name of Group</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">MCBU Collection</th>
                        <th colSpan={6} className="border px-3 py-2 text-center text-xs">CLIENT'S LOAN COLLECTION</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">Admission Fee</th>
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">LRF</th>
                        <th colSpan={2} className="border px-3 py-2 text-center text-xs">C.B.H.B</th>
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">Add'l Hosp.</th>
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">Other Inc.</th>
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">TOTAL</th>
                        <th colSpan={3} className="border px-3 py-2 text-center text-xs">LESS RETURNS</th>
                        <th rowSpan={3} className="border px-2 py-2 text-center text-xs">NET</th>
                        <th colSpan={5} className="border px-3 py-2 text-center text-xs">Full Payment Info</th>
                    </tr>
                    <tr className="bg-gray-100">
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Target</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Actual</th>
                        <th colSpan={3} className="border px-2 py-1 text-center text-xs">Regular (60 Days)</th>
                        <th colSpan={3} className="border px-2 py-1 text-center text-xs">Other (Weekly)</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">No.</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Amt.</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">No.</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">₱200</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">MCBU WD</th>
                        <th colSpan={2} className="border px-2 py-1 text-center text-xs">MCBU Ret.</th>
                        <th colSpan={2} className="border px-2 py-1 text-center text-xs">Renewal</th>
                        <th colSpan={2} className="border px-2 py-1 text-center text-xs">Offset</th>
                        <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Clients</th>
                    </tr>
                    <tr className="bg-gray-100">
                        {['Tgt','Adv','Act','Tgt','Adv','Act','No.','Amt','No.','Amt','No.','Amt'].map((h, i) => (
                            <th key={i} className="border px-2 py-1 text-center text-xs">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr key={`${item.loId}-${item.groupId}-${index}`} className="hover:bg-gray-50">
                            <td className="border px-2 py-1 text-center text-xs">{item.groupNo}</td>
                            {item.isFirstInLo ? (
                                <td rowSpan={item.loRowSpan} className="border px-2 py-1 text-left text-xs align-top bg-gray-50 font-medium">
                                    {item.loName}
                                </td>
                            ) : null}
                            <td className="border px-2 py-1 text-left text-xs">{item.groupName}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuActual)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanAdvance)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanActual)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanTarget)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanAdvance)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanActual)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.admissionNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.admissionAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.lrfCollection)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.cbhbNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.cbhbAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.addHospitalization)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherIncome)}</td>
                            <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(item.totalCollection)}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuWithdrawal)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.mcbuReturnNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuReturnAmount)}</td>
                            <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(item.netCollection)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.renewalNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.renewalAmount)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.offsetNo}</td>
                            <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.offsetAmount)}</td>
                            <td className="border px-2 py-1 text-center text-xs">{item.fullPaymentClients}</td>
                        </tr>
                    ))}
                </tbody>
                {totals && (
                    <tfoot>
                        <tr className="bg-yellow-50 font-bold">
                            <td className="border px-2 py-2"></td>
                            <td colSpan={2} className="border px-2 py-2 text-left text-xs">TOTAL</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuActual)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanAdvance)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanActual)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanTarget)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanAdvance)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanActual)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.admissionNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.admissionAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.lrfCollection)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.cbhbNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.cbhbAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.addHospitalization)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherIncome)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.totalCollection)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuWithdrawal)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.mcbuReturnNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuReturnAmount)}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.netCollection)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.renewalNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.renewalAmount)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.offsetNo}</td>
                            <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.offsetAmount)}</td>
                            <td className="border px-2 py-2 text-center text-xs">{totals.fullPaymentClients}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    </div>
);

// ── Empty state ──────────────────────────────────────────────
const EmptyState = ({ selectedDate }) => (
    <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-lg">
        <FileSpreadsheet className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">No data available</p>
        <p className="text-gray-400 text-sm mt-2">
            No collection records found for {moment(selectedDate).format('MMMM D, YYYY')}
        </p>
    </div>
);

// ── Main DCSTable component ──────────────────────────────────
const DCSTable = ({ data, branchData, totals, isAdminAllBranches, selectedDate }) => {
    const hasBranchData = branchData?.length > 0;
    const hasDetailData = data?.length > 0;

    if (isAdminAllBranches && hasBranchData) {
        return <BranchSummaryTable branchData={branchData} totals={totals} />;
    }

    if (hasDetailData) {
        return <DetailTable data={data} totals={totals} />;
    }

    return <EmptyState selectedDate={selectedDate} />;
};

export default DCSTable;