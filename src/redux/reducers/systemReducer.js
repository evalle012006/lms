import { SET_HOLIDAY, SET_SYSTEM_SETTINGS, SET_WEEKEND, SET_CURRENT_DATE, SET_LAST_DAY_OF_THE_MONTH, SET_CURRENT_TIME } from "../actions/systemActions";

const initialSystemSettingsState = {
    data: {},
    holiday: false,
    weekend: false,
    currentDate: null,
    currentTime: null,
    lastDay: null
};

const systemSettingsReducer = (state = initialSystemSettingsState, action) => {
    switch (action.type) {
        case SET_SYSTEM_SETTINGS:
            return { ...state, data: action.payload }
        case SET_HOLIDAY:
            return { ...state, holiday: action.payload }
        case SET_WEEKEND:
            return { ...state, weekend: action.payload }
        case SET_CURRENT_DATE:
            return { ...state, currentDate: action.payload }
        case SET_CURRENT_TIME:
            return { ...state, currentTime: action.payload }
        case SET_LAST_DAY_OF_THE_MONTH:
            return { ...state, lastDay: action.payload }
        default:
            return { ...state }
    }
};

export default systemSettingsReducer;