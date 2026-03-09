// src/components/transactions/daily-collection-sheet/SummaryPanel.jsx
// DCS Cashbook/Summary section — shows Beginning Balance, Receipts, Payments,
// Closing Balance, and Loan Release per LO.
// Renamed from CashbookPanel. Data comes from fn_get_dcs_summary.

import React from 'react';
import { BookOpen } from 'lucide-react';
import { formatPricePhp } from '@/lib/utils';
import { SUMMARY_RECEIPTS, SUMMARY_PAYMENTS, mapSummaryData } from '@/lib/constants';

// ── Row component ────────────────────────────────────────────
const SummaryRow = ({ label, value, bold = false, highlight = false, no = null }) => (
    <tr className={`${highlight ? 'bg-amber-50 font-bold' : ''} ${bold ? 'font-semibold' : ''}`}>
        {no !== null && (
            <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500 w-8">{no}</td>
        )}
        <td className="border border-gray-300 px-3 py-1 text-xs">{label}</td>
        <td className={`border border-gray-300 px-3 py-1 text-right text-xs min-w-[100px] ${
            value < 0 ? 'text-red-600' : value > 0 ? 'text-gray-900' : 'text-gray-400'
        }`}>
            {value !== 0 ? formatPricePhp(Math.abs(value)) : '—'}
        </td>
    </tr>
);

