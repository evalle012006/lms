import {
    SET_MANAGEMENT_COST_ACCOUNTS,
    SET_BRANCH_OVERHEAD_ACCOUNTS,
    SET_EQUIPMENT_ASSET_ACCOUNTS,
    SET_ADDITIONAL_INCOME_ACCOUNTS,
    SET_OTHER_EXPENSE_ACCOUNTS,
    SET_MANAGEMENT_COST_TRANSACTIONS,
    SET_BRANCH_OVERHEAD_TRANSACTIONS,
    SET_EQUIPMENT_ASSET_TRANSACTIONS,
    SET_ADDITIONAL_INCOME_TRANSACTIONS,
    SET_OTHER_EXPENSE_TRANSACTIONS
} from '../actions/managementTransactionActions';

const initialState = {
    accounts: {
        managementCost: [],
        branchOverhead: [],
        equipmentAsset: [],
        additionalIncome: [],
        otherExpense: []
    },
    transactions: {
        managementCost: [],
        branchOverhead: [],
        equipmentAsset: [],
        additionalIncome: [],
        otherExpense: []
    }
};

const managementTransactionReducer = (state = initialState, action) => {
    switch (action.type) {
        // Account Types
        case SET_MANAGEMENT_COST_ACCOUNTS:
            return {
                ...state,
                accounts: {
                    ...state.accounts,
                    managementCost: action.payload
                }
            };
        case SET_BRANCH_OVERHEAD_ACCOUNTS:
            return {
                ...state,
                accounts: {
                    ...state.accounts,
                    branchOverhead: action.payload
                }
            };
        case SET_EQUIPMENT_ASSET_ACCOUNTS:
            return {
                ...state,
                accounts: {
                    ...state.accounts,
                    equipmentAsset: action.payload
                }
            };
        case SET_ADDITIONAL_INCOME_ACCOUNTS:
            return {
                ...state,
                accounts: {
                    ...state.accounts,
                    additionalIncome: action.payload
                }
            };
        case SET_OTHER_EXPENSE_ACCOUNTS:
            return {
                ...state,
                accounts: {
                    ...state.accounts,
                    otherExpense: action.payload
                }
            };
        
        // Transactions
        case SET_MANAGEMENT_COST_TRANSACTIONS:
            return {
                ...state,
                transactions: {
                    ...state.transactions,
                    managementCost: action.payload
                }
            };
        case SET_BRANCH_OVERHEAD_TRANSACTIONS:
            return {
                ...state,
                transactions: {
                    ...state.transactions,
                    branchOverhead: action.payload
                }
            };
        case SET_EQUIPMENT_ASSET_TRANSACTIONS:
            return {
                ...state,
                transactions: {
                    ...state.transactions,
                    equipmentAsset: action.payload
                }
            };
        case SET_ADDITIONAL_INCOME_TRANSACTIONS:
            return {
                ...state,
                transactions: {
                    ...state.transactions,
                    additionalIncome: action.payload
                }
            };
        case SET_OTHER_EXPENSE_TRANSACTIONS:
            return {
                ...state,
                transactions: {
                    ...state.transactions,
                    otherExpense: action.payload
                }
            };
        
        default:
            return state;
    }
};

export default managementTransactionReducer;