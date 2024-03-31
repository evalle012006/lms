export const SET_REGION = 'SET_REGION';
export const SET_REGION_LIST = 'SET_REGION_LIST';
export const SET_ADD_UPDATE_REGION = 'SET_ADD_UPDATE_REGION';

export const setRegion = (region) => ({
    type: SET_REGION,
    payload: region
});

export const setRegionList = (regionList) => ({
    type: SET_REGION_LIST,
    payload: regionList
});

export const setAddUpdateRegion = (region) => ({
    type: SET_ADD_UPDATE_REGION,
    payload: region
});