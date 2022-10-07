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
        return new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(num);
    } else {
        new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(0);
    }
}