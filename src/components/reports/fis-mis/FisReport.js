import React, { useState } from 'react';

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

export default function FisReport() {
    const today = new Date();

    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());

    const [selectedMonth, setSelectedMonth] = useState(month);
    const [selectedYear, setSelectedYear] = useState(year);

    const handleSearch = () => {
        setSelectedMonth(month);
        setSelectedYear(year);
    };

    return (
        <div className="p-4 space-y-4">

            {/* Page Title */}
            <div className="bg-white rounded-lg shadow-sm border p-5">
                <h1 className="text-xl font-bold text-gray-800">
                    FIS & MIS Report
                </h1>

                <p className="text-sm text-gray-500 mt-1">
                    Financial Information Statement
                </p>
            </div>

            {/* Report Tabs */}
            <div className="bg-white rounded-lg shadow-sm border p-3">
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="px-5 py-2 bg-teal-600 text-white rounded-md text-sm font-medium"
                    >
                        FIS
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex flex-wrap items-end gap-4">

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Month
                        </label>

                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="border rounded-md px-3 py-2 text-sm"
                        >
                            {MONTHS.map((name, index) => (
                                <option key={name} value={index + 1}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Year
                        </label>

                        <input
                            type="number"
                            min="2000"
                            max="2100"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="border rounded-md px-3 py-2 text-sm w-28"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleSearch}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-md text-sm"
                    >
                        Search
                    </button>

                </div>
            </div>

            {/* FIS Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">

                <div className="p-4 border-b">
                    <h2 className="font-semibold text-gray-800">
                        Statement of Financial Position
                    </h2>

                    <p className="text-sm text-gray-500">
                        {MONTHS[selectedMonth - 1]} {selectedYear}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">

                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left px-4 py-3">
                                    Account Title
                                </th>

                                <th className="text-right px-4 py-3">
                                    Previous Balance
                                </th>

                                <th className="text-right px-4 py-3">
                                    Debit
                                </th>

                                <th className="text-right px-4 py-3">
                                    Credit
                                </th>

                                <th className="text-right px-4 py-3">
                                    Current Balance
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-center py-12 text-gray-500"
                                >
                                    FIS account details will appear here
                                    once the Excel account structure is configured.
                                </td>
                            </tr>
                        </tbody>

                    </table>
                </div>

            </div>

        </div>
    );
}