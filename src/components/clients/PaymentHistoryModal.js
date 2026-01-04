import React, { useState, useEffect } from 'react';
import { XMarkIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { formatPricePhp } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/constants';
import Spinner from '@/components/Spinner';
import moment from 'moment';

const PaymentHistoryModal = ({ show, onClose, loan }) => {
    const [loading, setLoading] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);

    useEffect(() => {
        if (show && loan?._id) {
            fetchPaymentHistory();
        }
    }, [show, loan]);

    const fetchPaymentHistory = async () => {
        setLoading(true);
        try {
            const response = await fetchWrapper.get(
                `${getApiBaseUrl()}transactions/cash-collections/get-payment-history?loanId=${loan._id}`
            );
            if (response.success) {
                setPaymentHistory(response.data || []);
            } else {
                console.error('Failed to fetch payment history:', response.message);
                setPaymentHistory([]);
            }
        } catch (error) {
            console.error('Error fetching payment history:', error);
            setPaymentHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const getRemarksDisplay = (remarks) => {
        if (!remarks) return '-';
        if (typeof remarks === 'object' && remarks.label) {
            return remarks.label;
        }
        if (typeof remarks === 'string') {
            return remarks;
        }
        return '-';
    };

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'closed':
                return 'bg-red-100 text-red-800';
            case 'active':
                return 'bg-blue-100 text-blue-800';
            case 'tomorrow':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div 
                    className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
                    onClick={onClose}
                ></div>

                {/* Modal panel */}
                <div className="inline-block w-full max-w-6xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                        <div className="flex items-center">
                            <BanknotesIcon className="w-6 h-6 text-primary-600 mr-2" />
                            <h3 className="text-lg font-semibold text-gray-900">
                                Payment History
                            </h3>
                        </div>
                        <button
                            type="button"
                            className="text-gray-400 hover:text-gray-500 focus:outline-none"
                            onClick={onClose}
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Loan Info Summary */}
                    {loan && (
                        <div className="mt-4 mb-4 p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Loan Cycle:</span>
                                    <span className="ml-2 font-medium">{loan.loanCycle || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Amount Released:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(loan.amountRelease || 0)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Loan Balance:</span>
                                    <span className="ml-2 font-medium">{formatPricePhp(loan.loanBalance || 0)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Status:</span>
                                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(loan.status)}`}>
                                        {loan.status || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment History Table */}
                    <div className="mt-4 overflow-x-auto max-h-96">
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <Spinner />
                            </div>
                        ) : paymentHistory.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            # of Payments
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            MCBU
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            MCBU Collection
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Target Collection
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actual Collection
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Excess
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Loan Balance
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Past Due
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Remarks
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paymentHistory.map((payment, index) => (
                                        <tr 
                                            key={payment._id || index} 
                                            className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                {payment.dateAdded ? moment(payment.dateAdded).format('MMM DD, YYYY') : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                                                {payment.noOfPayments || 0} / {payment.loanTerms || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {payment.mcbu > 0 ? formatPricePhp(payment.mcbu) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {payment.mcbuCol > 0 ? formatPricePhp(payment.mcbuCol) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {payment.targetCollection > 0 ? formatPricePhp(payment.targetCollection) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                {payment.paymentCollection > 0 ? formatPricePhp(payment.paymentCollection) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {payment.excess > 0 ? formatPricePhp(payment.excess) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                                                {payment.loanBalance > 0 ? formatPricePhp(payment.loanBalance) : '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                {payment.pastDue > 0 ? (
                                                    <span className="text-red-600 font-medium">{formatPricePhp(payment.pastDue)}</span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(payment.status)}`}>
                                                    {payment.status || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                {getRemarksDisplay(payment.remarks)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-12">
                                <BanknotesIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No payment history</h3>
                                <p className="text-gray-500">No cash collections found for this loan.</p>
                            </div>
                        )}
                    </div>

                    {/* Summary Section */}
                    {paymentHistory.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <span className="text-blue-600 text-xs uppercase font-medium">Total Collections</span>
                                    <p className="text-lg font-semibold text-blue-900">
                                        {formatPricePhp(paymentHistory.reduce((sum, p) => sum + (p.paymentCollection || 0), 0))}
                                    </p>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <span className="text-green-600 text-xs uppercase font-medium">Total MCBU Collection</span>
                                    <p className="text-lg font-semibold text-green-900">
                                        {formatPricePhp(paymentHistory.reduce((sum, p) => sum + (p.mcbuCol || 0), 0))}
                                    </p>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg">
                                    <span className="text-purple-600 text-xs uppercase font-medium">Total Excess</span>
                                    <p className="text-lg font-semibold text-purple-900">
                                        {formatPricePhp(paymentHistory.reduce((sum, p) => sum + (p.excess || 0), 0))}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <span className="text-gray-600 text-xs uppercase font-medium">Payment Count</span>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {paymentHistory.length} payment(s)
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistoryModal;