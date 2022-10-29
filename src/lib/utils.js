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
        console.log(exist)
    }
    console.log(exist);
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
