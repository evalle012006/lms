//src/hooks/useCashbookRows.js
import { useEffect, useMemo, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import {
  applyCashbookBeginningBalances,
  roundMoney,
} from "@/lib/dcs-calculations";

const formatTransactionCodes = (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) {
    return "";
  }

  const uniqueCodes = [
    ...new Set(
      codes
        .map((value) => {
          const text = String(value ?? "").trim();
          const match = text.match(/^(\d{1,3})(?=\D|$)/);

          return match ? match[1].padStart(3, "0") : "";
        })
        .filter(Boolean)
    ),
  ];

  return uniqueCodes.join(" / ");
};

const emptyRow = (day) => ({
  day,

  /* RECEIPTS / DEBIT */
  description: "",
  receiptTransactionCodes: "",
  paymentTransactionCodes: "",

  beginningBalance: 0,
  mcbuCollection: 0,
  csfCollection: 0,

  regularLoanCollection: 0,
  otherLoanCollection: 0,
  weekly12Collection: 0,

  staffCbuCollection: 0,
  cashbondCollection: 0,
  salaryAdvanceCollection: 0,
  membershipFee: 0,

  lrfCollection: 0,
  cbhbCollection: 0,
  cbhbAdditional: 0,
  cbhbOther: 0,
  otherIncomePicture: 0,

  withholdingTax: 0,
  mcbuUnclaimReturn: 0,

  // LOR CSF In / DCS Other Income CSF W/o Agent (12c)
  csfIn: 0,

  receiptFundTransfer: 0,
  otherIncome: 0,
  otherReceipts: 0,
  bankWithdrawal: 0,

  /* PAYMENTS / CREDIT */
  managementExpenses: 0,

  regularLoanReleasePersons: 0,
  regularLoanReleasePrincipal: 0,

  otherLoanReleasePersons: 0,
  otherLoanReleasePrincipal: 0,

  mcbuWithdrawal: 0,
  csfWithdrawal: 0,

  mcbuReturnPersons: 0,
  mcbuReturnAmount: 0,
  csfReturnAmount: 0,

  staffCbuWithdrawal: 0,
  cashbondRefund: 0,
  salaryAdvanceRelease: 0,

  managementCostExpenses: 0,
  cbhbDisbursement: 0,

  unclaimReturnOut: 0,
  rebatesLoan: 0,
  otherPayment: 0,

  paymentFundTransfer: 0,
  bankDeposit: 0,
});

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const CASHBOOK_OTHER_RECEIPT_COLUMNS = [
  {
    code: "013",
    aliases: ["Motorcycle Advance", "Motor Loan Principal Collection"],
  },
  {
    code: "014",
    aliases: ["Special Advance", "Special Advance Collection"],
  },
  {
    code: "015",
    aliases: ["Cash Advance to Staff", "Cash Advance Collection"],
  },
  {
    code: "016",
    aliases: ["Other Receivable", "Others/Account Receivables"],
  },
  {
    code: "017",
    aliases: ["Office Rental Deposit"],
  },
  {
    code: "030",
    aliases: ["Staff Benevolent Fund (SBF)", "Staff Benevolent Fund"],
  },
  {
    aliases: [
      "Accounts Payable (Payroll A/C)",
      "Accounts Payable - Payroll A/c",
    ],
  },
  {
    aliases: ["Accounts Payable (Others)", "Accounts Payable - Others"],
  },
  {
    code: "033",
    aliases: ["Accrued Expenses (Picture Collection)", "Picture Collection"],
  },
  {
    code: "048",
    aliases: [
      "Recovered from Bad debt Accounts Collection",
      "Recoverable from Badept Accounts",
      "Recoverable from Bad Debt Accounts",
      "Recovered from Bad Debt Accounts Collection",
    ],
  },
  {
    code: "052",
    aliases: [
      "Interest on Borrowed Funds / Investment Capital",
      "Borrowed Fund Accounts",
    ],
  },
];

const isIncludedOtherReceipt = (item) => {
  const category = normalize(item?.category);
  const code = String(item?.code || "").trim();

  const accountTitle = normalize(
    item?.account_title || item?.accountTitle || ""
  );

  if (category !== "other receipts" && code !== "048") {
    return false;
  }

  return CASHBOOK_OTHER_RECEIPT_COLUMNS.some((column) => {
    if (column.code && code === String(column.code)) {
      return true;
    }

    return (column.aliases || []).some(
      (alias) => normalize(alias) === accountTitle
    );
  });
};

