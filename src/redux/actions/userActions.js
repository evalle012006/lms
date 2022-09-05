export const SET_USER = 'SET_USER';
export const SET_USER_LIST = 'SET_USER_LIST';
export const SET_ADD_UPDATE_USER = 'SET_ADD_UPDATE_USER';

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