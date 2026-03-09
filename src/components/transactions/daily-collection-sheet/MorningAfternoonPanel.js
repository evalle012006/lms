// src/components/transactions/daily-collection-sheet/MorningAfternoonPanel.jsx
// Morning / Afternoon denomination summary panel.
// Shows per-LO remittance table + morning/afternoon transaction summaries.
// summaryData = mapped result from fn_get_dcs_summary
// data        = DCS table rows (each has morningRemittance / afternoonRemittance from v2)

import React from 'react';
import { Sun } from 'lucide-react';
import { formatPricePhp } from '@/lib/utils';
import { mapSummaryData } from '@/lib/constants';

const MorningAfternoonPanel = ({ summaryData: rawData, data = [] }) => {
    const d = mapSummaryData(rawData);

    // Build per-LO summary from denomination_summary (preferred) or fall back to DCS rows
    let loSummary = [];

    if (d?.denominationSummary?.length > 0) {
        loSummary = d.denominationSummary;
    } else if (data?.length > 0) {
        // Aggregate from DCS v2 rows
        const loMap = {};
        data.forEach(item => {
            if (!loMap[item.loId]) {
                loMap[item.loId] = {
                    loId:                item.loId,
                    loName:              item.loName,
                    loNo:                item.loNo,
                    totalNetCollection:  0,
                    morningRemittance:   0,
                    afternoonRemittance: 0,
                    bccVsRemittances:    0,
                    status:              null,
                };
            }
            loMap[item.loId].totalNetCollection  += item.netCollection || 0;
            loMap[item.loId].morningRemittance   += item.morningRemittance || 0;
            loMap[item.loId].afternoonRemittance += item.afternoonRemittance || 0;
        });
        // Compute BCC
        Object.values(loMap).forEach(lo => {
            lo.bccVsRemittances = lo.totalNetCollection - (lo.morningRemittance + lo.afternoonRemittance);
        });
        loSummary = Object.values(loMap);
    }

    if (loSummary.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Sun className="w-10 h-10 mb-2" />
            <p className="text-sm">No denomination data available</p>
        </div>
    );

    const totalMorning   = loSummary.reduce((s, lo) => s + (lo.morningRemittance   || 0), 0);
    const totalAfternoon = loSummary.reduce((s, lo) => s + (lo.afternoonRemittance || 0), 0);
    const totalNet       = loSummary.reduce((s, lo) => s + (lo.totalNetCollection  || 0), 0);
    const totalBcc       = loSummary.reduce((s, lo) => {
        const bcc = lo.bccVsRemittances ?? (lo.totalNetCollection - (lo.morningRemittance + lo.afternoonRemittance));
        return s + bcc;
    }, 0);

    const beginningBalance    = d?.beginningBalance || 0;
    const payLoanRelease      = d?.payLoanRelease   || 0;
    const closingBalance      = d?.closingBalance   || 0;

    const morningClosingBalance = beginningBalance + totalMorning - payLoanRelease;

    return (
        <div className="space-y-6">
            {/* ── LO Summary Table ── */}
            <div className="border border-teal-300 rounded-lg overflow-hidden">
                <div className="bg-teal-600 px-4 py-2">
                    <span className="text-white font-bold text-sm">LO COLLECTION SUMMARY</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-teal-50">
                                <th className="border border-teal-200 px-3 py-2 text-center text-xs font-semibold whitespace-nowrap">LO No.</th>
                                <th className="border border-teal-200 px-3 py-2 text-left text-xs font-semibold">Loan Officer</th>
                                <th className="border border-teal-200 px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">Net Collection</th>
                                <th className="border border-teal-200 px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">Morning</th>
                                <th className="border border-teal-200 px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">Afternoon</th>
                                <th className="border border-teal-200 px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">BCC vs Remittances</th>
                                <th className="border border-teal-200 px-3 py-2 text-center text-xs font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loSummary.map((lo, i) => {
                                const bcc = lo.bccVsRemittances ?? (lo.totalNetCollection - (lo.morningRemittance + lo.afternoonRemittance));
                                return (
                                    <tr key={lo.loId || i} className="hover:bg-gray-50">
                                        <td className="border border-gray-200 px-3 py-1.5 text-center text-xs font-medium">
                                            LO-{lo.loNo || (i + 1)}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-1.5 text-xs font-medium">{lo.loName}</td>
                                        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs">
                                            {formatPricePhp(lo.totalNetCollection || 0)}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs text-amber-700 font-medium">
                                            {formatPricePhp(lo.morningRemittance || 0)}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-1.5 text-right text-xs text-blue-700 font-medium">
                                            {formatPricePhp(lo.afternoonRemittance || 0)}
                                        </td>
                                        <td className={`border border-gray-200 px-3 py-1.5 text-right text-xs font-medium ${
                                            bcc < 0 ? 'text-red-600' : bcc > 0 ? 'text-orange-600' : 'text-green-600'
                                        }`}>
                                            {formatPricePhp(bcc)}
                                        </td>
                                        <td className="border border-gray-200 px-3 py-1.5 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                                lo.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                lo.status === 'rejected' ? 'bg-red-100 text-red-700'    :
                                                lo.status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {lo.status || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-teal-50 font-bold">
                                <td colSpan={2} className="border border-teal-200 px-3 py-2 text-xs">TOTAL</td>
                                <td className="border border-teal-200 px-3 py-2 text-right text-xs">{formatPricePhp(totalNet)}</td>
                                <td className="border border-teal-200 px-3 py-2 text-right text-xs">{formatPricePhp(totalMorning)}</td>
                                <td className="border border-teal-200 px-3 py-2 text-right text-xs">{formatPricePhp(totalAfternoon)}</td>
                                <td className="border border-teal-200 px-3 py-2 text-right text-xs">{formatPricePhp(totalBcc)}</td>
                                <td className="border border-teal-200 px-3 py-2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* ── Morning / Afternoon Transaction Cards ── */}
            {d && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Morning */}
                    <div className="border border-amber-300 rounded-lg overflow-hidden">
                        <div className="bg-amber-500 px-4 py-2">
                            <span className="text-white font-bold text-sm">☀ Morning Transaction</span>
                        </div>
                        <table className="w-full border-collapse text-sm">
                            <tbody>
                                <tr>
                                    <td className="border border-amber-100 px-3 py-1.5 text-xs">Beginning Balance</td>
                                    <td className="border border-amber-100 px-3 py-1.5 text-right text-xs">{formatPricePhp(beginningBalance)}</td>
                                </tr>
                                <tr>
                                    <td className="border border-amber-100 px-3 py-1.5 text-xs">LO's Morning Collection</td>
                                    <td className="border border-amber-100 px-3 py-1.5 text-right text-xs">{formatPricePhp(totalMorning)}</td>
                                </tr>
                                <tr className="bg-amber-50 font-semibold">
                                    <td className="border border-amber-200 px-3 py-1.5 text-xs">Total Morning Receipts</td>
                                    <td className="border border-amber-200 px-3 py-1.5 text-right text-xs">
                                        {formatPricePhp(beginningBalance + totalMorning)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-amber-100 px-3 py-1.5 text-xs text-red-600">Less: Loan Releases</td>
                                    <td className="border border-amber-100 px-3 py-1.5 text-right text-xs text-red-600">
                                        {formatPricePhp(payLoanRelease)}
                                    </td>
                                </tr>
                                <tr className="bg-amber-100 font-bold">
                                    <td className="border border-amber-300 px-3 py-2 text-xs">Morning Closing Balance</td>
                                    <td className="border border-amber-300 px-3 py-2 text-right text-xs">
                                        {formatPricePhp(morningClosingBalance)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Afternoon */}
                    <div className="border border-blue-300 rounded-lg overflow-hidden">
                        <div className="bg-blue-500 px-4 py-2">
                            <span className="text-white font-bold text-sm">🌆 Afternoon Collection</span>
                        </div>
                        <table className="w-full border-collapse text-sm">
                            <tbody>
                                <tr>
                                    <td className="border border-blue-100 px-3 py-1.5 text-xs">LO's Afternoon Collection</td>
                                    <td className="border border-blue-100 px-3 py-1.5 text-right text-xs">{formatPricePhp(totalAfternoon)}</td>
                                </tr>
                                <tr className="bg-blue-50 font-semibold">
                                    <td className="border border-blue-200 px-3 py-1.5 text-xs">Total Afternoon Receipts</td>
                                    <td className="border border-blue-200 px-3 py-1.5 text-right text-xs">{formatPricePhp(totalAfternoon)}</td>
                                </tr>
                                <tr className="bg-blue-100 font-bold">
                                    <td className="border border-blue-300 px-3 py-2 text-xs">Closing Balance</td>
                                    <td className="border border-blue-300 px-3 py-2 text-right text-xs">{formatPricePhp(closingBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MorningAfternoonPanel;