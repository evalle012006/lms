import { SET_ADD_UPDATE_HOLIDAY, SET_HOLIDAY, SET_HOLIDAY_LIST } from "../actions/holidayActions";

const initialHolidayState = {
    data: {},
    addUpdate: {},
    list: []
};

const holidayReducer = (state = initialHolidayState, action) => {
    switch (action.type) {
        case SET_HOLIDAY:
            return { ...state, data: action.payload }
        case SET_HOLIDAY_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_HOLIDAY:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default holidayReducer;