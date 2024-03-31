export const SET_DIVISION = 'SET_DIVISION';
export const SET_DIVISION_LIST = 'SET_DIVISION_LIST';
export const SET_ADD_UPDATE_DIVISION = 'SET_ADD_UPDATE_DIVISION';

export const setDivision = (division) => ({
    type: SET_DIVISION,
    payload: division
});

export const setDivisionList = (divisionList) => ({
    type: SET_DIVISION_LIST,
    payload: divisionList
});

export const setAddUpdateDivision = (division) => ({
    type: SET_ADD_UPDATE_DIVISION,
    payload: division
});