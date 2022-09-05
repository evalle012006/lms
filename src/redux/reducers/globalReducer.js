import { SET_CURRENT_PAGE, SET_CURRENT_PAGE_TITLE, SET_CURRENT_SUB_MENU, SET_NAV_STATE, SET_PAGE_LOADING } from '../actions/globalActions';

const initialState = {
    loading: false,
    navState: false,
    currentPage: '/',
    title: 'Dashboard',
    subMenu: ''
};

const globalReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_NAV_STATE:
            return { ...state, navState: action.payload }
        case SET_CURRENT_PAGE:
            return { ...state, currentPage: action.payload }
        case SET_CURRENT_PAGE_TITLE:
            return { ...state, title: action.payload }
        case SET_PAGE_LOADING:
            return { ...state, loading: !state.loading }
            case SET_CURRENT_SUB_MENU:
                return { ...state, subMenu: action.payload }
        default:
            return { ...state }
    }
};

export default globalReducer;