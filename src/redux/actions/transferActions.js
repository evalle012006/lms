export const SET_TRANSFER = 'SET_TRANSFER';
export const SET_TRANSFER_LIST = 'SET_TRANSFER_LIST';
export const SET_ADD_UPDATE_TRANSFER = 'SET_ADD_UPDATE_TRANSFER';
export const SET_TRANSFER_HISTORY_LO_LO = 'SET_TRANSFER_HISTORY_LO_LO';
export const SET_TRANSFER_HISTORY_BRANCH_BRANCH = 'SET_TRANSFER_HISTORY_BRANCH_BRANCH';

export const setTransfer = (transfer) => ({
    type: SET_TRANSFER,
    payload: transfer
});

export const setTransferList = (transferList) => ({
    type: SET_TRANSFER_LIST,
    payload: transferList
});

export const setAddUpdateTransfer = (transfer) => ({
    type: SET_ADD_UPDATE_TRANSFER,
    payload: transfer
});

export const setTransferHistoryLOToLO = (transfer) => ({
    type: SET_TRANSFER_HISTORY_LO_LO,
    payload: transfer
});

export const setTransferHistoryBranchToBranch = (transfer) => ({
    type: SET_TRANSFER_HISTORY_BRANCH_BRANCH,
    payload: transfer
});