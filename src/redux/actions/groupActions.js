export const SET_GROUP = 'SET_GROUP';
export const SET_GROUP_LIST = 'SET_GROUP_LIST';
export const SET_ADD_UPDATE_GROUP = 'SET_ADD_UPDATE_GROUP';

export const setGroup = (group) => ({
    type: SET_GROUP,
    payload: group
});

export const setGroupList = (groupList) => ({
    type: SET_GROUP_LIST,
    payload: groupList
});

export const setAddUpdateBranch = (group) => ({
    type: SET_ADD_UPDATE_GROUP,
    payload: group
});