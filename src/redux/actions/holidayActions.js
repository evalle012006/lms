export const SET_HOLIDAY = 'SET_HOLIDAY';
export const SET_HOLIDAY_LIST = 'SET_HOLIDAY_LIST';
export const SET_ADD_UPDATE_HOLIDAY = 'SET_ADD_UPDATE_HOLIDAY';

export const setHoliday = (holiday) => ({
    type: SET_HOLIDAY,
    payload: holiday
});

export const setHolidayList = (holidayList) => ({
    type: SET_HOLIDAY_LIST,
    payload: holidayList
});

export const setAddUpdateHoliday = (holiday) => ({
    type: SET_ADD_UPDATE_HOLIDAY,
    payload: holiday
});