import { SET_ADD_UPDATE_REGION, SET_REGION, SET_REGION_LIST } from "../actions/regionActions";

const initialRegionState = {
    data: {},
    addUpdate: {},
    list: []
};

const regionReducer = (state = initialRegionState, action) => {
    switch (action.type) {
        case SET_REGION:
            return { ...state, data: action.payload }
        case SET_REGION_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_REGION:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default regionReducer;