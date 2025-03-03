export const SET_BADDEBT = 'SET_BADDEBT';
export const SET_BADDEBT_LIST = 'SET_BADDEBT_LIST';
export const SET_ADD_UPDATE_BADDEBT = 'SET_ADD_UPDATE_BADDEBT';
export const SET_BADDEBT_COLLECTION_LIST = 'SET_BADDEBT_COLLECTION_LIST';
export const SET_ORIGINAL_BAD_DEBT_LIST = 'SET_ORIGINAL_BAD_DEBT_LIST';
export const SET_ORIGINAL_BAD_DEBT_COLLECTION_LIST = 'SET_ORIGINAL_BAD_DEBT_COLLECTION_LIST';

export const setBadDebt = (data) => ({
    type: SET_BADDEBT,
    payload: data
});

export const setBadDebtList = (list) => ({
    type: SET_BADDEBT_LIST,
    payload: list
});

export const setBadDebtCollectionList = (list) => ({
    type: SET_BADDEBT_COLLECTION_LIST,
    payload: list
});

export const setAddUpdateBadDebt = (data) => ({
    type: SET_ADD_UPDATE_BADDEBT,
    payload: data
});

export const setOriginalBadDebtList = (list) => ({
    type: SET_ORIGINAL_BAD_DEBT_LIST,
    payload: list
});

export const setOriginalBadDebtCollectionList = (list) => ({
    type: SET_ORIGINAL_BAD_DEBT_COLLECTION_LIST,
    payload: list
});