export const SET_MANAGEMENT_COST_ACCOUNTS = 'SET_MANAGEMENT_COST_ACCOUNTS';
export const SET_BRANCH_OVERHEAD_ACCOUNTS = 'SET_BRANCH_OVERHEAD_ACCOUNTS';
export const SET_EQUIPMENT_ASSET_ACCOUNTS = 'SET_EQUIPMENT_ASSET_ACCOUNTS';
export const SET_ADDITIONAL_INCOME_ACCOUNTS = 'SET_ADDITIONAL_INCOME_ACCOUNTS';
export const SET_OTHER_EXPENSE_ACCOUNTS = 'SET_OTHER_EXPENSE_ACCOUNTS';

export const SET_MANAGEMENT_COST_TRANSACTIONS = 'SET_MANAGEMENT_COST_TRANSACTIONS';
export const SET_BRANCH_OVERHEAD_TRANSACTIONS = 'SET_BRANCH_OVERHEAD_TRANSACTIONS';
export const SET_EQUIPMENT_ASSET_TRANSACTIONS = 'SET_EQUIPMENT_ASSET_TRANSACTIONS';
export const SET_ADDITIONAL_INCOME_TRANSACTIONS = 'SET_ADDITIONAL_INCOME_TRANSACTIONS';
export const SET_OTHER_EXPENSE_TRANSACTIONS = 'SET_OTHER_EXPENSE_TRANSACTIONS';

// Account Type Actions
export const setManagementCostAccounts = (data) => ({
    type: SET_MANAGEMENT_COST_ACCOUNTS,
    payload: data
});

export const setBranchOverheadAccounts = (data) => ({
    type: SET_BRANCH_OVERHEAD_ACCOUNTS,
    payload: data
});

export const setEquipmentAssetAccounts = (data) => ({
    type: SET_EQUIPMENT_ASSET_ACCOUNTS,
    payload: data
});

export const setAdditionalIncomeAccounts = (data) => ({
    type: SET_ADDITIONAL_INCOME_ACCOUNTS,
    payload: data
});

export const setOtherExpenseAccounts = (data) => ({
    type: SET_OTHER_EXPENSE_ACCOUNTS,
    payload: data
});

// Transaction Actions
export const setManagementCostTransactions = (data) => ({
    type: SET_MANAGEMENT_COST_TRANSACTIONS,
    payload: data
});

export const setBranchOverheadTransactions = (data) => ({
    type: SET_BRANCH_OVERHEAD_TRANSACTIONS,
    payload: data
});

export const setEquipmentAssetTransactions = (data) => ({
    type: SET_EQUIPMENT_ASSET_TRANSACTIONS,
    payload: data
});

export const setAdditionalIncomeTransactions = (data) => ({
    type: SET_ADDITIONAL_INCOME_TRANSACTIONS,
    payload: data
});

export const setOtherExpenseTransactions = (data) => ({
    type: SET_OTHER_EXPENSE_TRANSACTIONS,
    payload: data
});