//src/components/transactions/daily-collection-sheet/CBHB.jsx
import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

// =====================================================
// CBHB COLUMN CONFIGURATION
// =====================================================

const CBSF_COLUMNS = [
  {
    key: "scholarshipGrant",
    label: "Scholarship Grant Program",
  },
  {
    key: "medicalMission",
    label: "Medical Mission Program",
  },
  {
    key: "businessDevelopment",
    label: "Business Dev't Prog.",
  },
  {
    key: "disasterAssistance",
    label: "Disaster/Calamity Assistance (Relief)",
  },
  {
    key: "financialAssistanceDisaster",
    label: "Financial Assistance (Affected by Disaster)",
  },
];

const CLIENT_BENEFIT_COLUMNS = [
  {
    key: "hospitalization",
    label: "Hospitalization Benefits (Client)",
  },
  {
    key: "addHospitalization",
    label: "ADD Hospitalization Benefits",
  },
  {
    key: "animalBite",
    label: "Financial Assistance (Animal Bite)",
  },
  {
    key: "dental",
    label: "Financial Assistance (Dental)",
  },
];

const ALL_COLUMNS = [
  ...CBSF_COLUMNS,
  ...CLIENT_BENEFIT_COLUMNS,
];

// =====================================================
// TRANSACTION TO CBHB MAPPING
// =====================================================

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const CBHB_ACCOUNT_MAPPING = [
  {
    key: "scholarshipGrant",
    titles: [
      "Scholarship Grant Program",
    ],
  },
  {
    key: "medicalMission",
    titles: [
      "Medical Mission Program (Health Care)",
    ],
  },
  {
    key: "businessDevelopment",
    titles: [
      "Business Development Program",
    ],
  },
  {
    key: "disasterAssistance",
    titles: [
      "Calamity Benefits: (Relief & Disaster Assistance)",
    ],
  },
  {
    key: "financialAssistanceDisaster",
    titles: [
      "Financial Assistance for Calamity/Disaster Victim",
    ],
  },
  {
    key: "hospitalization",
    titles: [
      "Client Hospitalization & Beneficiary (C.B.H.B)",
    ],
  },
  {
    key: "addHospitalization",
    titles: [
      "ADD HOSPITALIZATION & Health Benefits (Additional Beneficiaries)",
    ],
  },
  {
    key: "animalBite",
    titles: [
      "Financial Assistance (Animal Bite)",
    ],
  },
  {
    key: "dental",
    titles: [
      "Financial Assistance (Dental)",
    ],
  },
];

const getCBHBColumn = (item) => {
  if (
    normalizeText(item.category) !== "other payments"
  ) {
    return null;
  }

  const accountTitle = normalizeText(
    item.account_title || item.accountTitle
  );

  const matched = CBHB_ACCOUNT_MAPPING.find(
    (mapping) =>
      mapping.titles.some(
        (title) => normalizeText(title) === accountTitle
      )
  );

  return matched?.key || null;
};

// =====================================================
// HELPERS
// =====================================================

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const formatAmount = (value) =>
  toNumber(value).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const createEmptyAmounts = () =>
  ALL_COLUMNS.reduce((result, column) => {
    result[column.key] = 0;
    return result;
  }, {});

const calculateTotal = (amounts) =>
  ALL_COLUMNS.reduce(
    (total, column) => total + toNumber(amounts[column.key]),
    0
  );

// =====================================================
// MAIN COMPONENT
// =====================================================

