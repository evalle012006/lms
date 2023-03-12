import { SET_HOLIDAY, SET_SYSTEM_SETTINGS, SET_WEEKEND } from "../actions/systemActions";

const initialSystemSettingsState = {
    data: {},
    holiday: false,
    weekend: false
};

const systemSettingsReducer = (state = initialSystemSettingsState, action) => {
    switch (action.type) {
        case SET_SYSTEM_SETTINGS:
            return { ...state, data: action.payload }
        case SET_HOLIDAY:
            return { ...state, holiday: action.payload }
        case SET_WEEKEND:
            return { ...state, weekend: action.payload }
        default:
            return { ...state }
    }
};

export default systemSettingsReducer;