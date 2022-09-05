import { SET_ADD_UPDATE_USER, SET_USER, SET_USER_LIST } from '@/redux/actions/userActions'

const initialUserState = {
    data: {},
    addUpdate: {},
    list: []
};

const userReducer = (state = initialUserState, action) => {
    switch (action.type) {
        case SET_USER:
            return { ...state, data: action.payload }
        case SET_USER_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_USER:
            return { ...state, addUpdate: action.payload }
        default:
            return { ...state }
    }
};

export default userReducer;