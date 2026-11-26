// src/components/transactions/daily-collection-sheet/SummaryPanel.jsx
import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import { BookOpen } from "lucide-react";
import { formatPricePhp } from "@/lib/utils";
import { SUMMARY_RECEIPTS, SUMMARY_PAYMENTS, mapSummaryData, } from "@/lib/constants";
import { calculateCashbookReceipts, calculateCashbookPayments, calculateClosingBalance, roundMoney, } from "@/lib/dcs-calculations";

const SummaryRow = ({
  label,
  value,
  bold = false,
  highlight = false,
  no = null,
}) => (
  <tr
    className={`${highlight ? "bg-amber-50 font-bold" : ""} ${
      bold ? "font-semibold" : ""
    }`}
  >
    {no !== null ? (
      <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500 w-8">
        {no}
      </td>
    ) : null}
    <td
      className="border border-gray-300 px-3 py-1 text-xs"
      colSpan={no === null ? 2 : 1}
    >
      {label}
    </td>
    <td
      className={`border border-gray-300 px-3 py-1 text-right text-xs min-w-[100px] ${
        value < 0
          ? "text-red-600"
          : value > 0
          ? "text-gray-900"
          : "text-gray-400"
      }`}
    >
      {value !== 0 ? formatPricePhp(Math.abs(value)) : "—"}
    </td>
  </tr>
);

