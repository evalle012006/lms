export const SET_ROLE = 'SET_ROLE';
export const SET_ROLE_LIST = 'SET_ROLE_LIST';
export const SET_ADD_UPDATE_ROLE = 'SET_ADD_UPDATE_ROLE';

export const setRole = (role) => ({
    type: SET_ROLE,
    payload: role
});

export const setRoleList = (roleList) => ({
    type: SET_ROLE_LIST,
    payload: roleList
});

export const setAddUpdateRole = (role) => ({
    type: SET_ADD_UPDATE_ROLE,
    payload: role
});