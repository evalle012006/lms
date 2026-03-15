import React from 'react';
import { formatPricePhp } from '@/lib/utils';

const ACCOUNT_GROUPS = {
    other_receipts:      'Other Receipts',
    management_expenses: 'Management Expenses',
    other_payments:      'Other Payments',
};

const GROUP_TAB_ORDER = ['other_receipts', 'management_expenses', 'other_payments'];

const SummaryView = ({
    summaryData,
    allAccountsSummaryData,
    showAllAccounts,
    onToggleShowAll,
    activeTab,
    onTabChange,
}) => {
    const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;

    const tabs = GROUP_TAB_ORDER.filter(g => {
        const d = dataSource[g];
        return d && d.accountTypes && d.accountTypes.length > 0;
    });

    const groupData  = dataSource[activeTab] || { accountTypes: [], totals: {} };
    const tabTotals  = groupData.totals || {};

    return (
        <>
            {/* Tab bar + toggle */}
            <div className="px-6 pt-4 border-b border-gray-200 flex items-center justify-between gap-4">
                <div className="flex gap-1 overflow-x-auto">
                    {tabs.map(g => (
                        <button
                            key={g}
                            onClick={() => onTabChange(g)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                                activeTab === g ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {ACCOUNT_GROUPS[g]}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Show All Accounts</label>
                    <button
                        onClick={onToggleShowAll}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            showAllAccounts ? 'bg-teal-600' : 'bg-gray-300'
                        }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showAllAccounts ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {/* Tab content */}
            <div className="p-6 space-y-6">
                {!groupData.accountTypes || groupData.accountTypes.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                        {showAllAccounts
                            ? `No accounts found for ${ACCOUNT_GROUPS[activeTab]}.`
                            : `No transactions found for ${ACCOUNT_GROUPS[activeTab]}.`}
                    </div>
                ) : (
                    <>
                        {groupData.accountTypes.map(typeData => (
                            <div key={typeData.type_code} className="bg-white rounded-lg shadow-sm border border-gray-200">
                                <div className="p-4 border-b border-gray-200 bg-gray-50">
                                    <h3 className="text-base font-semibold text-gray-800">{typeData.type_name}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {typeData.accounts.map(account => (
                                                <tr
                                                    key={account._id}
                                                    className={account.is_service_charge ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}
                                                >
                                                    <td className={`whitespace-nowrap text-sm ${account.is_service_charge ? 'px-6 py-3 pl-12 text-gray-700 font-medium' : 'px-6 py-4 font-medium text-gray-900'}`}>
                                                        {account.account_name}
                                                        {account.service_charge && !account.is_service_charge && (
                                                            <span className="text-xs text-amber-600 ml-1">(with S.C.)</span>
                                                        )}
                                                    </td>
                                                    <td className={`whitespace-nowrap text-sm text-right font-medium ${account.is_service_charge ? 'px-6 py-3 text-gray-700' : 'px-6 py-4 text-gray-900'}`}>
                                                        {formatPricePhp(account.total_balance)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100">
                                            <tr>
                                                <td className="px-6 py-3 text-left text-sm font-bold text-gray-700">Subtotal — {typeData.type_name}</td>
                                                <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">{formatPricePhp(typeData.totals?.totalBalance)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}

                        <div className="bg-teal-50 rounded-lg border border-teal-200 p-4 flex justify-between items-center px-8">
                            <span className="font-bold text-teal-800">{ACCOUNT_GROUPS[activeTab]} Total:</span>
                            <span className="font-bold text-teal-800 text-lg">{formatPricePhp(tabTotals.totalBalance)}</span>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default SummaryView;