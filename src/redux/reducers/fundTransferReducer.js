import {
    SET_FUND_TRANSFER_LIST,
    SET_FUND_TRANSFER_HISTORY_LIST,
    SET_FUND_TRANSFER_LOADING,
    SET_SELECTED_FUND_TRANSFER,
    CLEAR_FUND_TRANSFER_DATA
} from '../actions/fundTransferActions';

const initialState = {
    list: [],
    historyList: [],
    selectedFundTransfer: null,
    loading: false
};

const fundTransferReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_FUND_TRANSFER_LIST:
            return {
                ...state,
                list: action.payload
            };
        
        case SET_FUND_TRANSFER_HISTORY_LIST:
            return {
                ...state,
                historyList: action.payload
            };
        
        case SET_FUND_TRANSFER_LOADING:
            return {
                ...state,
                loading: action.payload
            };
        
        case SET_SELECTED_FUND_TRANSFER:
            return {
                ...state,
                selectedFundTransfer: action.payload
            };
        
        case CLEAR_FUND_TRANSFER_DATA:
            return {
                ...initialState
            };
        
        default:
            return state;
    }
};

export default fundTransferReducer;