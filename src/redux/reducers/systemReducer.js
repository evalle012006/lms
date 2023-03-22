import { SET_HOLIDAY, SET_SYSTEM_SETTINGS, SET_WEEKEND, SET_CURRENT_DATE } from "../actions/systemActions";

const initialSystemSettingsState = {
    data: {},
    holiday: false,
    weekend: false,
    currentDate: null
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
        default:
            return { ...state }
    }
};

export default systemSettingsReducer;