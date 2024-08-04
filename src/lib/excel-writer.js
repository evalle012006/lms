import * as XLSX from "xlsx";

export const createExcelBuffer = (data, headerBranchName, monthYear, userRole) => {
    const workbook = XLSX.utils.book_new();

    const COLUMNS = ['Index', 'Branch', 'Name of Client', 'Loan Principal', 'Amount Release'];
    const BRANCH_COLUMNS = ['Index', 'Name of Client', 'Loan Principal', 'Amount Release'];
    const HEADER_ROWS = 8;
    const ROWS_PER_COLUMN = 200;

    // Styles
    const centerAlignStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
    const boldStyle = { font: { bold: true } };
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFFFFF" } }, alignment: { horizontal: 'center' } };
    const evenRowStyle = { fill: { fgColor: { rgb: "E6F2FF" } } }; // Pastel blue
    const oddRowStyle = { fill: { fgColor: { rgb: "FFFFFF" } } };  // White
    const subtotalStyle = { font: { bold: true, color: { rgb: "FF0000" } }, fill: { fgColor: { rgb: "FFFF00" } } };
    const grandTotalStyle = { font: { bold: true, color: { rgb: "FF0000" } }, fill: { fgColor: { rgb: "FFFF00" } } };

    // Function to add header to a sheet
    const addHeaderToSheet = (sheet, sheetName) => {
        sheet['A1'] = { v: 'AmberCash PH Micro Lending Corporation', t: 's', s: { ...centerAlignStyle, ...boldStyle, font: { bold: true, size: 16 } } };
        sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUMNS.length - 1 } }];
    
        // Custom header text (second and third rows)
        let headerText;
        if (sheetName === 'Consolidated') {
            headerText = 'CONSOLIDATED LIST of Client Loan Releases for the Month of ';
        } else {
            headerText = 'Loan Releases for the Month of ';
        }
        sheet['A2'] = { v: headerText, t: 's', s: { ...centerAlignStyle, ...boldStyle } };
        sheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 2, c: COLUMNS.length - 1 } });
        
        // Set row heights
        sheet['!rows'] = [{ hpt: 30 }, { hpt: 30 }, { hpt: 30 }]; // Adjust heights as needed

        // Sheet name and month/year (fifth row)
        sheet['A5'] = { v: sheetName, t: 's', s: boldStyle };
        sheet[XLSX.utils.encode_cell({ r: 4, c: COLUMNS.length - 1 })] = { v: monthYear, t: 's', s: { ...boldStyle, alignment: { horizontal: 'right' } } };
    };
    // Group data by branch
    const branchData = data.reduce((acc, item) => {
        const branch = item.branchName || headerBranchName;
        if (!acc[branch]) {
            acc[branch] = [];
        }
        acc[branch].push(item);
        return acc;
    }, {});

    if (userRole === 'root') {
        // Create consolidated sheet
        const consolidatedSheet = XLSX.utils.aoa_to_sheet([]);
        addHeaderToSheet(consolidatedSheet, 'Consolidated');

        let consolidatedData = [];
        let grandTotalLoanPrincipal = 0;
        let grandTotalAmountRelease = 0;

        // Collect all data for consolidated sheet
        Object.entries(branchData).forEach(([branchName, branchItems]) => {
            branchItems.forEach(item => {
                consolidatedData.push({
                    branch: branchName,
                    clientName: item.clientName,
                    loanPrincipal: item.loanPrincipal,
                    amountRelease: item.amountRelease
                });
                grandTotalLoanPrincipal += item.loanPrincipal;
                grandTotalAmountRelease += item.amountRelease;
            });
        });

        // Calculate number of columns needed for consolidated data
        const consolidatedColumnsNeeded = Math.ceil(consolidatedData.length / ROWS_PER_COLUMN);

        for (let columnSet = 0; columnSet < consolidatedColumnsNeeded; columnSet++) {
            const startCol = columnSet * COLUMNS.length;
            let subtotalLoanPrincipal = 0;
            let subtotalAmountRelease = 0;

            // Column headers
            COLUMNS.forEach((header, index) => {
                const cellAddress = XLSX.utils.encode_cell({ r: HEADER_ROWS - 1, c: startCol + index });
                consolidatedSheet[cellAddress] = { v: header, t: 's', s: headerStyle };
            });

            // Data rows
            const startIndex = columnSet * ROWS_PER_COLUMN;
            const endIndex = Math.min((columnSet + 1) * ROWS_PER_COLUMN, consolidatedData.length);

            for (let i = startIndex; i < endIndex; i++) {
                const item = consolidatedData[i];
                const row = (i % ROWS_PER_COLUMN) + HEADER_ROWS;

                COLUMNS.forEach((column, colIndex) => {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: startCol + colIndex });
                    let value;
                    switch (column) {
                        case 'Index':
                            value = i + 1;
                            break;
                        case 'Branch':
                            value = item.branch;
                            break;
                        case 'Name of Client':
                            value = item.clientName;
                            break;
                        case 'Loan Principal':
                            value = item.loanPrincipal;
                            subtotalLoanPrincipal += value;
                            break;
                        case 'Amount Release':
                            value = item.amountRelease;
                            subtotalAmountRelease += value;
                            break;
                    }
                    consolidatedSheet[cellAddress] = { 
                        v: value, 
                        t: (typeof value === 'number') ? 'n' : 's', 
                        s: row % 2 === 0 ? evenRowStyle : oddRowStyle 
                    };
                });
            }

            // Add subtotal row for each set of 200
            const subtotalRow = HEADER_ROWS + Math.min(ROWS_PER_COLUMN, endIndex - startIndex);
            consolidatedSheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol })] = { v: 'Subtotal', t: 's', s: subtotalStyle };
            consolidatedSheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol + COLUMNS.indexOf('Loan Principal') })] = { v: subtotalLoanPrincipal, t: 'n', s: subtotalStyle };
            consolidatedSheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol + COLUMNS.indexOf('Amount Release') })] = { v: subtotalAmountRelease, t: 'n', s: subtotalStyle };

            // Add grand total after the first subtotal
            if (columnSet === 0) {
                const grandTotalRow = subtotalRow + 1;
                consolidatedSheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol })] = { v: 'Grand Total', t: 's', s: grandTotalStyle };
                consolidatedSheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol + COLUMNS.indexOf('Loan Principal') })] = { v: grandTotalLoanPrincipal, t: 'n', s: grandTotalStyle };
                consolidatedSheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol + COLUMNS.indexOf('Amount Release') })] = { v: grandTotalAmountRelease, t: 'n', s: grandTotalStyle };
            }
        }

        // Set column widths for consolidated sheet
        consolidatedSheet['!cols'] = [];
        for (let i = 0; i < consolidatedColumnsNeeded * COLUMNS.length; i++) {
            consolidatedSheet['!cols'].push({ wch: i % COLUMNS.length === 2 ? 30 : 15 });
        }

        // Set consolidated sheet dimensions
        const lastRow = HEADER_ROWS + consolidatedData.length + consolidatedColumnsNeeded + 1; // +1 for grand total
        consolidatedSheet['!ref'] = XLSX.utils.encode_range({
            s: { c: 0, r: 0 },
            e: { c: consolidatedColumnsNeeded * COLUMNS.length - 1, r: lastRow }
        });

        // Add the consolidated worksheet to the workbook (as the first sheet)
        XLSX.utils.book_append_sheet(workbook, consolidatedSheet, 'Consolidated');
    }

    // Create individual branch sheets
    Object.entries(branchData).forEach(([branchName, branchItems]) => {
        const worksheet = XLSX.utils.aoa_to_sheet([]);
        addHeaderToSheet(worksheet, branchName);

        let totalLoanPrincipal = 0;
        let totalAmountRelease = 0;

        // Calculate number of columns needed
        const columnsNeeded = Math.ceil(branchItems.length / ROWS_PER_COLUMN);

        for (let columnSet = 0; columnSet < columnsNeeded; columnSet++) {
            const startCol = columnSet * BRANCH_COLUMNS.length;
            let subtotalLoanPrincipal = 0;
            let subtotalAmountRelease = 0;

            // Column headers
            BRANCH_COLUMNS.forEach((header, index) => {
                const cellAddress = XLSX.utils.encode_cell({ r: HEADER_ROWS - 1, c: startCol + index });
                worksheet[cellAddress] = { v: header, t: 's', s: headerStyle };
            });

            // Data rows
            const startIndex = columnSet * ROWS_PER_COLUMN;
            const endIndex = Math.min((columnSet + 1) * ROWS_PER_COLUMN, branchItems.length);

            for (let i = startIndex; i < endIndex; i++) {
                const item = branchItems[i];
                const row = (i % ROWS_PER_COLUMN) + HEADER_ROWS;

                BRANCH_COLUMNS.forEach((column, colIndex) => {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: startCol + colIndex });
                    let value;
                    switch (column) {
                        case 'Index':
                            value = i + 1;
                            break;
                        case 'Name of Client':
                            value = item.clientName;
                            break;
                        case 'Loan Principal':
                            value = item.loanPrincipal;
                            subtotalLoanPrincipal += value;
                            break;
                        case 'Amount Release':
                            value = item.amountRelease;
                            subtotalAmountRelease += value;
                            break;
                    }
                    worksheet[cellAddress] = { 
                        v: value, 
                        t: (typeof value === 'number') ? 'n' : 's', 
                        s: row % 2 === 0 ? evenRowStyle : oddRowStyle 
                    };
                });
            }

            // Add subtotal row
            const subtotalRow = HEADER_ROWS + (endIndex - startIndex);
            worksheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol })] = { v: 'Subtotal', t: 's', s: subtotalStyle };
            worksheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol + BRANCH_COLUMNS.indexOf('Loan Principal') })] = { v: subtotalLoanPrincipal, t: 'n', s: subtotalStyle };
            worksheet[XLSX.utils.encode_cell({ r: subtotalRow, c: startCol + BRANCH_COLUMNS.indexOf('Amount Release') })] = { v: subtotalAmountRelease, t: 'n', s: subtotalStyle };

            totalLoanPrincipal += subtotalLoanPrincipal;
            totalAmountRelease += subtotalAmountRelease;

            // Add grand total after the first subtotal
            if (columnSet === 0) {
                const grandTotalRow = subtotalRow + 1;
                worksheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol })] = { v: 'Grand Total', t: 's', s: grandTotalStyle };
                worksheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol + BRANCH_COLUMNS.indexOf('Loan Principal') })] = { v: totalLoanPrincipal, t: 'n', s: grandTotalStyle };
                worksheet[XLSX.utils.encode_cell({ r: grandTotalRow, c: startCol + BRANCH_COLUMNS.indexOf('Amount Release') })] = { v: totalAmountRelease, t: 'n', s: grandTotalStyle };
            }
        }

        // Set column widths
        worksheet['!cols'] = [];
        for (let i = 0; i < columnsNeeded * BRANCH_COLUMNS.length; i++) {
            worksheet['!cols'].push({ wch: i % BRANCH_COLUMNS.length === 1 ? 30 : 15 });
        }

        // Set worksheet dimensions
        const lastRow = HEADER_ROWS + branchItems.length + columnsNeeded + 1; // +1 for grand total
        worksheet['!ref'] = XLSX.utils.encode_range({
            s: { c: 0, r: 0 },
            e: { c: columnsNeeded * BRANCH_COLUMNS.length - 1, r: lastRow }
        });

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, branchName);
    });

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return excelBuffer;
}