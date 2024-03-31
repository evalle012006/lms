export const SET_AREA = 'SET_AREA';
export const SET_AREA_LIST = 'SET_AREA_LIST';
export const SET_ADD_UPDATE_AREA = 'SET_ADD_UPDATE_AREA';

export const setArea = (area) => ({
    type: SET_AREA,
    payload: area
});

export const setAreaList = (areaList) => ({
    type: SET_AREA_LIST,
    payload: areaList
});

export const setAddUpdateArea = (area) => ({
    type: SET_ADD_UPDATE_AREA,
    payload: area
});