export default function useCashbookRows({
  branchId,
  selectedDate,
  cashbookData = {},
  otherIncomeRefreshKey = 0,
}) {
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [otherIncomeLoading, setOtherIncomeLoading] = useState(false);
  const [otherReceiptsLoading, setOtherReceiptsLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [otherIncomeTransactions, setOtherIncomeTransactions] = useState([]);
  const [otherReceiptsTransactions, setOtherReceiptsTransactions] = useState(
    []
  );

  useEffect(() => {
    if (!branchId) {
      setTransactions([]);
      return;
    }

    let cancelled = false;

    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs?branch_id=${encodeURIComponent(
            branchId
          )}`
        );

        if (cancelled) return;

        const data =
          response?.transactions || response?.data || response?.response || [];

        setTransactions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load Cashbook transactions:", error);

        if (!cancelled) {
          setTransactions([]);
        }
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedDate, otherIncomeRefreshKey]);

  useEffect(() => {
    if (!branchId || !selectedDate) {
      setOtherIncomeTransactions([]);
      return;
    }

    let cancelled = false;

    const loadOtherIncomeTransactions = async () => {
      setOtherIncomeLoading(true);

      try {
        const selectedMonth = selectedDate.slice(0, 7);

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs/other-income?branch_id=${encodeURIComponent(
            branchId
          )}&month=${encodeURIComponent(selectedMonth)}`
        );

        if (cancelled) return;

        setOtherIncomeTransactions(
          Array.isArray(response?.transactions) ? response.transactions : []
        );
      } catch (error) {
        console.error("Failed to load Cashbook Other Income:", error);

        if (!cancelled) {
          setOtherIncomeTransactions([]);
        }
      }
    };

    loadOtherIncomeTransactions();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedDate, otherIncomeRefreshKey]);

  useEffect(() => {
    if (!branchId || !selectedDate) {
        setOtherReceiptsTransactions([]);
        setOtherReceiptsLoading(false);
        return;
    }

    let cancelled = false;

    const loadOtherReceipts = async () => {
      setOtherReceiptsLoading(true);
      try {
        const selectedMonth = selectedDate.slice(0, 7);

        const params = new URLSearchParams({
          branch_id: String(branchId),
          month: selectedMonth,
        });

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs/other-receipts?${params.toString()}`
        );

        if (cancelled) return;

        setOtherReceiptsTransactions(
          Array.isArray(response?.transactions) ? response.transactions : []
        );
      } catch (error) {
        console.error("Failed to load Cashbook Other Receipts:", error);

        if (!cancelled) {
            setOtherReceiptsTransactions([]);
        }
        } finally {
        if (!cancelled) {
            setOtherReceiptsLoading(false);
        }
        }
    };

    loadOtherReceipts();

    return () => {
      cancelled = true;
    };
  }, [branchId, selectedDate, otherIncomeRefreshKey]);

  const selected = selectedDate
    ? new Date(`${selectedDate}T00:00:00`)
    : new Date();

  const year = selected.getFullYear();
  const monthIndex = selected.getMonth();

  const rows = useMemo(() => {
    const result = [];

    const selectedDay = selected.getDate();

    for (let day = 1; day <= selectedDay; day++) {
      const date = new Date(year, monthIndex, day);

      const dayOfWeek = date.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      const dateKey = `${year}-${String(monthIndex + 1).padStart(
        2,
        "0"
      )}-${String(day).padStart(2, "0")}`;

      const summary = cashbookData[dateKey];

      let staffCbuCollection = 0;
      let cashbondCollection = 0;
      let salaryAdvanceCollection = 0;
      let staffLoanInterestTotal = 0;
      let receiptFundTransfer = 0;
      let paymentFundTransfer = 0;
      let otherReceiptsTotal = 0;
      let withholdingTax = 0;
      let managementExpensesTotal = 0;
      let cbhbDisbursementTotal = 0;
      let otherPaymentsTotal = 0;
      let salaryAdvanceReleaseTotal = 0;
      let otherIncomeBankDeposit = 0;
      let otherIncomeBankWithdrawal = 0;
      let otherIncomePenalty = 0;
      let otherIncomeExcessRemittance = 0;
      let otherIncomePassbook = 0;

      otherReceiptsTransactions.forEach((transaction) => {
        const transactionDate = String(
          transaction?.transaction_date || ""
        ).slice(0, 10);

        if (transactionDate !== dateKey) {
          return;
        }

        const amount = Number(transaction?.amount || 0);

        if (!Number.isFinite(amount) || amount <= 0) {
          return;
        }

        switch (transaction.transaction_type) {
          case "staff_cbu_collection":
            staffCbuCollection += amount;
            break;

          case "staff_cashbond_collection":
            cashbondCollection += amount;
            break;

          // STAFF PRINCIPAL LOAN COLLECTION
          case "staff_loan_collection":
          case "cash_advance":
          case "special_advance":
              salaryAdvanceCollection += amount;
              break;

          // STAFF LOAN INTEREST
          case "staff_loan_interest":
              staffLoanInterestTotal += amount;
              break;

          // OTHER RECEIPTS
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

      otherIncomeTransactions.forEach((transaction) => {
        const transactionDate = String(
          transaction?.transaction_date || ""
        ).slice(0, 10);

        if (transactionDate !== dateKey) {
          return;
        }

        const amount = Number(transaction?.amount || 0);

        if (!Number.isFinite(amount) || amount <= 0) {
          return;
        }

        switch (transaction.transaction_type) {
          case "penalty":
            otherIncomePenalty += amount;
            break;

          case "excess_remittance":
            otherIncomeExcessRemittance += amount;
            break;

          case "passbook":
            otherIncomePassbook += amount;
            break;

          case "bank_deposit":
            otherIncomeBankDeposit += amount;
            break;

          case "bank_withdrawal":
            otherIncomeBankWithdrawal += amount;
            break;

          default:
            break;
        }
      });

      const receiptCodes = [];
      const paymentCodes = [];

      transactions.forEach((transaction) => {
        const transactionDate = String(
          transaction?.transaction_date || transaction?.date || ""
        ).slice(0, 10);

        if (transactionDate !== dateKey) {
          return;
        }

        const items =
          transaction?.dcs_transaction_items || transaction?.items || [];

        items.forEach((item) => {
          const category = normalize(item?.category);
          const rawCode = String(item?.code || "").trim();
          const codeMatch = rawCode.match(/^(\d{1,3})(?=\D|$)/);
          const code = codeMatch ? codeMatch[1].padStart(3, "0") : rawCode;
          const accountTitle = String(item?.account_title || item?.accountTitle || "")
            .trim()
            .toLowerCase();

          const amount = Number(item?.amount || 0);

          if (!Number.isFinite(amount) || amount <= 0) {
            return;
          }

          // =========================================================
          // AUTOMATIC RECEIPT TRANSACTION CODES
          // =========================================================

          if (
            code &&
            (category === "other receipts" || category === "other income")
          ) {
            receiptCodes.push(code);
          }

          // =========================================================
          // AUTOMATIC PAYMENT TRANSACTION CODES
          // =========================================================

          if (
            code &&
            (category === "management expenses" ||
              category === "other payments")
          ) {
            paymentCodes.push(code);
          }

          // Existing Management Expenses calculation
          if (category === "management expenses") {
            managementExpensesTotal += amount;
          }

        // =========================================================
        // OTHER PAYMENTS
        // 010 - Furniture and Fixtures
        // 010 - Equipments & Vehicles
        // 013 - Motorcycle Advance
        // 014 - Special Advance
        // 015 - Cash Advance to Staff
        // 034 - Accounts Payable
        // 037 - Borrowed Funds
        // 038 - Placement Funds
        // =========================================================
        if (
        category === "other payments" &&
        ["010", "013", "014", "015", "034", "037", "038"].includes(code)
        ) {
        otherPaymentsTotal += amount;
        }

        // =========================================================
        // SALARY ADVANCE RELEASE
        // 012 - Salary Advance
        // =========================================================
        if (
        category === "other payments" &&
        code === "012"
        ) {
        salaryAdvanceReleaseTotal += amount;
        }

        // =========================================================
        // CBHB TOTAL DISBURSEMENT
        // Transaction > Other Payments > Codes 023 and 024
        // =========================================================
        if (
            category === "other payments" &&
                (code === "023" || code === "024")
        )   {
            cbhbDisbursementTotal += amount;
        }

            if (isIncludedOtherReceipt(item)) {
            otherReceiptsTotal += amount;
        }

          if (
            category === "other receipts" &&
            code === "028" &&
            accountTitle === "staff cbu collection"
          ) {
            staffCbuCollection += amount;
          }

          if (
            category === "other receipts" &&
            code === "029" &&
            accountTitle === "staff cashbond collection"
          ) {
            cashbondCollection += amount;
          }

          if (
            category === "other receipts" &&
            code === "012" &&
            accountTitle === "salary advance"
          ) {
            salaryAdvanceCollection += amount;
          }

          if (
            category === "other receipts" &&
            code === "036" &&
            accountTitle === "fund transfer (receiver)"
          ) {
            receiptFundTransfer += amount;
          }

          if (
            category === "other payments" &&
            code === "036" &&
            accountTitle === "fund transfer (giver)"
          ) {
            paymentFundTransfer += amount;
          }
        });
      });

      result.push({
        ...emptyRow(day),

        date,
        dateKey,

        dayName: date.toLocaleDateString("en-US", {
          weekday: "long",
        }),

        receiptTransactionCodes: formatTransactionCodes(receiptCodes),
        paymentTransactionCodes: formatTransactionCodes(paymentCodes),
        beginningBalance: summary?.beginningBalance ?? 0,
        mcbuCollection: summary?.rcptMcbu ?? 0,
        csfCollection: summary?.rcptCsf ?? 0,
        managementCostExpenses: managementExpensesTotal,
        cbhbDisbursement: cbhbDisbursementTotal,
        salaryAdvanceRelease: salaryAdvanceReleaseTotal,
        regularLoanCollection: summary?.rcptRegularLoan ?? 0,
        otherLoanCollection: summary?.rcptOtherLoan ?? 0,
        weekly12Collection: summary?.rcptWeekly12 ?? 0,
        regularLoanReleasePersons:
          Number(summary?.regularLoanReleasePersons) || 0,
        regularLoanReleasePrincipal:
          Number(summary?.regularLoanReleasePrincipal) || 0,
        otherLoanReleasePersons: Number(summary?.otherLoanReleasePersons) || 0,
        otherLoanReleasePrincipal:
          Number(summary?.otherLoanReleasePrincipal) || 0,
        mcbuWithdrawal: Number(summary?.payMcbuWithdrawal) || 0,
        csfWithdrawal: Number(summary?.payCsfWithdrawal) || 0,
        mcbuReturnPersons: Number(summary?.payMcbuReturnNo) || 0,
        mcbuReturnAmount: roundMoney(summary?.payMcbuReturn),
        csfReturnAmount: Number(summary?.payCsfReturn) || 0,
        staffCbuCollection,
        cashbondCollection,
        salaryAdvanceCollection,
        membershipFee: summary?.rcptAdminFees ?? 0,
        lrfCollection: summary?.rcptLrf ?? 0,
        cbhbCollection: summary?.rcptCbhb ?? 0,
        cbhbAdditional: summary?.rcptAddHospi ?? 0,
        cbhbOther: Number(summary?.admissionNo || 0) * 50 + otherIncomePassbook,
        otherIncomePicture: Number(summary?.rcptOtherReceiptsPicture || 0),
        withholdingTax,
        mcbuUnclaimReturn: Number(summary?.rcptMcbuUnclaimedIn) || 0,
        unclaimReturnOut: Number(summary?.payMcbuUnclaimedOut) || 0,
        csfIn: Number(summary?.rcptOtherIncomeCsf) || 0,
        receiptFundTransfer: Number(summary?.rcptFundTransferIn) || 0,
        paymentFundTransfer,

        otherIncome:
          Number(summary?.rcptOtherIncome || 0) +
          otherIncomePenalty +
          otherIncomeExcessRemittance +
          staffLoanInterestTotal,

        otherReceipts: otherReceiptsTotal,
        rebatesLoan: summary?.payRebates ?? 0,

        bankWithdrawal:
            Number(summary?.rcptBankWithdrawal || 0) + otherIncomeBankWithdrawal,

        bankDeposit:
            Number(summary?.payBankDeposits || 0) + otherIncomeBankDeposit,

        otherPayment:
            (Number(summary?.payOtherPayments) || 0) +
            otherPaymentsTotal,
      });
    }

    return applyCashbookBeginningBalances(result, cashbookData);
  }, [
    selectedDate,
    year,
    monthIndex,
    cashbookData,
    transactions,
    otherIncomeTransactions,
    otherReceiptsTransactions,
  ]);

  const selectedDayBeginningBalance = useMemo(() => {
    if (!selectedDate) {
        return null;
    }

    const selectedRow = rows.find(
        (row) => row.dateKey === selectedDate
    );

    if (!selectedRow) {
        return null;
    }

    const amount = Number(selectedRow.beginningBalance);

    return Number.isFinite(amount)
        ? roundMoney(amount)
        : null;
    }, [rows, selectedDate]);

  const loading =
    transactionsLoading || otherIncomeLoading || otherReceiptsLoading;

  return {
    rows,
    selectedDayBeginningBalance: loading ? null : selectedDayBeginningBalance,
    loading,
  };
}
