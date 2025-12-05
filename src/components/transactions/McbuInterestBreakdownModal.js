import React from 'react';
import Modal from '@/lib/ui/Modal';
import { formatPricePhp } from '@/lib/utils';
import { Info, AlertTriangle } from 'lucide-react';

/**
 * MCBU Interest Breakdown Modal
 * 
 * Displays a table showing the monthly breakdown of MCBU interest calculation
 * 
 * @param {boolean} show - Whether to show the modal
 * @param {function} onClose - Function to call when modal is closed
 * @param {Array} breakdown - Array of monthly breakdown data
 * @param {number} totalInterest - Total calculated interest
 * @param {number} year - The year for which interest was calculated
 * @param {string} clientName - Optional client name to display
 * @param {string} offsetDate - Optional offset date if client had offset transaction
 * @param {number} lackingAmount - Amount added to mcbuCol to round up to nearest 10
 */
const McbuInterestBreakdownModal = ({ 
    show, 
    onClose, 
    breakdown = [], 
    totalInterest = 0, 
    year,
    clientName = '',
    offsetDate = null,
    lackingAmount = 0,
    mcbuInterestRate = 0.0083
}) => {
    return (
        <Modal 
            title={`MCBU Interest Breakdown ${year ? `(${year})` : ''}`}
            show={show} 
            onClose={onClose}
            width="50rem"
        >
            <div className="p-4">
                {clientName && (
                    <div className="mb-4 text-gray-600">
                        <span className="font-semibold">Client:</span> {clientName}
                    </div>
                )}

                {/* Offset Warning */}
                {offsetDate && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-yellow-700">
                            <p className="font-medium">Offset Transaction Detected</p>
                            <p>Client had an offset on <strong>{offsetDate}</strong>. Interest is calculated from records after this date only.</p>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start">
                    <Info className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700">
                        <p className="font-medium">Calculation Formula:</p>
                        <p>Monthly Interest = (MCBU - MCBU Withdrawal) × {mcbuInterestRate || 0.0083}</p>
                        <p className="mt-1 text-xs text-blue-600">
                            Based on the first transaction of each month where MCBU ≥ ₱500
                        </p>
                        <p className="mt-1 text-xs text-blue-600">
                            Final interest is rounded to whole number
                        </p>
                    </div>
                </div>

                {breakdown.length > 0 ? (
                    <>
                        {/* Breakdown Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Month
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            MCBU
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Withdrawal
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Net MCBU
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Interest
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {breakdown.map((item, index) => (
                                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {item.monthName}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {item.dateAdded}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {formatPricePhp(item.mcbu)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {item.mcbuWithdrawal > 0 ? formatPricePhp(item.mcbuWithdrawal) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {formatPricePhp(item.netMcbu)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                                                {formatPricePhp(item.monthlyInterest)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                                            Total MCBU Interest (Rounded):
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-700 text-right">
                                            {formatPricePhp(totalInterest)}
                                        </td>
                                    </tr>
                                    {lackingAmount > 0 && (
                                        <tr className="bg-blue-50">
                                            <td colSpan={5} className="px-4 py-3 text-sm font-medium text-blue-700 text-right">
                                                Added to MCBU Collection (to round to nearest 10):
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700 text-right">
                                                +{formatPricePhp(lackingAmount)}
                                            </td>
                                        </tr>
                                    )}
                                </tfoot>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="mt-4 text-sm text-gray-500 text-right">
                            Calculated from {breakdown.length} month{breakdown.length > 1 ? 's' : ''} with eligible records
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <p>No breakdown data available.</p>
                        <p className="text-sm mt-2">
                            This client may not have any transactions with MCBU ≥ ₱500 for the selected year.
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default McbuInterestBreakdownModal;