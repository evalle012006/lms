import { SET_ADD_UPDATE_ROLE, SET_ROLE, SET_ROLE_LIST } from "../actions/roleActions";


const initialRoleState = {
    data: {},
    addUpdate: {},
    list: []
};

const roleReducer = (state = initialRoleState, action) => {
    switch (action.type) {
        case SET_ROLE:
            return { ...state, data: action.payload }
        case SET_ROLE_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_ROLE:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default roleReducer;