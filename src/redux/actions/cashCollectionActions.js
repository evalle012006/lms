export const SET_CASH_COLLECTION = 'SET_CASH_COLLECTION';
export const SET_CASH_COLLECTION_LIST = 'SET_CASH_COLLECTION_LIST';
export const SET_CASH_COLLECTION_GROUP = 'SET_CASH_COLLECTION_GROUP';
export const SET_GROUP_SUMMARY_TOTALS = 'SET_GROUP_SUMMARY_TOTALS';
export const SET_LO_SUMMARY = 'SET_LO_SUMMARY';
export const SET_BM_SUMMARY = 'SET_BM_SUMMARY';

export const setCashCollection = (cashCollection) => ({
    type: SET_CASH_COLLECTION,
    payload: cashCollection
});

export const setCashCollectionList = (list) => ({
    type: SET_CASH_COLLECTION_LIST,
    payload: list
});

export const setCashCollectionGroup = (cashCollection) => ({
    type: SET_CASH_COLLECTION_GROUP,
    payload: cashCollection
});

export const setGroupSummaryTotals = (totals) => ({
    type: SET_GROUP_SUMMARY_TOTALS,
    payload: totals
});

export const setLoSummary = (totals) => ({
    type: SET_LO_SUMMARY,
    payload: totals
});

export const setBmSummary = (totals) => ({
    type: SET_BM_SUMMARY,
    payload: totals
});