import moment from 'moment';

export const getEndDate = (date, days) => {
    date = moment(date); // use a clone
    while (days > 0) {
       date = date.add(1, 'days');
       // decrease "days" only if it's a weekday.
       if (date.isoWeekday() !== 6 && date.isoWeekday() !== 7) {
          days -= 1;
       }
    }
    return date.format('YYYY-MM-DD');
 }

 export const getWeekDaysCount = (startDate, endDate) => {
    let count = 0;
    let curDate = +startDate;
    while (curDate <= +endDate) {
       const dayOfWeek = new Date(curDate).getDay();
       const isWeekend = (dayOfWeek === 6) || (dayOfWeek === 0);
       if (!isWeekend) {
          count++;
       }
       curDate = curDate + 24 * 60 * 60 * 1000
    }
    
    return count;
 }

export const getDaysOfMonth = (year, month) => {
    const strMonth = typeof month === 'number' ? month < 10 ? '0' + month : month : month;
    const monthDate = moment(year + '-' + strMonth, 'YYYY-MM');

    let daysInMonth = monthDate.daysInMonth();
    let arrDays = [];

    while(daysInMonth) { 
      const current = moment(`${year}-${strMonth}-01`).date(daysInMonth);
      arrDays.unshift(current.format('YYYY-MM-DD'));
      daysInMonth--;
    }
    return arrDays;
};

export const getCurrentDate = (timezone = 'Asia/Manila') => {
    return new Date().toLocaleDateString({}, { timeZone: timezone });
};

export const getLastWeekdayOfTheMonth = (year, month, holidayList = []) => {
    const days = getDaysOfMonth(year, month);
    const dateArr = days.filter(day => {
        const dayName = moment(day).format('dddd');

        const dateArr = day.split('-');
        const dateStr = dateArr[1] + "-" + dateArr[2];
        if (dayName !== 'Saturday' && dayName !== 'Sunday' && (holidayList && !holidayList.includes(dateStr))) {
            return day;
        }
    });

    return dateArr[dateArr.length - 1];
}

export const isEndMonthDate = (currentDate, holidayList = []) => {
    const year = moment(currentDate).year();
    const month = moment(currentDate).month() + 1;
    
    const days = getDaysOfMonth(year, month);

    const dateArr = days.filter(day => {
        const dayName = moment(day).format('dddd');

        const dateArr = day.split('-');
        const dateStr = dateArr[1] + "-" + dateArr[2];
        if (dayName !== 'Saturday' && dayName !== 'Sunday' && (holidayList && !holidayList.includes(dateStr))) {
            return day;
        }
    });

    return dateArr[dateArr.length - 1] == currentDate;
}

export const getQuarters = () => {
    return [
        { value: 1, label: '1st Qtr' },
        { value: 2, label: '2nd Qtr' },
        { value: 3, label: '3rd Qtr' },
        { value: 4, label: '4th Qtr' }
    ].sort((a, b) => +a.value - +b.value)
}

export const getWeeks = (year) => {
    const weeks = [];
  const startDate = new Date(year, 0, 1); // January 1st of the given year
  const endDate = new Date(); // December 31st of the given year

  let currentDate = startDate;
  let currentWeek = 1;


  while (currentDate <= endDate) {

    const firstDayOfWeek = currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() == 0 ? -6 : 1); // Adjust to first day of the week (Monday)
    const startOfWeek = new Date(currentDate.setDate(firstDayOfWeek));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Friday of the same week

    // Push the week with start and end dates
    weeks.push({
      weekNumber: currentWeek,
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
    });

    // Move to next week
    currentDate = new Date(endOfWeek.setDate(endOfWeek.getDate() + 1));
    currentWeek++;
  }

  return weeks.map(w => ({
    label: (() => {
        const [startMonth, startDay] = moment(w.startDate).format('MMM DD').split(' ');
        const [endMonth, endDay] = moment(w.endDate).format('MMM DD').split(' ');

        return `${startMonth} ${startDay} - ${ startMonth === endMonth ? '' : endMonth + ' '  } ${endDay}`
    })(),
    startDate: w.startDate,
    endDate: w.endDate,
    value: w.endDate,
  })).sort((a, b) => (+a.value - +b.value) * -1)
}

export const getMonths = (year) => {
    const current_date = moment(new Date());
    const current_year = +current_date.year();
    const current_month = current_date.month() + 1;

    return [
        { label: 'January', value: '01' },
        { label: 'February', value: '02' },
        { label: 'March', value: '03' },
        { label: 'April', value: '04' },
        { label: 'May', value: '05' },
        { label: 'June', value: '06' },
        { label: 'July', value: '07' },
        { label: 'August', value: '08' },
        { label: 'September', value: '09' },
        { label: 'October', value: '10' },
        { label: 'November', value: '11' },
        { label: 'December', value: '12' }
    ].sort((a, b) => (+a.value - +b.value) * -1)
     .filter(o => +year === current_year ? (+o.value) <= current_month : true);
}

