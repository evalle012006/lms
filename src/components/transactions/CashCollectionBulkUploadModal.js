import React, { useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import { toast } from 'react-toastify';
import moment from 'moment';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS, getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import Dialog from '@/lib/ui/Dialog';

/**
 * CashCollectionBulkUploadModal Component
 * 
 * This component provides bulk upload functionality for cash collection data.
 * Columns match the table exactly with editable fields highlighted in yellow.
 */
const CashCollectionBulkUploadModal = ({
    show,
    onClose,
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
    hasGroupLeader = false // Pass this from parent to control CSF In column
}) => {
    const [step, setStep] = useState(1);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedData, setUploadedData] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const fileInputRef = useRef(null);
    
    const currentUser = useSelector(state => state.user.data);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);

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
        const regex = /^CashCollection_(daily|weekly)_([a-f0-9-]+)_(\d{4}-\d{2}-\d{2})_(.+)\.xlsx$/i;
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
     */
    const handleDownloadTemplate = async () => {
        setIsDownloading(true);
        
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'AmberCash PH Micro Lending Corp';
            workbook.created = new Date();
            
            const worksheet = workbook.addWorksheet('Cash Collection');
            
            // Define ALL columns matching the table exactly
            // Editable columns: MCBU Collection, CSF Collection, Actual Collection, MCBU Withdrawal, Remarks
            let columns = [
                { header: 'Slot #', key: 'slotNo', width: 8 },
                { header: 'Client Name', key: 'fullName', width: 25 },
                { header: 'Advance Credit', key: 'advanceCredit', width: 14 },
                { header: 'Co-Maker', key: 'coMaker', width: 10 },
                { header: 'Cycle #', key: 'loanCycle', width: 8 },
                { header: 'MCBU', key: 'mcbu', width: 12 },
                { header: 'CSF', key: 'csf', width: 12 },
                { header: 'Total Loan Release w/ SC', key: 'amountRelease', width: 22 },
                { header: 'Total Loan Balance', key: 'loanBalance', width: 18 },
                { header: 'Current Releases', key: 'currentReleaseAmount', width: 16 },
                { header: '# of Payments', key: 'noOfPayments', width: 14 },
                { header: 'MCBU Collection*', key: 'mcbuCol', width: 16 },
                { header: 'CSF Collection*', key: 'csfCol', width: 14 },
                { header: 'Target Collection', key: 'targetCollection', width: 16 },
                { header: 'Excess', key: 'excess', width: 12 },
                { header: 'Actual Collection*', key: 'paymentCollection', width: 18 },
                { header: 'Admission Fee', key: 'admissionCollection', width: 14 },
                { header: 'LRF', key: 'lrfCollection', width: 10 },
                { header: 'C.B.H.B Collection', key: 'cbhbCollection', width: 18 },
                { header: 'Add. Hosp.', key: 'addHospitalization', width: 12 },
            ];
            
            // Add CSF In column if no group leader
            if (!hasGroupLeader) {
                columns.push({ header: 'CSF In', key: 'csfIn', width: 10 });
            }
            
            // Continue with remaining columns
            columns = columns.concat([
                { header: 'Other Income Passbook/Picture', key: 'otherIncome', width: 26 },
                { header: 'MCBU Withdrawal*', key: 'mcbuWithdrawal', width: 18 },
                { header: 'CSF Withdrawal', key: 'csfWithdrawal', width: 14 },
            ]);
            
            // Add MCBU Interest column if December
            if (showMcbuInterest) {
                columns.push({ header: 'MCBU Interest', key: 'mcbuInterest', width: 14 });
            }
            
            // Continue with remaining columns
            columns = columns.concat([
                { header: 'MCBU/CSF Return Amt', key: 'mcbuReturnAmt', width: 20 },
                { header: 'Full Payment', key: 'fullPayment', width: 14 },
                { header: 'Total Net Collection', key: 'totalCollection', width: 18 },
                { header: 'Mispay', key: 'mispayment', width: 10 },
                { header: '# of Mispay', key: 'noMispayment', width: 12 },
                { header: 'Past Due', key: 'pastDue', width: 12 },
                { header: 'Remarks*', key: 'remarks', width: 30 },
                // Hidden columns for reference
                { header: 'Client ID', key: 'clientId', width: 15 },
                { header: 'Loan ID', key: 'loanId', width: 15 },
            ]);
            
            worksheet.columns = columns;
            
            // Calculate editable column indices (these will be highlighted yellow)
            // Editable: MCBU Collection (12), CSF Collection (13), Actual Collection (16), MCBU Withdrawal, Remarks
            let editableColumnKeys = ['mcbuCol', 'csfCol', 'paymentCollection', 'mcbuWithdrawal', 'remarks'];
            let editableColumnIndices = editableColumnKeys.map(key => {
                const colIndex = columns.findIndex(c => c.key === key);
                return colIndex + 1; // Excel is 1-based
            });
            
            // Style header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2F5496' }
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            headerRow.height = 35;
            
            // Add data rows
            const clientData = groupData.filter(cc => 
                cc.status !== 'totals' && 
                cc.status !== 'open' && 
                cc.fullName && 
                cc.fullName !== '-'
            );
            
            clientData.forEach((client, index) => {
                let rowData = {
                    slotNo: client.slotNo,
                    fullName: client.fullName || '-',
                    advanceCredit: safeNumber(client.advanceDays),
                    coMaker: client.coMaker || '-',
                    loanCycle: client.loanCycle || '-',
                    mcbu: safeNumber(client.mcbu),
                    csf: safeNumber(client.csf),
                    amountRelease: safeNumber(client.amountRelease),
                    loanBalance: safeNumber(client.loanBalance),
                    currentReleaseAmount: safeNumber(client.currentReleaseAmount),
                    noOfPayments: client.noOfPaymentStr || '-',
                    mcbuCol: '', // Editable
                    csfCol: '', // Editable
                    targetCollection: safeNumber(client.targetCollection) || safeNumber(client.activeLoan),
                    excess: safeNumber(client.excess),
                    paymentCollection: '', // Editable
                    admissionCollection: safeNumber(client.admissionCollection),
                    lrfCollection: safeNumber(client.lrfCollection),
                    cbhbCollection: safeNumber(client.cbhbCollection),
                    addHospitalization: safeNumber(client.addHospitalization),
                    otherIncome: safeNumber(client.otherIncome),
                    mcbuWithdrawal: '', // Editable
                    csfWithdrawal: safeNumber(client.csfWithdrawal),
                    mcbuReturnAmt: safeNumber(client.mcbuReturnAmt),
                    fullPayment: safeNumber(client.fullPayment),
                    totalCollection: safeNumber(client.totalCollection),
                    mispayment: client.mispaymentStr || '-',
                    noMispayment: client.noMispaymentStr || '-',
                    pastDue: safeNumber(client.pastDue),
                    remarks: '', // Editable
                    clientId: client.clientId || '',
                    loanId: client.loanId || client._id || '',
                };
                
                // Add CSF In if applicable
                if (!hasGroupLeader) {
                    rowData.csfIn = safeNumber(client.csfIn);
                }
                
                // Add MCBU Interest if December
                if (showMcbuInterest) {
                    rowData.mcbuInterest = safeNumber(client.mcbuInterest);
                }
                
                const row = worksheet.addRow(rowData);
                
                // Style row
                row.alignment = { horizontal: 'center', vertical: 'middle' };
                row.font = { size: 9 };
                
                // Left align client name
                const clientNameColIndex = columns.findIndex(c => c.key === 'fullName') + 1;
                row.getCell(clientNameColIndex).alignment = { horizontal: 'left', vertical: 'middle' };
                
                // Right align numeric columns
                const numericKeys = ['mcbu', 'csf', 'amountRelease', 'loanBalance', 'currentReleaseAmount', 
                    'targetCollection', 'excess', 'admissionCollection', 'lrfCollection', 'cbhbCollection',
                    'addHospitalization', 'otherIncome', 'csfWithdrawal', 'mcbuReturnAmt', 'fullPayment',
                    'totalCollection', 'pastDue', 'csfIn', 'mcbuInterest'];
                numericKeys.forEach(key => {
                    const colIndex = columns.findIndex(c => c.key === key);
                    if (colIndex >= 0) {
                        row.getCell(colIndex + 1).alignment = { horizontal: 'right', vertical: 'middle' };
                    }
                });
            });
            
            // Lock non-editable columns and highlight editable ones
            for (let rowNum = 2; rowNum <= clientData.length + 1; rowNum++) {
                // Lock all cells first
                for (let colNum = 1; colNum <= columns.length; colNum++) {
                    const cell = worksheet.getCell(rowNum, colNum);
                    cell.protection = { locked: true };
                }
                
                // Unlock and highlight editable columns
                editableColumnIndices.forEach(colNum => {
                    if (colNum > 0) {
                        const cell = worksheet.getCell(rowNum, colNum);
                        cell.protection = { locked: false };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFFFCC' } // Light yellow
                        };
                    }
                });
            }
            
            // Hide reference columns (Client ID, Loan ID - last 2 columns)
            const clientIdColIndex = columns.findIndex(c => c.key === 'clientId') + 1;
            const loanIdColIndex = columns.findIndex(c => c.key === 'loanId') + 1;
            if (clientIdColIndex > 0) worksheet.getColumn(clientIdColIndex).hidden = true;
            if (loanIdColIndex > 0) worksheet.getColumn(loanIdColIndex).hidden = true;
            
            // Add data validation for Remarks column
            const remarksLabels = remarksOptions.filter(r => r.value !== '').map(r => r.label);
            const remarksColIndex = columns.findIndex(c => c.key === 'remarks') + 1;
            for (let rowNum = 2; rowNum <= clientData.length + 1; rowNum++) {
                worksheet.getCell(rowNum, remarksColIndex).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${remarksLabels.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Remarks',
                    error: 'Please select a valid remarks option from the dropdown.'
                };
            }
            
            // Add number validation for numeric editable columns
            const numericEditableKeys = ['mcbuCol', 'csfCol', 'paymentCollection', 'mcbuWithdrawal'];
            numericEditableKeys.forEach(key => {
                const colIndex = columns.findIndex(c => c.key === key) + 1;
                if (colIndex > 0) {
                    for (let rowNum = 2; rowNum <= clientData.length + 1; rowNum++) {
                        worksheet.getCell(rowNum, colIndex).dataValidation = {
                            type: 'decimal',
                            operator: 'greaterThanOrEqual',
                            allowBlank: true,
                            formulae: [0],
                            showErrorMessage: true,
                            errorTitle: 'Invalid Number',
                            error: 'Please enter a valid number (0 or greater).'
                        };
                    }
                }
            });
            
            // Protect worksheet
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
            
            // Add instructions sheet
            const instructionSheet = workbook.addWorksheet('Instructions');
            instructionSheet.getColumn(1).width = 80;
            
            const instructions = [
                ['CASH COLLECTION BULK UPLOAD TEMPLATE'],
                [''],
                [`Group: ${groupName}`],
                [`Date: ${moment(currentDate).format('MMMM DD, YYYY (dddd)')}`],
                [`Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`],
                [''],
                ['INSTRUCTIONS:'],
                ['1. Fill in the yellow-highlighted columns only:'],
                ['   - MCBU Collection*'],
                ['   - CSF Collection*'],
                ['   - Actual Collection*'],
                ['   - MCBU Withdrawal*'],
                ['   - Remarks*'],
                [''],
                ['2. All other columns are locked and show reference data only'],
                ['3. Use the dropdown for Remarks column to select valid options'],
                ['4. Leave cells blank if no data to enter (they will be treated as 0 or empty)'],
                ['5. MCBU Withdrawal will create a separate MCBU Withdrawal record when processed'],
                [''],
                ['IMPORTANT:'],
                ['- Do NOT rename this file - the filename is used for validation'],
                ['- Do NOT modify the locked columns'],
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
            
        } catch (error) {
            console.error('Error generating template:', error);
            toast.error('Failed to generate template: ' + error.message);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        setValidationErrors([]);
        setUploadedData(null);
        
        try {
            const filenameData = parseTemplateFilename(file.name);
            
            if (!filenameData.valid) {
                throw new Error('Invalid file format. Please use the downloaded template without renaming it.');
            }
            
            if (filenameData.groupId !== groupId) {
                throw new Error(`This template is for a different group. Expected group: ${groupName}`);
            }
            
            const expectedDate = moment(currentDate).format('YYYY-MM-DD');
            if (filenameData.date !== expectedDate) {
                throw new Error(`This template is for a different date (${filenameData.date}). Expected: ${expectedDate}`);
            }
            
            if (filenameData.mode !== mode) {
                throw new Error(`This template is for ${filenameData.mode} mode. Current mode: ${mode}`);
            }
            
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
            
            const worksheet = workbook.getWorksheet('Cash Collection');
            if (!worksheet) {
                throw new Error('Invalid template: "Cash Collection" sheet not found.');
            }
            
            // Get column indices from header row
            const headerRow = worksheet.getRow(1);
            const columnMap = {};
            headerRow.eachCell((cell, colNumber) => {
                const header = cell.value?.toString().replace('*', '').trim();
                columnMap[header] = colNumber;
            });
            
            // Required columns for parsing
            const requiredColumns = {
                slotNo: columnMap['Slot #'],
                fullName: columnMap['Client Name'],
                mcbuCol: columnMap['MCBU Collection'],
                csfCol: columnMap['CSF Collection'],
                paymentCollection: columnMap['Actual Collection'],
                mcbuWithdrawal: columnMap['MCBU Withdrawal'],
                remarks: columnMap['Remarks'],
                clientId: columnMap['Client ID'],
                loanId: columnMap['Loan ID']
            };
            
            const parsedData = [];
            const errors = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                
                const slotNo = row.getCell(requiredColumns.slotNo).value;
                const fullName = row.getCell(requiredColumns.fullName).value;
                const clientId = row.getCell(requiredColumns.clientId)?.value;
                const loanId = row.getCell(requiredColumns.loanId)?.value;
                
                if (!slotNo && !fullName) return;
                
                const paymentCollection = parseFloat(row.getCell(requiredColumns.paymentCollection).value) || 0;
                const mcbuCol = parseFloat(row.getCell(requiredColumns.mcbuCol).value) || 0;
                const csfCol = parseFloat(row.getCell(requiredColumns.csfCol).value) || 0;
                const remarksLabel = row.getCell(requiredColumns.remarks).value || '';
                const mcbuWithdrawal = parseFloat(row.getCell(requiredColumns.mcbuWithdrawal).value) || 0;
                
                const remarksOption = remarksOptions.find(r => r.label === remarksLabel);
                const remarksValue = remarksOption ? remarksOption.value : '';
                
                if (paymentCollection < 0) errors.push(`Row ${rowNumber}: Actual Collection cannot be negative`);
                if (mcbuCol < 0) errors.push(`Row ${rowNumber}: MCBU Collection cannot be negative`);
                if (csfCol < 0) errors.push(`Row ${rowNumber}: CSF Collection cannot be negative`);
                if (mcbuWithdrawal < 0) errors.push(`Row ${rowNumber}: MCBU Withdrawal cannot be negative`);
                if (remarksLabel && !remarksOption) errors.push(`Row ${rowNumber}: Invalid remarks value "${remarksLabel}"`);
                
                parsedData.push({
                    rowNumber,
                    slotNo,
                    fullName,
                    clientId,
                    loanId,
                    paymentCollection,
                    mcbuCol,
                    csfCol,
                    remarks: remarksValue ? { label: remarksLabel, value: remarksValue } : null,
                    mcbuWithdrawal
                });
            });
            
            if (errors.length > 0) {
                setValidationErrors(errors);
                toast.error(`Found ${errors.length} validation error(s). Please fix and re-upload.`);
                return;
            }
            
            const matchedData = parsedData.map(parsed => {
                const existing = groupData.find(g => 
                    g.slotNo === parsed.slotNo || g.clientId === parsed.clientId
                );
                
                if (!existing) {
                    errors.push(`Slot ${parsed.slotNo}: Client not found in current group`);
                    return null;
                }
                
                return {
                    ...existing,
                    uploadedPaymentCollection: parsed.paymentCollection,
                    uploadedMcbuCol: parsed.mcbuCol,
                    uploadedCsfCol: parsed.csfCol,
                    uploadedRemarks: parsed.remarks,
                    uploadedMcbuWithdrawal: parsed.mcbuWithdrawal,
                    hasUploadedData: parsed.paymentCollection > 0 || 
                                      parsed.mcbuCol > 0 || 
                                      parsed.csfCol > 0 || 
                                      parsed.remarks?.value ||
                                      parsed.mcbuWithdrawal > 0
                };
            }).filter(Boolean);
            
            if (errors.length > 0) {
                setValidationErrors(errors);
                toast.error(`Found ${errors.length} matching error(s).`);
                return;
            }
            
            const recordsWithData = matchedData.filter(d => d.hasUploadedData).length;
            
            if (recordsWithData === 0) {
                toast.warning('No data found in the uploaded file. Please fill in at least one row.');
                return;
            }
            
            setUploadedData(matchedData);
            toast.success(`Successfully parsed ${recordsWithData} record(s) with data.`);
            setShowConfirmDialog(true);
            
        } catch (error) {
            console.error('Error parsing file:', error);
            toast.error(error.message || 'Failed to parse uploaded file');
            setValidationErrors([error.message]);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmUpload = async () => {
        if (!uploadedData) return;
        
        setIsUploading(true);
        
        try {
            const mcbuWithdrawals = uploadedData.filter(d => d.uploadedMcbuWithdrawal > 0);
            
            for (const withdrawal of mcbuWithdrawals) {
                try {
                    const withdrawalData = {
                        loan_id: withdrawal.loanId,
                        branch_id: branchId,
                        lo_id: loId,
                        group_id: groupId,
                        client_id: withdrawal.clientId,
                        mcbu_withdrawal_amount: withdrawal.uploadedMcbuWithdrawal,
                        csf_withdrawal_amount: 0,
                        status: 'pending',
                        inserted_date: currentDate,
                        inserted_by: currentUser._id,
                        division_id: divisionId,
                        region_id: regionId,
                        area_id: areaId,
                        group_leader: withdrawal.groupLeader || false
                    };
                    
                    await fetchWrapper.post(getApiBaseUrl() + 'transactions/mcbu-withdrawal/save/', withdrawalData);
                    console.log(`MCBU Withdrawal created for slot ${withdrawal.slotNo}`);
                } catch (error) {
                    console.error(`Failed to create MCBU withdrawal for slot ${withdrawal.slotNo}:`, error);
                    toast.warning(`MCBU Withdrawal for slot ${withdrawal.slotNo} may need to be created manually.`);
                }
            }
            
            if (onUploadComplete) {
                onUploadComplete(uploadedData);
            }
            
            toast.success('Data uploaded successfully! You can now review and submit.');
            setShowConfirmDialog(false);
            onClose();
            
        } catch (error) {
            console.error('Error applying uploaded data:', error);
            toast.error('Failed to apply uploaded data: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setUploadedData(null);
        setValidationErrors([]);
        setShowConfirmDialog(false);
        onClose();
    };

    if (!show) return null;

    return (
        <>
            <Dialog show={show} className="max-w-2xl">
                <div className="bg-white rounded-lg shadow-xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Bulk Upload Cash Collection
                        </h3>
                        <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="px-6 py-4">
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
                                    <span className="ml-2 font-medium">
                                        {groupData.filter(g => g.status !== 'totals' && g.status !== 'open' && g.fullName && g.fullName !== '-').length}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
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
                        
                        {step === 1 && (
                            <div className="text-center py-8">
                                <DocumentArrowDownIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
                                <h4 className="text-lg font-medium mb-2">Download Template</h4>
                                <p className="text-gray-600 mb-6">
                                    Download the Excel template with all columns matching the table.
                                    Fill in the yellow-highlighted columns and upload it back.
                                </p>
                                <ButtonSolid
                                    label={isDownloading ? 'Generating...' : 'Download Template'}
                                    onClick={handleDownloadTemplate}
                                    disabled={isDownloading}
                                    className="px-6 py-2"
                                    icon={<ArrowDownTrayIcon className="w-5 h-5 mr-2" />}
                                />
                            </div>
                        )}
                        
                        {step === 2 && (
                            <div className="text-center py-8">
                                <ArrowUpTrayIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
                                <h4 className="text-lg font-medium mb-2">Upload Completed Template</h4>
                                <p className="text-gray-600 mb-6">
                                    Upload the completed template file. Make sure you haven't renamed the file.
                                </p>
                                
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                />
                                
                                <ButtonSolid
                                    label={isUploading ? 'Processing...' : 'Select File to Upload'}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="px-6 py-2"
                                    icon={<ArrowUpTrayIcon className="w-5 h-5 mr-2" />}
                                />
                                
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
                    </div>
                    
                    <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
                        <ButtonOutline label="Cancel" onClick={handleClose} className="px-4 py-2" />
                    </div>
                </div>
            </Dialog>
            
            <Dialog show={showConfirmDialog}>
                <div className="bg-white rounded-lg shadow-xl max-w-lg mx-auto">
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
                                                {uploadedData.filter(d => d.hasUploadedData).length}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Total Actual Col:</span>
                                            <span className="ml-2 font-medium">
                                                {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.uploadedPaymentCollection || 0), 0))}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Total MCBU Col:</span>
                                            <span className="ml-2 font-medium">
                                                {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.uploadedMcbuCol || 0), 0))}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Total CSF Col:</span>
                                            <span className="ml-2 font-medium">
                                                {formatPricePhp(uploadedData.reduce((sum, d) => sum + (d.uploadedCsfCol || 0), 0))}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">MCBU Withdrawals:</span>
                                            <span className="ml-2 font-medium">
                                                {uploadedData.filter(d => d.uploadedMcbuWithdrawal > 0).length}
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
                        <ButtonOutline
                            label="Cancel"
                            onClick={() => setShowConfirmDialog(false)}
                            className="px-4 py-2"
                            disabled={isUploading}
                        />
                        <ButtonSolid
                            label={isUploading ? 'Processing...' : 'Confirm & Populate'}
                            onClick={handleConfirmUpload}
                            className="px-4 py-2"
                            disabled={isUploading}
                        />
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default CashCollectionBulkUploadModal;