import React from 'react';
import { formatPricePhp } from '@/lib/utils';

const AggregatedView = ({ aggregatedData, selectedBranches, onBranchClick }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Balance</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {aggregatedData.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                {selectedBranches.length === 0
                                    ? 'Please select at least one branch to view transactions.'
                                    : 'No transactions found for selected branches and date.'}
                            </td>
                        </tr>
                    ) : (
                        aggregatedData.map((item, index) => (
                            <tr
                                key={index}
                                onClick={() => onBranchClick(item)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.branchDisplay}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(item.previousBalance)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(item.debit)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPricePhp(item.credit)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatPricePhp(item.totalBalance)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

export default AggregatedView;