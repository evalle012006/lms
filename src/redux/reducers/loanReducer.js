import { SET_ADD_UPDATE_LOAN, SET_LOAN, SET_LOAN_LIST } from "../actions/loanActions";


const initialLoanState = {
    data: {},
    addUpdate: {},
    list: []
};

const loanReducer = (state = initialLoanState, action) => {
    switch (action.type) {
        case SET_LOAN:
            return { ...state, data: action.payload }
        case SET_LOAN_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_LOAN:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default loanReducer;