// ── Main component ───────────────────────────────────────────
const SummaryPanel = ({
  summaryData: rawData,
  dcsTotals,
  cashbookMcbuIn,
  cashbookRow = null,
  branchId,
  selectedDate,
  otherIncomeRefreshKey = 0,
  canEditBeginningBalance = false,
  onBeginningBalanceSaved,
  cashbookBeginningBalance = null,
}) => {
  const d = mapSummaryData(rawData);

  const PICTURE_FEE_PER_RELEASE = 50;

  const totalLoanReleases = Number(d?.payLoanReleaseNo) || 0;

  const otherIncomePicture = totalLoanReleases * PICTURE_FEE_PER_RELEASE;

  const [beginningBalanceOverride, setBeginningBalanceOverride] =
    useState(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [balanceSource, setBalanceSource] = useState("historical");
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState("");
  const [otherIncomeBankDeposit, setOtherIncomeBankDeposit] = useState(0);
  const [otherIncomeBankWithdrawal, setOtherIncomeBankWithdrawal] = useState(0);
  const [otherIncomeReceipts, setOtherIncomeReceipts] = useState(0);
  const [otherIncomePassbook, setOtherIncomePassbook] = useState(0);

  const [staffCbuCollection, setStaffCbuCollection] = useState(0);
  const [staffCashbondCollection, setStaffCashbondCollection] = useState(0);
  const [staffLoanCollection, setStaffLoanCollection] = useState(0);
  const [staffLoanInterest, setStaffLoanInterest] = useState(0);
  const [otherReceiptsCollections, setOtherReceiptsCollections] = useState(0);

  useEffect(() => {
    if (!branchId || !selectedDate) {
      setOtherIncomeBankDeposit(0);
      setOtherIncomeBankWithdrawal(0);
      setOtherIncomeReceipts(0);
      setOtherIncomePassbook(0);
      return;
    }

    let cancelled = false;

    const loadBankDeposits = async () => {
      try {
        const params = new URLSearchParams({
          branch_id: String(branchId),
          transaction_date: selectedDate,
        });

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs/other-income?${params.toString()}`
        );

        if (cancelled) return;

        const transactions = Array.isArray(response?.transactions)
          ? response.transactions
          : [];

        let bankDepositTotal = 0;
        let bankWithdrawalTotal = 0;
        let otherIncomeTotal = 0;
        let passbookTotal = 0;

        transactions.forEach((transaction) => {
          const amount = Number(transaction?.amount || 0);

          if (!Number.isFinite(amount) || amount <= 0) {
            return;
          }

          switch (transaction.transaction_type) {
            case "bank_deposit":
              bankDepositTotal += amount;
              break;

            case "bank_withdrawal":
              bankWithdrawalTotal += amount;
              break;

            case "penalty":
            case "excess_remittance":
              otherIncomeTotal += amount;
              break;

            case "passbook":
              passbookTotal += amount;
              break;

            default:
              break;
          }
        });

        setOtherIncomeBankDeposit(bankDepositTotal);
        setOtherIncomeBankWithdrawal(bankWithdrawalTotal);
        setOtherIncomeReceipts(otherIncomeTotal);
        setOtherIncomePassbook(passbookTotal);
      } catch (error) {
        console.error("Other Income loading error:", error);

        if (!cancelled) {
          setOtherIncomeBankDeposit(0);
          setOtherIncomeBankWithdrawal(0);
          setOtherIncomeReceipts(0);
          setOtherIncomePassbook(0);
        }
      }
    };

    loadBankDeposits();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedDate, otherIncomeRefreshKey]);

  useEffect(() => {
    if (!branchId || !selectedDate) {
      setStaffCbuCollection(0);
      setStaffCashbondCollection(0);
      setStaffLoanCollection(0);
      setStaffLoanInterest(0);
      setOtherReceiptsCollections(0);
      return;
  }

    let cancelled = false;

    const loadOtherReceipts = async () => {
      try {
        const params = new URLSearchParams({
          branch_id: String(branchId),
          transaction_date: selectedDate,
        });

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs/other-receipts?${params.toString()}`
        );

        if (cancelled) return;

        const transactions = Array.isArray(response?.transactions)
          ? response.transactions
          : [];

        let cbuTotal = 0;
        let cashbondTotal = 0;
        let loanTotal = 0;
        let staffLoanInterestTotal = 0;
        let otherReceiptsTotal = 0;

        transactions.forEach((transaction) => {
          const amount = Number(transaction?.amount || 0);

          if (!Number.isFinite(amount) || amount <= 0) {
            return;
          }

          switch (transaction.transaction_type) {
            case "staff_cbu_collection":
              cbuTotal += amount;
              break;

            case "staff_cashbond_collection":
              cashbondTotal += amount;
              break;

            // 5 - Staff Principal Loan Collection
            case "staff_loan_collection":
            case "cash_advance":
            case "special_advance":
                loanTotal += amount;
                break;

            // Staff Loan Interest
            case "staff_loan_interest":
                staffLoanInterestTotal += amount;
                break;

            // 14 - Other Receipts
            case "bad_debt_collection":
            case "salary_advance":
            case "motorcycle_loan":
            case "staff_sbf_utility_collection":
            case "mpl_contribution":
            case "sss_contribution":
            case "ap_payroll":
            case "overstated_management_expenses":
                otherReceiptsTotal += amount;
                break;

            default:
              break;
          }
        });

        setStaffCbuCollection(cbuTotal);
        setStaffCashbondCollection(cashbondTotal);
        setStaffLoanCollection(loanTotal);
        setStaffLoanInterest(staffLoanInterestTotal);
        setOtherReceiptsCollections(otherReceiptsTotal);
      } catch (error) {
        console.error("Failed to load Other Receipts collections:", error);

        if (!cancelled) {
          setStaffCbuCollection(0);
          setStaffCashbondCollection(0);
          setStaffLoanCollection(0);
          setStaffLoanInterest(0);
          setOtherReceiptsCollections(0);
        }
      }
    };

    loadOtherReceipts();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedDate, otherIncomeRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    setBeginningBalanceOverride(null);
    setHasOverride(false);
    setBalanceSource("historical");
    setEditingBalance(false);
    setBalanceError("");

    if (!branchId || !selectedDate) return;

    const loadBeginningBalance = async () => {
      setBalanceLoading(true);

      try {
        const params = new URLSearchParams({
          branch_id: branchId,
          selected_date: selectedDate,
        });

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}dcs/beginning-balance?${params.toString()}`
        );

        if (cancelled) return;

        if (!response?.success) {
          throw new Error(
            response?.message || "Failed to load Beginning Balance."
          );
        }

        setHasOverride(Boolean(response.hasOverride));

        setBalanceSource(response.source || "historical");

        setBeginningBalanceOverride(
          response.beginningBalance !== null &&
            response.beginningBalance !== undefined
            ? Number(response.beginningBalance)
            : null
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Beginning Balance load error:", error);
          setBalanceError("Unable to load Beginning Balance.");
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

  const effectiveBeginningBalance = (() => {
    // Use the exact Beginning Balance from the selected Cashbook row.
    if (
        cashbookRow &&
        cashbookRow.beginningBalance !== null &&
        cashbookRow.beginningBalance !== undefined &&
        Number.isFinite(Number(cashbookRow.beginningBalance))
    ) {
        return roundMoney(cashbookRow.beginningBalance);
    }

    // Fallback while Cashbook data is loading.
    if (
        cashbookBeginningBalance !== null &&
        cashbookBeginningBalance !== undefined &&
        Number.isFinite(Number(cashbookBeginningBalance))
    ) {
        return roundMoney(cashbookBeginningBalance);
    }

    // Preserve saved manual overrides when Cashbook data is unavailable.
    if (balanceSource === "manual" && beginningBalanceOverride !== null) {
        return roundMoney(beginningBalanceOverride);
    }

    if (beginningBalanceOverride !== null) {
        return roundMoney(beginningBalanceOverride);
    }

    return roundMoney(d?.beginningBalance || 0);
    })();

  const handleSaveBeginningBalance = async () => {
    if (!canEditBeginningBalance || !branchId || !selectedDate) {
      setBalanceError("You cannot edit this Beginning Balance.");
      return;
    }

    const value = balanceInput.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      setBalanceError("Enter a valid amount with up to two decimal places.");
      return;
    }

    setBalanceSaving(true);
    setBalanceError("");

    try {
      const response = await fetchWrapper.post(
        `${getApiBaseUrl()}dcs/beginning-balance`,
        {
          branch_id: branchId,
          selected_date: selectedDate,
          beginning_balance: value,
        }
      );

      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to save Beginning Balance."
        );
      }

      setBeginningBalanceOverride(Number(response.beginningBalance));
      setHasOverride(true);
      setBalanceSource("manual");
      setEditingBalance(false);

      if (onBeginningBalanceSaved) {
        onBeginningBalanceSaved();
      }
    } catch (error) {
      console.error("Beginning Balance save error:", error);
      setBalanceError(error?.message || "Unable to save Beginning Balance.");
    } finally {
      setBalanceSaving(false);
    }
  };

  if (!d)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <BookOpen className="w-10 h-10 mb-2" />
        <p className="text-sm">No summary data available</p>
      </div>
    );

    console.log("SUMMARY MANAGEMENT EXPENSES:", {
        cashbookRow,
        cashbookManagementExpenses:
            cashbookRow?.managementCostExpenses,
        summaryManagementExpenses:
            d?.payMngtExpenses,
    });

  const amounts = {
    rcptMcbu: dcsTotals ? Number(dcsTotals.mcbuActual) || 0 : d.rcptMcbu,

    rcptCsf: dcsTotals
      ? Number(dcsTotals.csfCollection) || 0
      : Number(d.rcptCsf) || 0,

    rcptRegularLoan: dcsTotals
      ? Number(dcsTotals.regularLoanActual) || 0
      : Number(d.rcptRegularLoan) || 0,

    rcptOtherLoan: dcsTotals
      ? Number(dcsTotals.otherLoanActual) || 0
      : Number(d.rcptOtherLoan) || 0,

    rcptWeekly12: dcsTotals
      ? Number(dcsTotals.weekly12Actual) || 0
      : Number(d.rcptWeekly12) || 0,

    rcptStaffCbu:
      Number(d.rcptStaffCbu || 0) +
      staffCbuCollection +
      staffCashbondCollection,

    rcptStaffPrincipal: Number(d.rcptStaffPrincipal || 0) + staffLoanCollection,

    rcptAdminFees: d.rcptAdminFees,
    rcptLrf: d.rcptLrf,
    rcptCbhb: d.rcptCbhb,
    rcptAddHospi: d.rcptAddHospi,
    rcptWtax: d.rcptWtax,

    rcptMcbuUnclaimedIn: Number(d.rcptMcbuUnclaimedIn) || 0,

    rcptOtherIncomePassbook:
      (Number(dcsTotals?.admissionNo) || 0) * 50 + otherIncomePassbook,
    rcptOtherIncome:
      Number(d.rcptOtherIncome || 0) +
      otherIncomeReceipts +
      staffLoanInterest,
    rcptOtherIncomeCsf: d.rcptOtherIncomeCsf,

    rcptOtherReceiptsPicture: otherIncomePicture,

    rcptOtherReceiptsGl:
      Number(d.rcptOtherReceiptsGl || 0) + otherReceiptsCollections,

    rcptFundTransferIn: Number(d.rcptFundTransferIn) || 0,

    rcptBankWithdrawal:
      Number(d.rcptBankWithdrawal || 0) + otherIncomeBankWithdrawal,

    payLoanRelease: d.payLoanRelease,
    payMcbuWithdrawal: d.payMcbuWithdrawal,
    payCsfWithdrawal: d.payCsfWithdrawal,

    payMcbuReturn: dcsTotals
        ? Number(dcsTotals.mcbuReturnAmount) || 0
        : Number(d.payMcbuReturn) || 0,

    payCsfReturn: dcsTotals
        ? Number(dcsTotals.csfReturnAmount) || 0
        : Number(d.payCsfReturn) || 0,

    payStaffLoanRelease: cashbookRow
        ? (Number(cashbookRow.salaryAdvanceRelease) || 0) +
        (Number(cashbookRow.staffCbuWithdrawal) || 0)
        : Number(d.payStaffLoanRelease) || 0,

    payMngtExpenses: cashbookRow
        ? Number(cashbookRow.managementCostExpenses) || 0
        : Number(d.payMngtExpenses) || 0,

    payCbhbDisbursed: cashbookRow
        ? Number(cashbookRow.cbhbDisbursement) || 0
        : Number(d.payCbhbDisbursed) || 0,

    payMcbuUnclaimedOut: d.payMcbuUnclaimedOut,
    payRebates: d.payRebates,

    payOtherPayments: cashbookRow
        ? Number(cashbookRow.otherPayment) || 0
        : Number(d.payOtherPayments) || 0,

    payFundTransferOut: d.payFundTransferOut,
    payBankDeposits: Number(d.payBankDeposits || 0) + otherIncomeBankDeposit,
  };

  // ── RECEIPTS DIFFERENCES ─────────────────────────────

  const mcbuDifference = amounts.rcptMcbu - d.rcptMcbu;
  const csfDifference = amounts.rcptCsf - d.rcptCsf;
  const regularLoanDifference = amounts.rcptRegularLoan - d.rcptRegularLoan;
  const otherLoanDifference = amounts.rcptOtherLoan - d.rcptOtherLoan;
  const weekly12Difference =
    amounts.rcptWeekly12 - (Number(d.rcptWeekly12) || 0);
  const mcbuUnclaimedInDifference =
    amounts.rcptMcbuUnclaimedIn - d.rcptMcbuUnclaimedIn;

  const fundTransferInDifference =
    amounts.rcptFundTransferIn - Number(d.rcptFundTransferIn || 0);

  const totalCollectionDifference =
    mcbuDifference +
    csfDifference +
    regularLoanDifference +
    otherLoanDifference +
    weekly12Difference +
    mcbuUnclaimedInDifference +
    fundTransferInDifference;

  // ── PAYMENTS DIFFERENCES ─────────────────────────────

  const mcbuReturnDifference = amounts.payMcbuReturn - d.payMcbuReturn;
  const csfReturnDifference = amounts.payCsfReturn - d.payCsfReturn;
  const totalPaymentDifference = mcbuReturnDifference + csfReturnDifference;

  // ── UPDATED TOTALS ───────────────────────────────────

  const updatedTotalReceipts = roundMoney(
    effectiveBeginningBalance +
      Number(d.totalReceipts || 0) +
      totalCollectionDifference +
      otherIncomeReceipts +
      otherIncomeBankWithdrawal +
      staffCbuCollection +
      staffCashbondCollection +
      staffLoanCollection +
      staffLoanInterest +
      otherReceiptsCollections +
      (amounts.rcptOtherIncomePassbook -
        Number(d.rcptOtherIncomePassbook || 0)) +
      (otherIncomePicture - Number(d.rcptOtherReceiptsPicture || 0))
  );

  const updatedTotalPayments = roundMoney(
    Number(d.totalPayments || 0) +
      totalPaymentDifference +
      otherIncomeBankDeposit
  );

  const cashbookBalanceMatches =
    cashbookRow &&
    roundMoney(cashbookRow.beginningBalance) ===
        roundMoney(effectiveBeginningBalance);

    const finalTotalReceipts = cashbookBalanceMatches
    ? calculateCashbookReceipts(cashbookRow)
    : updatedTotalReceipts;

    const finalTotalPayments = cashbookBalanceMatches
    ? calculateCashbookPayments(cashbookRow)
    : updatedTotalPayments;

    const updatedClosingBalance = calculateClosingBalance({
    totalReceipts: finalTotalReceipts,
    totalPayments: finalTotalPayments,
    });

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
                        setBalanceError("");
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

                    {balanceSource === "carried_forward" && (
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
                        {balanceSaving ? "Saving..." : "Save"}
                      </button>

                      <button
                        type="button"
                        disabled={balanceSaving}
                        onClick={() => {
                          setEditingBalance(false);
                          setBalanceError("");
                        }}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : balanceLoading ? (
                  "Loading..."
                ) : (
                  formatPricePhp(effectiveBeginningBalance)
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
          <span className="text-white font-bold text-xs tracking-wide">
            RECEIPTS
          </span>
        </div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {SUMMARY_RECEIPTS.map((item) => (
              <SummaryRow
                key={item.key}
                no={item.no}
                label={item.label}
                value={amounts[item.key] || 0}
              />
            ))}
            <SummaryRow
              label="Total Receipts"
              value={finalTotalReceipts}
              highlight
            />
          </tbody>
        </table>
      </div>

      <div className="border border-red-300 rounded-lg overflow-hidden">
        <div className="bg-red-600 px-3 py-1.5">
          <span className="text-white font-bold text-xs tracking-wide">
            PAYMENTS
          </span>
        </div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {SUMMARY_PAYMENTS.map((item) => {
              let label = item.label;
              if (item.key === "payLoanRelease" && d.payLoanReleaseNo) {
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
              value={finalTotalPayments}
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
              <td
                className={`border border-blue-300 px-3 py-2 text-right font-bold text-sm min-w-[110px] ${
                  updatedClosingBalance < 0 ? "text-red-600" : "text-blue-700"
                }`}
              >
                {formatPricePhp(updatedClosingBalance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SummaryPanel;
