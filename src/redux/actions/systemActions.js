export const SET_SYSTEM_SETTINGS = 'SET_SYSTEM_SETTINGS';
export const SET_HOLIDAY = 'SET_HOLIDAY';
export const SET_WEEKEND = 'SET_WEEKEND';

export const setSystemSettings = (settings) => ({
    type: SET_SYSTEM_SETTINGS,
    payload: settings
});

export const setHoliday = (holiday) => ({
    type: SET_HOLIDAY,
    payload: holiday
});

export const setWeekend = (weekend) => ({
    type: SET_WEEKEND,
    payload: weekend
});