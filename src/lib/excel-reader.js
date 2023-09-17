import * as XLSX from "xlsx";

export const excelReader = (file) => {
    const wb = XLSX.readFile(file);
    const data = [];
    // for (let i = 0; i < wb.SheetNames.length; i++) {
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        /* Convert array of arrays */
        const jsonData = XLSX.utils.sheet_to_json(ws, {header:1});
        data.push({
            sheetName: wsname,
            data: jsonData
        });
    // }
    // const cols = make_cols(ws['!ref']); // not needed atm
    // console.log(data);
    return data;
}

export const excelReaderBase64 = (b64) => {
    const wb = XLSX.read(b64.replace(/_/g, "/").replace(/-/g, "+"), {type:'base64'});
    const data = [];
    for (let i = 0; i < wb.SheetNames.length; i++) {
        const wsname = wb.SheetNames[i];
        console.log('Sheet Name: ', wsname);
        const ws = wb.Sheets[wsname];
        /* Convert array of arrays */
        const jsonData = XLSX.utils.sheet_to_json(ws, {header:1});
        console.log(jsonData);
        data.push({
            sheetName: wsname,
            data: jsonData
        });
    }
    // const cols = make_cols(ws['!ref']); // not needed atm
    // console.log(data);
    return data;
}

/* generate an array of column objects */
const make_cols = refstr => {
	let o = [], C = XLSX.utils.decode_range(refstr).e.c + 1;
	for(var i = 0; i < C; ++i) o[i] = {name:XLSX.utils.encode_col(i), key:i}
	return o;
};