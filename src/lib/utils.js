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

export const jsonTryParse = (str, defVal) => {
    try {
        return JSON.parse(str)
    } catch(e) {
        return defVal ?? str;
    }
}

export const generateUUID = () => uuidv4();