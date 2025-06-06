export const SET_SYSTEM_SETTINGS = 'SET_SYSTEM_SETTINGS';
export const SET_HOLIDAY = 'SET_HOLIDAY';
export const SET_WEEKEND = 'SET_WEEKEND';
export const SET_CURRENT_DATE = 'SET_CURRENT_DATE';
export const SET_CURRENT_TIME = 'SET_CURRENT_TIME';
export const SET_LAST_DAY_OF_THE_MONTH = 'SET_LAST_DAY_OF_THE_MONTH';
export const SET_LAST_5_DAYS_OF_THE_MONTH = 'SET_LAST_5_DAYS_OF_THE_MONTH';

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

export const setCurrentDate = (currentDate) => ({
    type: SET_CURRENT_DATE,
    payload: currentDate
});

export const setCurrentTime = (currentTime) => ({
    type: SET_CURRENT_TIME,
    payload: currentTime
});

export const setLastDayOfTheMonth = (lastDay) => ({
    type: SET_LAST_DAY_OF_THE_MONTH,
    payload: lastDay
});

export const setLast5DaysOfTheMonth = (last5Days) => ({
    type: SET_LAST_5_DAYS_OF_THE_MONTH,
    payload: last5Days
});