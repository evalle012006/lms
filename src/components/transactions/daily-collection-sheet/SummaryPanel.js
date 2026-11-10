// src/components/transactions/daily-collection-sheet/SummaryPanel.jsx
import React, { useEffect, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { BookOpen } from 'lucide-react';
import { formatPricePhp } from '@/lib/utils';
import { SUMMARY_RECEIPTS, SUMMARY_PAYMENTS, mapSummaryData } from '@/lib/constants';

const SummaryRow = ({ label, value, bold = false, highlight = false, no = null }) => (
    <tr className={`${highlight ? 'bg-amber-50 font-bold' : ''} ${bold ? 'font-semibold' : ''}`}>
        {no !== null ? (
            <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500 w-8">{no}</td>
        ) : null}
        <td
            className="border border-gray-300 px-3 py-1 text-xs"
            colSpan={no === null ? 2 : 1}
        >
            {label}
        </td>
        <td className={`border border-gray-300 px-3 py-1 text-right text-xs min-w-[100px] ${
            value < 0 ? 'text-red-600' : value > 0 ? 'text-gray-900' : 'text-gray-400'
        }`}>
            {value !== 0 ? formatPricePhp(Math.abs(value)) : '—'}
        </td>
    </tr>
);

// ── Main component ───────────────────────────────────────────
const SummaryPanel = ({
    summaryData: rawData,
    dcsTotals,
    cashbookMcbuIn,
    branchId,
    selectedDate,
    canEditBeginningBalance = false,
    onBeginningBalanceSaved
}) => {
    const d = mapSummaryData(rawData);

    const [beginningBalanceOverride, setBeginningBalanceOverride] = useState(null);
    const [hasOverride, setHasOverride] = useState(false);
    const [balanceSource, setBalanceSource] = useState('historical');
    const [editingBalance, setEditingBalance] = useState(false);
    const [balanceInput, setBalanceInput] = useState('');
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [balanceSaving, setBalanceSaving] = useState(false);
    const [balanceError, setBalanceError] = useState('');

    useEffect(() => {
        let cancelled = false;

        setBeginningBalanceOverride(null);
        setHasOverride(false);
        setBalanceSource('historical');
        setEditingBalance(false);
        setBalanceError('');

        if (!branchId || !selectedDate) return;

        const loadBeginningBalance = async () => {
            setBalanceLoading(true);

            try {
                const params = new URLSearchParams({
                    branch_id: branchId,
                    selected_date: selectedDate
                });

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}dcs/beginning-balance?${params.toString()}`
                );

                if (cancelled) return;

                if (!response?.success) {
                    throw new Error(response?.message || 'Failed to load Beginning Balance.');
                }

                setHasOverride(Boolean(response.hasOverride));

                setBalanceSource(response.source || 'historical');

                setBeginningBalanceOverride(
                    response.beginningBalance !== null &&
                    response.beginningBalance !== undefined
                        ? Number(response.beginningBalance)
                        : null
                );
            } catch (error) {
                if (!cancelled) {
                    console.error('Beginning Balance load error:', error);
                    setBalanceError('Unable to load Beginning Balance.');
                }
            } finally {
                if (!cancelled) setBalanceLoading(false);
            }
        };

        loadBeginningBalance();

        return () => {
            cancelled = true;
        };
    }, [branchId, selectedDate]);

    const effectiveBeginningBalance =
        beginningBalanceOverride !== null
            ? beginningBalanceOverride
            : Number(d?.beginningBalance || 0);

    const handleSaveBeginningBalance = async () => {
        if (!canEditBeginningBalance || !branchId || !selectedDate) {
            setBalanceError('You cannot edit this Beginning Balance.');
            return;
        }

        const value = balanceInput.trim();

        if (!/^\d+(\.\d{1,2})?$/.test(value)) {
            setBalanceError(
                'Enter a valid amount with up to two decimal places.'
            );
            return;
        }

        setBalanceSaving(true);
        setBalanceError('');

        try {
            const response = await fetchWrapper.post(
                `${getApiBaseUrl()}dcs/beginning-balance`,
                {
                    branch_id: branchId,
                    selected_date: selectedDate,
                    beginning_balance: value
                }
            );

            if (!response?.success) {
                throw new Error(response?.message || 'Failed to save Beginning Balance.');
            }

            setBeginningBalanceOverride(Number(response.beginningBalance));
            setHasOverride(true);
            setBalanceSource('manual');
            setEditingBalance(false);

            if (onBeginningBalanceSaved) {
                onBeginningBalanceSaved();
            }
        } catch (error) {
            console.error('Beginning Balance save error:', error);
            setBalanceError(error?.message || 'Unable to save Beginning Balance.');
        } finally {
            setBalanceSaving(false);
        }
    };

    if (!d) return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <BookOpen className="w-10 h-10 mb-2" />
            <p className="text-sm">No summary data available</p>
        </div>
    );

    const amounts = {
        rcptMcbu: dcsTotals
            ? Number(dcsTotals.mcbuActual) || 0
            : d.rcptMcbu,

        rcptCsf: dcsTotals
            ? Number(dcsTotals.csfCollection) || 0
            : d.rcptCsf,

        rcptRegularLoan: dcsTotals
            ? Number(dcsTotals.regularLoanActual) || 0
            : d.rcptRegularLoan,

        rcptOtherLoan: dcsTotals
            ? Number(dcsTotals.otherLoanActual) || 0
            : d.rcptOtherLoan,

        rcptStaffCbu: d.rcptStaffCbu,
        rcptStaffPrincipal: d.rcptStaffPrincipal,
        rcptAdminFees: d.rcptAdminFees,
        rcptLrf: d.rcptLrf,
        rcptCbhb: d.rcptCbhb,
        rcptAddHospi: d.rcptAddHospi,
        rcptWtax: d.rcptWtax,
        rcptMcbuUnclaimedIn:
        cashbookMcbuIn !== null && cashbookMcbuIn !== undefined
            ? Number(cashbookMcbuIn) || 0
            : d.rcptMcbuUnclaimedIn,
        rcptOtherIncomePassbook: d.rcptOtherIncomePassbook,
        rcptOtherIncome: d.rcptOtherIncome,
        rcptOtherIncomeCsf: d.rcptOtherIncomeCsf,
        rcptOtherReceiptsPicture: d.rcptOtherReceiptsPicture,
        rcptOtherReceiptsGl: d.rcptOtherReceiptsGl,
        rcptFundTransferIn: d.rcptFundTransferIn,
        rcptBankWithdrawal: d.rcptBankWithdrawal,
        payLoanRelease: d.payLoanRelease,
        payMcbuWithdrawal: d.payMcbuWithdrawal,
        payCsfWithdrawal: d.payCsfWithdrawal,
        payMcbuReturn: dcsTotals
            ? Number(dcsTotals.mcbuReturnAmount) || 0
            : d.payMcbuReturn,

        payCsfReturn: dcsTotals
            ? Number(dcsTotals.csfReturnAmount) || 0
            : d.payCsfReturn,
        payStaffLoanRelease: d.payStaffLoanRelease,
        payMngtExpenses: d.payMngtExpenses,
        payCbhbDisbursed: d.payCbhbDisbursed,
        payMcbuUnclaimedOut: d.payMcbuUnclaimedOut,
        payRebates: d.payRebates,
        payOtherPayments: d.payOtherPayments,
        payFundTransferOut: d.payFundTransferOut,
        payBankDeposits: d.payBankDeposits,
    };

    // ── RECEIPTS DIFFERENCES ─────────────────────────────

    const mcbuDifference = amounts.rcptMcbu - d.rcptMcbu;
    const csfDifference = amounts.rcptCsf - d.rcptCsf;
    const regularLoanDifference = amounts.rcptRegularLoan - d.rcptRegularLoan;
    const otherLoanDifference = amounts.rcptOtherLoan - d.rcptOtherLoan;
    const mcbuUnclaimedInDifference =
        amounts.rcptMcbuUnclaimedIn -
        d.rcptMcbuUnclaimedIn;

    const totalCollectionDifference =
        mcbuDifference +
        csfDifference +
        regularLoanDifference +
        otherLoanDifference +
        mcbuUnclaimedInDifference;

    // ── PAYMENTS DIFFERENCES ─────────────────────────────

    const mcbuReturnDifference = amounts.payMcbuReturn - d.payMcbuReturn;
    const csfReturnDifference = amounts.payCsfReturn - d.payCsfReturn;
    const totalPaymentDifference =
        mcbuReturnDifference +
        csfReturnDifference;

    // ── UPDATED TOTALS ───────────────────────────────────

    const updatedTotalReceipts =
        Number(d.totalReceipts || 0) + totalCollectionDifference;

    const updatedTotalPayments =
        Number(d.totalPayments || 0) + totalPaymentDifference;

    const updatedClosingBalance =
        Math.round(
            (
                effectiveBeginningBalance +
                updatedTotalReceipts -
                updatedTotalPayments
            ) * 100
        ) / 100;

    return (
        <div className="space-y-4">
            <div className="border border-orange-300 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr className="bg-orange-50">
                            <td className="border border-orange-300 px-3 py-2 font-bold text-orange-800 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span>Beginning Balance</span>

                                    {canEditBeginningBalance && !editingBalance && (
                                        <button
                                            type="button"
                                            disabled={balanceLoading || balanceSaving}
                                            onClick={() => {
                                                setBalanceInput(String(effectiveBeginningBalance));
                                                setBalanceError('');
                                                setEditingBalance(true);
                                            }}
                                            className="px-2 py-1 text-xs rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>

                                {!editingBalance && (
                                    <>
                                        {hasOverride && (
                                            <span className="text-[10px] text-orange-600">
                                                Manual Override
                                            </span>
                                        )}

                                        {balanceSource === 'carried_forward' && (
                                            <span className="text-[10px] text-green-600">
                                                Auto Carry-Forward
                                            </span>
                                        )}
                                    </>
                                )}
                            </td>

                            <td className="border border-orange-300 px-3 py-2 text-right font-bold text-orange-700 text-sm min-w-[110px]">
                                {editingBalance ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={balanceInput}
                                            onChange={(e) => setBalanceInput(e.target.value)}
                                            className="w-full border border-orange-300 rounded px-2 py-1 text-right text-sm"
                                        />

                                        <div className="flex justify-end gap-1">
                                            <button
                                                type="button"
                                                disabled={balanceSaving}
                                                onClick={handleSaveBeginningBalance}
                                                className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                                            >
                                                {balanceSaving ? 'Saving...' : 'Save'}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={balanceSaving}
                                                onClick={() => {
                                                    setEditingBalance(false);
                                                    setBalanceError('');
                                                }}
                                                className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    balanceLoading
                                        ? 'Loading...'
                                        : formatPricePhp(effectiveBeginningBalance)
                                )}
                            </td>
                        </tr>

                        {balanceError && (
                            <tr>
                                <td
                                    colSpan={2}
                                    className="px-3 py-2 text-xs text-red-600 bg-red-50"
                                >
                                    {balanceError}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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
                        <SummaryRow
                            label="Total Receipts"
                            value={updatedTotalReceipts}
                            highlight
                        />
                    </tbody>
                </table>
            </div>

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
                        <SummaryRow
                            label="Total Payments"
                            value={updatedTotalPayments}
                            highlight
                        />
                    </tbody>
                </table>
            </div>

            <div className="border border-blue-400 rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-sm">
                    <tbody>
                        <tr className="bg-blue-50">
                            <td className="border border-blue-300 px-3 py-2 font-bold text-blue-800 text-sm">
                                Closing Balance
                            </td>
                            <td className={`border border-blue-300 px-3 py-2 text-right font-bold text-sm min-w-[110px] ${
                                updatedClosingBalance < 0 ? 'text-red-600' : 'text-blue-700'
                            }`}>
                                {formatPricePhp(updatedClosingBalance)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

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