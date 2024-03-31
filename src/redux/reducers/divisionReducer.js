import { SET_ADD_UPDATE_DIVISION, SET_DIVISION, SET_DIVISION_LIST } from "../actions/divisionActions";

const initialDivisionState = {
    data: {},
    addUpdate: {},
    list: []
};

const divisionReducer = (state = initialDivisionState, action) => {
    switch (action.type) {
        case SET_DIVISION:
            return { ...state, data: action.payload }
        case SET_DIVISION_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_DIVISION:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default divisionReducer;