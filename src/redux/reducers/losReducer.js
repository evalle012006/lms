import { SET_LOS, SET_LOS_LIST } from "../actions/losActions";


const initialLosState = {
    data: {},
    list: []
};

const losReducer = (state = initialLosState, action) => {
    switch (action.type) {
        case SET_LOS:
            return { ...state, data: action.payload }
        case SET_LOS_LIST:
            return { ...state, list: action.payload }
        default:
            return { ...state }
    }
};

export default losReducer;