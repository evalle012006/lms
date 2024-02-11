import { SET_ADD_UPDATE_LOAN, SET_ADD_UPDATE_PENDING_LOAN, SET_FILTERED_LOAN_LIST, SET_FILTERED_PENDING_LOAN_LIST, SET_LOAN, SET_LOAN_LIST, SET_PENDING_LOAN, SET_PENDING_LOAN_LIST } from "../actions/loanActions";


const initialLoanState = {
    data: {},
    addUpdate: {},
    list: [],
    filteredList: [],
    pendingData: {},
    addUpdatePending: {},
    pendingList: [],
    filteredPendingList: [],
};

const loanReducer = (state = initialLoanState, action) => {
    switch (action.type) {
        case SET_LOAN:
            return { ...state, data: action.payload }
        case SET_LOAN_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_LOAN:
            return { ...state, addUpdate: action.payload }
        case SET_FILTERED_LOAN_LIST:
            return { ...state, filteredList: action.payload }
        case SET_PENDING_LOAN:
            return { ...state, pendingData: action.payload }
        case SET_PENDING_LOAN_LIST:
            return { ...state, pendingList: action.payload }
        case SET_ADD_UPDATE_PENDING_LOAN:
            return { ...state, addUpdatePending: action.payload }
        case SET_FILTERED_PENDING_LOAN_LIST:
            return { ...state, filteredPendingList: action.payload }
        default:
            return { ...state }
    }
};

export default loanReducer;