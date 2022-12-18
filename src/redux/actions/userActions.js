export const SET_USER = 'SET_USER';
export const SET_USER_LIST = 'SET_USER_LIST';
export const SET_ADD_UPDATE_USER = 'SET_ADD_UPDATE_USER';
export const SET_IS_FILTERING = 'SET_IS_FILTERING';
export const SET_FILTERED_DATA = 'SET_FILTERED_DATA';
export const SET_SELECTED_LO = 'SET_SELECTED_LO';

export const setUser = (user) => ({
    type: SET_USER,
    payload: user
});

export const setUserList = (userList) => ({
    type: SET_USER_LIST,
    payload: userList
});

export const setAddUpdateUser = (user) => ({
    type: SET_ADD_UPDATE_USER,
    payload: user
});

export const setIsFiltering = (filtering) => ({
    type: SET_IS_FILTERING,
    payload: filtering
});

export const setFilteredData = (userList) => ({
    type: SET_FILTERED_DATA,
    payload: userList
});

export const setSelectedLO = (user) => ({
    type: SET_SELECTED_LO,
    payload: user
});