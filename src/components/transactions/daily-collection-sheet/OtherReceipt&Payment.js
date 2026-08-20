import React, { useMemo, useState } from "react";

const OtherReceiptPayment = ({ selectedDate }) => {
  const [activeSheet, setActiveSheet] = useState("receipt");

  // =========================================================
  // DATE / MONTH / YEAR
  // =========================================================
  const currentDate = useMemo(() => {
    if (selectedDate) {
      const parsed = new Date(`${selectedDate}T00:00:00`);

      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }, [selectedDate]);

  const monthName = currentDate
    .toLocaleString("en-US", { month: "long" })
    .toUpperCase();

  const year = currentDate.getFullYear();

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  // =========================================================
  // OTHER RECEIPT COLUMNS
  // FIRST EXCEL SHEET
  // =========================================================
  const receiptGroups = [
    {
      title: "FURNITURE, FIXTURES & EQUIPMENTS",
      columns: [
        "Real Estate & Improvements",
        "Furniture & Fixtures",
        "Motor Vehicle",
      ],
    },
    {
      title: "LOANS / ADVANCES",
      columns: [
        "Motor Loan Principal",
        "Special Advance Collection",
        "Cash Advance Collection",
      ],
    },
    {
      title: "OTHER RECEIVABLE",
      columns: ["Other Receivable"],
    },
    {
      title: "STAFF ACCOUNTS PAYABLE",
      columns: ["Staff Accounts Payable"],
    },
    {
      title: "OFFICE RENTAL",
      columns: ["Office Rental Deposit"],
    },
    {
      title: "ACCOUNTS PAYABLE",
      columns: [
        "Staff Benevolent Fund",
        "Reserve Fund",
        "Accounts",
        "Accounts",
      ],
    },
    {
      title: "ACCRUED EXPENSE",
      columns: [
        "Regular / Private",
        "Other Collection",
        "Regular / Private",
      ],
    },
    {
      title: "OTHER FUNDS",
      columns: [
        "Recoverable from Accounts",
        "Borrowed Fund Accounts",
        "Bank / Pag-IBIG Loan Financing",
        "Placement Fund",
      ],
    },
  ];

  // =========================================================
  // OTHER PAYMENT COLUMNS
  // SECOND EXCEL SHEET
  // =========================================================
  const paymentGroups = [
    {
      title: "FURNITURE, FIXTURES & EQUIPMENTS",
      columns: [
        "Real Estate & Improvements",
        "Furniture & Fixtures",
        "Motor Vehicle",
      ],
    },
    {
      title: "LOANS / ADVANCES",
      columns: [
        "Motor Loan Principal",
        "Special Advance Collection",
        "Cash Advance Collection",
      ],
    },
    {
      title: "OTHER RECEIVABLE",
      columns: ["Other Receivable"],
    },
    {
      title: "STAFF ACCOUNTS PAYABLE",
      columns: ["Staff Accounts Payable"],
    },
    {
      title: "OFFICE RENTAL",
      columns: ["Office Rental Deposit"],
    },
    {
      title: "CLIENT'S LIABILITIES",
      columns: [
        "Staff Savings / Deposit",
        "Accounts Receivable",
        "Receivable Accounts",
      ],
    },
    {
      title: "ACCOUNTS PAYABLE",
      columns: [
        "Staff Benevolent Fund",
        "Reserve Fund",
        "Accounts",
        "Accounts",
      ],
    },
    {
      title: "ACCRUED EXPENSE",
      columns: [
        "Regular / Private",
        "Other Collection",
        "Regular / Private",
      ],
    },
    {
      title: "TAXES PAYABLE",
      columns: [
        "Tax Payable to BIR",
        "BIR Penalties",
        "Advance Payment",
      ],
    },
    {
      title: "OTHER FUNDS",
      columns: [
        "Borrowed Fund Accounts",
        "Bank / Pag-IBIG Loan Financing",
        "Placement Fund",
      ],
    },
    {
      title: "REBATES",
      columns: [
        "Group Leader",
        "Secretary",
        "Others (Staff)",
      ],
    },
    {
      title: "INTEREST ON",
      columns: [
        "Interest on Client",
        "CBU & Cashbond",
      ],
    },
    {
      title: "BORROWED FUND",
      columns: ["Borrowed Fund"],
    },
    {
      title: "INVESTMENT",
      columns: ["Capital"],
    },
    {
      title: "OTHER EXPENSES",
      columns: [
        "Provision Management Expense",
        "Loan Loss Provision",
        "Depreciation Expense",
        "Grants / Donation",
      ],
    },
  ];

  // =========================================================
  // SELECT ACTIVE COLUMN SET
  // =========================================================
  const groups =
    activeSheet === "receipt" ? receiptGroups : paymentGroups;

  const allColumns = groups.flatMap((group) =>
    group.columns.map((column) => ({
      group: group.title,
      name: column,
    }))
  );

  // =========================================================
  // EMPTY UI DATA
  // API / HASURA WILL BE ADDED LATER
  // =========================================================
  const rows = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;

      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );

      return {
        day,
        weekday: date.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        values: {},
      };
    });
  }, [currentDate, daysInMonth]);

  // =========================================================
  // HELPERS
  // =========================================================
  const formatAmount = (value) => {
    const number = Number(value || 0);

    if (!number) {
      return "";
    }

    return number.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const getCellValue = (row, columnIndex) => {
    return row.values?.[columnIndex] || 0;
  };

  // =========================================================
  // WEEKLY TOTAL
  // =========================================================
  const shouldShowWeeklyTotal = (row, index) => {
    const isFriday = row.weekday === "Fri";
    const isLastDay = index === rows.length - 1;

    return isFriday || isLastDay;
  };

  const getWeekStartIndex = (endIndex) => {
    let startIndex = endIndex;

    while (
      startIndex > 0 &&
      rows[startIndex - 1].weekday !== "Fri"
    ) {
      startIndex -= 1;
    }

    return startIndex;
  };

  const getWeeklyTotal = (endIndex, columnIndex) => {
    const startIndex = getWeekStartIndex(endIndex);

    let total = 0;

    for (let i = startIndex; i <= endIndex; i += 1) {
      total += Number(
        getCellValue(rows[i], columnIndex) || 0
      );
    }

    return total;
  };

  // =========================================================
  // MONTHLY TOTAL
  // =========================================================
  const getMonthlyTotal = (columnIndex) => {
    return rows.reduce(
      (sum, row) =>
        sum +
        Number(getCellValue(row, columnIndex) || 0),
      0
    );
  };

  const getRowTotal = (row) => {
    return allColumns.reduce(
      (sum, _column, columnIndex) =>
        sum +
        Number(getCellValue(row, columnIndex) || 0),
      0
    );
  };

  const getWeeklyGrandTotal = (endIndex) => {
    return allColumns.reduce(
      (sum, _column, columnIndex) =>
        sum + getWeeklyTotal(endIndex, columnIndex),
      0
    );
  };

  const getMonthlyGrandTotal = () => {
    return allColumns.reduce(
      (sum, _column, columnIndex) =>
        sum + getMonthlyTotal(columnIndex),
      0
    );
  };

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <div className="orp-wrapper">

      {/* =====================================================
          SHEET SELECTOR
      ====================================================== */}
      <div className="orp-sheet-selector">
        <button
          type="button"
          className={`orp-sheet-btn ${
            activeSheet === "receipt" ? "active" : ""
          }`}
          onClick={() => setActiveSheet("receipt")}
        >
          Other Receipt
        </button>

        <button
          type="button"
          className={`orp-sheet-btn ${
            activeSheet === "payment" ? "active" : ""
          }`}
          onClick={() => setActiveSheet("payment")}
        >
          Other Payment
        </button>
      </div>

      <div className="orp-page">

        {/* =====================================================
            COMPANY HEADER
        ====================================================== */}
        <div className="orp-heading">

          <div className="orp-company-line">

            <div className="orp-logo-placeholder">
              AC
            </div>

            <div>
              <div className="orp-company-name">
                AmberCash PH Micro Lending Corp
              </div>

              <h2 className="orp-title">
                {activeSheet === "receipt"
                  ? "DETAILS OF OTHER RECEIPTS"
                  : "DETAILS OF OTHER PAYMENTS"}
              </h2>
            </div>

          </div>

          {/* MONTH / YEAR */}
          <div className="orp-period">

            <div className="orp-period-box">
              <span>Month:</span>

              <strong>{monthName}</strong>
            </div>

            <div className="orp-period-box">
              <span>Year:</span>

              <strong>{year}</strong>
            </div>

          </div>

        </div>

        {/* =====================================================
            TABLE
        ====================================================== */}
        <div className="orp-table-scroll">

          <table className="orp-table">

            <thead>

              {/* GROUP HEADER */}
              <tr className="orp-group-row">

                <th
                  rowSpan="2"
                  className="orp-date-header sticky-left"
                >
                  Date
                </th>

                {groups.map((group, index) => (
                  <th
                    key={`${group.title}-${index}`}
                    colSpan={group.columns.length}
                    className="orp-group-header"
                  >
                    {group.title}
                  </th>
                ))}

                <th
                  rowSpan="2"
                  className="orp-total-header"
                >
                  Total
                </th>

              </tr>

              {/* COLUMN HEADER */}
              <tr className="orp-column-row">

                {groups.flatMap((group, groupIndex) =>
                  group.columns.map(
                    (column, columnIndex) => (
                      <th
                        key={`${groupIndex}-${columnIndex}`}
                        className="orp-column-header"
                      >
                        {column}
                      </th>
                    )
                  )
                )}

              </tr>

            </thead>

            <tbody>

              {rows.map((row, rowIndex) => (
                <React.Fragment key={row.day}>

                  {/* DAY */}
                  <tr className="orp-day-row">

                    <td className="orp-date-cell sticky-left">

                      <span className="orp-weekday">
                        {row.weekday}
                      </span>

                      <strong>{row.day}</strong>

                    </td>

                    {allColumns.map(
                      (_column, columnIndex) => {
                        const value = getCellValue(
                          row,
                          columnIndex
                        );

                        return (
                          <td
                            key={columnIndex}
                            className="orp-amount-cell"
                          >
                            {formatAmount(value)}
                          </td>
                        );
                      }
                    )}

                    <td className="orp-row-total">
                      {formatAmount(
                        getRowTotal(row)
                      ) || "0"}
                    </td>

                  </tr>

                  {/* WEEKLY TOTAL */}
                  {shouldShowWeeklyTotal(
                    row,
                    rowIndex
                  ) && (
                    <tr className="orp-weekly-total-row">

                      <td className="orp-weekly-label sticky-left">
                        Weekly total:
                      </td>

                      {allColumns.map(
                        (_column, columnIndex) => (
                          <td
                            key={columnIndex}
                            className="orp-weekly-value"
                          >
                            {formatAmount(
                              getWeeklyTotal(
                                rowIndex,
                                columnIndex
                              )
                            ) || "0"}
                          </td>
                        )
                      )}

                      <td className="orp-weekly-grand">
                        {formatAmount(
                          getWeeklyGrandTotal(
                            rowIndex
                          )
                        ) || "0"}
                      </td>

                    </tr>
                  )}

                </React.Fragment>
              ))}

              {/* MONTHLY TOTAL */}
              <tr className="orp-monthly-total-row">

                <td className="orp-monthly-label sticky-left">
                  Monthly total:
                </td>

                {allColumns.map(
                  (_column, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="orp-monthly-value"
                    >
                      {formatAmount(
                        getMonthlyTotal(columnIndex)
                      ) || "0"}
                    </td>
                  )
                )}

                <td className="orp-monthly-grand">
                  {formatAmount(
                    getMonthlyGrandTotal()
                  ) || "0"}
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

      <style jsx>{`

        /* =========================================
           WRAPPER
        ========================================= */

        .orp-wrapper {
          width: 100%;
          background: #f8fafc;
          padding: 14px;
          box-sizing: border-box;
        }

        /* =========================================
           RECEIPT / PAYMENT BUTTONS
        ========================================= */

        .orp-sheet-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .orp-sheet-btn {
          appearance: none;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          border-radius: 7px;
          padding: 8px 18px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .orp-sheet-btn:hover {
          border-color: #0f9f94;
          color: #087f77;
        }

        .orp-sheet-btn.active {
          background: #0f9f94;
          border-color: #0f9f94;
          color: #ffffff;
        }

        /* =========================================
           PAGE
        ========================================= */

        .orp-page {
          width: 100%;
          background: #ffffff;
          color: #111827;
          border: 1px solid #1f2937;
          box-sizing: border-box;
        }

        /* =========================================
           COMPANY HEADER
        ========================================= */

        .orp-heading {
          background: #ffffff;
        }

        .orp-company-line {
          min-height: 66px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 5px 16px 2px;
        }

        .orp-logo-placeholder {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 2px solid #2563eb;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #1e40af;
          font-size: 14px;
          font-weight: 900;

          flex-shrink: 0;
        }

        .orp-company-name {
          text-align: center;
          color: #245f9e;
          font-size: 22px;
          line-height: 1.05;
          font-weight: 700;
        }

        .orp-title {
          margin: 3px 0 0;
          text-align: center;
          color: #ef0000;
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.4px;
        }

        /* =========================================
           MONTH / YEAR
        ========================================= */

        .orp-period {
          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 3px 10px;

          border-top: 1px solid #111827;
          border-bottom: 1px solid #111827;

          font-size: 11px;
          font-weight: 700;
        }

        .orp-period-box {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .orp-period strong {
          min-width: 115px;
          padding: 3px 14px;

          background: #ffd9b5;
          border: 1px solid #e5e7eb;

          text-align: center;

          font-size: 12px;
          font-weight: 900;
        }

        /* =========================================
           TABLE SCROLL
        ========================================= */

        .orp-table-scroll {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;
          background: #ffffff;
        }

        /* =========================================
           TABLE
        ========================================= */

        .orp-table {
          border-collapse: collapse;
          table-layout: fixed;

          width: max-content;
          min-width: 100%;

          background: #ffffff;

          font-size: 9px;
        }

        .orp-table th,
        .orp-table td {
          border: 1px solid #111827;
          box-sizing: border-box;
          padding: 2px 3px;
          height: 25px;
        }

        /* =========================================
           GROUP HEADERS
        ========================================= */

        .orp-group-header {
          background: #f7f7f7;

          min-width: 200px;

          text-align: center;
          vertical-align: middle;

          font-size: 9px;
          line-height: 1.05;
          font-weight: 900;

          white-space: normal;

          border-bottom: 2px solid #111827 !important;
        }

        /* separation between accounting groups */

        .orp-group-header:not(:first-child) {
          border-left-width: 3px;
        }

        /* =========================================
           DATE
        ========================================= */

        .orp-date-header {
          width: 70px;
          min-width: 70px;

          background: #ffffff;

          text-align: center;

          font-size: 10px;
          font-weight: 900;

          z-index: 6;
        }

        /* =========================================
           TOTAL
        ========================================= */

        .orp-total-header {
          width: 100px;
          min-width: 100px;

          background: #ffffff;

          text-align: center;

          font-size: 17px;
          font-weight: 900;
        }

        /* =========================================
           SUB HEADERS
        ========================================= */

        .orp-column-header {
          width: 82px;
          min-width: 82px;
          max-width: 82px;

          background: #f7f7f7;

          text-align: center;
          vertical-align: middle;

          font-size: 7px;
          line-height: 1.05;
          font-weight: 800;

          white-space: normal;
          overflow-wrap: anywhere;

          height: 48px !important;
        }

        /* =========================================
           DAY ROW
        ========================================= */

        .orp-day-row td {
          background: #c9eafa;
        }

        .orp-date-cell {
          width: 70px;
          min-width: 70px;

          background: #ffffff !important;

          white-space: nowrap;

          text-align: left;
        }

        .orp-weekday {
          display: inline-block;

          width: 35px;

          color: #374151;

          font-size: 8px;
          font-style: italic;
        }

        .orp-date-cell strong {
          font-size: 9px;
        }

        /* =========================================
           AMOUNT CELLS
        ========================================= */

        .orp-amount-cell {
          width: 82px;
          min-width: 82px;

          background: #c9eafa;

          text-align: right;

          font-size: 8px;
          font-weight: 600;
        }

        /* =========================================
           ROW TOTAL
        ========================================= */

        .orp-row-total {
          width: 100px;
          min-width: 100px;

          background: #ffffff !important;

          text-align: right;

          color: #ef0000;

          font-size: 9px;
          font-weight: 900;
          font-style: italic;
        }

        /* =========================================
           WEEKLY TOTAL
        ========================================= */

        .orp-weekly-total-row td {
          height: 21px;

          background: #ffffff !important;

          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .orp-weekly-label {
          background: #ffffff !important;

          color: #ef0000;

          font-size: 8px;
          font-weight: 900;
          font-style: italic;

          white-space: nowrap;
        }

        .orp-weekly-value,
        .orp-weekly-grand {
          background: #ffffff !important;

          color: #ef0000;

          text-align: right;

          font-size: 8px;
          font-weight: 900;
          font-style: italic;
        }

        /* =========================================
           MONTHLY TOTAL
        ========================================= */

        .orp-monthly-total-row td {
          height: 22px;

          background: #ffffff !important;

          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .orp-monthly-label {
          background: #ffffff !important;

          color: #ef0000;

          font-size: 8px;
          font-weight: 900;
          font-style: italic;

          white-space: nowrap;
        }

        .orp-monthly-value,
        .orp-monthly-grand {
          background: #ffffff !important;

          color: #ef0000;

          text-align: right;

          font-size: 8px;
          font-weight: 900;
          font-style: italic;
        }

        /* =========================================
           STICKY DATE COLUMN
        ========================================= */

        .sticky-left {
          position: sticky;
          left: 0;
          z-index: 4;
        }

        thead .sticky-left {
          z-index: 10;
        }

        /* =========================================
           SCROLLBAR
        ========================================= */

        .orp-table-scroll::-webkit-scrollbar {
          height: 12px;
        }

        .orp-table-scroll::-webkit-scrollbar-track {
          background: #e5e7eb;
        }

        .orp-table-scroll::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 10px;
          border: 2px solid #e5e7eb;
        }

        .orp-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        /* =========================================
           MOBILE
        ========================================= */

        @media (max-width: 900px) {
          .orp-wrapper {
            padding: 8px;
          }

          .orp-company-name {
            font-size: 17px;
          }

          .orp-title {
            font-size: 17px;
          }

          .orp-period {
            gap: 10px;
          }

          .orp-period strong {
            min-width: 85px;
          }
        }

      `}</style>

    </div>
  );
};

export default OtherReceiptPayment;