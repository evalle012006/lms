export const SET_LOS = 'SET_LOS';
export const SET_LOS_LIST = 'SET_LOS_LIST';

export const setLos = (los) => ({
    type: SET_LOS,
    payload: los
});

export const setLosList = (losList) => ({
    type: SET_LOS_LIST,
    payload: losList
});