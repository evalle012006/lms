// src/lib/reports/low-balance-filters.js
// Single definition of the Low Loan Balance filters, imported by BOTH the API and the UI so the two
// can never disagree about operators or defaults.
//
// !! CONFIRM THE DEFAULTS against what the classic page starts with — they were not visible to me.
// The second filter defaults to "payments >= 0" (matches everything) so it can't hide anything by accident.

export const BALANCE_OPERATORS = [
    { label: 'Less than or equal', value: 'less_than_equal' },
    { label: 'Greater than or equal', value: 'greater_than_equal' },
    { label: 'Equal to', value: 'equal' },
];

export const OPERATOR_VALUES = BALANCE_OPERATORS.map(o => o.value);

export const LOW_BALANCE_DEFAULTS = {
    amountOperator: 'less_than_equal',
    amount: 1000,
    noOfPaymentsOperator: 'greater_than_equal',
    noOfPayments: 0,
};