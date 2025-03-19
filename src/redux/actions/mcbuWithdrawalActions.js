export const SET_MCBU_WITHDRAWAL = 'SET_MCBU_WITHDRAWAL';
export const SET_MCBU_WITHDRAWAL_LIST = 'SET_MCBU_WITHDRAWAL_LIST';
export const SET_ADD_UPDATE_MCBU_WITHDRAWAL = 'SET_ADD_UPDATE_MCBU_WITHDRAWAL';

export const setBranch = (mcbuWithdrawal) => ({
    type: SET_MCBU_WITHDRAWAL,
    payload: mcbuWithdrawal
});

export const setMcbuWithdrawalList = (mcbuWithdrawalList) => ({
    type: SET_MCBU_WITHDRAWAL_LIST,
    payload: mcbuWithdrawalList
});

export const setAddUpdateMcbuWithdrawal = (mcbuWithdrawal) => ({
    type: SET_ADD_UPDATE_MCBU_WITHDRAWAL,
    payload: mcbuWithdrawal
});