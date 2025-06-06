import { SET_ADD_UPDATE_USER, SET_FILTERED_DATA, SET_IS_FILTERING, SET_SELECTED_LO, SET_USER, SET_USER_LIST } from '@/redux/actions/userActions'

const initialUserState = {
    data: {},
    addUpdate: {},
    list: [],
    isFiltering: false,
    filteredData: [],
    selectedLO: {}
};

const userReducer = (state = initialUserState, action) => {
    switch (action.type) {
        case SET_USER:
            return { ...state, data: action.payload }
        case SET_USER_LIST:
            return { ...state, list: action.payload }
        case SET_ADD_UPDATE_USER:
            return { ...state, addUpdate: action.payload }
        case SET_IS_FILTERING:
            return { ...state, isFiltering: action.payload }
        case SET_FILTERED_DATA:
            return { ...state, filteredData: action.payload }
        case SET_SELECTED_LO:
            return { ...state, selectedLO: action.payload }
        default:
            return { ...state }
    }
};

export default userReducer;