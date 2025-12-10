import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { Download } from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';
import { formatPricePhp } from '@/lib/utils';

const CashCollectionDetailsExcelExport = ({ 
    data, 
    groupInfo, 
    dateFilter, 
    occurence = 'daily',
    currentUser 
}) => {
    const [loading, setLoading] = useState(false);

    // Helper function to strip formatting and get plain numeric value
    const getPlainValue = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[₱,]/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    // Helper function to get display value (handles '-' and formatted strings)
    const getDisplayValue = (value) => {
        if (value === '-' || value === '' || value === null || value === undefined) return '-';
        return value;
    };

    // Check if group has a group leader (for CSF In column)
    const hasGroupLeader = data && data.some(row => row.groupLeader === true);

    // Get current month for MCBU Interest column
    const currentMonth = moment(dateFilter).month();

    const handleExport = async () => {
        try {
            setLoading(true);

            if (!data || data.length === 0) {
                toast.warning('No data available to export');
                setLoading(false);
                return;
            }

            // Filter out totals and open rows, keep only actual client data
            const filteredData = data.filter(row => 
                row.status !== 'totals' && 
                row.status !== 'open' && 
                row.clientId
            );

            if (filteredData.length === 0) {
                toast.warning('No client data available to export');
                setLoading(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Cash Collection Details');

            // Get loan officer name with fallbacks
            const loanOfficerName = groupInfo?.loanOfficerName || 
                                   groupInfo?.loanOfficer?.name || 
                                   groupInfo?.loanOfficer?.firstName + ' ' + groupInfo?.loanOfficer?.lastName ||
                                   currentUser?.firstName + ' ' + currentUser?.lastName ||
                                   'N/A';

            // Get branch name with fallback
            const branchName = groupInfo?.branch?.name || 
                              groupInfo?.branchName || 
                              currentUser?.designatedBranch || 
                              'N/A';

            // Define all columns - matching the exact order from CashCollectionDetails component
            const columns = [
                { header: 'Slot #', key: 'slotNo', width: 10 },
                { header: 'Client Name', key: 'fullName', width: 30 },
                { header: 'Advance Credit', key: 'advanceCredit', width: 12 },
                { header: 'Co-Maker', key: 'coMaker', width: 12 },
                { header: 'Cycle #', key: 'loanCycle', width: 10 },
                { header: 'MCBU', key: 'mcbu', width: 15 },
                { header: 'CSF', key: 'csf', width: 15 },
                { header: 'Total Loan Release w/ SC', key: 'amountRelease', width: 20 },
                { header: 'Total Loan Balance', key: 'loanBalance', width: 18 },
                { header: 'Current Releases', key: 'currentRelease', width: 18 },
                { header: '# of Payments', key: 'noOfPayments', width: 15 },
                { header: 'MCBU Collection', key: 'mcbuCollection', width: 18 },
                { header: 'CSF Collection', key: 'csfCollection', width: 18 },
                { header: 'Target Collection', key: 'targetCollection', width: 18 },
                { header: 'Excess', key: 'excess', width: 15 },
                { header: 'Actual Collection', key: 'paymentCollection', width: 18 },
                { header: 'Admission Fee', key: 'admissionFee', width: 15 },
                { header: 'LRF', key: 'lrf', width: 12 },
                { header: 'C.B.H.B Collection', key: 'cbhb', width: 18 },
                { header: 'Add. Hosp.', key: 'addHosp', width: 15 },
            ];

            // Conditionally add CSF In column (only if no group leader)
            if (!hasGroupLeader) {
                columns.push({ header: 'CSF In', key: 'csfIn', width: 15 });
            }

            // Continue with remaining columns
            columns.push(
                { header: 'Other Income Passbook/Picture', key: 'otherIncome', width: 25 },
                { header: 'MCBU Withdrawal', key: 'mcbuWithdrawal', width: 18 },
                { header: 'CSF Withdrawal', key: 'csfWithdrawal', width: 18 }
            );

            // Conditionally add MCBU Interest column (only in December)
            if (currentMonth === 11) {
                columns.push({ header: 'MCBU Interest', key: 'mcbuInterest', width: 15 });
            }

            // Final columns
            columns.push(
                { header: 'MCBU/CSF Return Amt', key: 'mcbuReturnAmt', width: 20 },
                { header: 'Full Payment', key: 'fullPayment', width: 18 },
                { header: 'Total Net Collection', key: 'totalNetCollection', width: 20 },
                { header: 'Mispay', key: 'mispay', width: 12 },
                { header: '# of Mispay', key: 'noMispay', width: 15 },
                { header: 'Past Due', key: 'pastDue', width: 15 },
                { header: 'Remarks', key: 'remarks', width: 25 },
                { header: 'TOC', key: 'toc', width: 12 }
            );

            // Set column definitions
            worksheet.columns = columns;

            // Add company header
            const headerRow1 = worksheet.addRow(['AMBERCASH PH MICRO LENDING CORP']);
            headerRow1.font = { size: 16, bold: true };
            headerRow1.alignment = { horizontal: 'center' };
            worksheet.mergeCells(1, 1, 1, columns.length);

            // Add report title
            const headerRow2 = worksheet.addRow([`Cash Collection Details (${occurence.toUpperCase()})`]);
            headerRow2.font = { size: 14, bold: true };
            headerRow2.alignment = { horizontal: 'center' };
            worksheet.mergeCells(2, 1, 2, columns.length);

            // Add group info
            const headerRow3 = worksheet.addRow([
                `Group: ${groupInfo?.name || 'N/A'}  |  Date: ${moment(dateFilter).format('MMMM DD, YYYY')}`
            ]);
            headerRow3.font = { size: 12, bold: true };
            headerRow3.alignment = { horizontal: 'center' };
            worksheet.mergeCells(3, 1, 3, columns.length);

            // Add branch and LO info
            const headerRow4 = worksheet.addRow([
                `Branch: ${branchName}  |  Loan Officer: ${loanOfficerName}`
            ]);
            headerRow4.font = { size: 11 };
            headerRow4.alignment = { horizontal: 'center' };
            worksheet.mergeCells(4, 1, 4, columns.length);

            // Add empty row
            worksheet.addRow([]);

            // Add column headers with styling
            const headerRow = worksheet.addRow(columns.map(col => col.header));
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.height = 30;

            // Add borders to header
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // Initialize totals object
            const totals = {
                advanceCredit: 0,
                mcbu: 0,
                csf: 0,
                amountRelease: 0,
                loanBalance: 0,
                currentRelease: 0,
                mcbuCollection: 0,
                csfCollection: 0,
                targetCollection: 0,
                excess: 0,
                paymentCollection: 0,
                admissionFee: 0,
                lrf: 0,
                cbhb: 0,
                addHosp: 0,
                csfIn: 0,
                otherIncome: 0,
                mcbuWithdrawal: 0,
                csfWithdrawal: 0,
                mcbuInterest: 0,
                mcbuReturnAmt: 0,
                fullPayment: 0,
                totalNetCollection: 0,
                mispayCount: 0,
                pastDue: 0
            };

            // Add data rows
            filteredData.forEach((row, index) => {
                // Extract remarks text
                let remarksText = '-';
                if (row.remarks) {
                    if (typeof row.remarks === 'object' && row.remarks.label) {
                        remarksText = row.remarks.label;
                    } else if (typeof row.remarks === 'string') {
                        remarksText = row.remarks;
                    }
                }

                // Build row data object
                const rowData = {
                    slotNo: row.slotNo || '-',
                    fullName: row.fullName || '-',
                    advanceCredit: row.advanceDays || 0,
                    coMaker: row.coMaker || '-',
                    loanCycle: row.loanCycle || '-',
                    mcbu: getPlainValue(row.mcbu || row.mcbuStr || 0),
                    csf: getPlainValue(row.csf || row.csfStr || 0),
                    amountRelease: getPlainValue(row.amountRelease || row.amountReleaseStr || 0),
                    loanBalance: getPlainValue(row.loanBalance || row.loanBalanceStr || 0),
                    currentRelease: getPlainValue(row.currentReleaseAmount || row.currentReleaseAmountStr || 0),
                    noOfPayments: row.noOfPaymentStr || row.noOfPayments || '-',
                    mcbuCollection: getPlainValue(row.mcbuCol || row.mcbuColStr || 0),
                    csfCollection: getPlainValue(row.csfCollection || row.csfCollectionStr || 0),
                    targetCollection: getPlainValue(row.targetCollection || row.targetCollectionStr || 0),
                    excess: getPlainValue(row.excess || row.excessStr || 0),
                    paymentCollection: getPlainValue(row.paymentCollection || row.paymentCollectionStr || 0),
                    admissionFee: getPlainValue(row.admissionCollection || 0),
                    lrf: getPlainValue(row.lrfCollection || 0),
                    cbhb: getPlainValue(row.cbhbCollection || 0),
                    addHosp: getPlainValue(row.addHospitalization || 0),
                    csfIn: getPlainValue(row.csfIn || row.csfInStr || 0),
                    otherIncome: getPlainValue(row.otherIncome || row.otherIncomeStr || 0),
                    mcbuWithdrawal: getPlainValue(row.mcbuWithdrawal || row.mcbuWithdrawalStr || 0),
                    csfWithdrawal: getPlainValue(row.csfWithdrawal || row.csfWithdrawalStr || 0),
                    mcbuInterest: getPlainValue(row.mcbuInterest || row.mcbuInterestStr || 0),
                    mcbuReturnAmt: getPlainValue(row.mcbuReturnAmt || row.mcbuReturnAmtStr || 0),
                    fullPayment: getPlainValue(row.fullPayment || row.fullPaymentStr || 0),
                    totalNetCollection: getPlainValue(row.totalCollection || 0),
                    mispay: row.mispaymentStr || '-',
                    noMispay: row.noMispaymentStr || '-',
                    pastDue: getPlainValue(row.pastDue || row.pastDueStr || 0),
                    remarks: remarksText,
                    toc: row.transferStr || '-'
                };

                // Add to totals (only numeric values)
                totals.advanceCredit += rowData.advanceCredit;
                totals.mcbu += rowData.mcbu;
                totals.csf += rowData.csf;
                totals.amountRelease += rowData.amountRelease;
                totals.loanBalance += rowData.loanBalance;
                totals.currentRelease += rowData.currentRelease;
                totals.mcbuCollection += rowData.mcbuCollection;
                totals.csfCollection += rowData.csfCollection;
                totals.targetCollection += rowData.targetCollection;
                totals.excess += rowData.excess;
                totals.paymentCollection += rowData.paymentCollection;
                totals.admissionFee += rowData.admissionFee;
                totals.lrf += rowData.lrf;
                totals.cbhb += rowData.cbhb;
                totals.addHosp += rowData.addHosp;
                totals.csfIn += rowData.csfIn;
                totals.otherIncome += rowData.otherIncome;
                totals.mcbuWithdrawal += rowData.mcbuWithdrawal;
                totals.csfWithdrawal += rowData.csfWithdrawal;
                totals.mcbuInterest += rowData.mcbuInterest;
                totals.mcbuReturnAmt += rowData.mcbuReturnAmt;
                totals.fullPayment += rowData.fullPayment;
                totals.totalNetCollection += rowData.totalNetCollection;
                totals.pastDue += rowData.pastDue;
                if (rowData.mispay === 'Yes') totals.mispayCount++;

                // Create row array in the same order as columns
                const cellValues = [
                    rowData.slotNo,
                    rowData.fullName,
                    rowData.advanceCredit,
                    rowData.coMaker,
                    rowData.loanCycle,
                    rowData.mcbu,
                    rowData.csf,
                    rowData.amountRelease,
                    rowData.loanBalance,
                    rowData.currentRelease,
                    rowData.noOfPayments,
                    rowData.mcbuCollection,
                    rowData.csfCollection,
                    rowData.targetCollection,
                    rowData.excess,
                    rowData.paymentCollection,
                    rowData.admissionFee,
                    rowData.lrf,
                    rowData.cbhb,
                    rowData.addHosp,
                ];

                if (!hasGroupLeader) {
                    cellValues.push(rowData.csfIn);
                }

                cellValues.push(
                    rowData.otherIncome,
                    rowData.mcbuWithdrawal,
                    rowData.csfWithdrawal
                );

                if (currentMonth === 11) {
                    cellValues.push(rowData.mcbuInterest);
                }

                cellValues.push(
                    rowData.mcbuReturnAmt,
                    rowData.fullPayment,
                    rowData.totalNetCollection,
                    rowData.mispay,
                    rowData.noMispay,
                    rowData.pastDue,
                    rowData.remarks,
                    rowData.toc
                );

                const dataRow = worksheet.addRow(cellValues);

                // Apply alternating row colors
                if (index % 2 === 0) {
                    dataRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF0F0F0' }
                    };
                }

                // Center specific columns (Slot #, Advance Credit, Cycle #, # of Payments)
                [1, 3, 5, 11].forEach(colNum => {
                    dataRow.getCell(colNum).alignment = { horizontal: 'center' };
                });

                // Format currency columns
                dataRow.eachCell((cell, colNumber) => {
                    if (typeof cell.value === 'number' && cell.value > 0 && colNumber >= 6) {
                        cell.numFmt = '₱#,##0.00';
                    }
                });

                // Add borders
                dataRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });

            // Build totals row array
            const totalsArray = [
                '',
                'TOTALS',
                totals.advanceCredit,
                '',
                '',
                totals.mcbu,
                totals.csf,
                totals.amountRelease,
                totals.loanBalance,
                totals.currentRelease,
                '',
                totals.mcbuCollection,
                totals.csfCollection,
                totals.targetCollection,
                totals.excess,
                totals.paymentCollection,
                totals.admissionFee,
                totals.lrf,
                totals.cbhb,
                totals.addHosp,
            ];

            if (!hasGroupLeader) {
                totalsArray.push(totals.csfIn);
            }

            totalsArray.push(
                totals.otherIncome,
                totals.mcbuWithdrawal,
                totals.csfWithdrawal
            );

            if (currentMonth === 11) {
                totalsArray.push(totals.mcbuInterest);
            }

            totalsArray.push(
                totals.mcbuReturnAmt,
                totals.fullPayment,
                totals.totalNetCollection,
                totals.mispayCount,
                '',
                totals.pastDue,
                '',
                ''
            );

            const totalsRow = worksheet.addRow(totalsArray);

            // Style totals row
            totalsRow.font = { bold: true };
            totalsRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
            };

            // Format currency in totals
            totalsRow.eachCell((cell, colNumber) => {
                if (typeof cell.value === 'number' && cell.value > 0 && colNumber >= 6) {
                    cell.numFmt = '₱#,##0.00';
                }
            });

            // Add borders to totals row
            totalsRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'double' },
                    left: { style: 'thin' },
                    bottom: { style: 'double' },
                    right: { style: 'thin' }
                };
            });

            // Generate and download file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const fileName = `Cash_Collection_${occurence}_${groupInfo?.name || 'Export'}_${moment(dateFilter).format('YYYY-MM-DD')}.xlsx`;
            link.download = fileName;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Excel file exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Error exporting to Excel: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg 
                     hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
            title="Export to Excel"
        >
            {loading ? (
                <>
                    <svg 
                        className="animate-spin h-5 w-5 text-gray-600" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24"
                    >
                        <circle 
                            className="opacity-25" 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="currentColor" 
                            strokeWidth="4"
                        />
                        <path 
                            className="opacity-75" 
                            fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Exporting...</span>
                </>
            ) : (
                <>
                    <Download className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Export</span>
                </>
            )}
        </button>
    );
};

export default CashCollectionDetailsExcelExport;