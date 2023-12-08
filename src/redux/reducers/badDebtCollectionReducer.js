import { SET_ADD_UPDATE_BADDEBT, SET_BADDEBT, SET_BADDEBT_COLLECTION_LIST, SET_BADDEBT_LIST } from "../actions/badDebtCollectionActions";


const initialState = {
    data: {},
    addUpdate: {},
    list: [],
    collectionList: []
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
        default:
            return { ...state }
    }
};

export default reducer;