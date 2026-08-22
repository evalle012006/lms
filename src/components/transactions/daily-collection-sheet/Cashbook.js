import React, { useMemo } from "react";

/* =========================================================
   CASHBOOK
   Connected to Daily Collection Summary data
   No Hasura
========================================================= */

const money = (value) => {
  const number = Number(value || 0);

  return number.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const emptyRow = (day) => ({
  day,

  /* RECEIPTS / DEBIT */
  description: "",
  beginningBalance: 0,
  mcbuCollection: 0,
  csfCollection: 0,

  regularLoanCollection: 0,
  otherLoanCollection: 0,

  staffCbuCollection: 0,
  cashbondCollection: 0,
  salaryAdvanceCollection: 0,
  membershipFee: 0,

  lrfCollection: 0,
  cbhbCollection: 0,
  cbhbAdditional: 0,
  cbhbOther: 0,

  withholdingTax: 0,
  mcbuUnclaimReturn: 0,
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

const Cashbook = ({
  selectedDate,
  cashbookData = {},
  loading = false,
}) => {
  /* =======================================================
     TEMPORARY UI DATA
     Later this will come from API / Hasura.
  ======================================================= */

  const selected = selectedDate
    ? new Date(`${selectedDate}T00:00:00`)
    : new Date();

  const year = selected.getFullYear();
  const monthIndex = selected.getMonth();

  const month = selected
    .toLocaleDateString("en-US", {
      month: "long",
    })
    .toUpperCase();

  const rows = useMemo(() => {
    const result = [];

    const selectedDay = selected.getDate();

    for (let day = 1; day <= selectedDay; day++) {
      const date = new Date(year, monthIndex, day);

      const dayOfWeek = date.getDay();

      // Skip Sunday and Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      const dateKey =
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const summary = cashbookData[dateKey];

      result.push({
        ...emptyRow(day),

        date,
        dateKey,

        dayName: date.toLocaleDateString("en-US", {
          weekday: "long",
        }),

        // DCS SUMMARY
        beginningBalance: summary?.beginningBalance ?? 0,
        mcbuCollection: summary?.rcptMcbu ?? 0,
        csfCollection: summary?.rcptCsf ?? 0,
        regularLoanCollection: summary?.rcptRegularLoan ?? 0,
        otherLoanCollection: summary?.rcptOtherLoan ?? 0,
      });
    }

    return result;
  }, [selected, year, monthIndex, cashbookData]);

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const calculateTotalReceipts = (row) => {
    return (
      Number(row.beginningBalance || 0) +
      Number(row.mcbuCollection || 0) +
      Number(row.csfCollection || 0) +
      Number(row.regularLoanCollection || 0) +
      Number(row.otherLoanCollection || 0) +
      Number(row.staffCbuCollection || 0) +
      Number(row.cashbondCollection || 0) +
      Number(row.salaryAdvanceCollection || 0) +
      Number(row.membershipFee || 0) +
      Number(row.lrfCollection || 0) +
      Number(row.cbhbCollection || 0) +
      Number(row.cbhbAdditional || 0) +
      Number(row.cbhbOther || 0) +
      Number(row.withholdingTax || 0) +
      Number(row.mcbuUnclaimReturn || 0) +
      Number(row.receiptFundTransfer || 0) +
      Number(row.otherIncome || 0) +
      Number(row.otherReceipts || 0) +
      Number(row.bankWithdrawal || 0)
    );
  };

  const calculateTotalPayments = (row) => {
    return (
      Number(row.managementExpenses || 0) +
      Number(row.regularLoanReleasePrincipal || 0) +
      Number(row.otherLoanReleasePrincipal || 0) +
      Number(row.mcbuWithdrawal || 0) +
      Number(row.csfWithdrawal || 0) +
      Number(row.mcbuReturnAmount || 0) +
      Number(row.csfReturnAmount || 0) +
      Number(row.staffCbuWithdrawal || 0) +
      Number(row.cashbondRefund || 0) +
      Number(row.salaryAdvanceRelease || 0) +
      Number(row.managementCostExpenses || 0) +
      Number(row.cbhbDisbursement || 0) +
      Number(row.unclaimReturnOut || 0) +
      Number(row.rebatesLoan || 0) +
      Number(row.otherPayment || 0) +
      Number(row.paymentFundTransfer || 0) +
      Number(row.bankDeposit || 0)
    );
  };

  /* =======================================================
     WEEK GROUPS
  ======================================================= */

  const isWeekEnd = (row, index) => {
    const nextRow = rows[index + 1];

    // Friday = end of normal work week
    if (row.date.getDay() === 5) {
      return true;
    }

    // Last working day of the month
    if (!nextRow) {
      return true;
    }

    return false;
  };

  /* =======================================================
     TOTAL HELPER
  ======================================================= */

  const sumField = (sourceRows, field) =>
    sourceRows.reduce(
      (total, row) => total + Number(row[field] || 0),
      0
    );

  const renderTotalRow = (sourceRows, label, className = "") => {
    const totalReceipts = sourceRows.reduce(
      (sum, row) => sum + calculateTotalReceipts(row),
      0
    );

    const totalPayments = sourceRows.reduce(
      (sum, row) => sum + calculateTotalPayments(row),
      0
    );

    const closingBalance = totalReceipts - totalPayments;

    return (
      <tr className={`cb-total-row ${className}`}>
        <td className="cb-sticky cb-total-label" colSpan={3}>
          {label}
        </td>

        <td>{money(sumField(sourceRows, "beginningBalance"))}</td>
        <td>{money(sumField(sourceRows, "mcbuCollection"))}</td>
        <td>{money(sumField(sourceRows, "csfCollection"))}</td>

        <td>{money(sumField(sourceRows, "regularLoanCollection"))}</td>
        <td>{money(sumField(sourceRows, "otherLoanCollection"))}</td>

        <td>{money(sumField(sourceRows, "staffCbuCollection"))}</td>
        <td>{money(sumField(sourceRows, "cashbondCollection"))}</td>
        <td>{money(sumField(sourceRows, "salaryAdvanceCollection"))}</td>
        <td>{money(sumField(sourceRows, "membershipFee"))}</td>

        <td>{money(sumField(sourceRows, "lrfCollection"))}</td>
        <td>{money(sumField(sourceRows, "cbhbCollection"))}</td>
        <td>{money(sumField(sourceRows, "cbhbAdditional"))}</td>
        <td>{money(sumField(sourceRows, "cbhbOther"))}</td>

        <td>{money(sumField(sourceRows, "withholdingTax"))}</td>
        <td>{money(sumField(sourceRows, "mcbuUnclaimReturn"))}</td>
        <td>{money(sumField(sourceRows, "receiptFundTransfer"))}</td>
        <td>{money(sumField(sourceRows, "otherIncome"))}</td>
        <td>{money(sumField(sourceRows, "otherReceipts"))}</td>
        <td>{money(sumField(sourceRows, "bankWithdrawal"))}</td>

        <td className="cb-important">
          {money(totalReceipts)}
        </td>

        <td>{money(sumField(sourceRows, "managementExpenses"))}</td>

        <td>{sumField(sourceRows, "regularLoanReleasePersons")}</td>
        <td>{money(sumField(sourceRows, "regularLoanReleasePrincipal"))}</td>

        <td>{sumField(sourceRows, "otherLoanReleasePersons")}</td>
        <td>{money(sumField(sourceRows, "otherLoanReleasePrincipal"))}</td>

        <td>{money(sumField(sourceRows, "mcbuWithdrawal"))}</td>
        <td>{money(sumField(sourceRows, "csfWithdrawal"))}</td>

        <td>{sumField(sourceRows, "mcbuReturnPersons")}</td>
        <td>{money(sumField(sourceRows, "mcbuReturnAmount"))}</td>
        <td>{money(sumField(sourceRows, "csfReturnAmount"))}</td>

        <td>{money(sumField(sourceRows, "staffCbuWithdrawal"))}</td>
        <td>{money(sumField(sourceRows, "cashbondRefund"))}</td>
        <td>{money(sumField(sourceRows, "salaryAdvanceRelease"))}</td>

        <td>{money(sumField(sourceRows, "managementCostExpenses"))}</td>
        <td>{money(sumField(sourceRows, "cbhbDisbursement"))}</td>

        <td>{money(sumField(sourceRows, "unclaimReturnOut"))}</td>
        <td>{money(sumField(sourceRows, "rebatesLoan"))}</td>
        <td>{money(sumField(sourceRows, "otherPayment"))}</td>

        <td>{money(sumField(sourceRows, "paymentFundTransfer"))}</td>
        <td>{money(sumField(sourceRows, "bankDeposit"))}</td>

        <td className="cb-important">
          {money(totalPayments)}
        </td>

        <td className="cb-closing">
          {money(closingBalance)}
        </td>
      </tr>
    );
  };

  return (
    <div className="cashbook-page">
      <style>{`
        .cashbook-page {
          width: 100%;
          background: #fff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
        }

        .cashbook-header {
          padding: 16px 20px 12px;
          border-bottom: 1px solid #d1d5db;
          text-align: center;
        }

        .cashbook-company {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          color: #315f96;
        }

        .cashbook-title {
          margin: 2px 0 10px;
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          color: #1f2937;
        }

        .cashbook-period {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 40px;
          font-size: 13px;
          font-weight: 700;
        }

        .cashbook-period strong {
          font-size: 17px;
        }

        .cashbook-scroll {
          width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          max-height: calc(100vh - 310px);
          border: 1px solid #111827;
        }

        .cashbook-table {
          width: max-content;
          min-width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 10px;
          background: white;
        }

        .cashbook-table th,
        .cashbook-table td {
          min-width: 86px;
          height: 29px;
          padding: 4px 5px;
          border-right: 1px solid #111;
          border-bottom: 1px solid #111;
          text-align: right;
          white-space: nowrap;
        }

        .cashbook-table th {
          text-align: center;
          font-weight: 800;
          white-space: normal;
          line-height: 1.1;
        }

        .cashbook-table thead {
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .cb-main-group th {
          height: 32px;
          font-size: 12px;
          letter-spacing: .3px;
        }

        .cb-receipts-title {
          background: #d9f0ff;
        }

        .cb-payments-title {
          background: #d9f0ff;
        }

        .cb-date {
          min-width: 55px !important;
          width: 55px;
          text-align: center !important;
        }

        .cb-description {
          min-width: 180px !important;
          text-align: left !important;
          background: #fffca8;
        }

        .cb-beginning {
          background: #d8efff;
        }

        .cb-collection {
          background: #d7f8d7;
        }

        .cb-cbu {
          background: #d6efff;
        }

        .cb-special {
          background: #ebe6f1;
        }

        .cb-expense {
          background: #fffca8;
        }

        .cb-payment {
          background: #e8e2ed;
        }

        .cb-bank {
          background: #eef0ff;
        }

        .cb-total-receipts {
          background: #d7efff;
        }

        .cb-total-payments {
          background: #d7efff;
        }

        .cb-closing-column {
          background: #e5e7eb;
        }

        .cb-important {
          font-weight: 900;
          background: #d7efff;
        }

        .cb-closing {
          font-weight: 900;
          background: #f3f4f6;
        }

        .cb-sticky {
          position: sticky;
          left: 0;
          z-index: 10;
          background: white;
        }

        thead .cb-sticky {
          z-index: 30;
        }

        .cb-day-cell {
          text-align: center !important;
          font-weight: 700;
        }

        .cb-description-cell {
          text-align: left !important;
          background: #fffca8;
        }

        .cb-zero {
          color: #9ca3af;
        }

        .cb-total-row td {
          color: #ef4444;
          font-weight: 800;
          font-style: italic;
          border-top: 2px solid #111;
          border-bottom: 2px solid #111;
          background: #fff;
        }

        .cb-total-row .cb-important {
          background: #f9fafb;
        }

        .cb-total-label {
          text-align: left !important;
          color: #ef4444 !important;
          min-width: 235px !important;
        }

        .cb-monthly-total td {
          border-top: 3px double #111;
          border-bottom: 3px double #111;
          font-weight: 900;
        }

        .cb-scroll-note {
          padding: 8px 14px;
          font-size: 11px;
          color: #6b7280;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-top: 0;
        }

        @media print {
          .cashbook-scroll {
            overflow: visible;
            max-height: none;
            border: 0;
          }

          .cb-scroll-note {
            display: none;
          }

          .cashbook-table {
            transform-origin: top left;
            font-size: 6px;
          }

          .cashbook-table th,
          .cashbook-table td {
            min-width: 45px;
            padding: 2px;
          }
        }
      `}</style>

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="cashbook-header">
        <h2 className="cashbook-company">
          AmberCash PH Micro Lending Corp
        </h2>

        <div className="cashbook-title">
          CASHBOOK
        </div>

        <div className="cashbook-period">
          <div>
            Month: <strong>{month}</strong>
          </div>

          <div>
            Year: <strong>{year}</strong>
          </div>
        </div>
      </div>

      {/* ===================================================
          ONE CONTINUOUS CASHBOOK
      =================================================== */}

      <div className="cashbook-scroll">
        <table className="cashbook-table">
          <thead>

            {/* MAIN GROUPS */}

            <tr className="cb-main-group">
              <th
                className="cb-receipts-title"
                colSpan={22}
              >
                RECEIPTS / DEBIT
              </th>

              <th
                className="cb-payments-title"
                colSpan={22}
              >
                PAYMENTS / CREDIT
              </th>
            </tr>

            {/* COLUMN HEADERS */}

            <tr>
              <th className="cb-weekday">
                Day
              </th>

              <th className="cb-date">
                Date
              </th>

              <th className="cb-description">
                Description of Others Receipts
                <br />
                & Other Income
              </th>

              <th className="cb-beginning">
                Beginning
                <br />
                Balance
              </th>

              <th className="cb-collection">
                MCBU
                <br />
                Collection
              </th>

              <th className="cb-collection">
                CSF
                <br />
                Collection
              </th>

              <th className="cb-collection">
                Regular Loan Collection
                <br />
                (Daily / 60 Days)
              </th>

              <th className="cb-collection">
                Other Loan Collection
                <br />
                (Weekly)
              </th>

              <th className="cb-cbu">
                Staff CBU
                <br />
                Collection
              </th>

              <th className="cb-cbu">
                Cashbond
                <br />
                Collection
              </th>

              <th className="cb-cbu">
                Staff Principal
                <br />
                Loan Collection
              </th>

              <th className="cb-special">
                Membership
                <br />
                Fee
              </th>

              <th className="cb-special">
                LRF
                <br />
                Collection
              </th>

              <th className="cb-special">
                CBHB
                <br />
                Collection
              </th>

              <th className="cb-special">
                CBHB
                <br />
                Additional
              </th>

              <th className="cb-special">
                CBHB
                <br />
                Other
              </th>

              <th className="cb-special">
                Withholding
                <br />
                Tax
              </th>

              <th className="cb-cbu">
                MCBU Unclaim
                <br />
                Return
              </th>

              <th className="cb-special">
                Fund
                <br />
                Transfer
              </th>

              <th className="cb-special">
                Other
                <br />
                Income
              </th>

              <th className="cb-special">
                Other
                <br />
                Receipts
              </th>

              <th className="cb-bank">
                Bank
                <br />
                Withdrawal
              </th>

              <th className="cb-total-receipts">
                TOTAL
                <br />
                RECEIPTS
              </th>

              {/* ================= PAYMENTS ================= */}

              <th className="cb-expense">
                Management Expenses
                <br />
                & Other Payments
              </th>

              <th className="cb-collection">
                Regular Loan Release
                <br />
                Pers.
              </th>

              <th className="cb-collection">
                Regular Loan Release
                <br />
                Principal
              </th>

              <th className="cb-collection">
                Other Loan Release
                <br />
                Pers.
              </th>

              <th className="cb-collection">
                Other Loan Release
                <br />
                Principal
              </th>

              <th className="cb-collection">
                MCBU
                <br />
                Withdrawal
              </th>

              <th className="cb-collection">
                CSF
                <br />
                Withdrawal
              </th>

              <th className="cb-collection">
                MCBU Return
                <br />
                Pers.
              </th>

              <th className="cb-collection">
                MCBU Return /
                <br />
                Refund Amount
              </th>

              <th className="cb-collection">
                CSF Return /
                <br />
                Refund Amount
              </th>

              <th className="cb-cbu">
                Staff CBU
                <br />
                Withdrawal
              </th>

              <th className="cb-cbu">
                Cashbond
                <br />
                Refund
              </th>

              <th className="cb-cbu">
                Salary Advance
                <br />
                Release
              </th>

              <th className="cb-payment">
                Management Cost /
                <br />
                Expenses
              </th>

              <th className="cb-payment">
                CBHB Total
                <br />
                Disbursement
              </th>

              <th className="cb-cbu">
                Unclaim Return /
                <br />
                Refund OUT
              </th>

              <th className="cb-payment">
                Rebates /
                <br />
                Loan
              </th>

              <th className="cb-payment">
                Other
                <br />
                Payment
              </th>

              <th className="cb-payment">
                Fund
                <br />
                Transfer
              </th>

              <th className="cb-bank">
                Bank
                <br />
                Deposit
              </th>

              <th className="cb-total-payments">
                TOTAL
                <br />
                PAYMENTS
              </th>

              <th className="cb-closing-column">
                CLOSING
                <br />
                BALANCE
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const totalReceipts =
                calculateTotalReceipts(row);

              const totalPayments =
                calculateTotalPayments(row);

              const closingBalance =
                totalReceipts - totalPayments;

              const weekEnd = isWeekEnd(row, index);

              return (
                <React.Fragment key={row.day}>
                  <tr>
                    <td className="cb-weekday-cell">
                        {row.dayName.slice(0, 3)}
                      </td>

                      <td className="cb-date cb-day-cell">
                        {row.day}
                      </td>

                    <td className="cb-description-cell">
                      {row.description || ""}
                    </td>

                    <td className="cb-beginning">
                      {money(row.beginningBalance)}
                    </td>

                    <td className="cb-collection">
                      {money(row.mcbuCollection)}
                    </td>

                    <td className="cb-collection">
                      {money(row.csfCollection)}
                    </td>

                    <td className="cb-collection">
                      {money(row.regularLoanCollection)}
                    </td>

                    <td className="cb-collection">
                      {money(row.otherLoanCollection)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.staffCbuCollection)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.cashbondCollection)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.salaryAdvanceCollection)}
                    </td>

                    <td className="cb-special">
                      {money(row.membershipFee)}
                    </td>

                    <td className="cb-special">
                      {money(row.lrfCollection)}
                    </td>

                    <td className="cb-special">
                      {money(row.cbhbCollection)}
                    </td>

                    <td className="cb-special">
                      {money(row.cbhbAdditional)}
                    </td>

                    <td className="cb-special">
                      {money(row.cbhbOther)}
                    </td>

                    <td className="cb-special">
                      {money(row.withholdingTax)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.mcbuUnclaimReturn)}
                    </td>

                    <td className="cb-special">
                      {money(row.receiptFundTransfer)}
                    </td>

                    <td className="cb-special">
                      {money(row.otherIncome)}
                    </td>

                    <td className="cb-special">
                      {money(row.otherReceipts)}
                    </td>

                    <td className="cb-bank">
                      {money(row.bankWithdrawal)}
                    </td>

                    <td className="cb-important">
                      {money(totalReceipts)}
                    </td>

                    {/* PAYMENTS */}

                    <td className="cb-expense">
                      {money(row.managementExpenses)}
                    </td>

                    <td className="cb-collection">
                      {row.regularLoanReleasePersons}
                    </td>

                    <td className="cb-collection">
                      {money(row.regularLoanReleasePrincipal)}
                    </td>

                    <td className="cb-collection">
                      {row.otherLoanReleasePersons}
                    </td>

                    <td className="cb-collection">
                      {money(row.otherLoanReleasePrincipal)}
                    </td>

                    <td className="cb-collection">
                      {money(row.mcbuWithdrawal)}
                    </td>

                    <td className="cb-collection">
                      {money(row.csfWithdrawal)}
                    </td>

                    <td className="cb-collection">
                      {row.mcbuReturnPersons}
                    </td>

                    <td className="cb-collection">
                      {money(row.mcbuReturnAmount)}
                    </td>

                    <td className="cb-collection">
                      {money(row.csfReturnAmount)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.staffCbuWithdrawal)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.cashbondRefund)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.salaryAdvanceRelease)}
                    </td>

                    <td className="cb-payment">
                      {money(row.managementCostExpenses)}
                    </td>

                    <td className="cb-payment">
                      {money(row.cbhbDisbursement)}
                    </td>

                    <td className="cb-cbu">
                      {money(row.unclaimReturnOut)}
                    </td>

                    <td className="cb-payment">
                      {money(row.rebatesLoan)}
                    </td>

                    <td className="cb-payment">
                      {money(row.otherPayment)}
                    </td>

                    <td className="cb-payment">
                      {money(row.paymentFundTransfer)}
                    </td>

                    <td className="cb-bank">
                      {money(row.bankDeposit)}
                    </td>

                    <td className="cb-important">
                      {money(totalPayments)}
                    </td>

                    <td className="cb-closing">
                      {money(closingBalance)}
                    </td>
                  </tr>

                  {weekEnd &&
                    renderTotalRow(
                      rows.filter((item) => {
                        const currentDate = row.date;

                        const monday = new Date(currentDate);
                        monday.setDate(
                          currentDate.getDate() -
                            ((currentDate.getDay() + 6) % 7)
                        );

                        const friday = new Date(monday);
                        friday.setDate(monday.getDate() + 4);

                        return item.date >= monday && item.date <= friday;
                      }),
                      "Weekly Total"
                    )}
                </React.Fragment>
              );
            })}

            {renderTotalRow(
              rows,
              "Monthly Total",
              "cb-monthly-total"
            )}
          </tbody>
        </table>
      </div>

      <div className="cb-scroll-note">
        ← Scroll horizontally to view the complete Cashbook. Receipts and
        Payments are part of one continuous table.
      </div>
    </div>
  );
};

export default Cashbook;