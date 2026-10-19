import React, { useMemo } from "react";
import moment from "moment";

const money = (value) => {
  const num = Number(value || 0);

  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const MIS = ({ branchId, selectedDate }) => {
  const selectedMoment = moment(selectedDate || undefined);

  const monthName = selectedMoment.format("MMMM").toUpperCase();
  const year = selectedMoment.format("YYYY");

  // ============================================================
  // TEMPORARY DATA
  // We will connect every MIS field to transactions one by one.
  // ============================================================

  const previousBalance = {
    newMember: 0,

    // CLIENT'S MCBU
    actualCollection: 0,
    withdrawal: 0,
    interest: 0,
    returnPerson: 0,
    returnAmount: 0,
    mcbuBalancePerson: 0,
    mcbuBalanceAmount: 0,

    // CLIENT SERVICE FEE
    csfActualCollection: 0,
    csfWithdrawal: 0,
    csfRefund: 0,
    csfBalance: 0,

    // LOAN RELEASE
    regularReleasePerson: 0,
    regularPrincipal: 0,
    regularInterest: 0,
    regularTotal: 0,

    otherReleasePerson: 0,
    otherPrincipal: 0,
    otherInterest: 0,
    otherAmount: 0,

    // LOAN COLLECTION
    collectionRegular: 0,
    collectionOther: 0,

    // FULL PAYMENT
    renewalPerson: 0,
    renewalAmount: 0,

    offsetPerson: 0,
    offsetAmount: 0,

    fullPaymentOtherPerson: 0,
    fullPaymentOtherAmount: 0,

    fullPaymentOther2Person: 0,
    fullPaymentOther2Amount: 0,

    // LOAN BALANCE
    regularBalancePerson: 0,
    regularBalanceAmount: 0,

    otherBalancePerson: 0,
    otherBalanceAmount: 0,

    grandTotalPerson: 0,
    grandTotalAmount: 0,
  };

  // ============================================================
  // CREATE MONDAY-FRIDAY ROWS
  // ============================================================

  const weeks = useMemo(() => {
    const start = selectedMoment.clone().startOf("month");
    const end = selectedMoment.clone().endOf("month");

    const result = [];
    let currentWeek = [];
    const cursor = start.clone();

    while (cursor.isSameOrBefore(end, "day")) {
      const day = cursor.day();

      if (day >= 1 && day <= 5) {
        currentWeek.push({
          date: cursor.format("YYYY-MM-DD"),
          day: cursor.format("ddd"),
          dayNumber: cursor.date(),
        });

        if (day === 5) {
          result.push(currentWeek);
          currentWeek = [];
        }
      }

      cursor.add(1, "day");
    }

    if (currentWeek.length) {
      result.push(currentWeek);
    }

    return result;
  }, [selectedDate]);

  const emptyDay = () => ({
    newMember: 0,

    actualCollection: 0,
    withdrawal: 0,
    interest: 0,
    returnPerson: 0,
    returnAmount: 0,
    mcbuBalancePerson: 0,
    mcbuBalanceAmount: 0,

    csfActualCollection: 0,
    csfWithdrawal: 0,
    csfRefund: 0,
    csfBalance: 0,

    regularReleasePerson: 0,
    regularPrincipal: 0,
    regularInterest: 0,
    regularTotal: 0,

    otherReleasePerson: 0,
    otherPrincipal: 0,
    otherInterest: 0,
    otherAmount: 0,

    collectionRegular: 0,
    collectionOther: 0,

    renewalPerson: 0,
    renewalAmount: 0,

    offsetPerson: 0,
    offsetAmount: 0,

    fullPaymentOtherPerson: 0,
    fullPaymentOtherAmount: 0,

    fullPaymentOther2Person: 0,
    fullPaymentOther2Amount: 0,

    regularBalancePerson: 0,
    regularBalanceAmount: 0,

    otherBalancePerson: 0,
    otherBalanceAmount: 0,

    grandTotalPerson: 0,
    grandTotalAmount: 0,
  });

  const dailyData = {};

  const getDayData = (date) => {
    return dailyData[date] || emptyDay();
  };

  const numberCell = (value, showZero = false) => {
    const n = Number(value || 0);

    if (!showZero && n === 0) return "";

    return money(n);
  };

  const sumWeek = (week) => {
    const total = emptyDay();

    week.forEach((row) => {
      const data = getDayData(row.date);

      Object.keys(total).forEach((key) => {
        total[key] += Number(data[key] || 0);
      });
    });

    return total;
  };

  return (
    <div className="mis-wrapper">
      <div className="mis-sheet">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mis-company">
          AmberCash PH Micro Lending Corp
        </div>

        <div className="mis-title">
          MANAGEMENT INFORMATION SYSTEM (MIS)
        </div>

        <div className="mis-period">
          <div>
            <strong>Month:</strong>
            <span>{monthName}</span>
          </div>

          <div>
            <strong>Year:</strong>
            <span>{year}</span>
          </div>
        </div>

        {/* ======================================================
            TABLE
        ====================================================== */}

        <table className="mis-table">
          <thead>

            {/* MAIN GROUP */}
            <tr className="group-row">
              <th rowSpan="4" className="date-main">
                Date
              </th>

              <th rowSpan="4" className="new-member">
                New
                <br />
                member
                <br />
                admi.
              </th>

              <th colSpan="7" className="mcbu-group">
                CLIENT&apos;S MCBU
              </th>

              <th colSpan="4" className="csf-group">
                Client Service Fee (CSF)
              </th>

              <th colSpan="8" className="loan-group">
                LOAN RELEASE (with SC)
              </th>

              <th colSpan="2" className="loan-group">
                LOAN COLLECTION
              </th>

              <th colSpan="8" className="loan-group">
                FULLY PAYMENT
              </th>

              <th colSpan="6" className="loan-group">
                LOAN BALANCE
              </th>
            </tr>

            {/* SECOND HEADER */}
            <tr>
              {/* MCBU */}
              <th rowSpan="3">
                ACTUAL
                <br />
                Collections
              </th>

              <th rowSpan="3">
                WITH-
                <br />
                DRAWAL
              </th>

              <th rowSpan="3">
                Inte
                <br />
                rest
              </th>

              <th colSpan="2">
                Return / Refund
              </th>

              <th colSpan="2">
                MCBU Balance
              </th>

              {/* CSF */}
              <th rowSpan="3">
                Actual
                <br />
                Collection
              </th>

              <th rowSpan="3">
                Withdrawal
              </th>

              <th rowSpan="3">
                Refund
              </th>

              <th rowSpan="3">
                Client Service Fee
                <br />
                (CSF) Balance
              </th>

              {/* LOAN RELEASE */}
              <th colSpan="4">
                REGULAR LOAN-DAILY
              </th>

              <th colSpan="4">
                OTHER LOAN-WEEKLY
              </th>

              {/* LOAN COLLECTION */}
              <th colSpan="2">
                ACTUAL COLLECTION
              </th>

              {/* FULL PAYMENT */}
              <th colSpan="2">
                FULL PAYMENT REGULAR
              </th>

              <th colSpan="2">
                OFFSET
              </th>

              <th colSpan="2">
                FULL PAYMENT OTHER-Weekly
              </th>

              <th colSpan="2">
                OTHER
              </th>

              {/* LOAN BALANCE */}
              <th colSpan="2">
                REGULAR-Daily
              </th>

              <th colSpan="2">
                OTHER-Weekly
              </th>

              <th colSpan="2">
                GRAND TOTAL
              </th>
            </tr>

            {/* THIRD HEADER */}
            <tr>
              {/* MCBU */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">MCBU Amnt.</th>

              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">Amount</th>

              {/* REGULAR RELEASE */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">Principal</th>
              <th rowSpan="2">Interest</th>
              <th rowSpan="2">REGULAR</th>

              {/* OTHER RELEASE */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">Principal</th>
              <th rowSpan="2">Interest</th>
              <th rowSpan="2">OTHER</th>

              {/* COLLECTION */}
              <th rowSpan="2">REGULAR</th>
              <th rowSpan="2">OTHER</th>

              {/* FULL PAYMENT REGULAR */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">RENEWAL</th>

              {/* OFFSET */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">OFFSET</th>

              {/* FULL PAYMENT OTHER */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">OTHER</th>

              {/* SECOND OTHER */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">OTHER</th>

              {/* LOAN BALANCE */}
              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">REGULAR-Daily</th>

              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">OTHER-Weekly</th>

              <th rowSpan="2">Pers.</th>
              <th rowSpan="2">GRAND TOTAL</th>
            </tr>

            <tr />
          </thead>

          <tbody>

            {/* ==================================================
                PREVIOUS BALANCE
            ================================================== */}

            <tr className="previous-row">
              <td>PREVIOUS</td>

              <td>{numberCell(previousBalance.newMember)}</td>

              <td>{numberCell(previousBalance.actualCollection)}</td>
              <td>{numberCell(previousBalance.withdrawal)}</td>
              <td>{numberCell(previousBalance.interest, true)}</td>

              <td>{numberCell(previousBalance.returnPerson)}</td>
              <td>{numberCell(previousBalance.returnAmount)}</td>

              <td>{numberCell(previousBalance.mcbuBalancePerson)}</td>
              <td>{numberCell(previousBalance.mcbuBalanceAmount)}</td>

              <td>{numberCell(previousBalance.csfActualCollection)}</td>
              <td>{numberCell(previousBalance.csfWithdrawal)}</td>
              <td>{numberCell(previousBalance.csfRefund)}</td>
              <td>{numberCell(previousBalance.csfBalance, true)}</td>

              <td>{numberCell(previousBalance.regularReleasePerson)}</td>
              <td>{numberCell(previousBalance.regularPrincipal)}</td>
              <td>{numberCell(previousBalance.regularInterest)}</td>
              <td>{numberCell(previousBalance.regularTotal)}</td>

              <td>{numberCell(previousBalance.otherReleasePerson)}</td>
              <td>{numberCell(previousBalance.otherPrincipal)}</td>
              <td>{numberCell(previousBalance.otherInterest, true)}</td>
              <td>{numberCell(previousBalance.otherAmount, true)}</td>

              <td>{numberCell(previousBalance.collectionRegular)}</td>
              <td>{numberCell(previousBalance.collectionOther)}</td>

              <td>{numberCell(previousBalance.renewalPerson)}</td>
              <td>{numberCell(previousBalance.renewalAmount)}</td>

              <td>{numberCell(previousBalance.offsetPerson)}</td>
              <td>{numberCell(previousBalance.offsetAmount)}</td>

              <td>{numberCell(previousBalance.fullPaymentOtherPerson)}</td>
              <td>{numberCell(previousBalance.fullPaymentOtherAmount)}</td>

              <td>{numberCell(previousBalance.fullPaymentOther2Person)}</td>
              <td>{numberCell(previousBalance.fullPaymentOther2Amount)}</td>

              <td>{numberCell(previousBalance.regularBalancePerson)}</td>
              <td>{numberCell(previousBalance.regularBalanceAmount)}</td>

              <td>{numberCell(previousBalance.otherBalancePerson)}</td>
              <td>{numberCell(previousBalance.otherBalanceAmount)}</td>

              <td>{numberCell(previousBalance.grandTotalPerson)}</td>
              <td>{numberCell(previousBalance.grandTotalAmount)}</td>
            </tr>

            {/* ==================================================
                DAILY + WEEKLY ROWS
            ================================================== */}

            {weeks.map((week, weekIndex) => {
              const weekly = sumWeek(week);

              return (
                <React.Fragment key={weekIndex}>
                  {week.map((row) => {
                    const data = getDayData(row.date);

                    return (
                      <tr key={row.date} className="daily-row">
                        <td className="date-cell">
                          <em>{row.day}-</em>
                          <strong>{row.dayNumber}</strong>
                        </td>

                        <td>{numberCell(data.newMember)}</td>

                        <td>{numberCell(data.actualCollection)}</td>
                        <td>{numberCell(data.withdrawal)}</td>
                        <td>{numberCell(data.interest, true)}</td>

                        <td>{numberCell(data.returnPerson)}</td>
                        <td>{numberCell(data.returnAmount)}</td>

                        <td className="balance-cell">
                          {numberCell(data.mcbuBalancePerson)}
                        </td>

                        <td className="balance-cell">
                          {numberCell(data.mcbuBalanceAmount)}
                        </td>

                        <td>{numberCell(data.csfActualCollection)}</td>
                        <td>{numberCell(data.csfWithdrawal)}</td>
                        <td>{numberCell(data.csfRefund)}</td>

                        <td className="balance-cell">
                          {numberCell(data.csfBalance, true)}
                        </td>

                        <td>{numberCell(data.regularReleasePerson)}</td>
                        <td>{numberCell(data.regularPrincipal)}</td>
                        <td>{numberCell(data.regularInterest, true)}</td>

                        <td className="balance-cell">
                          {numberCell(data.regularTotal, true)}
                        </td>

                        <td>{numberCell(data.otherReleasePerson)}</td>
                        <td>{numberCell(data.otherPrincipal)}</td>
                        <td>{numberCell(data.otherInterest, true)}</td>
                        <td>{numberCell(data.otherAmount, true)}</td>

                        <td>{numberCell(data.collectionRegular)}</td>
                        <td>{numberCell(data.collectionOther)}</td>

                        <td>{numberCell(data.renewalPerson)}</td>
                        <td>{numberCell(data.renewalAmount)}</td>

                        <td>{numberCell(data.offsetPerson)}</td>
                        <td>{numberCell(data.offsetAmount)}</td>

                        <td>{numberCell(data.fullPaymentOtherPerson)}</td>
                        <td>{numberCell(data.fullPaymentOtherAmount)}</td>

                        <td>{numberCell(data.fullPaymentOther2Person)}</td>
                        <td>{numberCell(data.fullPaymentOther2Amount)}</td>

                        <td>{numberCell(data.regularBalancePerson)}</td>

                        <td className="balance-cell">
                          {numberCell(data.regularBalanceAmount)}
                        </td>

                        <td>{numberCell(data.otherBalancePerson)}</td>

                        <td className="balance-cell">
                          {numberCell(data.otherBalanceAmount, true)}
                        </td>

                        <td>{numberCell(data.grandTotalPerson)}</td>

                        <td className="balance-cell">
                          {numberCell(data.grandTotalAmount)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* WEEKLY TOTAL */}
                  <tr className="weekly-row">
                    <td>W. total</td>

                    <td>{numberCell(weekly.newMember, true)}</td>

                    <td>{numberCell(weekly.actualCollection, true)}</td>
                    <td>{numberCell(weekly.withdrawal, true)}</td>
                    <td>{numberCell(weekly.interest, true)}</td>

                    <td>{numberCell(weekly.returnPerson, true)}</td>
                    <td>{numberCell(weekly.returnAmount, true)}</td>

                    <td>{numberCell(weekly.mcbuBalancePerson, true)}</td>
                    <td>{numberCell(weekly.mcbuBalanceAmount, true)}</td>

                    <td>{numberCell(weekly.csfActualCollection, true)}</td>
                    <td>{numberCell(weekly.csfWithdrawal, true)}</td>
                    <td>{numberCell(weekly.csfRefund, true)}</td>
                    <td>{numberCell(weekly.csfBalance, true)}</td>

                    <td>{numberCell(weekly.regularReleasePerson, true)}</td>
                    <td>{numberCell(weekly.regularPrincipal, true)}</td>
                    <td>{numberCell(weekly.regularInterest, true)}</td>
                    <td>{numberCell(weekly.regularTotal, true)}</td>

                    <td>{numberCell(weekly.otherReleasePerson, true)}</td>
                    <td>{numberCell(weekly.otherPrincipal, true)}</td>
                    <td>{numberCell(weekly.otherInterest, true)}</td>
                    <td>{numberCell(weekly.otherAmount, true)}</td>

                    <td>{numberCell(weekly.collectionRegular, true)}</td>
                    <td>{numberCell(weekly.collectionOther, true)}</td>

                    <td>{numberCell(weekly.renewalPerson, true)}</td>
                    <td>{numberCell(weekly.renewalAmount, true)}</td>

                    <td>{numberCell(weekly.offsetPerson, true)}</td>
                    <td>{numberCell(weekly.offsetAmount, true)}</td>

                    <td>{numberCell(weekly.fullPaymentOtherPerson, true)}</td>
                    <td>{numberCell(weekly.fullPaymentOtherAmount, true)}</td>

                    <td>{numberCell(weekly.fullPaymentOther2Person, true)}</td>
                    <td>{numberCell(weekly.fullPaymentOther2Amount, true)}</td>

                    <td>{numberCell(weekly.regularBalancePerson, true)}</td>
                    <td>{numberCell(weekly.regularBalanceAmount, true)}</td>

                    <td>{numberCell(weekly.otherBalancePerson, true)}</td>
                    <td>{numberCell(weekly.otherBalanceAmount, true)}</td>

                    <td>{numberCell(weekly.grandTotalPerson, true)}</td>
                    <td>{numberCell(weekly.grandTotalAmount, true)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .mis-wrapper {
          width: 100%;
          overflow-x: auto;
          padding-bottom: 12px;
        }

        .mis-sheet {
          background: white;
          min-width: 2900px;
          border: 1px solid #d1d5db;
          padding: 12px;
        }

        .mis-company {
          text-align: center;
          color: #315f92;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
        }

        .mis-title {
          text-align: center;
          color: red;
          font-size: 25px;
          font-weight: 500;
          margin: 4px 0 12px;
        }

        .mis-period {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
          margin-bottom: 2px;
        }

        .mis-period > div {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mis-period span {
          min-width: 120px;
          background: #ffd8b5;
          padding: 4px 15px;
          text-align: center;
          font-weight: 700;
        }

        .mis-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 10px;
          color: #000;
        }

        .mis-table th,
        .mis-table td {
          border: 1px solid #111;
          padding: 2px 4px;
          height: 25px;
          white-space: nowrap;
        }

        .mis-table th {
          text-align: center;
          vertical-align: middle;
          font-weight: 700;
          background: #fff;
          line-height: 1.05;
        }

        .group-row th {
          color: red;
          font-size: 13px;
        }

        .group-row .date-main {
          color: #000;
        }

        .new-member {
          color: red !important;
        }

        .mcbu-group,
        .csf-group,
        .loan-group {
          color: red !important;
        }

        .date-main {
          width: 75px;
        }

        .new-member {
          width: 62px;
        }

        .daily-row td {
          text-align: right;
        }

        .date-cell {
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left !important;
          background: white !important;
        }

        .date-cell em {
          font-style: italic;
        }

        .date-cell strong {
          font-weight: 700;
        }

        /*
         * MCBU + CSF daily input area
         */
        .daily-row td:nth-child(n + 2):nth-child(-n + 13) {
          background: #caffcf;
        }

        /*
         * Loan sections
         */
        .daily-row td:nth-child(n + 14):nth-child(-n + 37) {
          background: #e7e2ed;
        }

        /*
         * Balance/result columns stay white,
         * similar to the Excel MIS.
         */
        .daily-row .balance-cell {
          background: #fff !important;
          font-weight: 700;
        }

        .previous-row {
          background: #fffde0;
          color: red;
          font-weight: 700;
        }

        .previous-row td:first-child {
          color: #000;
          font-style: italic;
        }

        .previous-row td {
          text-align: right;
        }

        .weekly-row td {
          background: #fff !important;
          color: red;
          font-weight: 700;
          font-style: italic;
          text-align: right;
          border-top: 2px solid #111;
        }

        .weekly-row td:first-child {
          text-align: left;
        }
      `}</style>
    </div>
  );
};

export default MIS;