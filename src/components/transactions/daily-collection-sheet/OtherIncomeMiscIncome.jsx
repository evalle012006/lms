import React, { useEffect, useMemo, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

const OtherIncomeMiscIncome = ({
  branchId,
  selectedDate,
}) => {
  const cashInBankApiUrl =
    `${getApiBaseUrl()}transactions/cash-in-bank`;

  const [transactions, setTransactions] = useState([]);
  const [cashInBankInterest, setCashInBankInterest] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingDate, setSavingDate] = useState(null);

  // =========================================================
  // COLUMNS
  // =========================================================

  const columns = [
    {
      key: "othersAmount",
      label: "Others",
    },
    {
      key: "interestFromBank",
      label: "Interest From Bank",
    },
    {
      key: "ackpNonAgentCsf",
      label: "ACKP Non-Agent CSF",
    },
    {
      key: "badDebtCollection",
      label: "Bad Debt Collection",
    },
    {
      key: "motorcycleAdvance",
      label: "Motorcycle Advance",
    },
    {
      key: "salaryAdvance",
      label: "Salary Advance",
    },
    {
      key: "newClientPassbook",
      label: "New Client Passbook",
    },
    {
      key: "replacementPassbook",
      label: "Replacement Passbook",
    },
    {
      key: "staffExcessRemittance",
      label: "Staff Excess Remittance",
    },
    {
      key: "penalties",
      label: "Penalties",
    },
  ];

  // =========================================================
  // CURRENT MONTH
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-US", {
    month: "long",
  });

  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  // =========================================================
  // DATE HELPER
  // =========================================================

  const getDateKey = (day) => {
    return [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  };

  // =========================================================
  // LOAD TRANSACTIONS
  // =========================================================

  useEffect(() => {
    if (!branchId) {
      setTransactions([]);
      return;
    }

    let active = true;

    const loadTransactions = async () => {
      try {
        setLoading(true);

        const response = await fetchWrapper.get(
          `${getApiBaseUrl()}transactions/other-income-misc?branch_id=${encodeURIComponent(
            branchId
          )}`
        );

        if (!active) return;

        if (response?.error) {
          throw new Error(
            response?.message ||
              "Failed to load Other Income transactions."
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
          "Load Other Income Misc error:",
          error
        );

        if (active) {
          setTransactions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      active = false;
    };
  }, [branchId]);

  // =========================================================
  // LOAD INTEREST FROM CASH IN BANK
  // =========================================================

  useEffect(() => {
    if (!branchId) {
      setCashInBankInterest({});
      return;
    }

    let active = true;

    const loadCashInBankInterest = async () => {
      try {
        const selectedMonth = [
          year,
          String(month + 1).padStart(2, "0"),
        ].join("-");

        const response = await fetchWrapper.get(
          `${cashInBankApiUrl}` +
            `?branch_id=${encodeURIComponent(branchId)}` +
            `&month=${encodeURIComponent(selectedMonth)}`
        );

        if (!active) return;

        const entries = Array.isArray(response?.entries)
          ? response.entries
          : [];

        const interestByDate = {};

        entries.forEach((entry) => {
          const dateKey = String(
            entry?.transaction_date || ""
          ).slice(0, 10);

          if (!dateKey) return;

          interestByDate[dateKey] =
            Number(interestByDate[dateKey] || 0) +
            Number(entry?.net_interest || 0);
        });

        setCashInBankInterest(interestByDate);
      } catch (error) {
        console.error(
          "Load Cash in Bank interest error:",
          error
        );

        if (active) {
          setCashInBankInterest({});
        }
      }
    };

    loadCashInBankInterest();

    return () => {
      active = false;
    };
  }, [
    branchId,
    year,
    month,
    cashInBankApiUrl,
  ]);

  // =========================================================
  // BUILD MONTH ROWS
  // =========================================================

  const rows = useMemo(() => {
    return Array.from(
      { length: daysInMonth },
      (_, index) => {
        const day = index + 1;

        const date = new Date(
          year,
          month,
          day
        );

        const dateKey = getDateKey(day);

        const transaction = transactions.find(
          (item) =>
            String(item?.transactionDate || "").slice(
              0,
              10
            ) === dateKey
        );

        const values = {};

        columns.forEach((column) => {
          values[column.key] = Number(
            transaction?.[column.key] || 0
          );
        });

        return {
          day,
          dateKey,
          weekday: date.toLocaleDateString(
            "en-US",
            {
              weekday: "short",
            }
          ),
          transactionId:
            transaction?._id || null,
          values,
        };
      }
    );
  }, [
    transactions,
    daysInMonth,
    year,
    month,
  ]);

  // =========================================================
  // MONDAY - FRIDAY ONLY
  // =========================================================

  const weekdayRows = useMemo(() => {
    return rows.filter((row) => {
      const date = new Date(
        year,
        month,
        row.day
      );

      const dayOfWeek = date.getDay();

      return dayOfWeek >= 1 && dayOfWeek <= 5;
    });
  }, [rows, year, month]);

  // =========================================================
  // WEEKLY GROUPS
  // Monday - Friday, matching the Excel report
  // =========================================================

  const weeklyGroups = useMemo(() => {
    const groups = [];
    let currentWeek = [];

    weekdayRows.forEach((row) => {
      const date = new Date(
        year,
        month,
        row.day
      );

      const dayOfWeek = date.getDay();

      currentWeek.push(row);

      // Friday = end of reporting week
      if (dayOfWeek === 5) {
        groups.push(currentWeek);
        currentWeek = [];
      }
    });

    // Last partial week of the month
    if (currentWeek.length > 0) {
      groups.push(currentWeek);
    }

    return groups;
  }, [weekdayRows, year, month]);

  // =========================================================
  // UPDATE LOCAL DESCRIPTION
  // =========================================================

  const handleDescriptionChange = (dateKey, value) => {
    setTransactions((previous) => {
      const existingIndex = previous.findIndex(
        (item) =>
          String(item?.transactionDate || "").slice(0, 10) ===
          dateKey
      );

      if (existingIndex >= 0) {
        const next = [...previous];

        next[existingIndex] = {
          ...next[existingIndex],
          description: value,
        };

        return next;
      }

      return [
        ...previous,
        {
          _id: null,
          branchId,
          transactionDate: dateKey,
          description: value,

          othersAmount: 0,
          interestFromBank: 0,
          ackpNonAgentCsf: 0,
          badDebtCollection: 0,
          motorcycleAdvance: 0,
          salaryAdvance: 0,
          newClientPassbook: 0,
          replacementPassbook: 0,
          staffExcessRemittance: 0,
          penalties: 0,
        },
      ];
    });
  };

  // =========================================================
  // UPDATE LOCAL CELL
  // =========================================================

  const handleAmountChange = (
    dateKey,
    field,
    value
  ) => {
    const numericValue =
      value === "" ? 0 : Number(value);

    setTransactions((previous) => {
      const existingIndex =
        previous.findIndex(
          (item) =>
            String(
              item?.transactionDate || ""
            ).slice(0, 10) === dateKey
        );

      if (existingIndex >= 0) {
        const next = [...previous];

        next[existingIndex] = {
          ...next[existingIndex],
          [field]: numericValue,
        };

        return next;
      }

      return [
        ...previous,
        {
          _id: null,
          branchId,
          transactionDate: dateKey,

          othersAmount: 0,
          interestFromBank: 0,
          ackpNonAgentCsf: 0,
          badDebtCollection: 0,
          motorcycleAdvance: 0,
          salaryAdvance: 0,
          newClientPassbook: 0,
          replacementPassbook: 0,
          staffExcessRemittance: 0,
          penalties: 0,

          [field]: numericValue,
        },
      ];
    });
  };

  // =========================================================
  // GET ROW
  // =========================================================

  const getTransactionForDate = (dateKey) => {
    return transactions.find(
      (item) =>
        String(
          item?.transactionDate || ""
        ).slice(0, 10) === dateKey
    );
  };

  // =========================================================
  // SAVE DAY
  // =========================================================

  const handleSave = async (row) => {
    if (!branchId) {
      alert("Please select a branch.");
      return;
    }

    const transaction =
      getTransactionForDate(row.dateKey);

    const payload = {
      branchId,
      transactionDate: row.dateKey,

      description:
        transaction?.description || null,

      othersAmount: Number(
        transaction?.othersAmount || 0
      ),

      interestFromBank: Number(
        cashInBankInterest[row.dateKey] || 0
      ),

      ackpNonAgentCsf: Number(
        transaction?.ackpNonAgentCsf || 0
      ),

      badDebtCollection: Number(
        transaction?.badDebtCollection || 0
      ),

      motorcycleAdvance: Number(
        transaction?.motorcycleAdvance || 0
      ),

      salaryAdvance: Number(
        transaction?.salaryAdvance || 0
      ),

      newClientPassbook: Number(
        transaction?.newClientPassbook || 0
      ),

      replacementPassbook: Number(
        transaction?.replacementPassbook || 0
      ),

      staffExcessRemittance: Number(
        transaction?.staffExcessRemittance || 0
      ),

      penalties: Number(
        transaction?.penalties || 0
      ),
    };

    try {
      setSavingDate(row.dateKey);

      const response = await fetchWrapper.post(
        `${getApiBaseUrl()}transactions/other-income-misc/create`,
        payload
      );

      if (response?.error) {
        throw new Error(
          response?.message ||
            "Failed to save transaction."
        );
      }

      const saved =
        response?.transaction ||
        response?.data ||
        response?.response;

      if (saved?._id) {
        setTransactions((previous) => {
          const filtered = previous.filter(
            (item) =>
              String(
                item?.transactionDate || ""
              ).slice(0, 10) !== row.dateKey
          );

          return [...filtered, saved];
        });
      }

      alert("Other Income saved successfully.");
    } catch (error) {
      console.error(
        "Save Other Income Misc error:",
        error
      );

      alert(
        error?.message ||
          "Failed to save Other Income."
      );
    } finally {
      setSavingDate(null);
    }
  };

  // =========================================================
  // TOTALS
  // =========================================================

  const getCellValue = (row, key) => {
    // Interest From Bank comes automatically
    // from Cash in Bank.
    if (key === "interestFromBank") {
      return Number(
        cashInBankInterest[row.dateKey] || 0
      );
    }

    const transaction =
      getTransactionForDate(row.dateKey);

    return Number(
      transaction?.[key] || 0
    );
  };

  const getRowTotal = (row) => {
    return columns.reduce(
      (total, column) =>
        total +
        getCellValue(row, column.key),
      0
    );
  };

  const getWeeklyTotal = (weekRows, key) => {
    return weekRows.reduce(
      (total, row) =>
        total + getCellValue(row, key),
      0
    );
  };

  const getWeeklyGrandTotal = (weekRows) => {
    return columns.reduce(
      (total, column) =>
        total +
        getWeeklyTotal(weekRows, column.key),
      0
    );
  };

  const getMonthlyTotal = (key) => {
    return weekdayRows.reduce(
      (total, row) =>
        total + getCellValue(row, key),
      0
    );
  };

  const getMonthlyGrandTotal = () => {
    return columns.reduce(
      (total, column) =>
        total +
        getMonthlyTotal(column.key),
      0
    );
  };

  const formatAmount = (value) => {
    return Number(value || 0).toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="w-full">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Other Income - Misc Income
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Daily Other Income / Miscellaneous Income
            transactions.
          </p>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-700">
            {monthName} {year}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            Monthly Total
          </div>

          <div className="text-lg font-bold text-red-600">
            ₱ {formatAmount(getMonthlyGrandTotal())}
          </div>
        </div>
      </div>

      {!branchId && (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          Please select a branch.
        </div>
      )}

      {loading && (
        <div className="mb-3 text-sm text-gray-500">
          Loading transactions...
        </div>
      )}

      <div className="oimi-page">
        <div className="oimi-report-header">
          <div className="oimi-company-name">
            AmberCash PH Micro Lending Corp
          </div>

          <div className="oimi-title">
            OTHER INCOME - MISC INCOME
          </div>
        </div>

        <div className="oimi-table-scroll">
          <table className="oimi-table">
            <thead>
              {/* GROUP HEADER */}
              <tr className="oimi-group-row">
                <th
                  rowSpan="2"
                  className="oimi-date-header sticky-left"
                >
                  Date
                </th>

                <th
                  colSpan="2"
                  className="oimi-group-header"
                >
                  OTHERS
                </th>

                <th
                  rowSpan="2"
                  className="oimi-column-header"
                >
                  INTEREST
                  <br />
                  from
                  <br />
                  BANK
                </th>

                <th
                  rowSpan="2"
                  className="oimi-column-header"
                >
                  ACKP NONE
                  <br />
                  AGENT CSF
                </th>

                <th
                  rowSpan="2"
                  className="oimi-column-header"
                >
                  BAD DEBT
                  <br />
                  Collection
                </th>

                <th
                  colSpan="2"
                  className="oimi-group-header"
                >
                  INTEREST / SERVICE CHARGE
                </th>

                <th
                  colSpan="2"
                  className="oimi-group-header"
                >
                  CLIENT PASSBOOK
                </th>

                <th
                  colSpan="2"
                  className="oimi-group-header"
                >
                  STAFFS (LOs &amp; BMs)
                </th>

                <th
                  rowSpan="2"
                  className="oimi-total-header"
                >
                  TOTAL
                </th>

                <th
                  rowSpan="2"
                  className="oimi-action-header"
                >
                  Action
                </th>
              </tr>

              {/* SUB HEADER */}
              <tr className="oimi-subheader-row">
                <th className="oimi-description-header">
                  Description
                </th>

                <th className="oimi-column-header">
                  AMOUNT
                </th>

                <th className="oimi-column-header">
                  Motorcycle
                  <br />
                  Advance
                </th>

                <th className="oimi-column-header">
                  Salary
                  <br />
                  Advance
                </th>

                <th className="oimi-column-header">
                  New Client
                  <br />
                  Passbook
                </th>

                <th className="oimi-column-header">
                  Replacement
                  <br />
                  Passbook
                </th>

                <th className="oimi-column-header">
                  Excess /
                  <br />
                  Remittances
                </th>

                <th className="oimi-column-header">
                  PENALTIES
                </th>
              </tr>
            </thead>

            <tbody>
              {weeklyGroups.map((weekRows, weekIndex) => (
                <React.Fragment key={`week-${weekIndex}`}>
                  {weekRows.map((row) => (
                    <tr
                      key={row.dateKey}
                      className="oimi-day-row"
                    >
                      <td className="oimi-date-cell sticky-left">
                        <span className="oimi-weekday">
                          {row.weekday}-
                        </span>

                        <strong>{row.day}</strong>
                      </td>

                      <td className="oimi-description-cell">
                        <input
                          type="text"
                          value={
                            getTransactionForDate(row.dateKey)
                              ?.description || ""
                          }
                          onChange={(event) =>
                            handleDescriptionChange(
                              row.dateKey,
                              event.target.value
                            )
                          }
                          disabled={!branchId}
                        />
                      </td>

                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="oimi-amount-cell"
                        >
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              getCellValue(
                                row,
                                column.key
                              ) || ""
                            }
                            onChange={(event) =>
                              handleAmountChange(
                                row.dateKey,
                                column.key,
                                event.target.value
                              )
                            }
                            disabled={
                              !branchId ||
                              column.key === "interestFromBank"
                            }
                          />
                        </td>
                      ))}

                      <td className="oimi-row-total">
                        {formatAmount(
                          getRowTotal(row)
                        )}
                      </td>

                      <td className="oimi-action-cell">
                        <button
                          type="button"
                          onClick={() =>
                            handleSave(row)
                          }
                          disabled={
                            !branchId ||
                            savingDate === row.dateKey
                          }
                        >
                          {savingDate === row.dateKey
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* WEEKLY TOTAL */}
                  <tr className="oimi-weekly-row">
                    <td className="oimi-weekly-label sticky-left">
                      Weekly total =
                    </td>

                    <td className="oimi-weekly-description" />

                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className="oimi-weekly-value"
                      >
                        {formatAmount(
                          getWeeklyTotal(
                            weekRows,
                            column.key
                          )
                        )}
                      </td>
                    ))}

                    <td className="oimi-weekly-grand">
                      {formatAmount(
                        getWeeklyGrandTotal(weekRows)
                      )}
                    </td>

                    <td className="oimi-weekly-action" />
                  </tr>
                </React.Fragment>
              ))}

              <tr className="oimi-monthly-row">
                <td className="oimi-monthly-label sticky-left">
                  Monthly Total
                </td>

                <td className="oimi-monthly-description" />

                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="oimi-monthly-value"
                  >
                    {formatAmount(
                      getMonthlyTotal(column.key)
                    )}
                  </td>
                ))}

                <td className="oimi-monthly-grand">
                  {formatAmount(
                    getMonthlyGrandTotal()
                  )}
                </td>

                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .oimi-page {
          width: 100%;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          overflow: hidden;
        }

        .oimi-report-header {
          padding: 8px 10px 10px;
          text-align: center;
          background: #ffffff;
          border-bottom: 0;
        }

        .oimi-company-name {
          color: #315f91;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 700;
        }

        .oimi-title {
          margin-top: 5px;
          color: #ff0000;
          font-size: 23px;
          line-height: 1.1;
          font-weight: 900;
        }

        .oimi-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .oimi-table {
          width: max-content;
          min-width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 14px;
        }

        .oimi-table th,
        .oimi-table td {
          border: 1px solid #94a3b8;
          box-sizing: border-box;
        }

        .oimi-date-header {
          width: 75px;
          min-width: 75px;
          height: 55px;
          background: #ffffff;
          font-weight: 900;
          z-index: 10;
        }

        .oimi-weekly-row td {
          height: 30px;
          background: #ffffff !important;
          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .oimi-weekly-label {
          min-width: 75px;
          padding: 4px 5px;
          color: #ff0000;
          font-weight: 900;
          font-style: italic;
          white-space: nowrap;
        }

        .oimi-weekly-value {
          padding: 4px 5px;
          color: #ff0000;
          text-align: right;
          font-weight: 900;
          font-style: italic;
        }

        .oimi-weekly-grand {
          padding: 4px 5px;
          color: #ff0000;
          text-align: right;
          font-weight: 900;
          font-style: italic;
        }

        .oimi-weekly-label,
        .oimi-weekly-value,
        .oimi-weekly-grand {
          font-size: 13px;
        }

        .oimi-monthly-label,
        .oimi-monthly-value,
        .oimi-monthly-grand {
          font-size: 13px;
        }

        .oimi-date-header,
        .oimi-total-header,
        .oimi-action-header {
          font-size: 14px;
          font-weight: 900;
        }

        .oimi-row-total {
          font-size: 14px;
        }

        .oimi-action-cell button {
          font-size: 12px;
        }

        .oimi-weekly-action {
          background: #ffffff !important;
        }

        .oimi-group-row th {
          border-top: 2px solid #111827;
          border-bottom: 1px solid #111827;
        }

        .oimi-group-header {
          height: 36px;
          padding: 5px 8px;
          background: #ffffff;
          color: #111827;
          text-align: center;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.2;
          white-space: nowrap;
        }

        .oimi-subheader-row th {
          height: 42px;
          border-bottom: 2px solid #111827;
        }

        .oimi-group-row .oimi-date-header,
        .oimi-group-row .oimi-total-header,
        .oimi-group-row .oimi-action-header {
          border-bottom: 2px solid #111827;
        }

        .oimi-description-header {
          width: 220px;
          min-width: 220px;
          max-width: 220px;
          height: 65px;
          padding: 6px;
          background: #ffff99;
          text-align: center;
          font-size: 14px;
          line-height: 1.2;
          font-weight: 900;
        }

        .oimi-description-cell {
          width: 220px;
          min-width: 220px;
          max-width: 220px;
          padding: 3px;
          background: #ffff99 !important;
        }

        .oimi-description-cell input {
          width: 100%;
          height: 34px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 3px;
          background: transparent;
          padding: 2px 5px;
          font-size: 14px;
          outline: none;
        }

        .oimi-description-cell input:hover {
          background: #ffffff;
          border-color: #94a3b8;
        }

        .oimi-description-cell input:focus {
          background: #ffffff;
          border-color: #0f9f94;
        }

        .oimi-weekly-description,
        .oimi-monthly-description {
          width: 220px;
          min-width: 220px;
          max-width: 220px;
          background: #ffffff !important;
        }
        .oimi-column-header {
          width: 125px;
          min-width: 125px;
          max-width: 125px;
          height: 65px;
          padding: 6px;
          background: #f8fafc;
          text-align: center;
          font-size: 13px;
          line-height: 1.25;
          font-weight: 900;
          white-space: normal;
        }

        .oimi-total-header {
          width: 110px;
          min-width: 110px;
          background: #ffffff;
          font-weight: 900;
        }

        .oimi-action-header {
          width: 80px;
          min-width: 80px;
          background: #ffffff;
          font-weight: 900;
        }

        .oimi-day-row td {
          height: 42px;
          background: #c9eafa;
        }

        .oimi-date-cell {
          width: 75px;
          min-width: 75px;
          padding: 3px 5px;
          background: #ffffff !important;
          white-space: nowrap;
        }

        .oimi-weekday {
          display: inline-block;
          width: 45px;
          color: #374151;
          font-size: 13px;
          font-style: italic;
        }

        .oimi-date-cell strong {
          font-size: 14px;
          font-weight: 900;
        }

        .oimi-amount-cell {
          width: 125px;
          min-width: 125px;
          padding: 3px;
        }

        .oimi-amount-cell input {
          width: 100%;
          height: 34px;
          box-sizing: border-box;
          border: 1px solid transparent;
          border-radius: 3px;
          background: transparent;
          text-align: right;
          padding: 4px 7px;
          font-size: 14px;
          font-weight: 600;
          outline: none;
        }

        .oimi-amount-cell input:hover {
          background: #ffffff;
          border-color: #94a3b8;
        }

        .oimi-amount-cell input:focus {
          background: #ffffff;
          border-color: #0f9f94;
        }

        .oimi-row-total {
          width: 110px;
          min-width: 110px;
          padding: 3px 6px;
          background: #ffffff !important;
          color: #dc2626;
          text-align: right;
          font-weight: 900;
        }

        .oimi-action-cell {
          width: 80px;
          min-width: 80px;
          padding: 3px;
          background: #ffffff !important;
          text-align: center;
        }

        .oimi-action-cell button {
          border: 0;
          border-radius: 4px;
          background: #0f9f94;
          color: white;
          padding: 5px 10px;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .oimi-action-cell button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .oimi-monthly-row td {
          height: 30px;
          background: #ffffff !important;
          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
        }

        .oimi-monthly-label {
          padding: 4px 5px;
          color: #dc2626;
          font-weight: 900;
          font-style: italic;
          white-space: nowrap;
        }

        .oimi-monthly-value,
        .oimi-monthly-grand {
          padding: 4px 5px;
          color: #dc2626;
          text-align: right;
          font-weight: 900;
          font-style: italic;
        }

        .sticky-left {
          position: sticky;
          left: 0;
          z-index: 5;
        }
      `}</style>
    </div>
  );
};

export default OtherIncomeMiscIncome;