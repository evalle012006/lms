import React, { useEffect, useMemo, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

const OtherReceiptPayment = ({ branchId, selectedDate }) => {
  const [activeSheet, setActiveSheet] = useState("receipt");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!branchId) {
      setTransactions([]);
      return;
    }

    let active = true;

    const loadTransactions = async () => {
      try {
        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/dcs?branch_id=${encodeURIComponent(
            branchId
          )}`
        );

        if (!active) return;

        if (response?.error) {
          throw new Error(
            response?.message ||
              "Failed to load Other Receipts/Payments transactions."
          );
        }

        const rows =
          response?.transactions ||
          response?.data ||
          response?.response ||
          [];

        setTransactions(
          Array.isArray(rows) ? rows : []
        );

        } catch (error) {
        console.error(
          "Load Other Receipts/Payments error:",
          error
        );

        if (active) {
          setTransactions([]);
        }
      }
    };

    loadTransactions();

    return () => {
      active = false;
    };
  }, [branchId]);

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
      disabled: true,
      columns: [
        "Real Estate & Improvements",
        "Furniture & Fixtures",
        "Motor Vehicle",
      ],
    },
    {
      title: "LOANS / ADVANCES",
      columns: [
        {
          name: "Motor Loan Principal Collection",
          transactionCode: "013",
          aliases: [
            "Motorcycle Advance",
            "Motor Loan Principal Collection",
          ],
        },
        {
          name: "Special Advance Collection",
          transactionCode: "014",
          aliases: [
            "Special Advance",
            "Special Advance Collection",
          ],
        },
        {
          name: "Cash Advance Collection",
          transactionCode: "015",
          aliases: [
            "Cash Advance to Staff",
            "Cash Advance Collection",
          ],
        },
      ],
    },
    {
      title: "OTHER RECEIVABLE",
      columns: [
        {
          name: "Other Receivable",
          transactionCode: "016",
          aliases: [
            "Other Receivable",
            "Others/Account Receivables",
          ],
        },
      ],
    },
    {
      title: "STAFF ACCOUNTS PAYABLE",
      disabled: true,
      columns: ["Staff Accounts Payable"],
    },
    {
      title: "OFFICE RENTAL",
      columns: [
        {
          name: "Office Rental Deposit",
          transactionCode: "017",
          aliases: [
            "Office Rental Deposit",
          ],
        },
      ],
    },
    {
      title: "ACCOUNTS PAYABLE",
      columns: [
        {
          name: "Staff Benevolent Fund",
          transactionCode: "030",
          aliases: [
            "Staff Benevolent Fund (SBF)",
            "Staff Benevolent Fund",
          ],
        },
        { name: "Reserve Fund", disabled: true },
        {
          name: "Accounts Payable - Payroll A/c",
          aliases: [
            "Accounts Payable (Payroll A/C)",
            "Accounts Payable - Payroll A/c",
          ],
        },
        {
          name: "Accounts Payable - Others",
          aliases: [
            "Accounts Payable (Others)",
            "Accounts Payable - Others",
          ],
        },
      ],
    },
    {
      title: "ACCRUED EXPENSE",
      columns: [
        { name: "Reimbursable Privileges", disabled: true },
        {
          name: "Picture Collection",
          transactionCode: "033",
          aliases: [
            "Accrued Expenses (Picture Collection)",
            "Picture Collection",
          ],
        },
        { name: "Reimbursable Privileges", disabled: true },
      ],
    },
    {
      title: "OTHER FUNDS",
      columns: [
        {
          name: "Recoverable from Badept Accounts",
          transactionCode: "048",
          aliases: [
            "Recovered from Bad debt Accounts Collection",
            "Recoverable from Badept Accounts",
            "Recoverable from Bad Debt Accounts",
            "Recovered from Bad Debt Accounts Collection",
          ],
        },
        {
          name: "Borrowed Fund Accounts",
          transactionCode: "052",
          aliases: [
            "Interest on Borrowed Funds / Investment Capital",
            "Borrowed Fund Accounts",
          ],
        },
        { name: "Bank Loans Payable / Car Loan Financing", disabled: true },
        { name: "Placement Fund", disabled: true },
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
        { name: "Real Estate & Improvements", disabled: true },
        {
          name: "Furniture & Fixtures",
          transactionCode: "010",
          aliases: [
            "Furniture and Fixtures",
            "Furniture & Fixtures",
          ],
        },
        { name: "Motor Vehicle", disabled: true },
      ],
    },
    {
      title: "LOANS / ADVANCES",
      columns: [
        {
          name: "Motor Loan Principal",
          transactionCode: "013",
          aliases: [
            "Motorcycle Advance",
            "Motor Loan Principal",
          ],
        },
        {
          name: "Special Advance Collection",
          transactionCode: "014",
          aliases: [
            "Special Advance",
            "Special Advance Collection",
          ],
        },
        {
          name: "Cash Advance Collection",
          transactionCode: "015",
          aliases: [
            "Cash Advance to Staff",
            "Cash Advance Collection",
          ],
        },
      ],
    },
    {
      title: "OTHER RECEIVABLE",
      columns: [
        {
          name: "Other Receivable",
          transactionCode: "016",
          aliases: [
            "Others/Account Receivables",
            "Other Receivable",
            "Other Receivables",
          ],
        },
      ],
    },
    {
      title: "STAFF ACCOUNTS PAYABLE",
      disabled: true,
      columns: ["Staff Accounts Payable"],
    },
    {
      title: "OFFICE RENTAL",
      columns: [
        {
          name: "Office Rental Deposit",
          transactionCode: "017",
          aliases: [
            "Office Rental Deposit",
          ],
        },
      ],
    },
    {
      title: "CLIENT'S LIABILITIES",
      columns: [
        "Forgiven Ser.Char & Loan Bal of Demised Client",
        "Accounts Receivables",
        "Deactivated Accounts",
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
        {
          name: "Reimbursable Privileges",
        },
        {
          name: "Picture Collection",
          disabled: true,
        },
        {
          name: "Reimbursable Privileges",
        },
      ],
    },
    {
      title: "TAXES PAYABLE",
      columns: [
        {
          name: "Tax Payable to BIR",
          disabled: true,
        },
        "BIR Penalties",
        {
          name: "Advance Payment",
          disabled: true,
        },
      ],
    },
    {
      title: "OTHER FUNDS",
      columns: [
        "Borrowed Fund Accounts",
        {name: "Bank Loans Payable / Car Loan Financing", disabled: true},
        {name: "Placement Fund", disabled: true}
      ],
    },
    {
      title: "REBATES",
      columns: [
        "Group Leader",
        "Secretary",
        "Others (Staff Loan, etc..)",
      ],
    },
    {
      title: "INTEREST ON",
      columns: [
        "Interest on Client",
        "CBU & Cashbond",
        {
          name: "Borrowed Fund",
          disabled: true,
        },
        {
          name: "Investment Capital",
          disabled: true,
        },
      ],
    },
    {
      title: "OTHER EXPENSES",
      columns: [
        {name: "Provision Unspent Expenses", disabled: true},
        "Loan Loss Provision",
        {name: "Depreciation Expense", disabled: true},
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

      name:
        typeof column === "string"
          ? column
          : column.name,

      transactionCode:
        typeof column === "object"
          ? column.transactionCode || null
          : null,

      aliases:
        typeof column === "object"
          ? column.aliases || []
          : [],

      disabled:
        group.disabled === true ||
        (typeof column === "object" &&
          column.disabled === true),
    }))
  );

  // =========================================================
  // TRANSACTION MATCHING
  // =========================================================

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const doesItemMatchColumn = (item, column) => {
    if (column.disabled) {
      return false;
    }

    const itemCode = String(item?.code || "").trim();

    const accountTitle = normalize(
      item?.account_title || item?.accountTitle || ""
    );

    // First priority: transaction code
    if (
      column.transactionCode &&
      itemCode === String(column.transactionCode).trim()
    ) {
      return true;
    }

    // Second priority: exact column name
    if (normalize(column.name) === accountTitle) {
      return true;
    }

    // Third priority: known account-title aliases
    return (column.aliases || []).some(
      (alias) => normalize(alias) === accountTitle
    );
  };

  const rows = useMemo(() => {
    const wantedCategory =
      activeSheet === "receipt"
        ? "other receipts"
        : "other payments";

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;

      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );

      const dateKey = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");

      const values = {};

      transactions.forEach((transaction) => {
        const transactionDate = String(
          transaction?.transaction_date || ""
        ).slice(0, 10);

        // Only process transactions for this exact day.
        if (transactionDate !== dateKey) {
          return;
        }

        const items =
          transaction?.dcs_transaction_items || [];

        items.forEach((item) => {
          const itemCategory = normalize(item?.category);

          const itemCode = String(
            item?.code || ""
          ).trim();

          /*
          * Normal rule:
          *   Other Receipt tab  -> category = Other Receipts
          *   Other Payment tab  -> category = Other Payments
          *
          * Code 048 is explicitly an Other Receipt transaction.
          */
          const isCode048 =
            activeSheet === "receipt" &&
            itemCode === "048";

          if (
            itemCategory !== wantedCategory &&
            !isCode048
          ) {
            return;
          }

          const amount = Number(item?.amount || 0);

          if (
            !Number.isFinite(amount) ||
            amount <= 0
          ) {
            return;
          }

          /*
          * Find the report column using:
          * 1. transaction code
          * 2. exact account title
          * 3. account-title alias
          */
          const columnIndex = allColumns.findIndex(
            (column) =>
              doesItemMatchColumn(item, column)
          );

          if (columnIndex === -1) {
            return;
          }

          values[columnIndex] =
            Number(values[columnIndex] || 0) +
            amount;
        });
      });

      return {
        day,
        weekday: date.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        values,
      };
    });
  }, [
    transactions,
    activeSheet,
    currentDate,
    daysInMonth,
    allColumns,
  ]);

  const weekdayRows = useMemo(() => {
    return rows.filter((row) => {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        row.day
      );

      const dayOfWeek = date.getDay();

      // Keep Monday to Friday only.
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });
  }, [rows, currentDate]);

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
    const isLastWeekday =
      index === weekdayRows.length - 1;

    return isFriday || isLastWeekday;
  };

  const getWeekStartIndex = (endIndex) => {
    let startIndex = endIndex;

    while (
      startIndex > 0 &&
      weekdayRows[startIndex - 1].weekday !== "Fri"
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
        getCellValue(
          weekdayRows[i],
          columnIndex
        ) || 0
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
    <div className="w-full">

      {/* PAGE TITLE / MONTHLY TOTAL */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {activeSheet === "receipt"
              ? "Details of Other Receipts"
              : "Details of Other Payments"}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {activeSheet === "receipt"
              ? "Other receipts recorded from Daily Collection Sheet transactions."
              : "Other payments recorded from Daily Collection Sheet transactions."}
          </p>

          {/* RECEIPT / PAYMENT SELECTOR */}
          <div className="mt-3 flex items-center gap-2">
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
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-700">
            {monthName.charAt(0) +
              monthName.slice(1).toLowerCase()}{" "}
            {year}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            Monthly Total
          </div>

          <div className="text-lg font-bold text-red-600">
            ₱{" "}
            {Number(
              getMonthlyGrandTotal() || 0
            ).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="orp-page">

        {/* REPORT HEADER */}
        <div className="orp-report-header">
          <div className="orp-company-name">
            AmberCash PH Micro Lending Corp
          </div>

          <div className="orp-title">
            {activeSheet === "receipt"
              ? "DETAILS OF OTHER RECEIPTS"
              : "DETAILS OF OTHER PAYMENTS"}
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
                  group.columns.map((column, columnIndex) => (
                    <th
                      key={`${groupIndex}-${columnIndex}`}
                      className="orp-column-header"
                    >
                      {typeof column === "string" ? column : column.name}
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {weekdayRows.map((row, rowIndex) => (
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
                      (column, columnIndex) => {
                        const value = getCellValue(
                          row,
                          columnIndex
                        );

                        return (
                          <td
                            key={columnIndex}
                            className={`orp-amount-cell ${
                              column.disabled ? "orp-disabled-cell" : ""
                            }`}
                          >
                            {!column.disabled && formatAmount(value)}
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
          padding: 9px 20px;

          font-size: 13px;
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
          border: 1px solid #cbd5e1;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* =========================================
          COMPANY HEADER
        ========================================= */

        .orp-report-header {
          background: #ffffff;
          text-align: right;
          padding: 8px 10px 7px;
          border-bottom: 1px solid #cbd5e1;
          overflow: hidden;
        }

        .orp-report-header .orp-company-name {
          color: #0ea5e9;
          font-size: 13px;
          line-height: 1.2;
          font-weight: 500;
          text-align: right;
          white-space: nowrap;
        }

        .orp-report-header .orp-title {
          margin-top: 2px;
          color: #dc2626;
          font-size: 17px;
          line-height: 1.15;
          font-weight: 800;
          text-align: right;
          white-space: nowrap;
        }

        .orp-company-line {
          min-height: 72px;

          display: flex;
          align-items: center;
          justify-content: center;

          gap: 12px;

          padding: 7px 16px 4px;
        }

        .orp-logo-placeholder {
          width: 44px;
          height: 44px;

          border-radius: 50%;
          border: 2px solid #2563eb;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #1e40af;

          font-size: 15px;
          font-weight: 900;

          flex-shrink: 0;
        }

        .orp-company-name {
          text-align: center;

          color: #245f9e;

          font-size: 23px;
          line-height: 1.1;
          font-weight: 700;
        }

        .orp-title {
          margin: 3px 0 0;

          text-align: center;

          color: #ef0000;

          font-size: 23px;
          line-height: 1.05;
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

          padding: 4px 10px;

          border-top: 1px solid #111827;
          border-bottom: 1px solid #111827;

          font-size: 12px;
          font-weight: 700;
        }

        .orp-period-box {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .orp-period strong {
          min-width: 115px;

          padding: 4px 14px;

          background: #ffd9b5;
          border: 1px solid #e5e7eb;

          text-align: center;

          font-size: 13px;
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
          font-size: 10px;
        }

        .orp-table th,
        .orp-table td {
          border: 1px solid #94a3b8;
          box-sizing: border-box;
          padding: 2px 4px;
          height: 24px;
        }

        /* =========================================
          GROUP HEADERS
        ========================================= */

        .orp-group-header {
          background: #f7f7f7;
          min-width: 200px;
          text-align: center;
          vertical-align: middle;
          font-size: 11px;
          line-height: 1.15;
          font-weight: 900;
          white-space: normal;
          padding: 5px 4px !important;
          border-bottom: 2px solid #111827 !important;
        }

        /* separation between accounting groups */

        .orp-group-header:not(:first-child) {
          border-left-width: 3px;
        }

        /* =========================================
          DATE HEADER
        ========================================= */

        .orp-date-header {
          width: 76px;
          min-width: 76px;
          background: #ffffff;
          text-align: center;
          vertical-align: middle;
          font-size: 11px;
          font-weight: 900;
          z-index: 6;
        }

        /* =========================================
          TOTAL HEADER
        ========================================= */

        .orp-total-header {
          width: 105px;
          min-width: 105px;
          background: #ffffff;
          text-align: center;
          vertical-align: middle;
          font-size: 14px;
          font-weight: 900;
        }

        /* =========================================
          COLUMN / SUB HEADERS
        ========================================= */

        .orp-column-header {
          width: 82px;
          min-width: 82px;
          max-width: 82px;
          background: #f8fafc;
          text-align: center;
          vertical-align: middle;
          font-size: 9px;
          line-height: 1.1;
          font-weight: 700;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: normal;
          padding: 4px 3px !important;
          height: 52px !important;
        }

        /* =========================================
          DAY ROW
        ========================================= */

        .orp-day-row td {
          background: #c9eafa;
        }

        .orp-date-cell {
          width: 76px;
          min-width: 76px;
          background: #ffffff !important;
          white-space: nowrap;
          text-align: left;
          vertical-align: middle;
          padding-left: 5px !important;
        }

        .orp-weekday {
          display: inline-block;
          width: 39px;
          color: #374151;
          font-size: 10px;
          font-style: italic;
          font-weight: 500;
        }

        .orp-date-cell strong {
          font-size: 11px;
          font-weight: 800;
        }

        /* =========================================
          AMOUNT CELLS
        ========================================= */

        .orp-amount-cell {
          width: 82px;
          min-width: 82px;
          background: #c9eafa;
          text-align: right;
          vertical-align: middle;
          font-size: 10px;
          font-weight: 600;
          padding-right: 5px !important;
        }

        .orp-disabled-cell {
          background-color: #e5e7eb !important;
          background-image:
            linear-gradient(
              to top right,
              transparent calc(50% - 0.5px),
              #111827 50%,
              transparent calc(50% + 0.5px)
            ),
            linear-gradient(
              to bottom right,
              transparent calc(50% - 0.5px),
              #111827 50%,
              transparent calc(50% + 0.5px)
            ) !important;
        }

        /* =========================================
          ROW TOTAL
        ========================================= */

        .orp-row-total {
          width: 105px;
          min-width: 105px;

          background: #ffffff !important;

          text-align: right;
          vertical-align: middle;

          color: #ef0000;

          font-size: 10px;
          font-weight: 900;
          font-style: italic;

          padding-right: 5px !important;
        }

        /* =========================================
          WEEKLY TOTAL
        ========================================= */

        .orp-weekly-total-row td {
          height: 25px;

          background: #ffffff !important;

          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .orp-weekly-label {
          background: #ffffff !important;

          color: #ef0000;

          font-size: 10px;
          font-weight: 900;
          font-style: italic;

          white-space: nowrap;
        }

        .orp-weekly-value,
        .orp-weekly-grand {
          background: #ffffff !important;

          color: #ef0000;

          text-align: right;
          vertical-align: middle;

          font-size: 10px;
          font-weight: 900;
          font-style: italic;

          padding-right: 5px !important;
        }

        /* =========================================
          MONTHLY TOTAL
        ========================================= */

        .orp-monthly-total-row td {
          height: 26px;

          background: #ffffff !important;

          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .orp-monthly-label {
          background: #ffffff !important;

          color: #ef0000;

          font-size: 10px;
          font-weight: 900;
          font-style: italic;

          white-space: nowrap;
        }

        .orp-monthly-value,
        .orp-monthly-grand {
          background: #ffffff !important;

          color: #ef0000;

          text-align: right;
          vertical-align: middle;

          font-size: 10px;
          font-weight: 900;
          font-style: italic;

          padding-right: 5px !important;
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
          MOBILE / SMALL SCREEN
        ========================================= */

        @media (max-width: 900px) {
          .orp-wrapper {
            padding: 8px;
          }

          .orp-sheet-btn {
            font-size: 12px;
            padding: 8px 14px;
          }

          .orp-company-name {
            font-size: 19px;
          }

          .orp-title {
            font-size: 19px;
          }

          .orp-period {
            gap: 10px;
            font-size: 11px;
          }

          .orp-period strong {
            min-width: 85px;
            font-size: 12px;
          }

          .orp-group-header {
            font-size: 10px;
          }

          .orp-column-header {
            font-size: 9px;
          }

          .orp-weekday,
          .orp-date-cell strong,
          .orp-amount-cell,
          .orp-row-total,
          .orp-weekly-label,
          .orp-weekly-value,
          .orp-weekly-grand,
          .orp-monthly-label,
          .orp-monthly-value,
          .orp-monthly-grand {
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
};

export default OtherReceiptPayment;