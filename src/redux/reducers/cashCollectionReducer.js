import { SET_BM_SUMMARY, SET_CASH_COLLECTION, SET_CASH_COLLECTION_BRANCH, SET_CASH_COLLECTION_GROUP, SET_CASH_COLLECTION_LIST, SET_CASH_COLLECTION_LO, SET_GROUP_SUMMARY_TOTALS, SET_LO_SUMMARY } from "../actions/cashCollectionActions";

const initialState = {
    main: [],
    client: [],
    group: [],
    lo: [],
    branch: [],
    groupTotals: {},
    loSummary: {},
    bmSummary: {}
};

const cashCollectionReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_CASH_COLLECTION:
            return { ...state, client: action.payload }
        case SET_CASH_COLLECTION_LIST:
            return { ...state, main: action.payload }
        case SET_CASH_COLLECTION_GROUP:
            return { ...state, group: action.payload }
        case SET_CASH_COLLECTION_LO:
            return { ...state, lo: action.payload }
        case SET_CASH_COLLECTION_BRANCH:
            return { ...state, branch: action.payload }
        case SET_GROUP_SUMMARY_TOTALS: 
            return { ...state, groupTotals: action.payload }
        case SET_LO_SUMMARY: 
            return { ...state, loSummary: action.payload }
        case SET_BM_SUMMARY: 
            return { ...state, bmSummary: action.payload }
        default:
            return { ...state }
    }
};

export default cashCollectionReducer;