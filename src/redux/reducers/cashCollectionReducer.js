import { SET_CASH_COLLECTION, SET_CASH_COLLECTION_GROUP, SET_CASH_COLLECTION_LIST } from "../actions/cashCollectionActions";

const initialState = {
    main: [],
    client: [],
    group: []
};

const cashCollectionReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_CASH_COLLECTION:
            return { ...state, client: action.payload }
        case SET_CASH_COLLECTION_LIST:
            return { ...state, main: action.payload }
        case SET_CASH_COLLECTION_GROUP:
                return { ...state, group: action.payload }
        default:
            return { ...state }
    }
};

export default cashCollectionReducer;