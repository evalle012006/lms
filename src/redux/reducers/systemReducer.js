import { SET_SYSTEM_SETTINGS } from "../actions/systemActions";

const initialSystemSettingsState = {
    data: {}
};

const systemSettingsReducer = (state = initialSystemSettingsState, action) => {
    switch (action.type) {
        case SET_SYSTEM_SETTINGS:
            return { ...state, data: action.payload }
        default:
            return { ...state }
    }
};

export default systemSettingsReducer;