export const ItemTypes = {
    ACCOUNT_TYPE: 'accountType',
    ACCOUNT_NAME: 'accountName',
};

export const ACCOUNT_GROUP_OPTIONS = [
    { value: 'other_receipts',      label: 'Other Receipts' },
    { value: 'management_expenses', label: 'Management Expenses' },
    { value: 'other_payments',      label: 'Other Payments' },
];

export const DISPLAY_GROUP_OPTIONS = [
    { value: 'assets',               label: 'Assets' },
    { value: 'liabilities',          label: 'Liabilities' },
    { value: 'management_expenses',  label: 'Management Expenses' },
];

// Own-row variables available in every formula
export const OWN_ROW_VARIABLES = [
    { key: 'debit',         title: "This account's entered debit value" },
    { key: 'credit',        title: "This account's entered credit value" },
    { key: 'prev_balance',  title: "This account's previous balance" },
    { key: 'total_balance', title: "This account's total (prev + debit − credit)" },
];

// Suffixes available when referencing another account
export const ACCOUNT_REF_SUFFIXES = [
    { suffix: 'debit',            label: 'Debit',          sc: false },
    { suffix: 'credit',           label: 'Credit',         sc: false },
    { suffix: 'prev_balance',     label: 'Prev Balance',   sc: false },
    { suffix: 'total_balance',    label: 'Total Balance',  sc: false },
    { suffix: 'sc_debit',         label: 'SC Debit',       sc: true  },
    { suffix: 'sc_credit',        label: 'SC Credit',      sc: true  },
    { suffix: 'sc_prev_balance',  label: 'SC Prev Bal',    sc: true  },
    { suffix: 'sc_total_balance', label: 'SC Total',       sc: true  },
];

export const slugifyName = (name) =>
    (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const getGroupLabels = (groupCodes) => {
    if (!groupCodes?.length) return [];
    return groupCodes.map(code => ACCOUNT_GROUP_OPTIONS.find(g => g.value === code)?.label ?? code);
};