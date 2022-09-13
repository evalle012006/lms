import { SET_ADD_UPDATE_CLIENT, SET_CLIENT, SET_CLIENT_LIST } from "../actions/clientActions";

const initialClientState = {
    data: {},
    addUpdate: {},
    list: []
};

const clientReducer = (state = initialClientState, action) => {
    switch (action.type) {
        case SET_CLIENT:
            return { ...state, data: action.payload }
        case SET_CLIENT_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_CLIENT:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default clientReducer;