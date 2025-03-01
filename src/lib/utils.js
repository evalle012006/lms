import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

export const FileExists = (url) => {
    if (!url) {
        return;    
    }

    let exist = true;
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.send();
    request.onload = function() {
        if (request.status !== 200) {
            console.log("image doesn't exist");
            exist = false;
        }
    }

    return exist;
}


export const UppercaseFirstLetter = (str) => {
    if (!str) {
        return;
    }
    const arr = str.split(" ");

    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    
    }

    return arr ? arr.join(" ") : '';
}

export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const checkFileSize = (size) => {
    let msg;

    const fileSize = Math.round((size / 1024));
    
    if (fileSize > 1028) {
        msg = 'File too big, please select a file less than 1mb';
    }

    return msg;
}

export const formatPricePhp = (num) => {
    if (num) {
        if (num < 0) {
            const absNum = Math.abs(num);
            const price = new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(absNum);
            return `(${price.replace('.00', '')})`;
        } else {
            const price = new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(num);
            return price.replace('.00', '');
        }
    } else {
        return '0';
    }
}

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

 export const isBlank = (str) => {
    return (!str || /^\s*$/.test(str));
}

export const containsOnlyNumbers = (str) => {
    return /^\d+$/.test(str);
}

export const getTotal = (arr, prop) => {
    return arr.reduce((a, b) => {
        return a + b[prop];
    }, 0);
}

export const containsAnyLetters = (str) => {
    return /[a-zA-Z]/.test(str);
}

export const roman_to_Int = (str1) => {
    if(str1 == null) return -1;
    var num = char_to_int(str1.charAt(0));
    var pre, curr;
    
    for(var i = 1; i < str1.length; i++) {
        curr = char_to_int(str1.charAt(i));
        pre = char_to_int(str1.charAt(i-1));
        if(curr <= pre) {
            num += curr;
        } else {
            num = num - pre*2 + curr;
        }
    }
    
    return num;
}
    
const char_to_int = (c) => {
    switch (c) {
        case 'I': return 1;
        case 'V': return 5;
        case 'X': return 10;
        case 'L': return 50;
        case 'C': return 100;
        case 'D': return 500;
        case 'M': return 1000;
        default: return -1;
    }
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
    ];
}

export const getWeeks = (year) => {
    const weeks = [];
  const startDate = new Date(year, 0, 1); // January 1st of the given year
  const endDate = new Date(); // December 31st of the given year

  let currentDate = startDate;
  let currentWeek = 1;


  while (currentDate <= endDate) {

    console.log(currentDate, endDate);

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

  console.log('weeks', weeks);

  return weeks.map(w => ({
    label: (() => {
        const [startMonth, startDay] = moment(w.startDate).format('MMM DD').split(' ');
        const [endMonth, endDay] = moment(w.endDate).format('MMM DD').split(' ');

        return `${startMonth} ${startDay} - ${ startMonth === endMonth ? '' : endMonth + ' '  } ${endDay}`
    })(),
    value: w.weekNumber,
  }))
}

export const getMonths = () => {
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
    ];
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

    return years;

    /*
    return[
        { label: 2023, value: 2023 },
        { label: 2024, value: 2024 },
        { label: 2025, value: 2025 },
        { label: 2026, value: 2026 },
        { label: 2027, value: 2027 },
        { label: 2028, value: 2028 },
        { label: 2029, value: 2029 },
        { label: 2030, value: 2030 },
        { label: 2031, value: 2031 },
        { label: 2032, value: 2032 },
        { label: 2033, value: 2033 },
        { label: 2034, value: 2034 },
        { label: 2035, value: 2035 }
    ];
    */
}

export const extractName = (name) => {
    const _name = name && name !== undefined ? name.trim() : null;
    if (_name) {
        let firstName;
        let middleName;
        let lastName;
        const arg = _name.split(' ');
        if (arg.length == 2) {
            firstName = arg[0];
            lastName = arg[1];
        } else if (arg.length === 3) {
            firstName = arg[0]; 
            middleName = arg[1]; 
            lastName = arg[2];
        } else if (arg.length === 4) {
            firstName = arg[0] + ' ' + arg[1];
            middleName = arg[2];
            lastName = arg[3];
        } else if (arg.length === 5) {
            firstName = arg[0] + ' ' + arg[1] + ' ' + arg[1];
            middleName = arg[3]; 
            lastName = arg[4];
        }

        return { firstName, middleName, lastName };
    } else {
        return null;
    }
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

export const jsonTryParse = (str, defVal) => {
    try {
        return JSON.parse(str)
    } catch(e) {
        return defVal ?? str;
    }
}

export const generateUUID = () => uuidv4();

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