import React from 'react';
import { formatPricePhp } from '@/lib/utils';
import { buildAccountContext, computeScRow } from './formulaUtils';

// ── Row renderers ─────────────────────────────────────────────────────────────

// Computed (read-only) row — for non-SC accounts that have any formula set.
// Formula results replace the raw entered values in the row display.
const ComputedRow = ({ account, displayValue }) => {
    const { prevBalance, debit, credit, total } = displayValue;
    return (
        <tr className="bg-indigo-50 hover:bg-indigo-100">
            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-indigo-900">
                {account.account_name}
                <span className="ml-2 text-xs font-normal text-indigo-400 italic">computed</span>
            </td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-indigo-800 text-right font-medium">
                {formatPricePhp(prevBalance)}
            </td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-indigo-800 text-right font-medium">
                {formatPricePhp(debit)}
            </td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-indigo-800 text-right font-medium">
                {formatPricePhp(credit)}
            </td>
            <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-indigo-900 text-right bg-indigo-100">
                {formatPricePhp(total)}
            </td>
        </tr>
    );
};

// Editable input row — for standard and SC accounts.
const InputRow = ({
    account,
    newTransactions,
    isEditable,
    isPrevBalDisabled,
    onFieldChange,
    calculateTotalBalance,
    context,
}) => {
    const totalBalance  = calculateTotalBalance(account._id);
    const isPrevBal     = isPrevBalDisabled; // already pre-evaluated to boolean in BranchInputTable
    const debitValue    = parseFloat(newTransactions[account._id]?.debit          || 0);
    const creditValue   = parseFloat(newTransactions[account._id]?.credit         || 0);
    const prevBalValue  = parseFloat(newTransactions[account._id]?.previousBalance || 0);
    const totalBalValue = prevBalValue + debitValue - creditValue;

    const { scPrevBalance, scDebit, scCredit, scBalance, shouldShow } =
        computeScRow(account, debitValue, creditValue, prevBalValue, totalBalValue, context);

    const inputCls = (disabled) =>
        `w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-right ${
            disabled ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
        }`;

    return (
        <React.Fragment>
            <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account.account_name}
                    {account.service_charge && (
                        <span className="text-xs text-amber-600 ml-1">(with S.C.)</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <input
                        type="number" step="0.01" min="0"
                        value={newTransactions[account._id]?.previousBalance || ''}
                        onChange={e => onFieldChange(account._id, 'previousBalance', e.target.value)}
                        onWheel={e => e.target.blur()}
                        placeholder="0.00"
                        disabled={isPrevBal}
                        className={inputCls(isPrevBal)}
                    />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <input
                        type="number" step="0.01" min="0"
                        value={newTransactions[account._id]?.debit || ''}
                        onChange={e => onFieldChange(account._id, 'debit', e.target.value)}
                        onWheel={e => e.target.blur()}
                        placeholder="0.00"
                        disabled={!isEditable}
                        className={inputCls(!isEditable)}
                    />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <input
                        type="number" step="0.01" min="0"
                        value={newTransactions[account._id]?.credit || ''}
                        onChange={e => onFieldChange(account._id, 'credit', e.target.value)}
                        onWheel={e => e.target.blur()}
                        placeholder="0.00"
                        disabled={!isEditable}
                        className={inputCls(!isEditable)}
                    />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium bg-gray-50">
                    {formatPricePhp(totalBalance)}
                </td>
            </tr>

            {/* Virtual "Less: Unearned Service Charges" row — only when service_charge=true */}
            {shouldShow && (
                <tr className="bg-amber-50 hover:bg-amber-100">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 pl-12 font-medium">
                        Less: Unearned Service Charges
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                        <span className="px-3 py-2 inline-block font-medium">{formatPricePhp(scPrevBalance)}</span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                        <span className="px-3 py-2 inline-block font-medium">{formatPricePhp(scDebit)}</span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                        <span className="px-3 py-2 inline-block font-medium">{formatPricePhp(scCredit)}</span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 text-right font-medium bg-amber-100">
                        {formatPricePhp(scBalance)}
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

// ── BranchInputTable ──────────────────────────────────────────────────────────
const BranchInputTable = ({
    accounts,
    newTransactions,
    isEditable,
    onFieldChange,
    calculateTotalBalance,
    isPreviousBalanceDisabled,
}) => {
    // Build context once per render — needed for formula evaluation
    const { context, displayValues } = buildAccountContext(accounts, newTransactions);

    if (accounts.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                No accounts available. Please add accounts in Settings.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Account Name
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                                Previous Balance
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                                Debit
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                                Credit
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-44">
                                Total Balance
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {accounts.map((account) => {
                            // Non-SC accounts with any formula → read-only computed row
                            const isComputedRow = !account.service_charge && displayValues[account._id];

                            if (isComputedRow) {
                                return (
                                    <ComputedRow
                                        key={account._id}
                                        account={account}
                                        displayValue={displayValues[account._id]}
                                    />
                                );
                            }

                            // SC accounts + standard accounts → editable input row
                            return (
                                <InputRow
                                    key={account._id}
                                    account={account}
                                    newTransactions={newTransactions}
                                    isEditable={isEditable}
                                    isPrevBalDisabled={isPreviousBalanceDisabled(account._id)}
                                    onFieldChange={onFieldChange}
                                    calculateTotalBalance={calculateTotalBalance}
                                    context={context}
                                />
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BranchInputTable;