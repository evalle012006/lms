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
            let cashCollection = JSON.parse(JSON.stringify(state));
            cashCollection.client = action.payload;
            return cashCollection;
        case SET_CASH_COLLECTION_LIST:
            let cashCollectionList = JSON.parse(JSON.stringify(state));
            cashCollectionList.main = action.payload;
            return cashCollectionList;
        case SET_CASH_COLLECTION_GROUP:
            let cashCollectionGroup = JSON.parse(JSON.stringify(state));
            cashCollectionGroup.group = action.payload;
            return cashCollectionGroup;
        case SET_CASH_COLLECTION_LO:
            let cashCollectionLo = JSON.parse(JSON.stringify(state));
            cashCollectionLo.lo = action.payload;
            return cashCollectionLo;
        case SET_CASH_COLLECTION_BRANCH:
            let cashCollectionBranch = JSON.parse(JSON.stringify(state));
            cashCollectionBranch.branch = action.payload;
            return cashCollectionBranch;
        case SET_GROUP_SUMMARY_TOTALS: 
            let groupSummaryTotals = JSON.parse(JSON.stringify(state));
            groupSummaryTotals.groupTotals = action.payload;
            return groupSummaryTotals;
        case SET_LO_SUMMARY: 
            let loSummaryTotals = JSON.parse(JSON.stringify(state));
            loSummaryTotals.loSummary = action.payload;
            return loSummaryTotals;
        case SET_BM_SUMMARY: 
            let bmSummaryTotals = JSON.parse(JSON.stringify(state));
            bmSummaryTotals.bmSummary = action.payload;
            return bmSummaryTotals;
        default:
            return { ...state }
    }
};

export default cashCollectionReducer;