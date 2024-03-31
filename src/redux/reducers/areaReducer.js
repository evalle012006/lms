import { SET_ADD_UPDATE_AREA, SET_AREA, SET_AREA_LIST } from "../actions/areaActions";

const initialAreaState = {
    data: {},
    addUpdate: {},
    list: []
};

const areaReducer = (state = initialAreaState, action) => {
    switch (action.type) {
        case SET_AREA:
            return { ...state, data: action.payload }
        case SET_AREA_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_AREA:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default areaReducer;