export const getYears = () => {

    const current_year = new Date().getFullYear();
    let base_year = 2023;
    const years = [];

    for(let i = base_year; i <= current_year; i++) {
        years.push({
            label: i,
            value: i
        });
    }

    return years.sort((a, b) => (+a.value - +b.value) * -1)
}

export const parseDate = (date) => {
    let parsedDate;
    if (date && date !== undefined) {
        if (typeof date == 'number') {
            const convertedDate = new Date(Math.round((date - 25569)*86400*1000));
            parsedDate = moment(convertedDate).format('YYYY-MM-DD');
        } else {
            let arr = [];
            if (date.includes('-')) {
                arr = date.split('-');
            } else if (date.includes('/')) {
                arr = date.split('/');
            }

            if (arr.length === 3) {
                const month = arr[0].length == 1 ? "0" + arr[0] : arr[0];
                const day = arr[1].length == 1 ? "0" + arr[1] : arr[1];
                const year = arr[2].length == 2 ? parseInt(arr[2]) !== 23 ? "19" + arr[2] : "20" + arr[2] : arr[2];

                parsedDate = year + "-" + month + "-" + day;
            }
        }
    }

    return parsedDate;
}

export const calculateAge = (dob) => {
    return Math.round(moment().diff(dob, 'years', true));
}

export const getPrevousWorkday = () => {
    // Based on the current day, handle accordingly
    const today = moment().day();
    switch(today) {
        // If it is Monday (1),Saturday(6), or Sunday (0), Get the previous Friday (5)
        // and ensure we are on the previous week
        case 0:
        case 1:
        case 6:
            return moment().subtract(6,'days').day(5);
        // If it any other weekend, just return the previous day
        default:
            return moment().day(today - 1);
    }
}

export const checkIfWeekend = (date) => {
    const day = new Date(date).getDay();
    return day === 0 || day === 6;
}

export const checkIfHoliday = (date, holidays = []) => {
    const dateArr = date.split('-');
    const dateStr = dateArr[1] + "-" + dateArr[2];
    return holidays.includes(dateStr);
}

export const getNextValidDate = (date, holidays = []) => {
    let nextDate = moment(date);
    while (checkIfWeekend(nextDate) || checkIfHoliday(nextDate.format("YYYY-MM-DD"), holidays)) {
      nextDate = nextDate.add(1, 'days');
    }
    return nextDate;
}

/**
 * Returns the last 5 weekdays (Monday-Friday) of a specified month, excluding holidays
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @param {string[]} holidays - Array of holidays in "MM-DD" format
 * @returns {moment[]} Array of moment objects representing the last 5 weekdays
 */
export const getLastFiveWeekdaysOfMonth = (year, month, holidays = []) => {
    // Import moment.js from CDN if using in browser environment
    // For Node.js, you would use: const moment = require('moment');
    
    // Create a moment for the last day of the month
    const lastDayOfMonth = moment([year, month - 1]).endOf('month');
    
    const weekdays = [];
    let currentDay = moment(lastDayOfMonth);
    
    // Loop until we find 5 weekdays that are not holidays
    while (weekdays.length < 5) {
        // Check if the current day is not a weekend (0 = Sunday, 6 = Saturday)
        const dayOfWeek = currentDay.day();
        
        // Create MM-DD format string for holiday checking
        const monthDay = currentDay.format('MM-DD');
        
        // Check if the day is a weekday and not a holiday
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(monthDay)) {
            weekdays.push(moment(currentDay));
        }
        
        // Move to the previous day
        currentDay.subtract(1, 'days');
    }

    // Sort the dates in ascending order
    weekdays.sort((a, b) => a - b);
    const formattedDates = weekdays.map(date => date.format('YYYY-MM-DD'));
    
    return formattedDates;
}

/**
 * Returns the last weekday (Monday-Friday) of the current week or future weeks if needed, excluding holidays
 * If the entire week is a holiday, checks the next week and so on until a non-holiday weekday is found
 * 
 * @param {string[]} holidays - Array of holidays in "MM-DD" format
 * @returns {moment.Moment} Moment object representing the last non-holiday weekday
 */
export const getLastWorkingDayOfWeek = (holidays = []) => {
    let weekOffset = 0;
    let foundWorkingDay = false;
    let candidateDay;
    
    // Keep checking weeks until we find a working day
    while (!foundWorkingDay) {
      // Check days from Friday to Monday (5 down to 1) of the current+offset week
      for (let dayOfWeek = 5; dayOfWeek >= 1; dayOfWeek--) {
        // Create a moment for the day in the current+offset week
        candidateDay = moment().add(weekOffset, 'weeks').day(dayOfWeek);
        const candidateDayFormatted = candidateDay.format('MM-DD');
        
        // If this day is not a holiday, we found our day
        if (!holidays.includes(candidateDayFormatted)) {
          foundWorkingDay = true;
          break;
        }
      }
      
      // If we didn't find a working day this week, check the next week
      if (!foundWorkingDay) {
        weekOffset++;
      }
    }
    
    return candidateDay;
  };