// ── Main component ───────────────────────────────────────────
const SummaryPanel = ({ summaryData: rawData }) => {
    const d = mapSummaryData(rawData);

    if (!d) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <BookOpen className="w-10 h-10 mb-2" />
            <p className="text-sm">No summary data available</p>
        </div>
    );

    const amounts = {
        rcptMcbu:                d.rcptMcbu,
        rcptCsf:                 d.rcptCsf,
        rcptRegularLoan:         d.rcptRegularLoan,
        rcptOtherLoan:           d.rcptOtherLoan,
        rcptStaffCbu:            d.rcptStaffCbu,
        rcptStaffPrincipal:      d.rcptStaffPrincipal,
        rcptAdminFees:           d.rcptAdminFees,
        rcptLrf:                 d.rcptLrf,
        rcptCbhb:                d.rcptCbhb,
        rcptAddHospi:            d.rcptAddHospi,
        rcptWtax:                d.rcptWtax,
        rcptMcbuUnclaimedIn:     d.rcptMcbuUnclaimedIn,
        rcptOtherIncomePassbook: d.rcptOtherIncomePassbook,
        rcptOtherIncome:         d.rcptOtherIncome,
        rcptOtherIncomeCsf:      d.rcptOtherIncomeCsf,
        rcptOtherReceiptsPicture:d.rcptOtherReceiptsPicture,
        rcptOtherReceiptsGl:     d.rcptOtherReceiptsGl,
        rcptFundTransferIn:      d.rcptFundTransferIn,
        rcptBankWithdrawal:      d.rcptBankWithdrawal,
        // Payments
        payLoanRelease:          d.payLoanRelease,
        payMcbuWithdrawal:       d.payMcbuWithdrawal,
        payCsfWithdrawal:        d.payCsfWithdrawal,
        payMcbuReturn:           d.payMcbuReturn,
        payCsfReturn:            d.payCsfReturn,
        payStaffLoanRelease:     d.payStaffLoanRelease,
        payMngtExpenses:         d.payMngtExpenses,
        payCbhbDisbursed:        d.payCbhbDisbursed,
        payMcbuUnclaimedOut:     d.payMcbuUnclaimedOut,
        payRebates:              d.payRebates,
        payOtherPayments:        d.payOtherPayments,
        payFundTransferOut:      d.payFundTransferOut,
        payBankDeposits:         d.payBankDeposits,
    };

    return (
        <div className="space-y-4">
            {/* ── Beginning Balance ── */}
            <div className="border border-orange-300 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr className="bg-orange-50">
                            <td className="border border-orange-300 px-3 py-2 font-bold text-orange-800 text-sm">
                                Beginning Balance
                            </td>
                            <td className="border border-orange-300 px-3 py-2 text-right font-bold text-orange-700 text-sm min-w-[110px]">
                                {formatPricePhp(d.beginningBalance)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── RECEIPTS ── */}
            <div className="border border-green-300 rounded-lg overflow-hidden">
                <div className="bg-green-600 px-3 py-1.5">
                    <span className="text-white font-bold text-xs tracking-wide">RECEIPTS</span>
                </div>
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        {SUMMARY_RECEIPTS.map(item => (
                            <SummaryRow
                                key={item.key}
                                no={item.no}
                                label={item.label}
                                value={amounts[item.key] || 0}
                            />
                        ))}
                        <SummaryRow label="Total Receipts" value={d.totalReceipts} highlight />
                    </tbody>
                </table>
            </div>

            {/* ── PAYMENTS ── */}
            <div className="border border-red-300 rounded-lg overflow-hidden">
                <div className="bg-red-600 px-3 py-1.5">
                    <span className="text-white font-bold text-xs tracking-wide">PAYMENTS</span>
                </div>
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        {SUMMARY_PAYMENTS.map(item => {
                            let label = item.label;
                            if (item.key === 'payLoanRelease' && d.payLoanReleaseNo) {
                                label = `${label} ........ ${d.payLoanReleaseNo}`;
                            }
                            return (
                                <SummaryRow
                                    key={item.key}
                                    no={item.no}
                                    label={label}
                                    value={amounts[item.key] || 0}
                                />
                            );
                        })}
                        <SummaryRow label="Total Payments" value={d.totalPayments} highlight />
                    </tbody>
                </table>
            </div>

            {/* ── Closing Balance ── */}
            <div className="border border-blue-400 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr className="bg-blue-50">
                            <td className="border border-blue-300 px-3 py-2 font-bold text-blue-800 text-sm">
                                Closing Balance
                            </td>
                            <td className={`border border-blue-300 px-3 py-2 text-right font-bold text-sm min-w-[110px] ${
                                d.closingBalance < 0 ? 'text-red-600' : 'text-blue-700'
                            }`}>
                                {formatPricePhp(d.closingBalance)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Loan Release per LO ── */}
            {d.loanReleasePerLo.length > 0 && (
                <div className="border border-purple-300 rounded-lg overflow-hidden">
                    <div className="bg-purple-600 px-3 py-1.5">
                        <span className="text-white font-bold text-xs tracking-wide">LOAN RELEASE PER LO</span>
                    </div>
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-purple-50">
                                <th className="border border-purple-200 px-3 py-1.5 text-left text-xs font-semibold">LO</th>
                                <th className="border border-purple-200 px-3 py-1.5 text-center text-xs font-semibold"># of Client</th>
                                <th className="border border-purple-200 px-3 py-1.5 text-right text-xs font-semibold">Release Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {d.loanReleasePerLo.map((lo, i) => (
                                <tr key={lo.loId || i} className="hover:bg-purple-50">
                                    <td className="border border-gray-200 px-3 py-1.5 text-xs">
                                        LO-{lo.loNo} — {lo.loName}
                                    </td>
                                    <td className="border border-gray-200 px-3 py-1.5 text-center text-xs">{lo.noClients}</td>
                                    <td className="border border-gray-200 px-3 py-1.5 text-right text-xs font-medium">
                                        {formatPricePhp(lo.releaseAmount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-purple-50 font-bold">
                                <td className="border border-purple-200 px-3 py-1.5 text-xs">TOTAL</td>
                                <td className="border border-purple-200 px-3 py-1.5 text-center text-xs">
                                    {d.loanReleasePerLo.reduce((s, lo) => s + (lo.noClients || 0), 0)}
                                </td>
                                <td className="border border-purple-200 px-3 py-1.5 text-right text-xs">
                                    {formatPricePhp(d.loanReleasePerLo.reduce((s, lo) => s + (lo.releaseAmount || 0), 0))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SummaryPanel;