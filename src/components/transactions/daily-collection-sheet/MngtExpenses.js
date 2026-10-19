import React, { useEffect, useMemo, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

/*
 * Management Expense columns.
 *
 * Matching uses BOTH code and account title.
 * If your exact DCS codes differ, the account title fallback
 * still allows the transaction to be displayed.
 */
const EXPENSE_COLUMNS = [
    {
        key: "salaries_wages",
        group: "Personnel Related Cost",
        title: "Salaries and Wages",
        codes: ["054"],
        aliases: [
            "basic salaries",
            "basic salary",
            "salaries and wages",
            "salary and wages",
            "salaries & wages",
            "salary",
            "salaries",
            "staff cbu/cashbond & client mcbu interest",
        ],
    },
    {
        key: "back_pay",
        group: "Personnel Related Cost",
        title: "Back Pay",
        aliases: ["back pay"],
    },
    {
        key: "de_minimis",
        group: "Personnel Related Cost",
        title: "De Minimis / ECOLA",
        aliases: [
            "de minimis / ecola",
            "de minimis",
            "ecola",
            "de minimis ecola",
        ],
    },
    {
        key: "employer_contribution",
        group: "Personnel Related Cost",
        title: "Employer's Contribution (ER)",
        aliases: [
            "employer's contribution (er)",
            "employers contribution (er)",
            "employers contribution",
            "employer contribution",
            "employer's contribution",
        ],
    },
    {
        key: "thirteenth_month",
        group: "Personnel Related Cost",
        subgroup: "STAFF'S BENEFITS",
        title: "13th Month Benefits",
        aliases: [
            "13th month benefits",
            "13th month benefit",
            "13th month pay",
            "bonuses (13th month & other staff benefits)",
        ],
    },
    {
        key: "retirement_incentives",
        group: "Personnel Related Cost",
        subgroup: "STAFF'S BENEFITS",
        title: "Retirement Incentives",
        aliases: [
            "retirement incentives",
            "retirement incentive",
        ],
    },
    {
        key: "reimbursable_transpo",
        group: "Transportation and Other Travel Expenses",
        title: "Reimbursable Transpo",
        aliases: [
            "reimbursable transpo",
            "reimbursable transportation",
            "transportation reimbursement",
            "monthly allocated reimbursement transportation",
        ],
    },
    {
        key: "special_reimbursable_transpo",
        group: "Transportation and Other Travel Expenses",
        title: "Special Additional Reimbursable Transpo",
        aliases: [
            "special additional reimbursable transpo",
            "special additional reimbursable transportation",
            "special reimbursable transpo",
            "monthly special additional reimbursement transportation",
        ],
    },
    {
        key: "other_official_travel",
        group: "Transportation and Other Travel Expenses",
        title: "Other Transpo on Official Travel",
        aliases: [
            "other transpo on official travel",
            "other transportation on official travel",
            "official travel",
        ],
    },
    {
        key: "staff_benevolent",
        title: "Staff Benevolent Funds",
        aliases: [
            "staff benevolent fund (sbf)",
            "staff benevolent fund",
            "staff benevolent funds",
        ],
    },
    {
        key: "office_rental",
        title: "Office Rental",
        aliases: [
            "office rental",
            "office rent",
            "office rental base",
        ],
    },
    {
        key: "light_water",
        title: "Light & Water",
        aliases: [
            "light & water",
            "light and water",
            "light & water expense",
        ],
    },
    {
        key: "fuel",
        title: "Fuel and Lubricants",
        blocked: true,
        aliases: [],
    },
    {
        key: "sss",
        title: "SSS / PH & HDMF Payment",
        aliases: [
            "sss, hdmf, ph payment (bm personnel)",
            "sss",
            "sss / ph & hdmf payment",
            "sss / ph and hdmf payment",
            "ph & hdmf payment",
        ],
    },
    {
        key: "repair",
        title: "Repair & Maint.",
        aliases: [
            "repairing & maintenance",
            "repair & maint.",
            "repair & maintenance",
            "repair and maintenance",
        ],
    },
    {
        key: "communication",
        title: "Communication and Postage",
        aliases: [
            "communication and postage",
            "communication & postage",
        ],
    },
    {
        key: "branch_supplies",
        title: "Office Supplies / Branch Supplies",
        aliases: [
            "office supplies & xerox",
            "branch supplies",
            "office supplies",
        ],
    },
    {
        key: "printing",
        title: "Printing of Forms & Books",
        blocked: true,
        aliases: [],
    },
    {
        key: "staff_development",
        title: "Staff Dev't and Conference",
        aliases: [
            "staff dev't and conference",
            "staff development and conference",
            "staff development & conference",
        ],
    },
    {
        key: "security",
        title: "Security & Janitorial",
        blocked: true,
        aliases: [],
    },
    {
        key: "representation",
        title: "Representation",
        aliases: ["representation"],
    },
    {
        key: "bank_charges",
        title: "Bank Charges",
        aliases: ["bank charges", "bank charge"],
    },
    {
        key: "taxes",
        title: "City / Municipal Taxes & Licenses",
        aliases: [
            "city/municipality taxes and licenses",
            "city / municipal taxes & licenses",
            "city / municipal taxes and licenses",
            "taxes & licenses",
            "taxes and licenses",
            "taxes",
        ],
    },
    {
        key: "insurance",
        title: "Insurance Fee",
        blocked: true,
        aliases: [],
    },
    {
        key: "consultancy",
        title: "Consultancy and Professional Fee",
        codes: ["075"],
        aliases: [
            "consultancy and professional fee",
            "consultancy and professional fees",
            "consultancy & professional fee",
            "consultancy & professional fees",
            "professional fee",
            "professional fees",
        ],
    },
    {
        key: "client_development",
        title: "Client's Dev't Training",
        codes: ["076"],
        aliases: [
            "client's dev't training",
            "clients dev't training",
            "client development training",
            "clients' development & training",
            "clients' development and training",
            "client's development & training",
            "client's development and training",
        ],
    },
    {
        key: "association",
        title: "Association Dues & Mem. Fee",
        codes: ["077"],
        aliases: [
            "association dues & mem. fee",
            "association dues and membership fee",
            "association dues and membership fees",
            "association dues & membership fee",
            "association dues & membership fees",
            "association dues",
        ],
    },
];

const normalize = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

const money = (value) =>
    Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const toLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getItemColumn = (item) => {
    const title = normalize(item?.account_title);

    return EXPENSE_COLUMNS.find((column) =>
        (column.aliases || []).some(
            (alias) => normalize(alias) === title
        )
    );
};

const MngtExpenses = ({ branchId, selectedDate }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!branchId) {
            setTransactions([]);
            return;
        }

        let active = true;

        const loadTransactions = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}transactions/dcs?branch_id=${encodeURIComponent(
                        branchId
                    )}`
                );

                if (!active) return;

                if (response?.error) {
                    throw new Error(
                        response?.message ||
                            "Failed to load management expenses."
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
                    "Load management expenses error:",
                    err
                );

                if (active) {
                    setTransactions([]);
                    setError(
                        err?.message ||
                            "Failed to load management expenses."
                    );
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

    /*
     * Use the selected DCS date to determine the month/year.
     */
    const selectedMonth = useMemo(() => {
        if (!selectedDate) {
            return null;
        }

        const parts = String(selectedDate).split("-");

        if (parts.length !== 3) {
            return null;
        }

        const year = Number(parts[0]);
        const month = Number(parts[1]);

        if (!year || !month) {
            return null;
        }

        return {
            year,
            month,
        };
    }, [selectedDate]);

    /*
     * Build Monday-Friday rows for the selected month.
     * Saturday and Sunday are not displayed.
     */
    const weeks = useMemo(() => {
        if (!selectedMonth) {
            return [];
        }

        const { year, month } = selectedMonth;

        const lastDay = new Date(year, month, 0).getDate();

        const result = [];
        let currentWeek = [];

        for (let day = 1; day <= lastDay; day += 1) {
            const date = new Date(year, month - 1, day);
            const weekDay = date.getDay();

            // Sunday = 0, Saturday = 6
            if (weekDay === 0 || weekDay === 6) {
                continue;
            }

            currentWeek.push({
                date,
                dateKey: toLocalDateKey(date),
                day,
                dayName: date.toLocaleDateString("en-US", {
                    weekday: "short",
                }),
            });

            if (weekDay === 5) {
                result.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length) {
            result.push(currentWeek);
        }

        return result;
    }, [selectedMonth]);

    /*
     * Convert DCS transactions into management-expense data
     * grouped by transaction date.
     */
    const expensesByDate = useMemo(() => {
        const map = {};

        transactions.forEach((transaction) => {
            const dateKey = String(
                transaction?.transaction_date || ""
            ).slice(0, 10);

            if (!dateKey) {
                return;
            }

            const items =
                transaction?.dcs_transaction_items || [];

            items.forEach((item) => {
                if (
                    normalize(item?.category) !==
                    "management expenses"
                ) {
                    return;
                }

                if (!map[dateKey]) {
                    map[dateKey] = {
                        columns: {},
                        miscellaneous: [],
                        total: 0,
                    };
                }

                const amount = Number(item?.amount || 0);

                if (!Number.isFinite(amount) || amount <= 0) {
                    return;
                }

                const column = getItemColumn(item);

                const isMiscellaneousExpense =
                    normalize(item?.account_title) ===
                        "miscellaneous expense" ||
                    String(item?.code || "").trim() === "078";

                if (column) {
                    map[dateKey].columns[column.key] =
                        Number(
                            map[dateKey].columns[column.key] || 0
                        ) + amount;
                } else if (isMiscellaneousExpense) {
                    map[dateKey].miscellaneous.push({
                        code: item?.code || "",
                        accountTitle:
                            item?.account_title || "",
                        description:
                            item?.description || "",
                        amount,
                    });
                }

                map[dateKey].total += amount;
            });
        });

        return map;
    }, [transactions]);

    const monthTotal = useMemo(() => {
        return Object.values(expensesByDate).reduce(
            (sum, day) => sum + Number(day.total || 0),
            0
        );
    }, [expensesByDate]);

    const monthName = selectedMonth
        ? new Date(
              selectedMonth.year,
              selectedMonth.month - 1,
              1
          ).toLocaleDateString("en-US", {
              month: "long",
          })
        : "";

    const getWeekColumnTotal = (week, columnKey) =>
        week.reduce((sum, row) => {
            return (
                sum +
                Number(
                    expensesByDate[row.dateKey]?.columns?.[
                        columnKey
                    ] || 0
                )
            );
        }, 0);

    const getWeekMiscTotal = (week) =>
        week.reduce((sum, row) => {
            const misc =
                expensesByDate[row.dateKey]?.miscellaneous ||
                [];

            return (
                sum +
                misc.reduce(
                    (miscSum, item) =>
                        miscSum + Number(item.amount || 0),
                    0
                )
            );
        }, 0);

    const getWeekTotal = (week) =>
        week.reduce(
            (sum, row) =>
                sum +
                Number(
                    expensesByDate[row.dateKey]?.total || 0
                ),
            0
        );

    return (
        <div className="w-full">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">
                        Details of Management Expenses
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Management expenses recorded from Petty Cash
                        Voucher transactions.
                    </p>
                </div>

                <div className="text-right">
                    <div className="text-sm font-semibold text-gray-700">
                        {monthName} {selectedMonth?.year || ""}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                        Monthly Total
                    </div>

                    <div className="text-lg font-bold text-red-600">
                        ₱ {money(monthTotal)}
                    </div>
                </div>
            </div>

            {!branchId ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    Please select a branch.
                </div>
            ) : loading ? (
                <div className="py-16 text-center text-sm text-gray-500">
                    Loading management expenses...
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    {error}
                </div>
            ) : (
                <div className="overflow-x-auto border border-gray-300 bg-white">
                    <table className="min-w-[2800px] w-full border-collapse text-[11px]">
                        <thead>
                            <tr className="bg-white">
                                <th
                                    colSpan={
                                        EXPENSE_COLUMNS.length + 5
                                    }
                                    className="border border-gray-300 px-3 py-2 text-center"
                                >
                                    <div className="text-base font-semibold text-sky-500">
                                        AmberCash PH Micro Lending Corp
                                    </div>

                                    <div className="text-xl font-extrabold uppercase text-red-600">
                                        Details of Management Expenses
                                    </div>
                                </th>
                            </tr>

                            <tr className="bg-sky-100">
                                <th className="sticky left-0 z-20 border border-gray-400 bg-sky-100 px-2 py-2">
                                    Day
                                </th>

                                <th className="sticky left-[55px] z-20 border border-gray-400 bg-sky-100 px-2 py-2">
                                    Date
                                </th>

                                {EXPENSE_COLUMNS.map((column) => (
                                    <th
                                        key={column.key}
                                        className="min-w-[115px] border border-gray-400 px-2 py-2 text-center font-bold"
                                    >
                                        {column.title}
                                    </th>
                                ))}

                                <th className="min-w-[220px] border border-gray-400 bg-yellow-50 px-2 py-2">
                                    Miscellaneous Description
                                </th>

                                <th className="min-w-[100px] border border-gray-400 bg-sky-100 px-2 py-2">
                                    Misc. Amount
                                </th>

                                <th className="min-w-[110px] border border-gray-400 bg-white px-2 py-2">
                                    TOTAL
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {weeks.map((week, weekIndex) => (
                                <React.Fragment
                                    key={`week-${weekIndex}`}
                                >
                                    {week.map((row) => {
                                        const dayData =
                                            expensesByDate[
                                                row.dateKey
                                            ];

                                        const misc =
                                            dayData?.miscellaneous ||
                                            [];

                                        const miscTotal =
                                            misc.reduce(
                                                (sum, item) =>
                                                    sum +
                                                    Number(
                                                        item.amount ||
                                                            0
                                                    ),
                                                0
                                            );

                                        return (
                                            <tr
                                                key={row.dateKey}
                                                className="hover:bg-gray-50"
                                            >
                                                <td className="sticky left-0 z-10 border border-gray-300 bg-white px-2 py-2 italic">
                                                    {row.dayName}
                                                </td>

                                                <td className="sticky left-[55px] z-10 border border-gray-300 bg-white px-2 py-2 text-center font-semibold">
                                                    {row.day}
                                                </td>

                                                {EXPENSE_COLUMNS.map(
                                                    (column) => {
                                                        const value =
                                                            dayData
                                                                ?.columns?.[
                                                                column
                                                                    .key
                                                            ] || 0;

                                                        return (
                                                            <td
                                                              key={column.key}
                                                              className={`relative border border-gray-300 px-2 py-2 text-right ${
                                                                  column.blocked
                                                                      ? "bg-gray-200"
                                                                      : "bg-sky-50"
                                                              }`}
                                                            >
                                                              {column.blocked ? (
                                                                  <>
                                                                      <span className="absolute inset-0 overflow-hidden pointer-events-none">
                                                                          <span className="absolute left-1/2 top-1/2 h-px w-[145%] -translate-x-1/2 -translate-y-1/2 rotate-[24deg] bg-gray-500" />
                                                                          <span className="absolute left-1/2 top-1/2 h-px w-[145%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] bg-gray-500" />
                                                                      </span>
                                                                  </>
                                                              ) : value > 0 ? (
                                                                  money(value)
                                                              ) : (
                                                                  ""
                                                              )}
                                                            </td>
                                                        );
                                                    }
                                                )}

                                                <td className="border border-gray-300 bg-yellow-50 px-2 py-2">
                                                    {misc
                                                        .map(
                                                            (
                                                                item
                                                            ) =>
                                                                item.description
                                                        )
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            "; "
                                                        )}
                                                </td>

                                                <td className="border border-gray-300 bg-sky-50 px-2 py-2 text-right">
                                                    {miscTotal > 0
                                                        ? money(
                                                              miscTotal
                                                          )
                                                        : ""}
                                                </td>

                                                <td className="border border-gray-400 bg-white px-2 py-2 text-right font-bold text-red-600">
                                                    {dayData?.total >
                                                    0
                                                        ? money(
                                                              dayData.total
                                                          )
                                                        : "0.00"}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    <tr className="font-semibold italic text-red-600">
                                        <td
                                            colSpan={2}
                                            className="sticky left-0 z-10 border border-gray-400 bg-white px-2 py-2"
                                        >
                                            Weekly total =
                                        </td>

                                        {EXPENSE_COLUMNS.map(
                                            (column) => {
                                                const total =
                                                    getWeekColumnTotal(
                                                        week,
                                                        column.key
                                                    );

                                                return (
                                                    <td
                                                        key={
                                                            column.key
                                                        }
                                                        className="border border-gray-400 bg-white px-2 py-2 text-right"
                                                    >
                                                        {money(
                                                            total
                                                        )}
                                                    </td>
                                                );
                                            }
                                        )}

                                        <td className="border border-gray-400 bg-yellow-50" />

                                        <td className="border border-gray-400 bg-white px-2 py-2 text-right">
                                            {money(
                                                getWeekMiscTotal(
                                                    week
                                                )
                                            )}
                                        </td>

                                        <td className="border border-gray-400 bg-white px-2 py-2 text-right font-bold">
                                            {money(
                                                getWeekTotal(week)
                                            )}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>

                        <tfoot>
                            <tr className="font-bold">
                                <td
                                    colSpan={
                                        EXPENSE_COLUMNS.length + 4
                                    }
                                    className="border border-gray-400 bg-gray-100 px-3 py-3 text-right"
                                >
                                    MONTH TOTAL
                                </td>

                                <td className="border border-gray-400 bg-gray-100 px-3 py-3 text-right text-red-600">
                                    ₱ {money(monthTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MngtExpenses;