const CBHB = ({
  branchId,
  selectedDate,
}) => {
  const selected = moment(selectedDate || new Date());

  const month = selected.month();
  const year = selected.year();

  // =====================================================
  // LOAD SAVED TRANSACTIONS
  // =====================================================

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCBHBTransactions = async () => {
    if (!branchId) {
      setTransactions([]);
      setError("");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        branch_id: branchId,
      });

      const response = await fetchWrapper.get(
        `${getApiBaseUrl()}transactions/dcs?${params.toString()}`
      );

      if (response?.error) {
        throw new Error(
          response?.message ||
            "Failed to load CBHB transactions."
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
    } catch (err) {
      console.error(
        "CBHB transaction loading error:",
        err
      );

      setTransactions([]);
      setError(
        err?.message ||
          "Unable to load CBHB transactions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCBHBTransactions();
  }, [branchId, month, year]);

    // =====================================================
    // GROUP SAVED CBHB TRANSACTIONS BY DATE
    // =====================================================

    const transactionsByDate = useMemo(() => {
    const grouped = {};

    if (!Array.isArray(transactions)) {
        return grouped;
    }

    transactions.forEach((transaction) => {
        const transactionBranchId =
        transaction.branch_id ||
        transaction.branchId;

        if (
        transactionBranchId &&
        String(transactionBranchId) !== String(branchId)
        ) {
        return;
        }

        const dateValue =
        transaction.transaction_date ||
        transaction.transactionDate ||
        transaction.date;

        if (!dateValue) return;

        const date = moment(dateValue);

        if (!date.isValid()) return;

        // Only include selected month and year.
        if (
        date.month() !== month ||
        date.year() !== year
        ) {
        return;
        }

        const dateKey = date.format("YYYY-MM-DD");

        const items =
        transaction.dcs_transaction_items ||
        transaction.items ||
        [];

        if (!Array.isArray(items)) return;

        items.forEach((item) => {
        const column = getCBHBColumn(item);

        if (!column) return;

        const amount = toNumber(item.amount);

        if (!grouped[dateKey]) {
            grouped[dateKey] = createEmptyAmounts();
        }

        grouped[dateKey][column] += amount;
        });
    });

    return grouped;
    }, [transactions, branchId, month, year]);

  // ===================================================
  // GENERATE MONDAY-FRIDAY ROWS
  // ===================================================

  const weeks = useMemo(() => {
    const firstDay = moment({
      year,
      month,
      day: 1,
    });

    const lastDay = firstDay.clone().endOf("month");

    const result = [];

    let current = firstDay.clone().startOf("isoWeek");

    while (current.isSameOrBefore(lastDay, "day")) {
      const week = [];

      for (let i = 0; i < 5; i++) {
        const date = current.clone().add(i, "days");

        if (
          date.month() === month &&
          date.year() === year
        ) {
          const dateKey = date.format("YYYY-MM-DD");

          week.push({
            date: dateKey,
            day: date.format("ddd"),
            dayNumber: date.date(),
            amounts:
              transactionsByDate[dateKey] ||
              createEmptyAmounts(),
          });
        }
      }

      if (week.length > 0) {
        result.push(week);
      }

      current.add(1, "week");
    }

    return result;
  }, [month, year, transactionsByDate]);

  // ===================================================
  // WEEKLY TOTALS
  // ===================================================

  const calculateWeeklyTotals = (week) => {
    const totals = createEmptyAmounts();

    week.forEach((row) => {
      ALL_COLUMNS.forEach((column) => {
        totals[column.key] += toNumber(
          row.amounts[column.key]
        );
      });
    });

    return totals;
  };

  // ===================================================
  // MONTHLY TOTALS
  // ===================================================

  const monthlyTotals = useMemo(() => {
    const totals = createEmptyAmounts();

    weeks.forEach((week) => {
      week.forEach((row) => {
        ALL_COLUMNS.forEach((column) => {
          totals[column.key] += toNumber(
            row.amounts[column.key]
          );
        });
      });
    });

    return totals;
  }, [weeks]);

  // ===================================================
  // TABLE STYLES
  // ===================================================

  const border =
    "border border-gray-500";

  const headerStyle =
    `${border} px-2 py-2 text-center text-[11px] font-bold text-gray-900`;

  const cellStyle =
    `${border} px-2 py-2 text-right text-xs bg-sky-100`;

  const totalStyle =
    `${border} px-2 py-2 text-right text-xs font-bold text-red-600 bg-white`;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* LOADING STATUS */}

        {loading && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Loading CBHB transactions...
        </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
        </div>
        )}

      {/* TITLE */}

      <div className="text-center mb-5">
        <h2 className="text-xl font-extrabold text-blue-800">
          AmberCash PH Micro Lending Corp
        </h2>

        <h3 className="text-lg font-bold text-red-600 mt-1">
          Details of CBHB and Clients Benefits Disbursement
        </h3>

        <div className="flex justify-center gap-12 mt-3 text-sm font-semibold">
          <div>
            Month:{" "}
            <span className="text-blue-800">
              {selected.format("MMMM").toUpperCase()}
            </span>
          </div>

          <div>
            Year:{" "}
            <span className="text-blue-800">
              {year}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}

      <div className="overflow-x-auto">

        <table className="border-collapse min-w-[1300px] w-full">

          {/* GROUP HEADERS */}

          <thead>

            <tr className="bg-white">

              <th
                rowSpan={2}
                className={`${headerStyle} min-w-[100px]`}
              >
                Date
              </th>

              <th
                colSpan={CBSF_COLUMNS.length}
                className={`${headerStyle} bg-gray-100`}
              >
                CBSF ACCOUNTS
              </th>

              <th
                colSpan={CLIENT_BENEFIT_COLUMNS.length}
                className={`${headerStyle} bg-gray-100`}
              >
                Clients Benefits
              </th>

              <th
                rowSpan={2}
                className={`${headerStyle} min-w-[130px]`}
              >
                TOTAL
                <br />
                Disbursements
              </th>

            </tr>

            <tr>

              {ALL_COLUMNS.map((column) => (

                <th
                  key={column.key}
                  className={`${headerStyle} min-w-[125px]`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {weeks.map((week, weekIndex) => {
              const weeklyTotals =
                calculateWeeklyTotals(week);

              return (
                <React.Fragment key={weekIndex}>
                  {/* DAILY ROWS */}
                  {week.map((row) => (
                    <tr key={row.date} className="hover:bg-blue-50">
                      <td className={`${border} px-2 py-2 text-xs bg-white font-medium`}>
                        {row.day} - {row.dayNumber}
                      </td>

                      {ALL_COLUMNS.map((column) => (
                        <td key={column.key} className={cellStyle}>
                          {toNumber(
                            row.amounts[column.key]
                          ) !== 0
                            ? formatAmount(
                                row.amounts[column.key]
                              )
                            : ""}
                        </td>
                      ))}

                      <td className={`${border} px-2 py-2 text-right text-xs font-semibold bg-white`}>
                        {formatAmount(
                          calculateTotal(row.amounts)
                        )}
                      </td>
                    </tr>

                  ))}

                  {/* WEEKLY TOTAL */}
                  <tr className="border-t-2 border-gray-800">

                    <td className={`${border} px-2 py-2 text-xs italic font-bold text-red-600`}>
                      Weekly total =
                    </td>

                    {ALL_COLUMNS.map((column) => (

                      <td key={column.key} className={totalStyle}>
                        {formatAmount(
                          weeklyTotals[column.key]
                        )}
                      </td>

                    ))}

                    <td className={totalStyle}>
                      {formatAmount(
                        calculateTotal(weeklyTotals)
                      )}
                    </td>

                  </tr>
                </React.Fragment>
              );
            })}

            {/* MONTHLY TOTAL */}
            <tr className="border-t-4 border-blue-800">
              <td className={`${border} px-2 py-3 text-xs font-extrabold text-red-600`}>
                Monthly total =
              </td>

              {ALL_COLUMNS.map((column) => (

                <td key={column.key} className={`${totalStyle} bg-gray-100`}>
                  {formatAmount(
                    monthlyTotals[column.key]
                  )}
                </td>

              ))}

              <td className={`${totalStyle} bg-gray-100`}>
                {formatAmount(
                  calculateTotal(monthlyTotals)
                )}
              </td>

            </tr>
          </tbody>
        </table>
      </div>

      {/* FOOTER */}

      <div className="mt-3 text-xs text-gray-400">
        Scroll horizontally to view all CBHB and Clients Benefits columns.
      </div>
    </div>
  );
};

export default CBHB;