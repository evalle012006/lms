export const SET_TRANSACTION_SETTINGS = 'SET_TRANSACTION_SETTINGS';

export const setTransactionSettings = (settings) => ({
    type: SET_TRANSACTION_SETTINGS,
    payload: settings
});