import moment from 'moment';

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

export const formatPricePhp = (num) => {
    if (num) {
        const price = new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(num);
        return price.replace('.00', '');
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

export const getLastWeekdayOfTheMonth = (year, month) => {
    const days = getDaysOfMonth(year, month);
    let lastDay;
    days.map(day => {
        const dayName = moment(day).format('dddd');

        if (dayName === 'Saturday' || dayName === 'Sunday') {
            return;
        }

        lastDay = day;
    });

    return lastDay;
}