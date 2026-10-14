import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const money = (value) => {
    const num = Number(value || 0);

    return num.toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
};

const WTaxEEER = ({ branchId, selectedDate }) => {
    const selectedMoment = moment(selectedDate);

    const monthName = selectedMoment.format('MMMM').toUpperCase();
    const year = selectedMoment.format('YYYY');

    // Temporary until database fields are connected.
    const previousBalance = {
        ee: 0,
        er: 0,
        withholdingTax: 0,
    };

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadTransactions = async () => {
            if (!branchId) {
                setTransactions([]);
                return;
            }

            try {
                setLoading(true);

                const params = new URLSearchParams({
                    branch_id: branchId,
                });

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}transactions/dcs?${params.toString()}`
                );

                if (response?.error) {
                    throw new Error(
                        response?.message || 'Failed to load transactions.'
                    );
                }

                const data =
                    response?.transactions ||
                    response?.data ||
                    response?.response ||
                    [];

                setTransactions(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to load WTax EE ER transactions:', error);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };

        loadTransactions();
    }, [branchId]);

    const dailyData = useMemo(() => {
        const result = {};

        transactions.forEach((transaction) => {
            const date = transaction.transaction_date;

            if (!date) return;

            // Only include transactions in the selected month.
            if (
                moment(date).format('YYYY-MM') !==
                selectedMoment.format('YYYY-MM')
            ) {
                return;
            }

            if (!result[date]) {
                result[date] = {
                    ee: 0,
                    er: 0,
                    withholdingTax: 0,
                };
            }

            const items = transaction.dcs_transaction_items || [];

            items.forEach((item) => {
                const category = String(item.category || '')
                    .trim()
                    .toLowerCase();

                const code = String(item.code || '').trim();

                const accountTitle = String(item.account_title || '')
                    .trim()
                    .toLowerCase();

                const amount = Number(item.amount || 0);

                if (
                    category !== 'management expenses' ||
                    code !== '055'
                ) {
                    return;
                }

                // Employee's Contribution (EE)
                if (accountTitle === 'employers contribution (ee)') {
                    result[date].ee += amount;
                }

                // Employer's Contribution (ER)
                if (accountTitle === 'employers contribution (er)') {
                    result[date].er += amount;
                }

                // Withholding Tax
                if (accountTitle === 'witheld tax') {
                    result[date].withholdingTax += amount;
                }
            });
        });

        return result;
    }, [transactions, selectedDate]);

    const rows = useMemo(() => {
        const start = selectedMoment.clone().startOf('month');
        const end = selectedMoment.clone().endOf('month');

        const weeks = [];
        let currentWeek = [];

        const cursor = start.clone();

        while (cursor.isSameOrBefore(end, 'day')) {
            const day = cursor.day();

            // Monday-Friday only
            if (day >= 1 && day <= 5) {
                currentWeek.push({
                    date: cursor.format('YYYY-MM-DD'),
                    dayLabel: cursor.format('ddd') + '-',
                    dayNumber: cursor.date(),
                });

                // Friday closes the week
                if (day === 5) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }

            cursor.add(1, 'day');
        }

        if (currentWeek.length) {
            weeks.push(currentWeek);
        }

        return weeks;
    }, [selectedDate]);

    const getDayData = (date) => {
        return dailyData[date] || {
            ee: 0,
            er: 0,
            withholdingTax: 0,
        };
    };

    const getTotal = (data) =>
        Number(data.ee || 0) +
        Number(data.er || 0) +
        Number(data.withholdingTax || 0);

    const previousTotal = getTotal(previousBalance);

    const monthTotals = rows
        .flat()
        .reduce(
            (total, row) => {
                const data = getDayData(row.date);

                total.ee += Number(data.ee || 0);
                total.er += Number(data.er || 0);
                total.withholdingTax += Number(data.withholdingTax || 0);

                return total;
            },
            {
                ee: 0,
                er: 0,
                withholdingTax: 0,
            }
        );

    return (
        <div className="wtax-wrapper">
            <div className="wtax-sheet">

                <div className="company-title">
                    AmberCash Ph Micro Lending Corp
                </div>

                <div className="report-title">
                    DETAILS OF EE&amp;ER W/TAX
                </div>

                <div className="period-row">
                    <div className="period-box">
                        <span>Month:</span>
                        <strong>{monthName}</strong>
                    </div>

                    <div className="period-box">
                        <span>Year:</span>
                        <strong>{year}</strong>
                    </div>
                </div>

                <table className="wtax-table">
                    <thead>
                        <tr>
                            <th className="day-col">Day</th>
                            <th className="date-col">Date</th>

                            <th>
                                Employee&apos;s
                                <br />
                                Contribution
                                <br />
                                (EE)
                            </th>

                            <th>
                                Employer&apos;s
                                <br />
                                Contribution
                                <br />
                                (ER)
                            </th>

                            <th>
                                Withholding TAX
                            </th>

                            <th className="total-col">
                                TOTAL
                                <br />
                                Balance
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr className="previous-row">
                            <td colSpan="2">PREVIOUS BALANCE</td>

                            <td>{previousBalance.ee ? money(previousBalance.ee) : ''}</td>

                            <td>{previousBalance.er ? money(previousBalance.er) : ''}</td>

                            <td>
                                {previousBalance.withholdingTax
                                    ? money(previousBalance.withholdingTax)
                                    : ''}
                            </td>

                            <td className="total-value">
                                {previousTotal ? money(previousTotal) : ''}
                            </td>
                        </tr>

                        {rows.map((week, weekIndex) => {
                            const weeklyTotals = week.reduce(
                                (total, row) => {
                                    const data = getDayData(row.date);

                                    total.ee += Number(data.ee || 0);
                                    total.er += Number(data.er || 0);
                                    total.withholdingTax += Number(
                                        data.withholdingTax || 0
                                    );

                                    return total;
                                },
                                {
                                    ee: 0,
                                    er: 0,
                                    withholdingTax: 0,
                                }
                            );

                            const weeklyGrandTotal =
                                weeklyTotals.ee +
                                weeklyTotals.er +
                                weeklyTotals.withholdingTax;

                            return (
                                <React.Fragment key={weekIndex}>
                                    {week.map((row) => {
                                        const data = getDayData(row.date);
                                        const total = getTotal(data);

                                        return (
                                            <tr key={row.date}>
                                                <td className="day-cell">
                                                    {row.dayLabel.replace('-', '')}
                                                </td>

                                                <td className="date-cell">
                                                    {row.dayNumber}
                                                </td>

                                                <td>
                                                    {data.ee
                                                        ? money(data.ee)
                                                        : ''}
                                                </td>

                                                <td>
                                                    {data.er
                                                        ? money(data.er)
                                                        : ''}
                                                </td>

                                                <td>
                                                    {data.withholdingTax
                                                        ? money(
                                                              data.withholdingTax
                                                          )
                                                        : ''}
                                                </td>

                                                <td className="total-value">
                                                    {money(total)}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    <tr className="weekly-total">
                                        <td colSpan="2">Weekly total =</td>

                                        <td>{money(weeklyTotals.ee)}</td>

                                        <td>{money(weeklyTotals.er)}</td>

                                        <td>
                                            {money(
                                                weeklyTotals.withholdingTax
                                            )}
                                        </td>

                                        <td>{money(weeklyGrandTotal)}</td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}

                        <tr className="monthly-total">
                            <td colSpan="2">Monthly total =</td>

                            <td>{money(monthTotals.ee)}</td>

                            <td>{money(monthTotals.er)}</td>

                            <td>{money(monthTotals.withholdingTax)}</td>

                            <td>
                                {money(
                                    monthTotals.ee +
                                        monthTotals.er +
                                        monthTotals.withholdingTax
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

          <style jsx>{`
            .wtax-wrapper {
                width: 100%;
                overflow-x: auto;
            }

            .wtax-sheet {
                background: #ffffff;
                min-width: 1000px;
                padding: 0;
            }

            .company-title {
                text-align: center;
                font-size: 18px;
                font-weight: 800;
                color: #174f8a;
                margin-bottom: 2px;
            }

            .report-title {
                text-align: center;
                font-size: 14px;
                font-weight: 700;
                color: red;
                margin-bottom: 12px;
            }

            .period-row {
                display: flex;
                border: 1px solid #9ca3af;
                background: #dceef5;
                margin-bottom: 0;
            }

            .period-box {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 12px;
                font-size: 11px;
            }

            .period-box:first-child {
                border-right: 1px solid #9ca3af;
            }

            .period-box span,
            .period-box strong {
                font-weight: 700;
            }

            .wtax-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-size: 10px;
            }

            .wtax-table th,
            .wtax-table td {
                border: 1px solid #b8c0c8;
                padding: 3px 5px;
                height: 25px;
            }

            .wtax-table th {
                background: #e8f4fa;
                text-align: center;
                vertical-align: middle;
                font-weight: 700;
                line-height: 1.1;
                color: #111827;
            }

            .day-col {
                width: 6%;
            }

            .date-col {
                width: 5%;
            }

            .total-col {
                width: 18%;
                font-size: 11px;
            }

            .day-cell {
                text-align: center !important;
                font-style: italic;
                background: #ffffff !important;
            }

            .date-cell {
                text-align: center !important;
                font-weight: 700;
                background: #ffffff !important;
            }

            .wtax-table tbody td:nth-child(3),
            .wtax-table tbody td:nth-child(4),
            .wtax-table tbody td:nth-child(5) {
                background: #eaf5fb;
                text-align: right;
            }

            .wtax-table tbody td:nth-child(6) {
                text-align: right;
                background: #ffffff;
            }

            .previous-row td {
                background: #ffffff !important;
            }

            .previous-row td:first-child {
                font-weight: 700;
                text-align: left !important;
                white-space: nowrap;
            }

            .total-value {
                color: red;
                font-weight: 700;
            }

            .weekly-total td {
                background: #ffffff !important;
                color: red;
                font-weight: 700;
                font-style: italic;
                text-align: right;
                height: 32px;
            }

            .weekly-total td:first-child {
                text-align: left;
            }

            .monthly-total td {
                background: #ffffff !important;
                color: red;
                font-weight: 800;
                font-style: italic;
                border-top: 2px solid #777;
                text-align: right;
            }

            .monthly-total td:first-child {
                text-align: left;
            }
        `}</style>
        </div>
    );
};

export default WTaxEEER;