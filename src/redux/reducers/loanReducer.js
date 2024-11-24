import { SET_ADD_UPDATE_FORECASTED_LOAN, SET_ADD_UPDATE_LOAN, SET_ADD_UPDATE_PENDING_LOAN, SET_ADD_UPDATE_TOMORROW_LOAN, SET_DUPLICATE_LOAN_LIST, SET_FILTERED_FORECASTED_LOAN_LIST, SET_FILTERED_LOAN_LIST, SET_FILTERED_PENDING_LOAN_LIST, SET_FILTERED_TOMORROW_LOAN_LIST, SET_FORECASTED_LOAN, SET_FORECASTED_LOAN_LIST, SET_LOAN, SET_LOAN_LIST, SET_PENDING_LOAN, SET_PENDING_LOAN_LIST, SET_TOMORROW_LOAN, SET_TOMORROW_LOAN_LIST } from "../actions/loanActions";


const initialLoanState = {
    data: {},
    addUpdate: {},
    list: [],
    filteredList: [],
    pendingData: {},
    addUpdatePending: {},
    pendingList: [],
    filteredPendingList: [],
    tomorrowData: {},
    addUpdateTomorrow: {},
    tomorrowList: [],
    filteredTomorrowList: [],
    forecastedData: {},
    addUpdateForecasted: {},
    forecastedList: [],
    filteredForecastedList: [],
    duplicateLoanList: [],
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
        case SET_TOMORROW_LOAN:
            return { ...state, tomorrowData: action.payload }
        case SET_TOMORROW_LOAN_LIST:
            return { ...state, tomorrowList: action.payload }
        case SET_ADD_UPDATE_TOMORROW_LOAN:
            return { ...state, addUpdateTomorrow: action.payload }
        case SET_FILTERED_TOMORROW_LOAN_LIST:
            return { ...state, filteredTomorrowList: action.payload }
        case SET_DUPLICATE_LOAN_LIST:
            return { ...state, duplicateLoanList: action.payload }
        case SET_FORECASTED_LOAN:
            return { ...state, forecastedData: action.payload }
        case SET_FORECASTED_LOAN_LIST:
            return { ...state, forecastedList: action.payload }
        case SET_ADD_UPDATE_FORECASTED_LOAN:
            return { ...state, addUpdateForecasted: action.payload }
        case SET_FILTERED_FORECASTED_LOAN_LIST:
            return { ...state, filteredForecastedList: action.payload }
        default:
            return { ...state }
    }
};

export default loanReducer;