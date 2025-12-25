import React, { useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import { toast } from 'react-toastify';
import moment from 'moment';
import { Upload, AlertTriangle } from 'lucide-react';
import { LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS, getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import { fetchWrapper } from '@/lib/fetch-wrapper';

/**
 * CashCollectionBulkUpload Component
 * 
 * Self-contained bulk upload component that renders a button and manages its own modal.
 * Similar to CashCollectionDetailsExcelExport component pattern.
 * 
 * Template: All columns from "MCBU Collection" onwards are editable (unlocked)
 * Upload: Parses paymentCollection, csfCollection, mcbuCol, remarks from Excel
 * MCBU/CSF Withdrawal: Creates records via API
 * 
 * Supports two modes:
 * 1. Download Template → Fill → Upload (recommended)
 * 2. Direct Upload (validates loan balance to ensure data is current)
 * 
 * @param {Function} onUploadComplete - Callback when upload is confirmed
 *   Receives array of client data with REAL field names (not prefixed):
 *   - paymentCollection: number
 *   - csfCollection: number  
 *   - mcbuCol: number
 *   - remarks: { label: string, value: string } | null
 *   - mcbuWithdrawal: number
 *   - csfWithdrawal: number
 *   - _bulkUploaded: true (flag to identify bulk uploaded records)
 *   - _hasChanges: boolean (true if any field was changed)
 * 
 * PARENT COMPONENT USAGE:
 * ```jsx
 * const handleBulkUploadComplete = (uploadedData) => {
 *     // 1. Update state directly - data already has real field names
 *     setGroupClients(prev => prev.map(client => {
 *         const uploaded = uploadedData.find(u => u.clientId === client.clientId);
 *         return uploaded || client;
 *     }));
 *     
 *     // 2. Trigger onChange/onBlur on inputs (for defaultValue inputs)
 *     setTimeout(() => {
 *         uploadedData.forEach(client => {
 *             if (!client._hasChanges) return;
 *             
 *             // Trigger paymentCollection input
 *             const paymentInput = document.querySelector(
 *                 `input[data-client-id="${client.clientId}"][data-field="paymentCollection"]`
 *             );
 *             if (paymentInput) {
 *                 paymentInput.value = client.paymentCollection;
 *                 paymentInput.dispatchEvent(new Event('input', { bubbles: true }));
 *                 paymentInput.dispatchEvent(new Event('blur', { bubbles: true }));
 *             }
 *             
 *             // Similar for csfCollection, mcbuCol, remarks...
 *         });
 *     }, 100);
 *     
 *     // 3. DO NOT call getCashCollections() - data is not saved yet
 * };
 * ```
 */
const CashCollectionBulkUpload = ({
    groupData,
    groupId,
    groupName,
    currentDate,
    mode = 'daily',
    onUploadComplete,
    branchId,
    loId,
    divisionId,
    regionId,
    areaId,
    hasGroupLeader = false,
    disabled = false
}) => {
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState(1);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedData, setUploadedData] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [uploadMode, setUploadMode] = useState('template'); // 'template' or 'direct'
    const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);
    const fileInputRef = useRef(null);
    const directFileInputRef = useRef(null);
    
    const currentUser = useSelector(state => state.user.data);

    const remarksOptions = mode === 'daily' ? LOR_DAILY_REMARKS : LOR_WEEKLY_REMARKS;
    
    // Check if current month is December for MCBU Interest column
    const currentMonth = moment(currentDate).month();
    const showMcbuInterest = currentMonth === 11;

    const generateTemplateFilename = useCallback(() => {
        const dateStr = moment(currentDate).format('YYYY-MM-DD');
        const groupNameSafe = groupName.replace(/[^a-zA-Z0-9]/g, '_');
        return `CashCollection_${mode}_${groupId}_${dateStr}_${groupNameSafe}.xlsx`;
    }, [currentDate, groupId, groupName, mode]);

    const parseTemplateFilename = useCallback((filename) => {
        // Handle browser duplicate suffixes like " (1)", " (2)", etc.
        // Example: CashCollection_daily_64f91ede19f25bfc17a7b19e_2025-12-24_BLUE (1).xlsx
        const regex = /^CashCollection_(daily|weekly)_([a-f0-9-]+)_(\d{4}-\d{2}-\d{2})_(.+?)(?:\s*\(\d+\))?\.xlsx$/i;
        const match = filename.match(regex);
        
        if (match) {
            return {
                valid: true,
                mode: match[1],
                groupId: match[2],
                date: match[3],
                groupName: match[4]
            };
        }
        return { valid: false };
    }, []);

    /**
     * Download Excel template with ALL columns matching the table exactly
     * Columns from MCBU Collection onwards are editable (unlocked and highlighted yellow)
     */
    const handleDownloadTemplate = async () => {
        setIsDownloading(true);
        
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'AmberCash PH Micro Lending Corp';
            workbook.created = new Date();
            
            const worksheet = workbook.addWorksheet('Cash Collection');
            
            // Define ALL columns matching the table exactly
            let columns = [
                { header: 'Slot #', key: 'slotNo', width: 8, locked: true },
                { header: 'Client Name', key: 'fullName', width: 25, locked: true },
                { header: 'Advance Credit', key: 'advanceCredit', width: 14, locked: true },
                { header: 'Co-Maker', key: 'coMaker', width: 10, locked: true },
                { header: 'Cycle #', key: 'loanCycle', width: 8, locked: true },
                { header: 'MCBU', key: 'mcbu', width: 12, locked: true },
                { header: 'CSF', key: 'csf', width: 12, locked: true },
                { header: 'Total Loan Release w/ SC', key: 'amountRelease', width: 20, locked: true },
                { header: 'Total Loan Balance', key: 'loanBalance', width: 18, locked: true },
                { header: 'Current Releases', key: 'currentReleaseAmount', width: 16, locked: true },
                { header: '# of Payments', key: 'noOfPayments', width: 14, locked: true },
                // Editable columns (yellow highlighted, unlocked)
                { header: 'MCBU Collection', key: 'mcbuCol', width: 16, locked: false, editable: true },
                { header: 'CSF Collection', key: 'csfCol', width: 14, locked: false, editable: true },
                { header: 'Target Collection', key: 'targetCollection', width: 16, locked: true },
                { header: 'Excess', key: 'excess', width: 12, locked: true },
                { header: 'Actual Collection', key: 'paymentCollection', width: 16, locked: false, editable: true },
                { header: 'Admission Fee', key: 'admissionCollection', width: 14, locked: true },
                { header: 'LRF', key: 'lrfCollection', width: 10, locked: true },
                { header: 'C.B.H.B Collection', key: 'cbhbCollection', width: 16, locked: true },
                { header: 'Add. Hosp.', key: 'addHospitalization', width: 12, locked: true },
            ];
            
            // Add CSF In column if no group leader
            if (!hasGroupLeader) {
                columns.push({ header: 'CSF In', key: 'csfIn', width: 10, locked: false, editable: true });
            }
            
            columns = columns.concat([
                { header: 'Other Income', key: 'otherIncome', width: 14, locked: true },
                { header: 'MCBU Withdrawal', key: 'mcbuWithdrawal', width: 16, locked: false, editable: true },
                { header: 'CSF Withdrawal', key: 'csfWithdrawal', width: 14, locked: false, editable: true },
            ]);
            
            // Add MCBU Interest column if December
            if (showMcbuInterest) {
                columns.push({ header: 'MCBU Interest', key: 'mcbuInterest', width: 14, locked: false, editable: true });
            }
            
            columns = columns.concat([
                { header: 'MCBU/CSF Return Amt', key: 'mcbuReturnAmt', width: 18, locked: true },
                { header: 'Full Payment', key: 'fullPayment', width: 14, locked: true },
                { header: 'Total Net Collection', key: 'totalCollection', width: 18, locked: true },
                { header: 'Mispay', key: 'mispayment', width: 10, locked: true },
                { header: '# of Mispay', key: 'noMispayment', width: 12, locked: true },
                { header: 'Past Due', key: 'pastDue', width: 12, locked: true },
                { header: 'Remarks', key: 'remarks', width: 20, locked: false, editable: true },
                { header: 'TOC', key: 'transferStr', width: 8, locked: true },
                // Hidden columns for data integrity
                { header: 'Client ID', key: 'clientId', width: 15, locked: true, hidden: true },
                { header: 'Loan ID', key: 'loanId', width: 15, locked: true, hidden: true },
                { header: 'Group Leader', key: 'groupLeader', width: 12, locked: true, hidden: true },
            ]);
            
            worksheet.columns = columns;
            
            // Style header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, size: 11 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9E1F2' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            headerRow.height = 30;
            
            // Filter and sort data (exclude pending loans and totals)
            const filteredData = groupData
                .filter(g => 
                    g.status !== 'totals' && 
                    g.status !== 'open' && 
                    g.status !== 'pending' &&
                    g.loanStatus !== 'pending' &&
                    g.fullName && 
                    g.fullName !== '-'
                )
                .sort((a, b) => (a.slotNo || 0) - (b.slotNo || 0));
            
            // Add data rows
            filteredData.forEach((client, index) => {
                const rowData = {
                    slotNo: client.slotNo,
                    fullName: client.fullName,
                    advanceCredit: client.advanceDays || 0,
                    coMaker: client.coMaker || '-',
                    loanCycle: client.loanCycle,
                    mcbu: safeNumber(client.mcbu),
                    csf: safeNumber(client.csf),
                    amountRelease: safeNumber(client.amountRelease),
                    loanBalance: safeNumber(client.loanBalance),
                    currentReleaseAmount: safeNumber(client.currentReleaseAmount),
                    noOfPayments: client.noOfPaymentStr || '-',
                    mcbuCol: safeNumber(client.mcbuCol) || '',
                    csfCol: safeNumber(client.csfCollection) || '',
                    targetCollection: safeNumber(client.targetCollection),
                    excess: safeNumber(client.excess),
                    paymentCollection: safeNumber(client.paymentCollection) || '',
                    admissionCollection: safeNumber(client.admissionCollection),
                    lrfCollection: safeNumber(client.lrfCollection),
                    cbhbCollection: safeNumber(client.cbhbCollection),
                    addHospitalization: safeNumber(client.addHospitalization),
                    otherIncome: safeNumber(client.otherIncome),
                    mcbuWithdrawal: safeNumber(client.mcbuWithdrawal) || '',
                    csfWithdrawal: safeNumber(client.csfWithdrawal) || '',
                    mcbuReturnAmt: safeNumber(client.mcbuReturnAmt),
                    fullPayment: safeNumber(client.fullPayment),
                    totalCollection: safeNumber(client.totalCollection),
                    mispayment: client.mispaymentStr || '-',
                    noMispayment: client.noMispaymentStr || '-',
                    pastDue: safeNumber(client.pastDue),
                    remarks: client.remarks?.label || '',
                    transferStr: client.transferStr || '-',
                    clientId: client.clientId,
                    loanId: client.loanId,
                    groupLeader: client.groupLeader ? 'Yes' : 'No',
                };
                
                if (!hasGroupLeader) {
                    rowData.csfIn = safeNumber(client.csfIn) || '';
                }
                
                if (showMcbuInterest) {
                    rowData.mcbuInterest = safeNumber(client.mcbuInterest) || '';
                }
                
                const row = worksheet.addRow(rowData);
                
                // Style data cells
                row.eachCell((cell, colNumber) => {
                    const column = columns[colNumber - 1];
                    
                    // Yellow background for editable columns
                    if (column && column.editable) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFF2CC' }
                        };
                    }
                    
                    // Number formatting for currency columns
                    if (['mcbu', 'csf', 'amountRelease', 'loanBalance', 'currentReleaseAmount', 
                         'targetCollection', 'excess', 'paymentCollection', 'mcbuCol', 'csfCol',
                         'admissionCollection', 'lrfCollection', 'cbhbCollection', 'addHospitalization',
                         'otherIncome', 'mcbuWithdrawal', 'csfWithdrawal', 'mcbuReturnAmt',
                         'fullPayment', 'totalCollection', 'pastDue', 'mcbuInterest', 'csfIn'].includes(column?.key)) {
                        cell.numFmt = '#,##0.00';
                    }
                    
                    cell.alignment = { vertical: 'middle' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
                    };
                });
                
                // Alternate row colors
                if (index % 2 === 1) {
                    row.eachCell((cell, colNumber) => {
                        const column = columns[colNumber - 1];
                        if (!column?.editable) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF5F5F5' }
                            };
                        }
                    });
                }
            });
            
            // Enable sheet protection but leave editable columns unlocked
            worksheet.protect('', {
                selectLockedCells: true,
                selectUnlockedCells: true,
                formatCells: false,
                formatColumns: false,
                formatRows: false,
                insertColumns: false,
                insertRows: false,
                insertHyperlinks: false,
                deleteColumns: false,
                deleteRows: false,
                sort: false,
                autoFilter: false,
                pivotTables: false
            });
            
            // Unlock editable columns
            columns.forEach((col, colIndex) => {
                if (col.editable) {
                    worksheet.getColumn(colIndex + 1).eachCell((cell) => {
                        cell.protection = { locked: false };
                    });
                }
            });
            
            // Hide ID columns
            const clientIdCol = columns.findIndex(c => c.key === 'clientId') + 1;
            const loanIdCol = columns.findIndex(c => c.key === 'loanId') + 1;
            const groupLeaderCol = columns.findIndex(c => c.key === 'groupLeader') + 1;
            if (clientIdCol > 0) worksheet.getColumn(clientIdCol).hidden = true;
            if (loanIdCol > 0) worksheet.getColumn(loanIdCol).hidden = true;
            if (groupLeaderCol > 0) worksheet.getColumn(groupLeaderCol).hidden = true;
            
            // Add Instructions sheet
            const instructionSheet = workbook.addWorksheet('Instructions');
            const instructions = [
                ['BULK UPLOAD INSTRUCTIONS'],
                [''],
                [`Group: ${groupName}`],
                [`Date: ${moment(currentDate).format('MMMM DD, YYYY')}`],
                [`Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`],
                [''],
                ['INSTRUCTIONS:'],
                ['1. Fill in the YELLOW highlighted columns only'],
                ['2. Editable columns: MCBU Collection, CSF Collection, Actual Collection, Remarks'],
                ['3. For withdrawals, enter the withdrawal amount in MCBU Withdrawal or CSF Withdrawal columns'],
                ['4. Use the remarks dropdown values exactly as shown below'],
                ['5. Save the file and upload it back to the system'],
                [''],
                ['IMPORTANT:'],
                ['- Do NOT rename this file'],
                ['- Do NOT modify the locked columns (Slot # through # of Payments)'],
                ['- Upload this file back to the same group and date'],
                [''],
                ['REMARKS OPTIONS:'],
                ...remarksOptions.filter(r => r.value !== '').map(r => [`  • ${r.label}`])
            ];
            
            instructions.forEach((row, index) => {
                const excelRow = instructionSheet.addRow(row);
                if (index === 0) {
                    excelRow.font = { bold: true, size: 14 };
                } else if (row[0] === 'INSTRUCTIONS:' || row[0] === 'IMPORTANT:' || row[0] === 'REMARKS OPTIONS:') {
                    excelRow.font = { bold: true };
                }
            });
            
            // Generate and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = generateTemplateFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('Template downloaded successfully!');
            setStep(2);
            setHasDownloadedTemplate(true);
            
        } catch (error) {
            console.error('Error generating template:', error);
            toast.error('Failed to generate template: ' + error.message);
        } finally {
            setIsDownloading(false);
        }
    };

    /**
     * Handle file upload and parse data
     * Supports two modes:
     * - template: validates filename matches downloaded template
     * - direct: validates loan balance to ensure data is current
     */
    const handleFileSelect = async (event, isDirect = false) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        setValidationErrors([]);
        setUploadedData(null);
        
        try {
            // For template mode, validate filename strictly
            if (!isDirect) {
                const filenameData = parseTemplateFilename(file.name);
                
                if (!filenameData.valid) {
                    toast.error('Invalid file format. Please use the downloaded template without renaming it.');
                    return;
                }
                
                if (filenameData.groupId !== groupId) {
                    toast.error(`This template is for a different group. Expected group: ${groupName}`);
                    return;
                }
                
                const expectedDate = moment(currentDate).format('YYYY-MM-DD');
                if (filenameData.date !== expectedDate) {
                    toast.error(`This template is for a different date (${filenameData.date}). Expected: ${expectedDate}`);
                    return;
                }
                
                if (filenameData.mode !== mode) {
                    toast.error(`This template is for ${filenameData.mode} mode. Current mode: ${mode}`);
                    return;
                }
            } else {
                // For direct upload, still check date if filename looks like a template
                const filenameData = parseTemplateFilename(file.name);
                if (filenameData.valid) {
                    const expectedDate = moment(currentDate).format('YYYY-MM-DD');
                    if (filenameData.date !== expectedDate) {
                        toast.error(
                            `This file appears to be a template from ${filenameData.date}. ` +
                            `Today's date is ${expectedDate}. Please download a fresh template or the loan balance validation may fail.`
                        );
                        return;
                    }
                }
            }
            
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            
            const worksheet = workbook.getWorksheet('Cash Collection');
            if (!worksheet) {
                toast.error('Invalid template: "Cash Collection" sheet not found.');
                return;
            }
            
            // Get column indices from header row dynamically
            const headerRow = worksheet.getRow(1);
            const columnMap = {};
            headerRow.eachCell((cell, colNumber) => {
                const header = cell.value?.toString().trim();
                columnMap[header] = colNumber;
            });
            
            // Required columns for parsing
            const requiredColumns = {
                slotNo: columnMap['Slot #'],
                fullName: columnMap['Client Name'],
                paymentCollection: columnMap['Actual Collection'],
                mcbuCol: columnMap['MCBU Collection'],
                csfCol: columnMap['CSF Collection'],
                remarks: columnMap['Remarks'],
                mcbuWithdrawal: columnMap['MCBU Withdrawal'],
                csfWithdrawal: columnMap['CSF Withdrawal'],
                clientId: columnMap['Client ID'],
                loanId: columnMap['Loan ID'],
                groupLeader: columnMap['Group Leader'],
                loanBalance: columnMap['Total Loan Balance']  // For direct upload validation
            };
            
            const parsedData = [];
            const errors = [];
            const balanceMismatches = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                
                const slotNo = row.getCell(requiredColumns.slotNo).value;
                const fullName = row.getCell(requiredColumns.fullName).value;
                const clientId = row.getCell(requiredColumns.clientId)?.value;
                const loanId = row.getCell(requiredColumns.loanId)?.value;
                const groupLeaderVal = row.getCell(requiredColumns.groupLeader)?.value;
                const isGroupLeader = groupLeaderVal === 'Yes' || groupLeaderVal === true;
                
                // Parse loan balance for validation (strip currency formatting)
                let uploadedLoanBalance = row.getCell(requiredColumns.loanBalance)?.value;
                if (typeof uploadedLoanBalance === 'string') {
                    uploadedLoanBalance = parseFloat(uploadedLoanBalance.replace(/[₱,]/g, '')) || 0;
                } else {
                    uploadedLoanBalance = parseFloat(uploadedLoanBalance) || 0;
                }
                
                if (!slotNo && !fullName) return;
                
                // For direct upload mode, validate loan balance matches current data
                if (isDirect && slotNo) {
                    const currentClient = groupData.find(g => g.slotNo === slotNo);
                    if (currentClient && currentClient.status !== 'totals' && currentClient.status !== 'open') {
                        const currentLoanBalance = safeNumber(currentClient.loanBalance);
                        // Allow small tolerance for floating point comparison
                        if (Math.abs(currentLoanBalance - uploadedLoanBalance) > 0.01) {
                            balanceMismatches.push(
                                `Slot ${slotNo} (${fullName}): Loan balance mismatch. ` +
                                `File: ${formatPricePhp(uploadedLoanBalance)}, Current: ${formatPricePhp(currentLoanBalance)}. ` +
                                `Please download a fresh template.`
                            );
                        }
                    }
                }
                
                // Parse editable fields
                const paymentCollection = parseFloat(row.getCell(requiredColumns.paymentCollection).value) || 0;
                const mcbuCol = parseFloat(row.getCell(requiredColumns.mcbuCol).value) || 0;
                const csfCol = parseFloat(row.getCell(requiredColumns.csfCol).value) || 0;
                const remarksLabel = row.getCell(requiredColumns.remarks).value || '';
                const mcbuWithdrawal = parseFloat(row.getCell(requiredColumns.mcbuWithdrawal).value) || 0;
                const csfWithdrawal = parseFloat(row.getCell(requiredColumns.csfWithdrawal).value) || 0;
                
                // Convert remarks label to value
                const remarksOption = remarksOptions.find(r => r.label === remarksLabel);
                const remarksValue = remarksOption ? remarksOption.value : '';
                
                // Validation
                if (paymentCollection < 0) errors.push(`Row ${rowNumber}: Actual Collection cannot be negative`);
                if (mcbuCol < 0) errors.push(`Row ${rowNumber}: MCBU Collection cannot be negative`);
                if (csfCol < 0) errors.push(`Row ${rowNumber}: CSF Collection cannot be negative`);
                if (mcbuWithdrawal < 0) errors.push(`Row ${rowNumber}: MCBU Withdrawal cannot be negative`);
                if (csfWithdrawal < 0) errors.push(`Row ${rowNumber}: CSF Withdrawal cannot be negative`);
                if (csfWithdrawal > 0 && !isGroupLeader) errors.push(`Row ${rowNumber}: CSF Withdrawal is only allowed for Group Leaders`);
                if (remarksLabel && !remarksOption) errors.push(`Row ${rowNumber}: Invalid remarks value "${remarksLabel}"`);
                
                parsedData.push({
                    rowNumber,
                    slotNo,
                    fullName,
                    clientId,
                    loanId,
                    isGroupLeader,
                    uploadedLoanBalance,
                    // Fields to populate in UI (trigger onChange)
                    paymentCollection,
                    csfCol,
                    remarks: remarksValue ? { label: remarksLabel, value: remarksValue } : null,
                    // Additional data for reference
                    mcbuCol,
                    // Withdrawal fields (create records)
                    mcbuWithdrawal,
                    csfWithdrawal
                });
            });
            
            // For direct upload, check for balance mismatches first
            if (isDirect && balanceMismatches.length > 0) {
                setValidationErrors(balanceMismatches);
                toast.error(`Data is outdated! Found ${balanceMismatches.length} loan balance mismatch(es). Please download a fresh template.`);
                setIsUploading(false);
                return;
            }
            
            if (errors.length > 0) {
                setValidationErrors(errors);
                toast.error(`Found ${errors.length} validation error(s). Please fix and re-upload.`);
                return;
            }
            
            // Match parsed data with existing group data
            // Put values directly into REAL field names (not uploaded* prefixes)
            const matchedData = parsedData.map(parsed => {
                const existing = groupData.find(g => 
                    g.slotNo === parsed.slotNo || g.clientId === parsed.clientId
                );
                
                if (!existing) {
                    errors.push(`Slot ${parsed.slotNo}: Client not found in current group`);
                    return null;
                }
                
                const hasChanges = parsed.paymentCollection > 0 || 
                                   parsed.csfCol > 0 || 
                                   parsed.mcbuCol > 0 ||
                                   parsed.remarks?.value ||
                                   parsed.mcbuWithdrawal > 0 ||
                                   parsed.csfWithdrawal > 0;
                
                return {
                    ...existing,
                    // Direct field values (will be merged into state)
                    paymentCollection: parsed.paymentCollection || existing.paymentCollection,
                    csfCollection: parsed.csfCol || existing.csfCollection,
                    mcbuCol: parsed.mcbuCol || existing.mcbuCol,
                    remarks: parsed.remarks || existing.remarks,
                    // Withdrawal data (for API calls)
                    mcbuWithdrawal: parsed.mcbuWithdrawal || existing.mcbuWithdrawal,
                    csfWithdrawal: parsed.csfWithdrawal || existing.csfWithdrawal,
                    // Flags
                    isGroupLeader: parsed.isGroupLeader,
                    _bulkUploaded: true,  // Flag to identify bulk uploaded records
                    _hasChanges: hasChanges
                };
            }).filter(Boolean);
            
            if (errors.length > 0) {
                setValidationErrors(errors);
                toast.error(`Found ${errors.length} matching error(s).`);
                return;
            }
            
            setUploadedData(matchedData);
            setShowConfirmDialog(true);
            toast.success(`Successfully parsed ${matchedData.length} records. Please confirm to proceed.`);
            
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.error(error.message || 'Failed to parse file');
            setValidationErrors([error.message]);
        } finally {
            setIsUploading(false);
            // Reset file input
            if (event.target) event.target.value = '';
        }
    };

    /**
     * Confirm and process the uploaded data
     */
    const handleConfirmUpload = async () => {
        if (!uploadedData || uploadedData.length === 0) {
            toast.error('No data to process');
            return;
        }
        
        setIsUploading(true);
        
        try {
            // Process MCBU withdrawals
            const mcbuWithdrawals = uploadedData.filter(d => d.mcbuWithdrawal > 0);
            for (const client of mcbuWithdrawals) {
                try {
                    const withdrawalData = {
                        clientId: client.clientId,
                        loanId: client.loanId,
                        branchId: branchId,
                        loId: loId,
                        groupId: groupId,
                        divisionId: divisionId,
                        regionId: regionId,
                        areaId: areaId,
                        mcbu_withdrawal_amount: client.mcbuWithdrawal,
                        csf_withdrawal_amount: 0,
                        group_leader: client.isGroupLeader,
                        status: 'pending',
                        date: currentDate,
                        insertedBy: currentUser._id,
                        dateAdded: currentDate
                    };
                    
                    await fetchWrapper.post(getApiBaseUrl() + 'transactions/mcbu-withdrawal/save', withdrawalData);
                } catch (error) {
                    console.error(`Failed to create MCBU withdrawal for ${client.fullName}:`, error);
                    toast.error(`Failed to create MCBU withdrawal for ${client.fullName}`);
                }
            }
            
            // Process CSF withdrawals (for group leaders only)
            const csfWithdrawals = uploadedData.filter(d => d.csfWithdrawal > 0 && d.isGroupLeader);
            for (const client of csfWithdrawals) {
                try {
                    const withdrawalData = {
                        clientId: client.clientId,
                        loanId: client.loanId,
                        branchId: branchId,
                        loId: loId,
                        groupId: groupId,
                        divisionId: divisionId,
                        regionId: regionId,
                        areaId: areaId,
                        mcbu_withdrawal_amount: 0,
                        csf_withdrawal_amount: client.csfWithdrawal,
                        group_leader: true,
                        status: 'pending',
                        date: currentDate,
                        insertedBy: currentUser._id,
                        dateAdded: currentDate
                    };
                    
                    await fetchWrapper.post(getApiBaseUrl() + 'transactions/mcbu-withdrawal/save', withdrawalData);
                } catch (error) {
                    console.error(`Failed to create CSF withdrawal for ${client.fullName}:`, error);
                    toast.error(`Failed to create CSF withdrawal for ${client.fullName}`);
                }
            }
            
            // Call the completion callback with the uploaded data
            // Parent component should:
            // 1. Update state with this data (data already has real field names)
            // 2. Trigger onChange/onBlur on inputs if needed
            // 3. NOT call getCashCollections() - data is not saved yet
            if (onUploadComplete) {
                onUploadComplete(uploadedData);
            }
            
            toast.success('Upload processed successfully! Form has been populated.');
            handleCloseModal();
            
        } catch (error) {
            console.error('Error processing upload:', error);
            toast.error('Failed to process upload: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    /**
     * Reset modal state and close
     */
    const handleCloseModal = () => {
        setStep(1);
        setUploadedData(null);
        setValidationErrors([]);
        setShowConfirmDialog(false);
        setUploadMode('template');
        setHasDownloadedTemplate(false);
        setShowModal(false);
        // Reset file inputs
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (directFileInputRef.current) directFileInputRef.current.value = '';
    };

    /**
     * Open the modal
     */
    const handleOpenModal = () => {
        if (disabled) return;
        setShowModal(true);
    };

    // Get filtered client count (excluding pending loans)
    const clientCount = groupData?.filter(g => 
        g.status !== 'totals' && 
        g.status !== 'open' && 
        g.status !== 'pending' &&
        g.loanStatus !== 'pending' &&
        g.fullName && 
        g.fullName !== '-'
    ).length || 0;

    return (
        <>
            {/* Bulk Upload Button - matches Export button style */}
            <button
                onClick={handleOpenModal}
                disabled={disabled || !groupData || clientCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg 
                         hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200"
                title="Bulk Upload"
            >
                <Upload className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Bulk Upload</span>
            </button>

            {/* Main Modal - z-[9999] to stay above table header (z-20) and sticky elements */}
            {showModal && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleCloseModal} />
                        
                        {/* Modal Content */}
                        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-[10000]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Bulk Upload Cash Collection
                                </h3>
                                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="px-6 py-4">
                                {/* Info Section */}
                                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Group:</span>
                                            <span className="ml-2 font-medium">{groupName}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Date:</span>
                                            <span className="ml-2 font-medium">
                                                {moment(currentDate).format('MMMM DD, YYYY')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Mode:</span>
                                            <span className="ml-2 font-medium capitalize">{mode}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Clients:</span>
                                            <span className="ml-2 font-medium">{clientCount}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Step indicator - only show for template mode */}
                                {uploadMode === 'template' && (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-center space-x-4">
                                            <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
                                                <span className="ml-2 text-sm font-medium">Download Template</span>
                                            </div>
                                            <div className="w-12 h-0.5 bg-gray-200" />
                                            <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
                                                <span className="ml-2 text-sm font-medium">Upload Data</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Template Mode - Step 1: Download */}
                                {uploadMode === 'template' && step === 1 && (
                                    <div className="text-center py-6">
                                        <svg className="w-16 h-16 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <h4 className="text-lg font-medium mb-2">Download Template</h4>
                                        <p className="text-gray-600 mb-6">
                                            Download the Excel template with all columns matching the table.
                                            Fill in the yellow-highlighted columns and upload it back.
                                        </p>
                                        <button
                                            onClick={handleDownloadTemplate}
                                            disabled={isDownloading}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isDownloading ? 'Generating...' : 'Download Template'}
                                        </button>
                                        
                                        {/* Direct Upload Option */}
                                        <div className="mt-8 pt-6 border-t border-gray-200">
                                            <p className="text-sm text-gray-500 mb-3">Already have a template file?</p>
                                            <button
                                                onClick={() => setUploadMode('direct')}
                                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                Upload directly without downloading →
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Template Mode - Step 2: Upload */}
                                {uploadMode === 'template' && step === 2 && (
                                    <div className="text-center py-6">
                                        <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        <h4 className="text-lg font-medium mb-2">Upload Completed Template</h4>
                                        <p className="text-gray-600 mb-6">
                                            Upload the completed template file. Make sure you haven't renamed the file.
                                        </p>
                                        
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => handleFileSelect(e, false)}
                                            accept=".xlsx,.xls"
                                            className="hidden"
                                        />
                                        
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                                                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isUploading ? 'Processing...' : 'Select File to Upload'}
                                        </button>
                                        
                                        <div className="mt-4">
                                            <button onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline">
                                                ← Download template again
                                            </button>
                                        </div>
                                        
                                        {validationErrors.length > 0 && (
                                            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                                                <h5 className="text-sm font-medium text-red-800 mb-2">Validation Errors:</h5>
                                                <ul className="text-sm text-red-700 list-disc list-inside max-h-40 overflow-y-auto">
                                                    {validationErrors.map((error, index) => (
                                                        <li key={index}>{error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Direct Upload Mode */}
                                {uploadMode === 'direct' && (
                                    <div className="py-6">
                                        {/* Warning Banner */}
                                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                            <div className="flex items-start">
                                                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                                                <div className="text-sm">
                                                    <p className="font-medium text-amber-800 mb-1">Direct Upload Mode</p>
                                                    <p className="text-amber-700">
                                                        Your file will be validated by checking each client's loan balance 
                                                        against the current data. If balances don't match, you'll need to 
                                                        download a fresh template.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center">
                                            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <h4 className="text-lg font-medium mb-2">Upload Excel File</h4>
                                            <p className="text-gray-600 mb-6">
                                                Select your cash collection Excel file. The file must have the same 
                                                column structure as the template.
                                            </p>
                                            
                                            <input
                                                type="file"
                                                ref={directFileInputRef}
                                                onChange={(e) => handleFileSelect(e, true)}
                                                accept=".xlsx,.xls"
                                                className="hidden"
                                            />
                                            
                                            <button
                                                onClick={() => directFileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                                                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isUploading ? 'Validating & Processing...' : 'Select File to Upload'}
                                            </button>
                                            
                                            <div className="mt-4">
                                                <button 
                                                    onClick={() => {
                                                        setUploadMode('template');
                                                        setValidationErrors([]);
                                                    }} 
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    ← Back to download template
                                                </button>
                                            </div>
                                            
                                            {validationErrors.length > 0 && (
                                                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                                                    <h5 className="text-sm font-medium text-red-800 mb-2">
                                                        {validationErrors[0]?.includes('balance mismatch') 
                                                            ? 'Data Outdated - Loan Balance Mismatch:' 
                                                            : 'Validation Errors:'}
                                                    </h5>
                                                    <ul className="text-sm text-red-700 list-disc list-inside max-h-40 overflow-y-auto">
                                                        {validationErrors.map((error, index) => (
                                                            <li key={index}>{error}</li>
                                                        ))}
                                                    </ul>
                                                    {validationErrors[0]?.includes('balance mismatch') && (
                                                        <div className="mt-3 pt-3 border-t border-red-200">
                                                            <button
                                                                onClick={() => {
                                                                    setUploadMode('template');
                                                                    setValidationErrors([]);
                                                                    setStep(1);
                                                                }}
                                                                className="text-sm font-medium text-red-700 hover:text-red-800 underline"
                                                            >
                                                                Download Fresh Template
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Footer */}
                            <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
                                <button
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 
                                             hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Confirm Dialog - z-[10001] to stay above main modal */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-[10001] overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black bg-opacity-50" />
                        
                        {/* Dialog Content */}
                        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full z-[10002]">
                            <div className="px-6 py-4">
                                <h3 className="text-lg font-semibold mb-4">Confirm Upload</h3>
                                
                                {uploadedData && (
                                    <div className="space-y-3">
                                        <p className="text-gray-600">
                                            You are about to populate the cash collection form with the following data:
                                        </p>
                                        
                                        <div className="p-4 bg-gray-50 rounded-lg text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-gray-500">Records with data:</span>
                                                    <span className="ml-2 font-medium">
                                                        {uploadedData.filter(d => d._hasChanges).length}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Total Actual Col:</span>
                                                    <span className="ml-2 font-medium">
                                                        {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.paymentCollection || 0), 0))}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Total MCBU Col:</span>
                                                    <span className="ml-2 font-medium">
                                                        {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.mcbuCol || 0), 0))}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Total CSF Col:</span>
                                                    <span className="ml-2 font-medium">
                                                        {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.csfCollection || 0), 0))}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">MCBU Withdrawals:</span>
                                                    <span className="ml-2 font-medium">
                                                        {uploadedData.filter(d => d.mcbuWithdrawal > 0).length}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">CSF Withdrawals:</span>
                                                    <span className="ml-2 font-medium">
                                                        {uploadedData.filter(d => d.csfWithdrawal > 0).length}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <p className="text-amber-600 text-sm">
                                            Note: This will populate the form but won't save until you click Submit.
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end px-6 py-4 border-t bg-gray-50 space-x-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    disabled={isUploading}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 
                                             hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmUpload}
                                    disabled={isUploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isUploading ? 'Processing...' : 'Confirm & Populate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CashCollectionBulkUpload;