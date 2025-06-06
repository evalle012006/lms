import { SET_ADD_UPDATE_CLIENT, SET_CLIENT, SET_CLIENT_LIST, SET_COMAKER_LIST, SET_TRANSFER_CLIENT_LIST } from "../actions/clientActions";

const initialClientState = {
    data: {},
    addUpdate: {},
    list: [],
    transferList: [],
    comakerList: []
};

const clientReducer = (state = initialClientState, action) => {
    switch (action.type) {
        case SET_CLIENT:
            return { ...state, data: action.payload }
        case SET_CLIENT_LIST:
            return { ...state, list: action.payload }
        case SET_COMAKER_LIST:
            return { ...state, comakerList: action.payload }
        case SET_ADD_UPDATE_CLIENT:
            return { ...state, addUpdate: action.payload }
        case SET_TRANSFER_CLIENT_LIST:
            return { ...state, transferList: action.payload }
        default:
            return { ...state }
    }
};

export default clientReducer;