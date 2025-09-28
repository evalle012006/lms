import ExcelJS from 'exceljs';

export const excelReader = async (file) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    
    const data = [];
    
    // Get first worksheet (equivalent to wb.SheetNames[0])
    const worksheet = workbook.getWorksheet(1);
    if (worksheet) {
        const jsonData = [];
        
        worksheet.eachRow((row, rowNumber) => {
            const rowData = [];
            row.eachCell((cell, colNumber) => {
                // Handle different cell types
                let value = cell.value;
                if (cell.type === ExcelJS.ValueType.Date) {
                    value = cell.value;
                } else if (cell.type === ExcelJS.ValueType.Formula) {
                    value = cell.result || cell.value;
                } else {
                    value = cell.value;
                }
                rowData[colNumber - 1] = value; // ExcelJS is 1-indexed, arrays are 0-indexed
            });
            jsonData.push(rowData);
        });
        
        data.push({
            sheetName: worksheet.name,
            data: jsonData
        });
    }
    
    return data;
};

export const excelReaderBase64 = async (b64) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(b64.replace(/_/g, "/").replace(/-/g, "+"), 'base64');
    await workbook.xlsx.load(buffer);
    
    const data = [];
    
    // Process all worksheets (equivalent to wb.SheetNames loop)
    workbook.eachSheet((worksheet, sheetId) => {
        console.log('Sheet Name: ', worksheet.name);
        
        const jsonData = [];
        
        worksheet.eachRow((row, rowNumber) => {
            const rowData = [];
            row.eachCell((cell, colNumber) => {
                // Handle different cell types
                let value = cell.value;
                if (cell.type === ExcelJS.ValueType.Date) {
                    value = cell.value;
                } else if (cell.type === ExcelJS.ValueType.Formula) {
                    value = cell.result || cell.value;
                } else {
                    value = cell.value;
                }
                rowData[colNumber - 1] = value;
            });
            jsonData.push(rowData);
        });
        
        console.log(jsonData);
        data.push({
            sheetName: worksheet.name,
            data: jsonData
        });
    });
    
    return data;
};

/* generate an array of column objects - ExcelJS equivalent */
const make_cols = (worksheet) => {
    const dimensions = worksheet.dimensions;
    if (!dimensions) return [];
    
    const columnCount = dimensions.right;
    const o = [];
    
    for (let i = 0; i < columnCount; i++) {
        o[i] = {
            name: String.fromCharCode(65 + (i % 26)), // A, B, C, etc.
            key: i
        };
    }
    return o;
};