import React, { useMemo } from "react";
import moment from "moment";

const money = (value) => {
  const n = Number(value || 0);

  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const FundTransfer = ({ branchId, selectedDate }) => {
  const reportDate = moment(
    selectedDate || moment().format("YYYY-MM-DD")
  );

  const monthLabel = reportDate.format("MMMM").toUpperCase();
  const yearLabel = reportDate.format("YYYY");

  // ============================================================
  // TEMPORARY EMPTY DATA
  // We will connect these columns to the database one by one.
  // ============================================================

  const dailyData = {};

  // ============================================================
  // GENERATE MONDAY-FRIDAY ROWS FOR SELECTED MONTH
  // ============================================================

  const weeks = useMemo(() => {
    const start = reportDate.clone().startOf("month");
    const end = reportDate.clone().endOf("month");

    const result = [];
    let currentWeek = [];

    const cursor = start.clone();

    while (cursor.isSameOrBefore(end, "day")) {
      const day = cursor.day();

      // Monday-Friday only
      if (day >= 1 && day <= 5) {
        currentWeek.push(cursor.clone());

        if (day === 5) {
          result.push(currentWeek);
          currentWeek = [];
        }
      }

      cursor.add(1, "day");
    }

    // Last partial week
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [selectedDate]);

  const getDayData = (date) => {
    const key = date.format("YYYY-MM-DD");

    return (
      dailyData[key] || {
        // RECEIPTS
        receiptDescription: "",
        receiptMainOffice: 0,
        receiptCBHB: 0,
        receiptBranches: 0,
        receiptPagibigSSS: 0,
        receiptStaffAccounts: 0,
        receiptRemittances: 0,

        // PAYMENTS
        paymentDescription: "",
        paymentMainOffice: 0,
        paymentClientDeath: 0,
        paymentBranches: 0,
        paymentPagibigSSS: 0,
        paymentStaffAccounts: 0,
      }
    );
  };

  const receiptTotal = (row) =>
    Number(row.receiptMainOffice || 0) +
    Number(row.receiptCBHB || 0) +
    Number(row.receiptBranches || 0) +
    Number(row.receiptPagibigSSS || 0) +
    Number(row.receiptStaffAccounts || 0) +
    Number(row.receiptRemittances || 0);

  const paymentTotal = (row) =>
    Number(row.paymentMainOffice || 0) +
    Number(row.paymentClientDeath || 0) +
    Number(row.paymentBranches || 0) +
    Number(row.paymentPagibigSSS || 0) +
    Number(row.paymentStaffAccounts || 0);

  const getWeekTotals = (week) => {
    const totals = {
      receiptMainOffice: 0,
      receiptCBHB: 0,
      receiptBranches: 0,
      receiptPagibigSSS: 0,
      receiptStaffAccounts: 0,
      receiptRemittances: 0,
      receiptTotal: 0,

      paymentMainOffice: 0,
      paymentClientDeath: 0,
      paymentBranches: 0,
      paymentPagibigSSS: 0,
      paymentStaffAccounts: 0,
      paymentTotal: 0,
    };

    week.forEach((date) => {
      const row = getDayData(date);

      totals.receiptMainOffice += Number(
        row.receiptMainOffice || 0
      );

      totals.receiptCBHB += Number(
        row.receiptCBHB || 0
      );

      totals.receiptBranches += Number(
        row.receiptBranches || 0
      );

      totals.receiptPagibigSSS += Number(
        row.receiptPagibigSSS || 0
      );

      totals.receiptStaffAccounts += Number(
        row.receiptStaffAccounts || 0
      );

      totals.receiptRemittances += Number(
        row.receiptRemittances || 0
      );

      totals.receiptTotal += receiptTotal(row);

      totals.paymentMainOffice += Number(
        row.paymentMainOffice || 0
      );

      totals.paymentClientDeath += Number(
        row.paymentClientDeath || 0
      );

      totals.paymentBranches += Number(
        row.paymentBranches || 0
      );

      totals.paymentPagibigSSS += Number(
        row.paymentPagibigSSS || 0
      );

      totals.paymentStaffAccounts += Number(
        row.paymentStaffAccounts || 0
      );

      totals.paymentTotal += paymentTotal(row);
    });

    return totals;
  };

  const monthlyTotals = useMemo(() => {
    const totals = {
      receiptMainOffice: 0,
      receiptCBHB: 0,
      receiptBranches: 0,
      receiptPagibigSSS: 0,
      receiptStaffAccounts: 0,
      receiptRemittances: 0,
      receiptTotal: 0,

      paymentMainOffice: 0,
      paymentClientDeath: 0,
      paymentBranches: 0,
      paymentPagibigSSS: 0,
      paymentStaffAccounts: 0,
      paymentTotal: 0,
    };

    weeks.flat().forEach((date) => {
      const row = getDayData(date);

      totals.receiptMainOffice += Number(
        row.receiptMainOffice || 0
      );

      totals.receiptCBHB += Number(
        row.receiptCBHB || 0
      );

      totals.receiptBranches += Number(
        row.receiptBranches || 0
      );

      totals.receiptPagibigSSS += Number(
        row.receiptPagibigSSS || 0
      );

      totals.receiptStaffAccounts += Number(
        row.receiptStaffAccounts || 0
      );

      totals.receiptRemittances += Number(
        row.receiptRemittances || 0
      );

      totals.receiptTotal += receiptTotal(row);

      totals.paymentMainOffice += Number(
        row.paymentMainOffice || 0
      );

      totals.paymentClientDeath += Number(
        row.paymentClientDeath || 0
      );

      totals.paymentBranches += Number(
        row.paymentBranches || 0
      );

      totals.paymentPagibigSSS += Number(
        row.paymentPagibigSSS || 0
      );

      totals.paymentStaffAccounts += Number(
        row.paymentStaffAccounts || 0
      );

      totals.paymentTotal += paymentTotal(row);
    });

    return totals;
  }, [weeks]);

  return (
    <div className="ft-report">
      <div className="ft-scroll">
        <div className="ft-sheet">

          {/* ====================================================
              REPORT HEADER
          ==================================================== */}

          <div className="ft-company">
            AmberCash PH Micro Lending Corp
          </div>

          <div className="ft-title">
            Details of Due to HO/Branches
          </div>

          <div className="ft-info-row">
            <div className="ft-info-box">
              <span>Month:</span>
              <strong>{monthLabel}</strong>
            </div>

            <div />

            <div className="ft-info-box ft-year">
              <span>Year:</span>
              <strong>{yearLabel}</strong>
            </div>
          </div>

          {/* ====================================================
              TABLE
          ==================================================== */}

          <table className="ft-table">
            <thead>
              {/* MAIN GROUP */}

              <tr>
                <th
                  rowSpan={3}
                  className="ft-date-header"
                >
                  Date
                </th>

                <th
                  colSpan={8}
                  className="ft-main-group"
                >
                  RECEIPTS / Collections
                </th>

                <th
                  colSpan={7}
                  className="ft-main-group"
                >
                  PAYMENTS / Disbursements
                </th>
              </tr>

              {/* DESCRIPTION / FUND TRANSFER GROUP */}

              <tr>
                <th
                  rowSpan={2}
                  className="ft-description-header"
                >
                  Description
                  <br />
                  <span>OF</span>
                  <br />
                  FT from Giver branch and Control #
                </th>

                <th
                  colSpan={6}
                  className="ft-sub-group"
                >
                  DUE TO ACCOUNT/FUND TRANSFER
                </th>

                <th
                  rowSpan={2}
                  className="ft-total-header"
                >
                  TOTAL
                </th>

                <th
                  rowSpan={2}
                  className="ft-description-header"
                >
                  Description
                  <br />
                  <span>OF</span>
                  <br />
                  FT from Giver branch and Control #
                </th>

                <th
                  colSpan={5}
                  className="ft-sub-group"
                >
                  DUE TO HO/FUND TRANSFER
                </th>

                <th
                  rowSpan={2}
                  className="ft-total-header"
                >
                  TOTAL
                </th>
              </tr>

              {/* COLUMN HEADERS */}

              <tr>
                {/* RECEIPTS */}

                <th>
                  FT from
                  <br />
                  <strong>Main Office</strong>
                </th>

                <th>
                  CBHB ACCOUNTS
                  <br />
                  <strong>(To/From MO)</strong>
                </th>

                <th>
                  FT from
                  <br />
                  <strong>Branches</strong>
                </th>

                <th>
                  (Pag-ibig/SSS
                  <br />
                  Payment)
                </th>

                <th>
                  Staff Accts.
                  <br />
                  Settlement
                </th>

                <th>
                  Remittances
                  <br />
                  (EE & ER,
                  <br />
                  Withheld Tax)
                </th>

                {/* PAYMENTS */}

                <th>
                  FT from
                  <br />
                  <strong>Main Office</strong>
                </th>

                <th>
                  Client Death
                  <br />
                  Benefits
                </th>

                <th>
                  FT from
                  <br />
                  <strong>Branches</strong>
                </th>

                <th>
                  (Pag-ibig/SSS
                  <br />
                  Payment)
                </th>

                <th>
                  Staff Accts.
                  <br />
                  Settlement
                </th>
              </tr>
            </thead>

            <tbody>
              {weeks.map((week, weekIndex) => {
                const totals = getWeekTotals(week);

                return (
                  <React.Fragment key={`week-${weekIndex}`}>
                    {week.map((date) => {
                      const row = getDayData(date);

                      return (
                        <tr key={date.format("YYYY-MM-DD")}>
                          <td className="ft-date">
                            <span className="ft-day">
                              {date.format("ddd")}-
                            </span>

                            <strong>
                              {date.format("D")}
                            </strong>
                          </td>

                          {/* RECEIPTS */}

                          <td className="ft-description">
                            {row.receiptDescription}
                          </td>

                          <td>
                            {row.receiptMainOffice
                              ? money(row.receiptMainOffice)
                              : ""}
                          </td>

                          <td>
                            {money(row.receiptCBHB)}
                          </td>

                          <td>
                            {row.receiptBranches
                              ? money(row.receiptBranches)
                              : ""}
                          </td>

                          <td>
                            {row.receiptPagibigSSS
                              ? money(row.receiptPagibigSSS)
                              : ""}
                          </td>

                          <td>
                            {row.receiptStaffAccounts
                              ? money(row.receiptStaffAccounts)
                              : ""}
                          </td>

                          <td>
                            {money(row.receiptRemittances)}
                          </td>

                          <td className="ft-row-total">
                            {money(receiptTotal(row))}
                          </td>

                          {/* PAYMENTS */}

                          <td className="ft-description">
                            {row.paymentDescription}
                          </td>

                          <td>
                            {row.paymentMainOffice
                              ? money(row.paymentMainOffice)
                              : ""}
                          </td>

                          <td>
                            {row.paymentClientDeath
                              ? money(row.paymentClientDeath)
                              : ""}
                          </td>

                          <td>
                            {row.paymentBranches
                              ? money(row.paymentBranches)
                              : ""}
                          </td>

                          <td>
                            {row.paymentPagibigSSS
                              ? money(row.paymentPagibigSSS)
                              : ""}
                          </td>

                          <td>
                            {row.paymentStaffAccounts
                              ? money(row.paymentStaffAccounts)
                              : ""}
                          </td>

                          <td className="ft-row-total">
                            {money(paymentTotal(row))}
                          </td>
                        </tr>
                      );
                    })}

                    {/* WEEKLY TOTAL */}

                    <tr className="ft-week-total">
                      <td>Weekly total =</td>

                      <td />

                      <td>{money(totals.receiptMainOffice)}</td>
                      <td>{money(totals.receiptCBHB)}</td>
                      <td>{money(totals.receiptBranches)}</td>
                      <td>{money(totals.receiptPagibigSSS)}</td>
                      <td>{money(totals.receiptStaffAccounts)}</td>
                      <td>{money(totals.receiptRemittances)}</td>

                      <td>
                        {money(totals.receiptTotal)}
                      </td>

                      <td />

                      <td>{money(totals.paymentMainOffice)}</td>
                      <td>{money(totals.paymentClientDeath)}</td>
                      <td>{money(totals.paymentBranches)}</td>
                      <td>{money(totals.paymentPagibigSSS)}</td>
                      <td>{money(totals.paymentStaffAccounts)}</td>

                      <td>
                        {money(totals.paymentTotal)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* ==================================================
                  MONTHLY TOTAL
              ================================================== */}

              <tr className="ft-month-total">
                <td>Monthly total =</td>

                <td />

                <td>{money(monthlyTotals.receiptMainOffice)}</td>
                <td>{money(monthlyTotals.receiptCBHB)}</td>
                <td>{money(monthlyTotals.receiptBranches)}</td>
                <td>{money(monthlyTotals.receiptPagibigSSS)}</td>
                <td>{money(monthlyTotals.receiptStaffAccounts)}</td>
                <td>{money(monthlyTotals.receiptRemittances)}</td>

                <td>
                  {money(monthlyTotals.receiptTotal)}
                </td>

                <td />

                <td>{money(monthlyTotals.paymentMainOffice)}</td>
                <td>{money(monthlyTotals.paymentClientDeath)}</td>
                <td>{money(monthlyTotals.paymentBranches)}</td>
                <td>{money(monthlyTotals.paymentPagibigSSS)}</td>
                <td>{money(monthlyTotals.paymentStaffAccounts)}</td>

                <td>
                  {money(monthlyTotals.paymentTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .ft-report {
          width: 100%;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          overflow: hidden;
        }

        .ft-scroll {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;
        }

        .ft-sheet {
          min-width: 1900px;
          padding: 20px;
          font-family: Arial, Helvetica, sans-serif;
          background: white;
        }

        .ft-company {
          text-align: center;
          color: #2563a5;
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .ft-title {
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 12px;
        }

        .ft-info-row {
          display: grid;
          grid-template-columns: 420px 1fr 250px;
          align-items: center;
          margin-bottom: 2px;
        }

        .ft-info-box {
          display: grid;
          grid-template-columns: 90px 1fr;
          border: 1px solid #111;
          min-height: 38px;
        }

        .ft-info-box span {
          display: flex;
          align-items: center;
          padding: 6px;
          font-weight: 700;
        }

        .ft-info-box strong {
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fed7aa;
          padding: 6px;
          font-size: 16px;
        }

        .ft-year {
          grid-template-columns: 80px 1fr;
        }

        .ft-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
          color: #111;
        }

        .ft-table th,
        .ft-table td {
          border: 1px solid #111827;
          padding: 4px;
          text-align: right;
          vertical-align: middle;
          height: 38px;
        }

        .ft-table thead th {
          text-align: center;
          background: #ffffff;
          font-weight: 700;
          line-height: 1.15;
        }

        .ft-main-group {
          font-size: 18px;
          height: 34px !important;
        }

        .ft-sub-group {
          font-size: 12px;
          height: 32px !important;
        }

        .ft-date-header {
          width: 105px;
          font-size: 18px;
        }

        .ft-description-header {
          width: 290px;
          font-size: 13px;
        }

        .ft-description-header span {
          font-size: 14px;
          font-weight: 700;
        }

        .ft-total-header {
          width: 135px;
          font-size: 18px;
        }

        .ft-table tbody td {
          background: #cbeeff;
        }

        .ft-date {
          width: 105px;
          background: #ffffff !important;
          text-align: center !important;
          white-space: nowrap;
        }

        .ft-day {
          font-style: italic;
          margin-right: 8px;
        }

        .ft-description {
          width: 290px;
          background: #fffca3 !important;
          text-align: left !important;
        }

        .ft-row-total {
          background: #ffffff !important;
          font-weight: 700;
        }

        .ft-week-total td {
          background: #ffffff !important;
          color: red;
          font-style: italic;
          font-weight: 700;
          border-top: 2px solid #111;
          border-bottom: 2px solid #111;
        }

        .ft-week-total td:first-child {
          text-align: left;
          white-space: nowrap;
        }

        .ft-month-total td {
          background: #ffffff !important;
          color: red;
          font-weight: 700;
          border-top: 3px double #111;
          border-bottom: 3px double #111;
        }

        .ft-month-total td:first-child {
          text-align: left;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default FundTransfer;