import { useState } from 'react';
import ExcelJS from 'exceljs';
import { toast } from 'react-toastify';

export const useExcelExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  // Smart field mapper to handle different data structures
  const mapLoanData = (loan, index) => {
    // Helper function to safely get nested values
    const safeGet = (obj, path, defaultValue = '') => {
      const keys = path.split('.');
      let result = obj;
      for (const key of keys) {
        if (result && result[key] !== undefined) {
          result = result[key];
        } else {
          return defaultValue;
        }
      }
      return result || defaultValue;
    };

    // Extract client name from various possible structures
    const getClientName = () => {
      return safeGet(loan, 'client.fullName') ||
             safeGet(loan, 'client.0.fullName') ||
             safeGet(loan, 'clientName') ||
             safeGet(loan, 'fullName') ||
             'Unknown Client';
    };

    // Extract branch name from various possible structures
    const getBranchName = () => {
      return safeGet(loan, 'branch.name') ||
             safeGet(loan, 'branch.0.name') ||
             safeGet(loan, 'branchName') ||
             'Unknown Branch';
    };

    // Extract loan officer name
    const getLoanOfficerName = () => {
      const firstName = safeGet(loan, 'loanOfficer.firstName') || 
                       safeGet(loan, 'lo.firstName') ||
                       safeGet(loan, 'user.firstName');
      const lastName = safeGet(loan, 'loanOfficer.lastName') || 
                      safeGet(loan, 'lo.lastName') ||
                      safeGet(loan, 'user.lastName');
      
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      return safeGet(loan, 'loanOfficerName') || 'Unknown LO';
    };

    // Extract group name
    const getGroupName = () => {
      return safeGet(loan, 'group.name') ||
             safeGet(loan, 'group.0.name') ||
             safeGet(loan, 'groupName') ||
             'Unknown Group';
    };

    // Calculate loan principal with fallbacks
    const getLoanPrincipal = () => {
      const principal = safeGet(loan, 'principalLoan') ||
                       safeGet(loan, 'loanAmount') ||
                       safeGet(loan, 'principal') ||
                       safeGet(loan, 'amount');
      
      return typeof principal === 'number' ? principal : 5000; // Default fallback
    };

    // Calculate amount release (20% markup as per business logic)
    const loanPrincipal = getLoanPrincipal();
    const amountRelease = loanPrincipal * 1.20;

    // Extract dates with proper formatting
    const getDate = (dateField) => {
      const date = safeGet(loan, dateField);
      if (!date) return '';
      
      try {
        return new Date(date).toLocaleDateString('en-US');
      } catch {
        return date.toString();
      }
    };

    // Return mapped data object
    return {
      index: index + 1,
      loanOfficer: getLoanOfficerName(),
      group: getGroupName(),
      slotNo: safeGet(loan, 'slotNo') || safeGet(loan, 'slot') || '',
      clientName: getClientName(),
      loanCycle: safeGet(loan, 'loanCycle') || safeGet(loan, 'cycle') || 1,
      admissionDate: getDate('admissionDate') || getDate('dateAdded'),
      mcbu: safeGet(loan, 'mcbu') || safeGet(loan, 'mcbuBalance') || 0,
      principalLoan: loanPrincipal,
      targetLoanCollection: safeGet(loan, 'targetLoanCollection') || safeGet(loan, 'targetCollection') || 100,
      loanRelease: amountRelease,
      loanBalance: safeGet(loan, 'loanBalance') || safeGet(loan, 'balance') || loanPrincipal,
      pnNumber: safeGet(loan, 'pnNumber') || safeGet(loan, 'promissoryNote') || '',
      dateOfRelease: getDate('dateGranted') || getDate('dateRelease') || getDate('releaseDate'),
      ciName: safeGet(loan, 'ciName') || safeGet(loan, 'collectionIncentive') || 'A',
      status: safeGet(loan, 'status') || 'Active',
      branchName: getBranchName(),
      
      // Additional fields for different contexts
      remarks: safeGet(loan, 'remarks') || '',
      mispayment: safeGet(loan, 'mispayment') || false,
      delinquent: safeGet(loan, 'delinquent') || false,
      
      // Raw loan object for custom processing
      _raw: loan
    };
  };

  // Create Excel workbook with enhanced column structure
  const createExcelBuffer = async (data, headerBranchName, monthYear, userRole) => {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'AmberCash PH Micro Lending Corporation';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Enhanced column definitions matching the screenshot
    const DETAILED_COLUMNS = [
      'LOAN OFFICER', 'GROUP', 'SLOT NO.', 'CLIENT NAME', 'LOAN CYCLE', 
      'ADMISSION DATE', 'MCBU', 'PRINCIPAL LOAN', 'TARGET LOAN COLLECTION',
      'LOAN RELEASE', 'LOAN BALANCE', 'PN NUMBER', 'DATE OF RELEASE', 
      'CI NAME', 'STATUS'
    ];

    const CONSOLIDATED_COLUMNS = [
      'INDEX', 'BRANCH', 'LOAN OFFICER', 'GROUP', 'CLIENT NAME', 
      'PRINCIPAL LOAN', 'LOAN RELEASE', 'STATUS'
    ];

    const HEADER_ROWS = 8;
    const ROWS_PER_COLUMN = 200;

    // Enhanced header function
    const addHeaderToSheet = (worksheet, sheetName, isDetailed = false) => {
      const columnsToUse = isDetailed ? DETAILED_COLUMNS : CONSOLIDATED_COLUMNS;
      
      // Main title
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = 'AmberCash PH Micro Lending Corporation';
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(1, 1, 1, columnsToUse.length);

      // Subtitle
      const subtitleText = sheetName === 'Consolidated' 
        ? 'CONSOLIDATED LIST of Client Loan Releases for the Month of ' 
        : `${sheetName} - Loan Applications Report for `;
      
      const headerCell = worksheet.getCell(2, 1);
      headerCell.value = subtitleText;
      headerCell.font = { bold: true };
      headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(2, 1, 3, columnsToUse.length);

      // Sheet info
      const sheetNameCell = worksheet.getCell(5, 1);
      sheetNameCell.value = sheetName;
      sheetNameCell.font = { bold: true };
      
      const monthYearCell = worksheet.getCell(5, columnsToUse.length);
      monthYearCell.value = monthYear;
      monthYearCell.font = { bold: true };
      monthYearCell.alignment = { horizontal: 'right' };

      // Set row heights
      [1, 2, 3].forEach(row => {
        worksheet.getRow(row).height = 30;
      });
    };

    // Process and map the data
    const mappedData = data.map((loan, index) => mapLoanData(loan, index));

    // Group data by branch for consolidated view
    const branchData = mappedData.reduce((acc, item) => {
      const branch = item.branchName || headerBranchName || 'Main Branch';
      if (!acc[branch]) {
        acc[branch] = [];
      }
      acc[branch].push(item);
      return acc;
    }, {});

    // Create consolidated sheet for root users
    if (userRole === 'root' && Object.keys(branchData).length > 1) {
      const consolidatedSheet = workbook.addWorksheet('Consolidated');
      addHeaderToSheet(consolidatedSheet, 'Consolidated', false);

      let rowIndex = HEADER_ROWS + 1;
      let totalPrincipal = 0;
      let totalRelease = 0;

      // Column headers
      CONSOLIDATED_COLUMNS.forEach((header, colIndex) => {
        const cell = consolidatedSheet.getCell(HEADER_ROWS, colIndex + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Data rows
      Object.entries(branchData).forEach(([branchName, branchItems]) => {
        branchItems.forEach((item) => {
          const row = consolidatedSheet.getRow(rowIndex);
          
          row.getCell(1).value = item.index;
          row.getCell(2).value = branchName;
          row.getCell(3).value = item.loanOfficer;
          row.getCell(4).value = item.group;
          row.getCell(5).value = item.clientName;
          row.getCell(6).value = item.principalLoan;
          row.getCell(7).value = item.loanRelease;
          row.getCell(8).value = item.status;

          // Apply formatting
          [6, 7].forEach(col => {
            row.getCell(col).numFmt = '#,##0.00';
          });

          // Alternating row colors
          if (rowIndex % 2 === 0) {
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
            });
          }

          // Borders
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin' }, left: { style: 'thin' },
              bottom: { style: 'thin' }, right: { style: 'thin' }
            };
          });

          totalPrincipal += item.principalLoan;
          totalRelease += item.loanRelease;
          rowIndex++;
        });
      });

      // Totals row
      const totalRow = consolidatedSheet.getRow(rowIndex);
      totalRow.getCell(5).value = 'TOTAL';
      totalRow.getCell(6).value = totalPrincipal;
      totalRow.getCell(7).value = totalRelease;
      
      totalRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      });

      // Set column widths
      const consolidatedWidths = [8, 20, 25, 15, 30, 15, 15, 12];
      consolidatedWidths.forEach((width, index) => {
        consolidatedSheet.getColumn(index + 1).width = width;
      });
    }

    // Create detailed branch sheets
    Object.entries(branchData).forEach(([branchName, branchItems]) => {
      const worksheet = workbook.addWorksheet(branchName);
      addHeaderToSheet(worksheet, branchName, true);

      // Column headers
      DETAILED_COLUMNS.forEach((header, colIndex) => {
        const cell = worksheet.getCell(HEADER_ROWS, colIndex + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Data rows
      branchItems.forEach((item, itemIndex) => {
        const rowIndex = HEADER_ROWS + itemIndex + 1;
        const row = worksheet.getRow(rowIndex);

        // Map data to columns
        const rowData = [
          item.loanOfficer, item.group, item.slotNo, item.clientName,
          item.loanCycle, item.admissionDate, item.mcbu, item.principalLoan,
          item.targetLoanCollection, item.loanRelease, item.loanBalance,
          item.pnNumber, item.dateOfRelease, item.ciName, item.status
        ];

        rowData.forEach((value, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.value = value;

          // Format currency columns
          if ([6, 7, 9, 10].includes(colIndex)) { // MCBU, Principal, Release, Balance
            cell.numFmt = '#,##0.00';
          }

          // Alternating row colors
          if (rowIndex % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2FF' } };
          }

          // Borders
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      });

      // Set column widths to match screenshot proportions
      const detailedWidths = [20, 15, 8, 25, 8, 12, 12, 15, 15, 15, 15, 15, 12, 8, 12];
      detailedWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
    });

    // Generate and return buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  };

  // Download function
  const downloadExcel = (buffer, filename) => {
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Main export function
  const exportLoansToExcel = async (loansData, userInfo, selectedMonth, selectedYear) => {
    try {
      setIsExporting(true);
      
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = months[selectedMonth - 1] || 'Unknown';
      
      // Generate filename
      let fileName = `DST ${monthName}_${selectedYear}.xlsx`;
      if (userInfo.role?.shortCode === 'root') {
        fileName = `DST ${monthName}_${selectedYear}_All_Branches.xlsx`;
      } else if (['deputy_director', 'regional_manager', 'area_admin'].includes(userInfo.role?.shortCode)) {
        const userName = `${userInfo.firstName} ${userInfo.lastName}`;
        fileName = `${userName} DST ${monthName}_${selectedYear}.xlsx`;
      } else if (userInfo.role?.shortCode === 'branch_manager') {
        fileName = `${userInfo.designatedBranch || 'Branch'} DST ${monthName}_${selectedYear}.xlsx`;
      }

      if (!loansData || loansData.length === 0) {
        toast.warning('No data available to export');
        return;
      }

      const monthYear = `${monthName} ${selectedYear}`;
      const headerBranchName = userInfo.designatedBranch || 'Main Branch';
      
      // Create Excel buffer
      const excelBuffer = await createExcelBuffer(
        loansData, 
        headerBranchName, 
        monthYear, 
        userInfo.role?.shortCode
      );
      
      // Download the file
      downloadExcel(excelBuffer, fileName);
      
      toast.success(`Excel file downloaded successfully! (${loansData.length} records)`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Error generating Excel file: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportLoansToExcel,
    isExporting
  };
};