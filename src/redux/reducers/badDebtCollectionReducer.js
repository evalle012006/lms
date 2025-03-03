import { SET_ADD_UPDATE_BADDEBT, SET_BADDEBT, SET_BADDEBT_COLLECTION_LIST, SET_BADDEBT_LIST, SET_ORIGINAL_BAD_DEBT_COLLECTION_LIST, SET_ORIGINAL_BAD_DEBT_LIST } from "../actions/badDebtCollectionActions";


const initialState = {
    data: {},
    addUpdate: {},
    list: [],
    collectionList: [],
    originalList: [],
    originalCollectionList: [],
};

const reducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_BADDEBT:
            return { ...state, data: action.payload }
        case SET_BADDEBT_LIST:
            return { ...state, list: action.payload }
        case SET_BADDEBT_COLLECTION_LIST:
            return { ...state, collectionList: action.payload }
        case SET_ADD_UPDATE_BADDEBT:
            return { ...state, addUpdate: action.payload }
        case SET_ORIGINAL_BAD_DEBT_LIST:
            return {
                ...state,
                originalList: action.payload
            };
        case SET_ORIGINAL_BAD_DEBT_COLLECTION_LIST:
            return {
                ...state,
                originalCollectionList: action.payload
            };
        default:
            return { ...state }
    }
};

export default reducer;