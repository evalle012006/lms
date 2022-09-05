export const SET_NAV_STATE = 'SET_NAV_STATE';
export const SET_CURRENT_PAGE = 'SET_CURRENT_PAGE';
export const SET_CURRENT_PAGE_TITLE = 'SET_CURRENT_PAGE_TITLE';
export const SET_PAGE_LOADING = 'SET_PAGE_LOADING';
export const SET_CURRENT_SUB_MENU = 'SET_CURRENT_SUB_MENU';

export const setNavState = (open) => ({
    type: SET_NAV_STATE,
    payload: open
});

export const setCurrentPage = (page) => ({
    type: SET_CURRENT_PAGE,
    payload: page
});

export const setCurrentPageTitle = (title) => ({
    type: SET_CURRENT_PAGE_TITLE,
    payload: title
});

export const setPageLoading = () => ({
    type: SET_PAGE_LOADING
});

export const setCurrentSubMenu = (title) => ({
    type: SET_CURRENT_SUB_MENU,
    payload: title
});