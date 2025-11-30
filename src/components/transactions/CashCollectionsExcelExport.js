import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';

const CashCollectionsExcelExport = ({
  data,
  grandTotalRow,
  visibleColumnDefs,
  currentFilter,
  currentUser,
  dateFilter,
  sortedData
}) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Helper function to get plain values (without formatting)
  const getPlainValue = (value) => {
    if (value === undefined || value === null || value === '-') {
      return '';
    }
    
    if (typeof value === 'string' && value.includes('₱')) {
      return parseFloat(value.replace('₱', '').replace(/,/g, ''));
    }
    
    if (typeof value === 'string' && value.includes('/')) {
      return value; // Keep formatted strings like "5 / 10"
    }
    
    return value;
  };

  // Helper function to extract comparison diff
  const getComparisonDiff = (current, previous) => {
    if (current === undefined || previous === undefined || current === '-' || previous === '-') {
      return null;
    }
    
    let currentValue, previousValue;
    
    if (typeof current === 'string' && current.includes('₱')) {
      currentValue = parseFloat(current.replace('₱', '').replace(/,/g, ''));
      previousValue = parseFloat(previous.replace('₱', '').replace(/,/g, ''));
    } else {
      currentValue = current;
      previousValue = previous;
    }
    
    if (isNaN(currentValue) || isNaN(previousValue)) {
      return null;
    }
    
    return currentValue - previousValue;
  };

  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);
      
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'AmberCash PH Micro Lending Corp';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Cash Collections');
      
      // Define columns based on visible columns
      const excelColumns = [];
      
      visibleColumnDefs.forEach(col => {
        if (col.key === 'actions') return; // Skip actions column
        
        excelColumns.push({
          header: col.label,
          key: col.key,
          width: 20
        });
        
        // Add comparison column if enabled and column has comparison
        if (includeComparison && col.hasComparison) {
          excelColumns.push({
            header: `${col.label} (+/-)`,
            key: `${col.key}_diff`,
            width: 15
          });
        }
      });
      
      worksheet.columns = excelColumns;
      
      // Style header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' }
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 25;
      
      // Add data rows
      sortedData.forEach((row, index) => {
        const rowData = {};
        
        visibleColumnDefs.forEach(col => {
          if (col.key === 'actions') return;
          
          if (col.key === 'name') {
            rowData[col.key] = row[col.key];
          } else if (col.key === 'transactionType') {
            rowData[col.key] = row[col.key] || '-';
          } else if (col.key === 'excess' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.excessCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.excessCurrent, row.excessPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbu' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.mcbu);
            if (includeComparison) {
              const diff = row._value.mcbuCollection - row._value.mcbuWithdrawal - row._value.mcbuReturn;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'csf' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.csf);
            if (includeComparison) {
              const diff = row._value.csfCollection - row._value.csfWithdrawal - row._value.csfReturnAmt;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'actualLoanCollection' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.actualLoanCollectionCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.actualLoanCollectionCurrent, row.actualLoanCollectionPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'activeClients' && col.hasComparison) {
            rowData[col.key] = row.activeClients;
            if (includeComparison) {
              const diff = row.activeClients - row.activeClientsPrevious;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'activeBorrowers' && col.hasComparison) {
            rowData[col.key] = row.activeBorrowers;
            if (includeComparison) {
              const diff = row.activeBorrowers - row.activeBorrowersPrevious;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'totalReleasesStr' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.totalReleasesStr);
            if (includeComparison) {
              const diff = row.currentReleaseAmount - row._value.fullPaymentAmount;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'totalLoanBalanceStr' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.totalLoanBalanceStr);
            if (includeComparison) {
              const diff = row.currentReleaseAmount - row._value.actualLoanCollection;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'fullPaymentPerson' && col.hasComparison) {
            rowData[col.key] = row.fullPaymentPersonCurrent;
            if (includeComparison) {
              const diff = row.fullPaymentPersonCurrent - row.fullPaymentPersonPrevious;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'fullPaymentAmount' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.fullPaymentAmountCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.fullPaymentAmountCurrent, row.fullPaymentAmountPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mispay' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.mispayCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.mispayCurrent, row.mispayPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'noPastDue' && col.hasComparison) {
            rowData[col.key] = row.noPastDueCurrent;
            if (includeComparison) {
              const diff = row.noPastDueCurrent - row.noPastDuePrevious;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbuWithdrawal' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.mcbuWithdrawalCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.mcbuWithdrawalCurrent, row.mcbuWithdrawalPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'noMcbuReturn' && col.hasComparison) {
            rowData[col.key] = row.noMcbuReturnCurrent;
            if (includeComparison) {
              const diff = row.noMcbuReturnCurrent - row.noMcbuReturnPrevious;
              rowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbuReturn' && col.hasComparison) {
            rowData[col.key] = getPlainValue(row.mcbuReturnCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(row.mcbuReturnCurrent, row.mcbuReturnPrevious);
              rowData[`${col.key}_diff`] = diff;
            }
          } else {
            rowData[col.key] = getPlainValue(row[col.key]);
          }
        });
        
        const excelRow = worksheet.addRow(rowData);
        
        // Apply row styling
        let bgColor = 'FFFFFFFF'; // Default white
        if (currentUser.role.rep >= 3 && row.activeClients > 0 && (row.groupStatus == 'pending' || row.groupStatus == null)) {
          bgColor = 'FFBFDBFE'; // Blue
        } else if (currentUser.role.rep < 3 && currentFilter != 'group' && row.activeClients > 0 && (row.approvalStatus == 'open' || row.groupStatus == 'pending' || row.groupStatus == null)) {
          bgColor = 'FFFEF3C7'; // Yellow
        }
        if (row.isDraft && currentFilter === 'group') {
          bgColor = 'FFFED7AA'; // Orange
        }
        
        excelRow.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Format currency cells
          if (typeof cell.value === 'number' && !Number.isInteger(cell.value)) {
            cell.numFmt = '₱#,##0.00';
          }
          
          // Format comparison cells
          const columnKey = worksheet.getColumn(colNumber).key;
          if (columnKey && columnKey.includes('_diff')) {
            if (typeof cell.value === 'number') {
              cell.numFmt = cell.value >= 0 ? '+#,##0.00;-#,##0.00' : '#,##0.00';
              cell.font = {
                color: { argb: cell.value >= 0 ? 'FF10B981' : 'FFEF4444' }
              };
            }
          }
        });
      });
      
      // Add grand total row if exists
      if (grandTotalRow) {
        const totalRowData = {};
        
        visibleColumnDefs.forEach(col => {
          if (col.key === 'actions') return;
          
          if (col.key === 'name') {
            totalRowData[col.key] = 'GRAND TOTALS';
          } else if (col.key === 'transactionType') {
            totalRowData[col.key] = grandTotalRow[col.key] || 'ALL';
          } else if (col.key === 'excess' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.excessCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.excessCurrent, grandTotalRow.excessPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbu' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.mcbu);
            if (includeComparison) {
              const diff = grandTotalRow._value.mcbuCollection - grandTotalRow._value.mcbuWithdrawal - grandTotalRow._value.mcbuReturn;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'csf' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.csf);
            if (includeComparison) {
              const diff = grandTotalRow._value.csfCollection - grandTotalRow._value.csfWithdrawal - grandTotalRow._value.csfReturnAmt;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'actualLoanCollection' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.actualLoanCollectionCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.actualLoanCollectionCurrent, grandTotalRow.actualLoanCollectionPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'activeClients' && col.hasComparison) {
            totalRowData[col.key] = grandTotalRow.activeClients;
            if (includeComparison) {
              const diff = grandTotalRow.activeClients - grandTotalRow.activeClientsPrevious;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'activeBorrowers' && col.hasComparison) {
            totalRowData[col.key] = grandTotalRow.activeBorrowers;
            if (includeComparison) {
              const diff = grandTotalRow.activeBorrowers - grandTotalRow.activeBorrowersPrevious;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'totalReleasesStr' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.totalReleasesStr);
            if (includeComparison) {
              const diff = grandTotalRow.currentReleaseAmount - grandTotalRow._value.fullPaymentAmount;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'totalLoanBalanceStr' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.totalLoanBalanceStr);
            if (includeComparison) {
              const diff = grandTotalRow.currentReleaseAmount - grandTotalRow._value.actualLoanCollection;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'fullPaymentPerson' && col.hasComparison) {
            totalRowData[col.key] = grandTotalRow.fullPaymentPersonCurrent;
            if (includeComparison) {
              const diff = grandTotalRow.fullPaymentPersonCurrent - grandTotalRow.fullPaymentPersonPrevious;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'fullPaymentAmount' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.fullPaymentAmountCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.fullPaymentAmountCurrent, grandTotalRow.fullPaymentAmountPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mispay' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.mispayCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.mispayCurrent, grandTotalRow.mispayPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'noPastDue' && col.hasComparison) {
            totalRowData[col.key] = grandTotalRow.noPastDueCurrent;
            if (includeComparison) {
              const diff = grandTotalRow.noPastDueCurrent - grandTotalRow.noPastDuePrevious;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbuWithdrawal' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.mcbuWithdrawalCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.mcbuWithdrawalCurrent, grandTotalRow.mcbuWithdrawalPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'noMcbuReturn' && col.hasComparison) {
            totalRowData[col.key] = grandTotalRow.noMcbuReturnCurrent;
            if (includeComparison) {
              const diff = grandTotalRow.noMcbuReturnCurrent - grandTotalRow.noMcbuReturnPrevious;
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else if (col.key === 'mcbuReturn' && col.hasComparison) {
            totalRowData[col.key] = getPlainValue(grandTotalRow.mcbuReturnCurrent);
            if (includeComparison) {
              const diff = getComparisonDiff(grandTotalRow.mcbuReturnCurrent, grandTotalRow.mcbuReturnPrevious);
              totalRowData[`${col.key}_diff`] = diff;
            }
          } else {
            totalRowData[col.key] = getPlainValue(grandTotalRow[col.key]);
          }
        });
        
        const totalRow = worksheet.addRow(totalRowData);
        totalRow.font = { bold: true };
        totalRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }
        };
        totalRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'double' },
            left: { style: 'thin' },
            bottom: { style: 'double' },
            right: { style: 'thin' }
          };
          
          // Format currency cells
          if (typeof cell.value === 'number' && !Number.isInteger(cell.value)) {
            cell.numFmt = '₱#,##0.00';
          }
        });
      }
      
      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 12), 40);
      });
      
      // Generate filename
      const entityType = currentFilter === 'division' ? 'Division' :
                        currentFilter === 'region' ? 'Region' :
                        currentFilter === 'area' ? 'Area' :
                        currentFilter === 'branch' ? 'Branch' :
                        currentFilter === 'lo' ? 'Loan_Officer' :
                        currentFilter === 'group' ? 'Group' : 'Cash_Collections';
      
      const fileName = `Cash_Collections_${entityType}_${moment(dateFilter).format('YYYY-MM-DD')}.xlsx`;
      
      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file exported successfully!');
      setShowExportDialog(false);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Error exporting to Excel: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowExportDialog(true)}
        className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
        title="Export as Excel"
        disabled={isExporting}
      >
        {isExporting ? (
          <RefreshCw size={20} className="animate-spin" />
        ) : (
          <Download size={20} />
        )}
      </button>

      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Export to Excel
            </h3>
            
            <div className="mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeComparison}
                  onChange={(e) => setIncludeComparison(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Include comparison values (+/-)
                </span>
              </label>
              <p className="mt-2 text-xs text-gray-500 ml-7">
                When enabled, additional columns will show the difference between current and previous values
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExportToExcel}
                disabled={isExporting}
                className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <span className="flex items-center justify-center">
                    <RefreshCw size={16} className="animate-spin mr-2" />
                    Exporting...
                  </span>
                ) : (
                  'Export'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CashCollectionsExcelExport;