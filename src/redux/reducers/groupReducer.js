import { SET_ADD_UPDATE_GROUP, SET_GROUP, SET_GROUP_LIST } from "../actions/groupActions";

const initialGroupState = {
    data: {},
    addUpdate: {},
    list: []
};

const groupReducer = (state = initialGroupState, action) => {
    switch (action.type) {
        case SET_GROUP:
            return { ...state, data: action.payload }
        case SET_GROUP_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_GROUP:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default groupReducer;