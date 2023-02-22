import { SET_TRANSACTION_SETTINGS } from "../actions/transactionsActions";

const initialTransactionSettingsState = {
    data: {}
};

const transactionSettingsReducer = (state = initialTransactionSettingsState, action) => {
    switch (action.type) {
        case SET_TRANSACTION_SETTINGS:
            return { ...state, data: action.payload }
        default:
            return { ...state }
    }
};

export default transactionSettingsReducer;