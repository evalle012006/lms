import { SET_ADD_UPDATE_MCBU_WITHDRAWAL, SET_MCBU_WITHDRAWAL, SET_MCBU_WITHDRAWAL_LIST } from "../actions/mcbuWithdrawalActions";


const initialState = {
    data: {},
    addUpdate: {},
    list: []
};

const mcbuWithdrawalReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_MCBU_WITHDRAWAL:
            return { ...state, data: action.payload }
        case SET_MCBU_WITHDRAWAL_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_MCBU_WITHDRAWAL:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default mcbuWithdrawalReducer;