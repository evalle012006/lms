import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

const CashInBank = ({ branchId, selectedDate }) => {
  const apiBaseUrl = getApiBaseUrl();

  const accountsApiUrl =
    `${apiBaseUrl}transactions/cash-in-bank/accounts`;

  const entriesApiUrl =
    `${apiBaseUrl}transactions/cash-in-bank`;

  const createApiUrl =
    `${apiBaseUrl}transactions/cash-in-bank/create`;

  const openingBalanceApiUrl =
    `${apiBaseUrl}transactions/cash-in-bank/opening-balance`;

  const [loadingBanks, setLoadingBanks] = useState(false);
  const [savingBanks, setSavingBanks] = useState(false);

  const [loadingCashInBank, setLoadingCashInBank] = useState(false);
  const [savingDates, setSavingDates] = useState({});
  const [savingOpeningBalances, setSavingOpeningBalances] =
    useState(false);

  const currentDate = useMemo(
    () => moment(selectedDate || undefined),
    [selectedDate]
  );

  const monthName = currentDate.format("MMMM").toUpperCase();
  const year = currentDate.format("YYYY");

    // ============================================================
    // BANK INFORMATION
    // ============================================================

    const [banks, setBanks] = useState([
        {
            id: 1,
            bankName: "",
            accountNo: "",
        },
        {
            id: 2,
            bankName: "",
            accountNo: "",
        },
        {
            id: 3,
            bankName: "",
            accountNo: "",
        },
    ]);

    const handleBankChange = (index, field, value) => {
        setBanks((prev) =>
            prev.map((bank, i) =>
            i === index
                ? {
                    ...bank,
                    [field]: value,
                }
                : bank
            )
        );
    };

    // ============================================================
    // LOAD BANK INFORMATION
    // ============================================================

    useEffect(() => {
      const loadBankAccounts = async () => {
        if (!branchId) {
          return;
        }

        try {
          setLoadingBanks(true);

          const response = await fetchWrapper.get(
            `${accountsApiUrl}?branch_id=${encodeURIComponent(branchId)}`
          );

          const accounts = Array.isArray(response?.accounts)
            ? response.accounts
            : [];

          setBanks((prev) =>
            prev.map((bank) => {
              const savedBank = accounts.find(
                (item) => Number(item.bank_no) === Number(bank.id)
              );

              if (!savedBank) {
                return {
                  ...bank,
                  bankName: "",
                  accountNo: "",
                };
              }

              return {
                ...bank,
                bankName: savedBank.bank_name || "",
                accountNo: savedBank.account_no || "",
              };
            })
          );
        } catch (error) {
          console.error(
            "LOAD CASH IN BANK ACCOUNTS ERROR:",
            error
          );
        } finally {
          setLoadingBanks(false);
        }
      };

      loadBankAccounts();
    }, [branchId, accountsApiUrl]);

  // ============================================================
  // SAVE BANK INFORMATION
  // ============================================================

  const handleSaveBankInformation = async () => {
    if (!branchId) {
      alert("Please select a branch first.");
      return;
    }

    try {
      setSavingBanks(true);

      await Promise.all(
        banks.map((bank) =>
          fetchWrapper.post(accountsApiUrl, {
            branch_id: branchId,
            bank_no: bank.id,
            bank_name: bank.bankName,
            account_no: bank.accountNo,
          })
        )
      );

      alert("Bank information saved successfully.");
    } catch (error) {
      console.error(
        "SAVE CASH IN BANK ACCOUNTS ERROR:",
        error
      );

      alert(
        error?.message ||
          "Failed to save bank information."
      );
    } finally {
      setSavingBanks(false);
    }
  };

  // ============================================================
  // TEMPORARY DATA
  // Database / transaction connection will be added later.
  // ============================================================

  const [bankData, setBankData] = useState({
    1: {},
    2: {},
    3: {},
  });

  const [savedDates, setSavedDates] = useState({});

  const handleSaveRow = async (date) => {
    if (!branchId) {
      alert("Please select a branch first.");
      return;
    }

    try {
      setSavingDates((prev) => ({
        ...prev,
        [date]: true,
      }));

      await Promise.all(
        banks.map((bank) => {
          const data =
            bankData?.[bank.id]?.[date] || {};

          return fetchWrapper.post(createApiUrl, {
            branch_id: branchId,
            bank_no: bank.id,
            transaction_date: date,
            deposit: Number(data.deposit || 0),
            net_interest: Number(data.interest || 0),
            withdrawal: Number(data.withdrawal || 0),
          });
        })
      );

      setSavedDates((prev) => ({
        ...prev,
        [date]: true,
      }));
    } catch (error) {
      console.error(
        "SAVE CASH IN BANK ROW ERROR:",
        error
      );

      alert(
        error?.message ||
          "Failed to save Cash in Bank entry."
      );
    } finally {
      setSavingDates((prev) => ({
        ...prev,
        [date]: false,
      }));
    }
  };

  const handleEditRow = (date) => {
    setSavedDates((prev) => ({
      ...prev,
      [date]: false,
    }));
  };

  const handleBankDataChange = (bankId, date, field, value) => {
    const cleanValue = String(value).replace(/,/g, "");

    setBankData((prev) => ({
      ...prev,

      [bankId]: {
        ...(prev[bankId] || {}),

        [date]: {
          ...(prev[bankId]?.[date] || {}),
          [field]: cleanValue,
        },
      },
    }));
  };

  const [previousBalances, setPreviousBalances] = useState({
    1: "",
    2: "",
    3: "",
  });

  // ============================================================
  // LOAD PREVIOUS / OPENING BALANCES
  // ============================================================

  useEffect(() => {
    const loadOpeningBalances = async () => {
      if (!branchId) {
        return;
      }

      const balanceMonth = currentDate
        .clone()
        .startOf("month")
        .format("YYYY-MM-DD");

      try {
        const response = await fetchWrapper.get(
          `${openingBalanceApiUrl}` +
            `?branch_id=${encodeURIComponent(branchId)}` +
            `&balance_month=${encodeURIComponent(balanceMonth)}`
        );

        const rows = Array.isArray(response?.openingBalances)
          ? response.openingBalances
          : [];

        const loadedBalances = {
          1: "",
          2: "",
          3: "",
        };

        rows.forEach((row) => {
          const bankNo = Number(row.bank_no);

          if (bankNo >= 1 && bankNo <= 3) {
            loadedBalances[bankNo] =
              row.opening_balance ?? "";
          }
        });

        setPreviousBalances(loadedBalances);
      } catch (error) {
        console.error(
          "LOAD CASH IN BANK OPENING BALANCES ERROR:",
          error
        );
      }
    };

    loadOpeningBalances();
  }, [branchId, selectedDate, openingBalanceApiUrl]);

  // ============================================================
  // LOAD DAILY CASH IN BANK ENTRIES
  // ============================================================

  useEffect(() => {
    const loadCashInBankEntries = async () => {
      if (!branchId) {
        setBankData({
          1: {},
          2: {},
          3: {},
        });

        setSavedDates({});
        return;
      }

      try {
        setLoadingCashInBank(true);

        const month = currentDate.format("YYYY-MM");

        const response = await fetchWrapper.get(
          `${entriesApiUrl}` +
            `?branch_id=${encodeURIComponent(branchId)}` +
            `&month=${encodeURIComponent(month)}`
        );

        const rows = Array.isArray(response?.entries)
          ? response.entries
          : [];

        const loadedBankData = {
          1: {},
          2: {},
          3: {},
        };

        const loadedSavedDates = {};

        rows.forEach((row) => {
          const bankNo = Number(row.bank_no);

          if (bankNo < 1 || bankNo > 3) {
            return;
          }

          const date = moment(
            row.transaction_date
          ).format("YYYY-MM-DD");

          loadedBankData[bankNo][date] = {
            deposit: row.deposit ?? "",
            interest: row.net_interest ?? "",
            withdrawal: row.withdrawal ?? "",
          };

          loadedSavedDates[date] = true;
        });

        setBankData(loadedBankData);
        setSavedDates(loadedSavedDates);
      } catch (error) {
        console.error(
          "LOAD CASH IN BANK ENTRIES ERROR:",
          error
        );
      } finally {
        setLoadingCashInBank(false);
      }
    };

    loadCashInBankEntries();
  }, [branchId, selectedDate, entriesApiUrl]);

  const handlePreviousBalanceChange = (bankId, value) => {
    const cleanValue = String(value).replace(/,/g, "");

    setPreviousBalances((prev) => ({
      ...prev,
      [bankId]: cleanValue,
    }));
  };

  // ============================================================
  // SAVE PREVIOUS / OPENING BALANCES
  // ============================================================

  const handleSaveOpeningBalances = async () => {
    if (!branchId) {
      alert("Please select a branch first.");
      return;
    }

    const balanceMonth = currentDate
      .clone()
      .startOf("month")
      .format("YYYY-MM-DD");

    try {
      setSavingOpeningBalances(true);

      await Promise.all(
        banks.map((bank) =>
          fetchWrapper.post(openingBalanceApiUrl, {
            branch_id: branchId,
            bank_no: bank.id,
            balance_month: balanceMonth,
            opening_balance: Number(
              previousBalances[bank.id] || 0
            ),
          })
        )
      );

      alert("Previous balances saved successfully.");
    } catch (error) {
      console.error(
        "SAVE CASH IN BANK OPENING BALANCES ERROR:",
        error
      );

      alert(
        error?.message ||
          "Failed to save previous balances."
      );
    } finally {
      setSavingOpeningBalances(false);
    }
  };

  // ============================================================
  // CREATE MONDAY-FRIDAY ROWS
  // ============================================================

  const weeks = useMemo(() => {
    const start = currentDate.clone().startOf("month");
    const end = currentDate.clone().endOf("month");

    const result = [];
    let currentWeek = [];

    const cursor = start.clone();

    while (cursor.isSameOrBefore(end, "day")) {
      const dayOfWeek = cursor.day();

      // Monday = 1 through Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        currentWeek.push({
          date: cursor.format("YYYY-MM-DD"),
          day: cursor.format("ddd"),
          dayNumber: cursor.date(),
        });

        if (dayOfWeek === 5) {
          result.push(currentWeek);
          currentWeek = [];
        }
      }

      cursor.add(1, "day");
    }

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [selectedDate]);

  // ============================================================
  // HELPERS
  // ============================================================

  const money = (value, showZero = true) => {
    const num = Number(value || 0);

    if (!showZero && num === 0) {
      return "";
    }

    return num.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const getBankDay = (bankId, date) => {
    return (
      bankData?.[bankId]?.[date] || {
        deposit: 0,
        interest: 0,
        withdrawal: 0,
      }
    );
  };

  const getWeeklyTotals = (bankId, week) => {
    return week.reduce(
      (total, row) => {
        const data = getBankDay(bankId, row.date);

        total.deposit += Number(data.deposit || 0);
        total.interest += Number(data.interest || 0);
        total.withdrawal += Number(data.withdrawal || 0);

        return total;
      },
      {
        deposit: 0,
        interest: 0,
        withdrawal: 0,
      }
    );
  };

  const getConsolidatedDay = (date) => {
    return banks.reduce(
      (total, bank) => {
        const data = getBankDay(bank.id, date);

        total.deposit += Number(data.deposit || 0);
        total.interest += Number(data.interest || 0);
        total.withdrawal += Number(data.withdrawal || 0);

        return total;
      },
      {
        deposit: 0,
        interest: 0,
        withdrawal: 0,
      }
    );
  };

  const consolidatedPreviousBalance = banks.reduce(
    (sum, bank) => sum + Number(previousBalances[bank.id] || 0),
    0
  );

  const getBankBalance = (bankId, date) => {
    let balance = Number(previousBalances[bankId] || 0);

    const allDates = weeks
      .flat()
      .filter((row) => moment(row.date).isSameOrBefore(moment(date), "day"));

    allDates.forEach((row) => {
      const data = getBankDay(bankId, row.date);

      balance += Number(data.deposit || 0);
      balance += Number(data.interest || 0);
      balance -= Number(data.withdrawal || 0);
    });

    return balance;
  };

  const getConsolidatedBalance = (date) => {
    return banks.reduce(
      (total, bank) => total + getBankBalance(bank.id, date),
      0
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="cash-bank-scroll">
      <div className="cash-bank-sheet">

        {/* ======================================================
            TITLE
        ====================================================== */}

        <div className="cash-bank-title-area">
          <div className="company-name">
            AmberCash PH Micro Lending Corp
          </div>

          <div className="report-title">
            DETAILS OF CASH IN BANK
          </div>
        </div>

        {/* ======================================================
            BANK INFORMATION
        ====================================================== */}

        <div className="bank-information-grid">

            {/* BANK 1 */}
            <div className="bank-info first-bank">
                <div className="bank-field">
                <label>Bank Name:</label>

                <input
                    type="text"
                    value={banks[0].bankName}
                    onChange={(e) =>
                    handleBankChange(0, "bankName", e.target.value)
                    }
                    placeholder="Enter bank name"
                />
                </div>

                <div className="bank-field">
                <label>Account No.:</label>

                <input
                    type="text"
                    value={banks[0].accountNo}
                    onChange={(e) =>
                    handleBankChange(0, "accountNo", e.target.value)
                    }
                    placeholder="Enter account no."
                />
                </div>
            </div>


            {/* BANK 2 */}
            <div className="bank-info">
                <div className="bank-field">
                <label>Bank Name:</label>

                <input
                    type="text"
                    value={banks[1].bankName}
                    onChange={(e) =>
                    handleBankChange(1, "bankName", e.target.value)
                    }
                    placeholder="Enter bank name"
                />
                </div>

                <div className="bank-field">
                <label>Account No.:</label>

                <input
                    type="text"
                    value={banks[1].accountNo}
                    onChange={(e) =>
                    handleBankChange(1, "accountNo", e.target.value)
                    }
                    placeholder="Enter account no."
                />
                </div>
            </div>


            {/* BANK 3 */}
            <div className="bank-info">
                <div className="bank-field">
                <label>Bank Name:</label>

                <input
                    type="text"
                    value={banks[2].bankName}
                    onChange={(e) =>
                    handleBankChange(2, "bankName", e.target.value)
                    }
                    placeholder="Enter bank name"
                />
                </div>

                <div className="bank-field">
                <label>Account No.:</label>

                <input
                    type="text"
                    value={banks[2].accountNo}
                    onChange={(e) =>
                    handleBankChange(2, "accountNo", e.target.value)
                    }
                    placeholder="Enter account no."
                />
                </div>
            </div>


            {/* GRAND TOTAL */}
            <div className="grand-info consolidated-info">
                <div className="grand-title">
                GRAND TOTAL
                </div>

                <div className="consolidated-title">
                CONSOLIDATED CASH IN BANK
                </div>
            </div>
        </div>

        <div className="bank-save-row">
            <button
              type="button"
              className="bank-save-btn"
              onClick={handleSaveBankInformation}
              disabled={savingBanks || loadingBanks || !branchId}
            >
              {savingBanks
                ? "Saving..."
                : loadingBanks
                  ? "Loading..."
                  : "Save Bank Information"}
            </button>
        </div>

        {/* ======================================================
            TABLE
        ====================================================== */}

        <table className="cash-bank-table">
          <thead>
            <tr>
              <th className="date-column">
                <div className="date-number">1</div>
                <div>Date</div>
              </th>

              {banks.map((bank) => (
                <React.Fragment key={bank.id}>
                  <th>DEPOSITS</th>

                  <th className="interest-header">
                    Net Interest
                    <br />
                    from
                    <br />
                    Bank
                  </th>

                  <th>WITHDRAWALS</th>
                  <th>BALANCE</th>
                </React.Fragment>
              ))}

              {/* CONSOLIDATED */}
              <th>DEPOSITS</th>

              <th className="interest-header">
                Net Interest
                <br />
                from
                <br />
                Bank
              </th>

              <th>WITHDRAWALS</th>
              <th>BALANCE</th>

              {/* ACTION */}
              <th className="action-header">
                ACTION
              </th>
            </tr>
          </thead>

          <tbody>

            {/* ==================================================
                PREVIOUS BALANCE
            ================================================== */}

            <tr className="previous-row">
              <td>PREVIOUS BALANCE</td>

              {banks.map((bank) => (
                <React.Fragment key={bank.id}>
                  <td colSpan="3"></td>

                  <td className="previous-balance-value">
                    <input
                      type="number"
                      step="0.01"
                      value={previousBalances[bank.id] ?? ""}
                      onChange={(e) =>
                        handlePreviousBalanceChange(
                          bank.id,
                          e.target.value
                        )
                      }
                      className="previous-balance-input"
                    />
                  </td>
                </React.Fragment>
              ))}

              <td colSpan="3"></td>
              <td className="previous-balance-value">
                {money(consolidatedPreviousBalance, false)}
              </td>
              <td className="action-cell">
                <button
                  type="button"
                  className="row-save-btn"
                  onClick={handleSaveOpeningBalances}
                  disabled={
                    savingOpeningBalances ||
                    loadingCashInBank ||
                    !branchId
                  }
                >
                  {savingOpeningBalances ? "Saving..." : "Save"}
                </button>
              </td>
            </tr>

            {/* ==================================================
                WEEKS
            ================================================== */}

            {weeks.map((week, weekIndex) => {
              const weeklyBankTotals = {};

              banks.forEach((bank) => {
                weeklyBankTotals[bank.id] = getWeeklyTotals(
                  bank.id,
                  week
                );
              });

              const consolidatedWeek = week.reduce(
                (total, row) => {
                  const day = getConsolidatedDay(row.date);

                  total.deposit += day.deposit;
                  total.interest += day.interest;
                  total.withdrawal += day.withdrawal;

                  return total;
                },
                {
                  deposit: 0,
                  interest: 0,
                  withdrawal: 0,
                }
              );

              return (
                <React.Fragment key={weekIndex}>

                  {/* DAILY ROWS */}

                  {week.map((row) => {
                    const consolidated = getConsolidatedDay(
                      row.date
                    );

                    return (
                      <tr
                        key={row.date}
                        className="daily-row"
                      >
                        <td className="date-cell">
                          <em>{row.day}-</em>

                          <strong>{row.dayNumber}</strong>
                        </td>

                        {banks.map((bank) => {
                          const data = getBankDay(
                            bank.id,
                            row.date
                          );

                          return (
                            <React.Fragment key={bank.id}>
                              <td className="entry-cell">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={data.deposit || ""}
                                  disabled={!!savedDates[row.date]}
                                  onChange={(e) =>
                                    handleBankDataChange(
                                      bank.id,
                                      row.date,
                                      "deposit",
                                      e.target.value
                                    )
                                  }
                                  className="bank-entry-input"
                                />
                              </td>

                              <td className="entry-cell">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={data.interest || ""}
                                  disabled={!!savedDates[row.date]}
                                  onChange={(e) =>
                                    handleBankDataChange(
                                      bank.id,
                                      row.date,
                                      "interest",
                                      e.target.value
                                    )
                                  }
                                  className="bank-entry-input"
                                />
                              </td>

                              <td className="entry-cell">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={data.withdrawal || ""}
                                  disabled={!!savedDates[row.date]}
                                  onChange={(e) =>
                                    handleBankDataChange(
                                      bank.id,
                                      row.date,
                                      "withdrawal",
                                      e.target.value
                                    )
                                  }
                                  className="bank-entry-input"
                                />
                              </td>

                              <td className="balance-cell">
                                {money(getBankBalance(bank.id, row.date), true)}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* CONSOLIDATED */}

                        <td className="consolidated-cell">
                          {money(
                            consolidated.deposit,
                            true
                          )}
                        </td>

                        <td className="consolidated-cell">
                          {money(
                            consolidated.interest,
                            true
                          )}
                        </td>

                        <td className="consolidated-cell">
                          {money(
                            consolidated.withdrawal,
                            true
                          )}
                        </td>

                        <td className="consolidated-balance">
                          {money(getConsolidatedBalance(row.date), true)}
                        </td>

                        <td className="action-cell">
                          {savedDates[row.date] ? (
                            <button
                              type="button"
                              className="row-edit-btn"
                              onClick={() => handleEditRow(row.date)}
                            >
                              Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="row-save-btn"
                              onClick={() => handleSaveRow(row.date)}
                              disabled={
                                !!savingDates[row.date] ||
                                loadingCashInBank ||
                                !branchId
                              }
                            >
                              {savingDates[row.date] ? "Saving..." : "Save"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* ==================================================
                      WEEKLY TOTAL
                  ================================================== */}

                  <tr className="weekly-total-row">
                    <td>Weekly total</td>

                      {banks.map((bank) => {
                        const total = weeklyBankTotals[bank.id];

                        return (
                          <React.Fragment key={bank.id}>
                            <td>
                              {money(total.deposit, true)}
                            </td>

                            <td>
                              {money(total.interest, true)}
                            </td>

                            <td>
                              {money(total.withdrawal, true)}
                            </td>

                            <td className="weekly-balance-cell">
                              {money(
                                getBankBalance(
                                  bank.id,
                                  week[week.length - 1].date
                                ),
                                true
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      <td>
                        {money(
                          consolidatedWeek.deposit,
                          true
                        )}
                      </td>

                      <td>
                        {money(
                          consolidatedWeek.interest,
                          true
                        )}
                      </td>

                      <td>
                        {money(
                          consolidatedWeek.withdrawal,
                          true
                        )}
                      </td>

                      <td className="weekly-balance-cell">
                        {money(
                          getConsolidatedBalance(
                            week[week.length - 1].date
                          ),
                          true
                        )}
                      </td>

                      <td className="action-cell"></td>
                  </tr>
                </React.Fragment>
              );
            })}

            {/* ==================================================
                MONTHLY TOTAL
            ================================================== */}

            <tr className="monthly-total-row">
              <td>Monthly total</td>

              {banks.map((bank) => {
                const monthlyTotal = weeks
                  .flat()
                  .reduce(
                    (total, row) => {
                      const data = getBankDay(bank.id, row.date);

                      total.deposit += Number(data.deposit || 0);
                      total.interest += Number(data.interest || 0);
                      total.withdrawal += Number(data.withdrawal || 0);

                      return total;
                    },
                    {
                      deposit: 0,
                      interest: 0,
                      withdrawal: 0,
                    }
                  );

                const allMonthRows = weeks.flat();
                const lastRow =
                  allMonthRows.length > 0
                    ? allMonthRows[allMonthRows.length - 1]
                    : null;

                return (
                  <React.Fragment key={bank.id}>
                    <td>{money(monthlyTotal.deposit, true)}</td>

                    <td>{money(monthlyTotal.interest, true)}</td>

                    <td>{money(monthlyTotal.withdrawal, true)}</td>

                    <td className="monthly-balance-cell">
                      {lastRow
                        ? money(
                            getBankBalance(bank.id, lastRow.date),
                            true
                          )
                        : money(previousBalances[bank.id], true)}
                    </td>
                  </React.Fragment>
                );
              })}

              {/* CONSOLIDATED MONTHLY TOTAL */}

              <td>
                {money(
                  weeks.flat().reduce(
                    (sum, row) =>
                      sum + getConsolidatedDay(row.date).deposit,
                    0
                  ),
                  true
                )}
              </td>

              <td>
                {money(
                  weeks.flat().reduce(
                    (sum, row) =>
                      sum + getConsolidatedDay(row.date).interest,
                    0
                  ),
                  true
                )}
              </td>

              <td>
                {money(
                  weeks.flat().reduce(
                    (sum, row) =>
                      sum + getConsolidatedDay(row.date).withdrawal,
                    0
                  ),
                  true
                )}
              </td>

              <td className="monthly-balance-cell">
                {weeks.flat().length > 0
                  ? money(
                      getConsolidatedBalance(
                        weeks.flat()[weeks.flat().length - 1].date
                      ),
                      true
                    )
                  : money(consolidatedPreviousBalance, true)}
              </td>

              <td className="action-cell"></td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* ========================================================
          STYLE
      ======================================================== */}

      <style jsx>{`
        .cash-bank-scroll {
          width: 100%;
          overflow-x: auto;
          padding-bottom: 15px;
        }

        .cash-bank-sheet {
          min-width: 2200px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          padding: 12px;
        }

        .cash-bank-title-area {
          text-align: center;
          margin-bottom: 8px;
        }

        .previous-balance-input {
          width: 100%;
          height: 30px;
          border: none;
          outline: none;
          background: #fffecb;
          text-align: right;
          padding: 3px 5px;
          font-size: 11px;
          font-weight: 700;
          font-style: italic;
          color: #000;
          box-sizing: border-box;
        }

        .previous-balance-input:focus {
          background: #fff7a8;
          outline: 2px solid #0f766e;
          outline-offset: -2px;
        }

        .company-name {
          color: #174d82;
          font-size: 27px;
          font-weight: 500;
        }

        .bank-field {
            display: grid;
            grid-template-columns: 75px 1fr;
            align-items: center;
            margin-bottom: 3px;
            }

            .bank-field label {
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            }

            .bank-field input {
            width: 100%;
            height: 28px;
            padding: 2px 6px;
            border: 1px solid #f3d6d6;
            background: #fde2e2;
            color: #000;
            font-size: 12px;
            font-weight: 600;
            box-sizing: border-box;
            }

            .bank-save-row {
            display: flex;
            justify-content: flex-end;
            margin: 5px 0 8px;
            }

            .bank-save-btn {
            padding: 6px 14px;
            border: 0;
            border-radius: 4px;
            background: #0f766e;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            }

            .bank-save-btn:hover {
            background: #115e59;
            }

        .report-title {
          color: red;
          font-size: 28px;
          font-weight: 800;
          margin-top: 5px;
        }

        .bank-information-grid {
            display: grid;

            /*
                Date = 100px
                Bank 1 = 4 columns
                Bank 2 = 4 columns
                Bank 3 = 4 columns
                Consolidated = 4 columns
            */
            grid-template-columns:
                calc(100px + (100% - 100px) * 4 / 16)
                calc((100% - 100px) * 4 / 16)
                calc((100% - 100px) * 4 / 16)
                calc((100% - 100px) * 4 / 16);

            gap: 0;
            align-items: end;
            margin-bottom: 0;
            }

        .bank-info,
            .grand-info {
            min-height: 95px;
            box-sizing: border-box;
            padding: 0 4px;
            }

            .first-bank {
            padding-left: 0;
            }

        .info-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          align-items: center;
          min-height: 31px;
        }

        .info-row span {
          font-weight: 700;
        }

        .info-row strong {
          background: #fde2e2;
          min-height: 31px;
          padding: 7px;
        }

        .period-row {
          display: grid;
          grid-template-columns:
            70px
            1fr
            60px
            100px;

          align-items: center;
          margin-top: 3px;
        }

        .period-row span {
          background: #bfe1eb;
          padding: 7px;
          text-align: center;
          font-weight: 700;
        }

        .grand-info {
          text-align: left;
        }

        .grand-title {
          color: red;
          text-align: center;
          font-size: 27px;
          font-weight: 900;
        }

        .consolidated-info {
          padding-left: 4px;
          padding-right: 0;
        }

        .consolidated-title {
          text-align: center;
          font-size: 19px;
          font-weight: 800;
          margin-bottom: 2px;
        }

        .cash-bank-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
          color: #000;
        }

          .cash-bank-table th:not(.date-column),
          .cash-bank-table td:not(:first-child) {
          width: calc((100% - 100px) / 16);
        }

        .cash-bank-table th,
        .cash-bank-table td {
          border: 1px solid #111;
          height: 31px;
          padding: 3px 5px;
          white-space: nowrap;
        }

        .cash-bank-table th {
          background: white;
          text-align: center;
          vertical-align: middle;
          font-weight: 500;
        }

        /* CONSOLIDATED CASH IN BANK - HEADER */
        .cash-bank-table th:nth-last-child(-n + 4) {
          background: #d9f0f0;
          font-weight: 700;
          border-color: #0f766e;
        }

        .date-column {
          width: 100px;
          font-weight: 700 !important;
        }

        .date-number {
          font-size: 16px;
          margin-bottom: 5px;
        }

        .interest-header {
          font-style: italic;
          font-weight: 700 !important;
          line-height: 1.1;
        }

        .previous-row td {
          background: white;
          font-style: italic;
          font-weight: 700;
        }

        .previous-row td:first-child {
          text-align: left;
        }

        .previous-balance-value {
          background: #fffecb !important;
          text-align: right;
        }

        .daily-row td {
          text-align: right;
        }

        .date-cell {
          background: white !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left !important;
        }

        .date-cell em {
          font-style: italic;
        }

        .date-cell strong {
          font-weight: 700;
        }

        .entry-cell {
          background: #e5e0ed;
          padding: 0 !important;
        }

        .bank-entry-input {
          width: 100%;
          height: 30px;
          border: none;
          outline: none;
          background: transparent;
          text-align: right;
          padding: 3px 5px;
          font-size: 11px;
          font-weight: 600;
          color: #000;
          box-sizing: border-box;
        }

        .bank-entry-input:focus {
          background: #fffbd1;
          outline: 2px solid #0f766e;
          outline-offset: -2px;
        }

        .balance-cell {
          background: white;
          font-weight: 700;
          font-style: italic;
        }

        .consolidated-cell {
          background: #e8f7f7 !important;
          font-weight: 600;
          border-left-color: #0f766e !important;
          border-right-color: #0f766e !important;
        }

        .consolidated-balance {
          background: #d9f0f0 !important;
          font-weight: 800;
          font-style: italic;
          border-right: 2px solid #0f766e !important;
        }

        /* Strong divider before CONSOLIDATED section */
        .cash-bank-table th:nth-last-child(4),
        .cash-bank-table td:nth-last-child(4) {
          border-left: 3px solid #0f766e !important;
        }

        .previous-row td:last-child {
          background: #ccebea !important;
          color: #0f4f4a;
          font-weight: 900;
          border-right: 2px solid #0f766e !important;
        }

        .weekly-total-row td:nth-last-child(-n + 4) {
          background: #e8f7f7 !important;
          font-weight: 800;
        }

        .weekly-total-row td:nth-last-child(4) {
          border-left: 3px solid #0f766e !important;
        }

        .weekly-total-row td:last-child {
          border-right: 2px solid #0f766e !important;
        }

        .weekly-total-row td {
          background: #fff7cc !important;
          color: red !important;
          font-style: italic;
          font-weight: 800;
          text-align: right;
          border-top: 2px solid #d97706 !important;
          border-bottom: 2px solid #d97706 !important;
        }

        .weekly-total-row td:first-child {
          text-align: left;
          background: #fde68a !important;
          font-weight: 900;
        }

        .weekly-total-row .weekly-balance-cell {
          background: #ffefad !important;
          font-weight: 900;
        }

        .weekly-total-row td:first-child {
          text-align: left;
        }

        .monthly-total-row td {
          background: #dbeafe !important;
          color: #dc2626 !important;
          font-style: italic;
          font-weight: 900;
          text-align: right;
          border-top: 3px double #111 !important;
          border-bottom: 3px double #111 !important;
        }

        .monthly-total-row td:first-child {
          text-align: left;
          background: #bfdbfe !important;
          color: #dc2626 !important;
        }

        .monthly-total-row .monthly-balance-cell {
          background: #bfdbfe !important;
          font-weight: 900;
        }

        .monthly-total-row td:nth-last-child(-n + 5) {
          background: #ccebea !important;
        }

        .monthly-total-row td:nth-last-child(5) {
          border-left: 3px solid #0f766e !important;
        }

        .action-header {
          width: 85px !important;
          min-width: 85px;
          background: #f3f4f6 !important;
          font-weight: 800 !important;
        }

        .action-cell {
          width: 85px !important;
          min-width: 85px;
          background: #ffffff !important;
          text-align: center !important;
          padding: 3px !important;
        }

        .row-save-btn,
        .row-edit-btn {
          width: 60px;
          height: 24px;
          border: none;
          border-radius: 4px;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .row-save-btn {
          background: #0f766e;
        }

        .row-save-btn:hover {
          background: #115e59;
        }

        .row-edit-btn {
          background: #2563eb;
        }

        .row-edit-btn:hover {
          background: #1d4ed8;
        }

        .bank-entry-input:disabled {
          background: #f3f4f6;
          color: #111827;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default CashInBank;