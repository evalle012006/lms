// Fund Transfer Action Types
export const SET_FUND_TRANSFER_LIST = 'SET_FUND_TRANSFER_LIST';
export const SET_FUND_TRANSFER_HISTORY_LIST = 'SET_FUND_TRANSFER_HISTORY_LIST';
export const SET_FUND_TRANSFER_LOADING = 'SET_FUND_TRANSFER_LOADING';
export const SET_SELECTED_FUND_TRANSFER = 'SET_SELECTED_FUND_TRANSFER';
export const CLEAR_FUND_TRANSFER_DATA = 'CLEAR_FUND_TRANSFER_DATA';

// Fund Transfer Action Creators
export const setFundTransferList = (list) => ({
    type: SET_FUND_TRANSFER_LIST,
    payload: list
});

export const setFundTransferHistoryList = (list) => ({
    type: SET_FUND_TRANSFER_HISTORY_LIST,
    payload: list
});

export const setFundTransferLoading = (loading) => ({
    type: SET_FUND_TRANSFER_LOADING,
    payload: loading
});

export const setSelectedFundTransfer = (fundTransfer) => ({
    type: SET_SELECTED_FUND_TRANSFER,
    payload: fundTransfer
});

export const clearFundTransferData = () => ({
    type: CLEAR_FUND_TRANSFER_DATA
});