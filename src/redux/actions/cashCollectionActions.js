export const SET_CASH_COLLECTION = 'SET_CASH_COLLECTION';
export const SET_CASH_COLLECTION_LIST = 'SET_CASH_COLLECTION_LIST';
export const SET_CASH_COLLECTION_GROUP = 'SET_CASH_COLLECTION_GROUP';

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