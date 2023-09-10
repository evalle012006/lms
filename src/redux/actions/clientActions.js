export const SET_CLIENT = 'SET_CLIENT';
export const SET_CLIENT_LIST = 'SET_CLIENT_LIST';
export const SET_COMAKER_LIST = 'SET_COMAKER_LIST';
export const SET_ADD_UPDATE_CLIENT = 'SET_ADD_UPDATE_CLIENT';
export const SET_TRANSFER_CLIENT_LIST = 'SET_TRANSFER_CLIENT_LIST';

export const setClient = (client) => ({
    type: SET_CLIENT,
    payload: client
});

export const setClientList = (clientList) => ({
    type: SET_CLIENT_LIST,
    payload: clientList
});

export const setComakerList = (clientList) => ({
    type: SET_COMAKER_LIST,
    payload: clientList
});

export const setAddUpdateBranch = (client) => ({
    type: SET_ADD_UPDATE_CLIENT,
    payload: client
});

export const setTransferClientList = (clientList) => ({
    type: SET_TRANSFER_CLIENT_LIST,
    payload: clientList
});