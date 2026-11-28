// src/lib/dcs-calculations.js

export const toAmount = (value) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const roundMoney = (value) => {
  const amount = toAmount(value);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const sumMoney = (...values) => {
  return roundMoney(
    values.reduce((total, value) => total + toAmount(value), 0)
  );
};

export const calculateDcsCollection = (item = {}) => {
  const totalCollection = sumMoney(
    item.mcbuActual,
    item.csfCollection,
    item.csfIn,
    item.regularLoanActual,
    item.otherLoanActual,
    item.weekly12Actual,
    item.admissionAmount,
    item.lrfCollection,
    item.cbhbAmount,
    item.addHospitalization,
    item.otherIncome
  );

  const totalWithdrawalsAndReturns = sumMoney(
    item.mcbuWithdrawal,
    item.mcbuReturnAmount,
    item.csfWithdrawal,
    item.csfReturnAmount
  );

  return {
    totalCollection,
    totalWithdrawalsAndReturns,
    netCollection: roundMoney(totalCollection - totalWithdrawalsAndReturns),
  };
};

const CASHBOOK_RECEIPT_FIELDS = [
  "mcbuCollection",
  "csfCollection",
  "regularLoanCollection",
  "otherLoanCollection",
  "weekly12Collection",
  "staffCbuCollection",
  "cashbondCollection",
  "salaryAdvanceCollection",
  "membershipFee",
  "lrfCollection",
  "cbhbCollection",
  "cbhbAdditional",
  "cbhbOther",
  "otherIncomePicture",
  "withholdingTax",
  "mcbuUnclaimReturn",
  "csfIn",
  "receiptFundTransfer",
  "otherIncome",
  "otherReceipts",
  "bankWithdrawal",
];

export const calculateCashbookReceipts = (row = {}) => {
  const collections = CASHBOOK_RECEIPT_FIELDS.reduce(
    (total, field) => total + toAmount(row[field]),
    0
  );

  return roundMoney(toAmount(row.beginningBalance) + collections);
};

const CASHBOOK_PAYMENT_FIELDS = [
  "regularLoanReleasePrincipal",
  "otherLoanReleasePrincipal",
  "mcbuWithdrawal",
  "csfWithdrawal",
  "mcbuReturnAmount",
  "csfReturnAmount",
  "staffCbuWithdrawal",
  "cashbondRefund",
  "salaryAdvanceRelease",
  "managementCostExpenses",
  "cbhbDisbursement",
  "unclaimReturnOut",
  "rebatesLoan",
  "otherPayment",
  "paymentFundTransfer",
  "bankDeposit",
];

export const calculateCashbookPayments = (row = {}) => {
  return roundMoney(
    CASHBOOK_PAYMENT_FIELDS.reduce(
      (total, field) => total + toAmount(row[field]),
      0
    )
  );
};

export const calculateClosingBalance = ({
  totalReceipts = 0,
  totalPayments = 0,
} = {}) => {
  return roundMoney(toAmount(totalReceipts) - toAmount(totalPayments));
};

export const calculateCarriedBeginningBalance = ({
  beginningBalance = 0,
  receipts = 0,
  payments = 0,
} = {}) => {
  return roundMoney(
    toAmount(beginningBalance) + toAmount(receipts) - toAmount(payments)
  );
};

export const applyCashbookBeginningBalances = (
  rows = [],
  cashbookData = {}
) => {
  let previousClosingBalance = null;

  return rows.map((originalRow, index) => {
    const row = { ...originalRow };
    const source = cashbookData[row.dateKey];

    const sourceType = String(
      source?.beginningBalanceSource || ""
    ).toLowerCase();

    const sourceBalance =
      source?.beginningBalance !== null &&
      source?.beginningBalance !== undefined &&
      Number.isFinite(Number(source.beginningBalance))
        ? roundMoney(source.beginningBalance)
        : null;

    const existingBalance =
      originalRow.beginningBalance !== null &&
      originalRow.beginningBalance !== undefined &&
      Number.isFinite(Number(originalRow.beginningBalance))
        ? roundMoney(originalRow.beginningBalance)
        : null;

    if (sourceType === "manual" && sourceBalance !== null) {
      row.beginningBalance = sourceBalance;
    } else if (index === 0 || previousClosingBalance === null) {
      row.beginningBalance = sourceBalance ?? existingBalance ?? 0;
    } else {
      row.beginningBalance = previousClosingBalance;
    }

    const totalReceipts = calculateCashbookReceipts(row);
    const totalPayments = calculateCashbookPayments(row);

    previousClosingBalance = calculateClosingBalance({
      totalReceipts,
      totalPayments,
    });

    return row;
  });
};
