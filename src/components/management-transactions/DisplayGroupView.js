import React from 'react';
import { formatPricePhp } from '@/lib/utils';
import moment from 'moment';

const DISPLAY_GROUPS = {
    assets:              'Assets',
    liabilities:         'Liabilities',
    management_expenses: 'Management Expenses',
};

const DisplayGroupView = ({ selectedDisplayGroup, displayGroupData, dateFilter }) => {
    if (!displayGroupData) return null;

    return (
        <div className="p-6 space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h2 className="text-base font-semibold text-purple-800">
                    {DISPLAY_GROUPS[selectedDisplayGroup]} — Transaction Summary
                </h2>
                <p className="text-sm text-purple-600 mt-0.5">
                    Transactions for {moment(dateFilter).format('MMMM D, YYYY')}
                </p>
            </div>

            {displayGroupData.accountTypes && displayGroupData.accountTypes.length > 0 ? (
                displayGroupData.accountTypes.map(typeData => (
                    <div key={typeData.type_code} className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-base font-semibold text-gray-800">{typeData.type_name}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Previous Balance</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Debit</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Credit</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Total Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {typeData.accounts.map(account => (
                                        <tr key={account._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{account.account_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(account.previous_balance)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(account.debit)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(account.credit)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium bg-gray-50">{formatPricePhp(account.total_balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td className="px-6 py-3 text-left text-sm font-bold text-gray-700">Subtotal — {typeData.type_name}</td>
                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">{formatPricePhp(typeData.totals?.previousBalance)}</td>
                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">{formatPricePhp(typeData.totals?.debit)}</td>
                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">{formatPricePhp(typeData.totals?.credit)}</td>
                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-200">{formatPricePhp(typeData.totals?.totalBalance)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    No transactions found for {DISPLAY_GROUPS[selectedDisplayGroup]} on this date.
                </div>
            )}

            {displayGroupData.totals && (
                <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <tbody>
                                <tr>
                                    <td className="px-6 py-2 text-left font-bold text-purple-800">{DISPLAY_GROUPS[selectedDisplayGroup]} Total:</td>
                                    <td className="px-6 py-2 text-right w-40 font-bold text-purple-800">{formatPricePhp(displayGroupData.totals.previousBalance)}</td>
                                    <td className="px-6 py-2 text-right w-40 font-bold text-purple-800">{formatPricePhp(displayGroupData.totals.debit)}</td>
                                    <td className="px-6 py-2 text-right w-40 font-bold text-purple-800">{formatPricePhp(displayGroupData.totals.credit)}</td>
                                    <td className="px-6 py-2 text-right w-40 font-bold text-purple-800">{formatPricePhp(displayGroupData.totals.totalBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DisplayGroupView;