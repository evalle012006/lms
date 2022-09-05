import * as XLSX from "xlsx";

export const excelReader = (b64) => {
    const wb = XLSX.read(b64.replace(/_/g, "/").replace(/-/g, "+"), {type:'base64'});
    /* Get first worksheet */
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];
    /* Convert array of arrays */
    const data = XLSX.utils.sheet_to_json(ws, {header:1});
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