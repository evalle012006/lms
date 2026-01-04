import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { toast } from 'react-toastify';
import { Download, Calendar, Building2, User, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';

import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp } from '@/lib/utils';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from '@/styles/select';

const DailyCollectionSheet = () => {
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [totals, setTotals] = useState(null);
    const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
    const [selectedLo, setSelectedLo] = useState(null);
    const [loanOfficers, setLoanOfficers] = useState([]);

    // Check if current user is a Loan Officer (rep = 4)
    const isLoanOfficer = currentUser?.role?.rep === 4;
    // Check if current user is Branch Manager (rep = 3)
    const isBranchManager = currentUser?.role?.rep === 3;

    const modernSelectStyles = {
        ...borderStyles,
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
            '&:hover': { borderColor: '#14b8a6' }
        }),
        menu: (base) => ({ ...base, zIndex: 9999 }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 })
    };

    // Fetch loan officers for branch manager
    const fetchLoanOfficers = useCallback(async (branchId) => {
        if (!branchId) return;
        try {
            const url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId: branchId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const loOptions = [];
                response.users && response.users
                    .filter(u => u.role.rep === 4)
                    .forEach(lo => {
                        const name = `${lo.firstName} ${lo.lastName}`;
                        loOptions.push({
                            ...lo,
                            value: lo._id,
                            label: name,
                            name: name
                        });
                    });
                loOptions.sort((a, b) => (a.loNo || 0) - (b.loNo || 0));
                setLoanOfficers(loOptions);
            }
        } catch (error) {
            console.error('Error fetching loan officers:', error);
        }
    }, []);

    const calculateTotals = (dataArray) => {
        if (!dataArray || dataArray.length === 0) return null;
        return dataArray.reduce((acc, item) => ({
            mcbuTarget: (acc.mcbuTarget || 0) + item.mcbuTarget,
            mcbuActual: (acc.mcbuActual || 0) + item.mcbuActual,
            regularLoanTarget: (acc.regularLoanTarget || 0) + item.regularLoanTarget,
            regularLoanAdvance: (acc.regularLoanAdvance || 0) + item.regularLoanAdvance,
            regularLoanActual: (acc.regularLoanActual || 0) + item.regularLoanActual,
            otherLoanTarget: (acc.otherLoanTarget || 0) + item.otherLoanTarget,
            otherLoanAdvance: (acc.otherLoanAdvance || 0) + item.otherLoanAdvance,
            otherLoanActual: (acc.otherLoanActual || 0) + item.otherLoanActual,
            admissionNo: (acc.admissionNo || 0) + item.admissionNo,
            admissionAmount: (acc.admissionAmount || 0) + item.admissionAmount,
            lrfCollection: (acc.lrfCollection || 0) + item.lrfCollection,
            cbhbNo: (acc.cbhbNo || 0) + item.cbhbNo,
            cbhbAmount: (acc.cbhbAmount || 0) + item.cbhbAmount,
            addHospitalization: (acc.addHospitalization || 0) + item.addHospitalization,
            otherIncome: (acc.otherIncome || 0) + item.otherIncome,
            totalCollection: (acc.totalCollection || 0) + item.totalCollection,
            mcbuWithdrawal: (acc.mcbuWithdrawal || 0) + item.mcbuWithdrawal,
            mcbuReturnNo: (acc.mcbuReturnNo || 0) + item.mcbuReturnNo,
            mcbuReturnAmount: (acc.mcbuReturnAmount || 0) + item.mcbuReturnAmount,
            netCollection: (acc.netCollection || 0) + item.netCollection,
            renewalNo: (acc.renewalNo || 0) + item.renewalNo,
            renewalAmount: (acc.renewalAmount || 0) + item.renewalAmount,
            offsetNo: (acc.offsetNo || 0) + item.offsetNo,
            offsetAmount: (acc.offsetAmount || 0) + item.offsetAmount,
            fullPaymentClients: (acc.fullPaymentClients || 0) + item.fullPaymentClients,
            activeClients: (acc.activeClients || 0) + item.activeClients,
            activeBorrowers: (acc.activeBorrowers || 0) + item.activeBorrowers,
            totalLoanBalance: (acc.totalLoanBalance || 0) + item.totalLoanBalance,
            mcbuBalance: (acc.mcbuBalance || 0) + item.mcbuBalance,
            pastDueNo: (acc.pastDueNo || 0) + item.pastDueNo,
            pastDueAmount: (acc.pastDueAmount || 0) + item.pastDueAmount,
            mispayCount: (acc.mispayCount || 0) + item.mispayCount,
            pendingClients: (acc.pendingClients || 0) + item.pendingClients,
            transferClients: (acc.transferClients || 0) + item.transferClients
        }), {});
    };

    const exportToExcel = async () => {
        if (!data || data.length === 0) {
            toast.warning('No data to export');
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Daily Collection Sheet');

            worksheet.columns = [
                { width: 5 }, { width: 20 }, { width: 15 }, { width: 12 }, { width: 12 },
                { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
                { width: 12 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 8 },
                { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 12 },
                { width: 8 }, { width: 12 }, { width: 15 }, { width: 8 }, { width: 12 },
                { width: 8 }, { width: 12 }, { width: 10 }, { width: 12 }
            ];

            worksheet.mergeCells('A1:AC1');
            worksheet.getCell('A1').value = 'AmberCash PH Micro Lending Corp.';
            worksheet.getCell('A1').font = { bold: true, size: 14 };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.mergeCells('A2:AC2');
            worksheet.getCell('A2').value = 'DAILY COLLECTION SHEET';
            worksheet.getCell('A2').font = { bold: true, size: 12 };
            worksheet.getCell('A2').alignment = { horizontal: 'center' };

            worksheet.getCell('A3').value = 'Name of Branch:';
            worksheet.getCell('B3').value = getBranchName();
            worksheet.getCell('T3').value = 'DATE:';
            worksheet.getCell('U3').value = moment(selectedDate).format('YYYY-MM-DD');
            worksheet.getCell('X3').value = 'DAY:';
            worksheet.getCell('Y3').value = moment(selectedDate).format('dddd');

            const row4 = worksheet.getRow(4);
            row4.values = ['No.', 'Name of LO', 'Name of Group', 'MCBU Collection', '', "CLIENT'S LOAN COLLECTION", '', '', '', '', '', 'Admission Fee', '', 'LRF', 'C.B.H.B Collection', '', "Addt'l Hospitalization Php100", 'Other Income (Passbook/Picture)', 'TOTAL COLLECTION', 'LESS RETURN & WITHDRAWALS', '', '', '', 'NET COLLECTION', 'Info. On Fully Payment', '', '', '', ''];

            const row5 = worksheet.getRow(5);
            row5.values = ['', '', '', '', '', 'Regular Loan (60 Days)', '', '', 'Other Loan (Weekly)', '', '', '', '', '', '', '', '', '', '', 'MCBU', 'MCBU Return', '', '', '', 'Renewal (Regular)', '', 'Offset (Regular)', '', 'No. of Client', 'Other Loan (Weekly)'];

            const row6 = worksheet.getRow(6);
            row6.values = ['', '', '', 'Target', 'Actual', 'Target', 'Advance Payment', 'Actual', 'Target', 'Advance Payment', 'Actual', 'No.', 'Amt.', '', 'No.', 'Php 200', '', '', '', 'w/drawals', 'No.', 'Amount', '', '', 'No.', 'Amount', 'No.', 'Amount', '', ''];

            const row7 = worksheet.getRow(7);
            row7.values = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H=F+G', 'I', 'J', 'K= I + J', 'L', 'M= L * 100', 'N', 'O', 'P= O * 200', 'Q= O * 100', 'R= O * 100', 'S=E+H+K+M+N+P+Q+R', 'T', 'U', 'V', 'W=S-T-V', '', 'X', 'Y', 'Z', 'AA', 'AB', 'AC'];

            [4, 5, 6, 7].forEach(rowNum => {
                const row = worksheet.getRow(rowNum);
                row.eachCell((cell) => {
                    cell.font = { bold: true, size: 10 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            worksheet.mergeCells('D4:E4');
            worksheet.mergeCells('F4:K4');
            worksheet.mergeCells('L4:M4');
            worksheet.mergeCells('O4:P4');
            worksheet.mergeCells('T4:W4');
            worksheet.mergeCells('X4:AC4');
            worksheet.mergeCells('F5:H5');
            worksheet.mergeCells('I5:K5');
            worksheet.mergeCells('X5:Y5');
            worksheet.mergeCells('Z5:AA5');

            // Track row positions for LO merging
            const startDataRow = 8; // Data starts at row 8 (after headers)
            let currentRow = startDataRow;
            const loMergeRanges = [];
            let currentLoId = null;
            let loStartRow = currentRow;

            data.forEach((item, index) => {
                // Track LO groupings for merging
                if (item.loId !== currentLoId) {
                    if (currentLoId !== null && currentRow > loStartRow) {
                        loMergeRanges.push({ start: loStartRow, end: currentRow - 1 });
                    }
                    currentLoId = item.loId;
                    loStartRow = currentRow;
                }

                const dataRow = worksheet.addRow([
                    item.groupNo, item.loName, item.groupName, item.mcbuTarget, item.mcbuActual,
                    item.regularLoanTarget, item.regularLoanAdvance, item.regularLoanActual,
                    item.otherLoanTarget, item.otherLoanAdvance, item.otherLoanActual,
                    item.admissionNo, item.admissionAmount, item.lrfCollection,
                    item.cbhbNo, item.cbhbAmount, item.addHospitalization, item.otherIncome,
                    item.totalCollection, item.mcbuWithdrawal, item.mcbuReturnNo, item.mcbuReturnAmount,
                    item.netCollection, '', item.renewalNo, item.renewalAmount,
                    item.offsetNo, item.offsetAmount, item.fullPaymentClients, item.otherLoanActual
                ]);

                dataRow.eachCell((cell, colNumber) => {
                    cell.alignment = { horizontal: colNumber === 2 ? 'left' : 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (colNumber >= 4 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
                });

                currentRow++;
            });

            // Add last LO merge range
            if (currentLoId !== null && currentRow > loStartRow) {
                loMergeRanges.push({ start: loStartRow, end: currentRow - 1 });
            }

            // Merge LO name cells (column B)
            loMergeRanges.forEach(range => {
                if (range.end > range.start) {
                    worksheet.mergeCells(`B${range.start}:B${range.end}`);
                    const cell = worksheet.getCell(`B${range.start}`);
                    cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
                }
            });

            if (totals) {
                const totalsRow = worksheet.addRow([
                    '', 'TOTAL', '', totals.mcbuTarget, totals.mcbuActual,
                    totals.regularLoanTarget, totals.regularLoanAdvance, totals.regularLoanActual,
                    totals.otherLoanTarget, totals.otherLoanAdvance, totals.otherLoanActual,
                    totals.admissionNo, totals.admissionAmount, totals.lrfCollection,
                    totals.cbhbNo, totals.cbhbAmount, totals.addHospitalization, totals.otherIncome,
                    totals.totalCollection, totals.mcbuWithdrawal, totals.mcbuReturnNo, totals.mcbuReturnAmount,
                    totals.netCollection, '', totals.renewalNo, totals.renewalAmount,
                    totals.offsetNo, totals.offsetAmount, totals.fullPaymentClients, totals.otherLoanActual
                ]);

                totalsRow.eachCell((cell, colNumber) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (colNumber >= 4 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const fileName = `DCS_${getBranchName()}_${moment(selectedDate).format('YYYYMMDD')}.xlsx`;
            
            // Native browser download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('Excel file exported successfully!');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Error exporting to Excel');
        }
    };

    // Fetch loan officers for BM on mount
    useEffect(() => {
        if (isBranchManager && currentUser?.designatedBranchId) {
            fetchLoanOfficers(currentUser.designatedBranchId);
        }
    }, [isBranchManager, currentUser?.designatedBranchId, fetchLoanOfficers]);

    // Auto-fetch data when component mounts or date/LO filter changes
    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            // Determine branch_id and lo_id based on role
            let branchId = null;
            let loId = null;

            if (currentUser?.role?.rep === 4) {
                // LO (rep = 4): query by lo_id
                branchId = currentUser.designatedBranchId;
                loId = currentUser._id;
            } else if (currentUser?.role?.rep === 3) {
                // BM (rep = 3): query by branch_id, optionally filter by selected LO
                branchId = currentUser.designatedBranchId;
                loId = selectedLo?._id || null;
            } else {
                // Higher roles: use currentBranch
                branchId = currentBranch?._id;
                loId = selectedLo?._id || null;
            }

            if (!branchId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const params = new URLSearchParams({
                    branch_id: branchId,
                    selected_date: selectedDate
                });

                if (loId) {
                    params.append('lo_id', loId);
                }

                const response = await fetchWrapper.get(getApiBaseUrl() + 'data/get_daily_collection_sheet?' + params.toString());
                
                if (response.data && Array.isArray(response.data)) {
                    const processedData = response.data.map(item => {
                        const d = item.data || item;
                        return {
                            loId: item.loId || item.lo_id,
                            loName: item.loName || item.lo_name,
                            groupId: item.groupId || item.group_id,
                            groupName: item.groupName || item.group_name,
                            mcbuTarget: parseFloat(d.mcbuTarget || d.mcbu_target) || 0,
                            mcbuActual: parseFloat(d.mcbuActual || d.mcbu_actual) || 0,
                            regularLoanTarget: parseFloat(d.regularLoanTarget || d.regular_loan_target) || 0,
                            regularLoanAdvance: parseFloat(d.regularLoanAdvance || d.regular_loan_advance) || 0,
                            regularLoanActual: parseFloat(d.regularLoanActual || d.regular_loan_actual) || 0,
                            otherLoanTarget: parseFloat(d.otherLoanTarget || d.other_loan_target) || 0,
                            otherLoanAdvance: parseFloat(d.otherLoanAdvance || d.other_loan_advance) || 0,
                            otherLoanActual: parseFloat(d.otherLoanActual || d.other_loan_actual) || 0,
                            admissionNo: parseInt(d.admissionNo || d.admission_no) || 0,
                            admissionAmount: parseFloat(d.admissionAmount || d.admission_amount) || 0,
                            lrfCollection: parseFloat(d.lrfCollection || d.lrf_collection) || 0,
                            cbhbNo: parseInt(d.cbhbNo || d.cbhb_no) || 0,
                            cbhbAmount: parseFloat(d.cbhbAmount || d.cbhb_amount) || 0,
                            addHospitalization: parseFloat(d.addHospitalization || d.add_hospitalization) || 0,
                            otherIncome: parseFloat(d.otherIncome || d.other_income) || 0,
                            totalCollection: parseFloat(d.totalCollection || d.total_collection) || 0,
                            mcbuWithdrawal: parseFloat(d.mcbuWithdrawal || d.mcbu_withdrawal) || 0,
                            mcbuReturnNo: parseInt(d.mcbuReturnNo || d.mcbu_return_no) || 0,
                            mcbuReturnAmount: parseFloat(d.mcbuReturnAmount || d.mcbu_return_amount) || 0,
                            netCollection: parseFloat(d.netCollection || d.net_collection) || 0,
                            renewalNo: parseInt(d.renewalNo || d.renewal_no) || 0,
                            renewalAmount: parseFloat(d.renewalAmount || d.renewal_amount) || 0,
                            offsetNo: parseInt(d.offsetNo || d.offset_no) || 0,
                            offsetAmount: parseFloat(d.offsetAmount || d.offset_amount) || 0,
                            fullPaymentClients: parseInt(d.fullPaymentClients || d.full_payment_clients) || 0,
                            activeClients: parseInt(d.activeClients || d.active_clients) || 0,
                            activeBorrowers: parseInt(d.activeBorrowers || d.active_borrowers) || 0,
                            totalLoanBalance: parseFloat(d.totalLoanBalance || d.total_loan_balance) || 0,
                            mcbuBalance: parseFloat(d.mcbuBalance || d.mcbu_balance) || 0,
                            pastDueNo: parseInt(d.pastDueNo || d.past_due_no) || 0,
                            pastDueAmount: parseFloat(d.pastDueAmount || d.past_due_amount) || 0,
                            mispayCount: parseInt(d.mispayCount || d.mispay_count) || 0,
                            pendingClients: parseInt(d.pendingClients || d.pending_clients) || 0,
                            transferClients: parseInt(d.transferClients || d.transfer_clients) || 0
                        };
                    });

                    // Group data by loId and add group numbering
                    const groupedByLo = {};
                    processedData.forEach(item => {
                        if (!groupedByLo[item.loId]) {
                            groupedByLo[item.loId] = {
                                loId: item.loId,
                                loName: item.loName,
                                groups: []
                            };
                        }
                        groupedByLo[item.loId].groups.push(item);
                    });

                    // Flatten with group numbers and row span info
                    const flattenedData = [];
                    Object.values(groupedByLo).forEach(lo => {
                        lo.groups.forEach((group, idx) => {
                            flattenedData.push({
                                ...group,
                                groupNo: idx + 1,
                                isFirstInLo: idx === 0,
                                loRowSpan: lo.groups.length
                            });
                        });
                    });

                    setData(flattenedData);
                    setTotals(calculateTotals(flattenedData));
                } else {
                    setData([]);
                    setTotals(null);
                }
            } catch (error) {
                console.error('Error fetching daily collection data:', error);
                toast.error('Error fetching daily collection data');
                setData([]);
                setTotals(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, currentBranch?._id, selectedDate, selectedLo?._id]);

    // Get branch name for display
    const getBranchName = () => {
        if (isLoanOfficer || isBranchManager) {
            return currentUser?.designatedBranch?.name || currentUser?.designatedBranchName || 'Branch';
        }
        return currentBranch?.name || 'Branch';
    };

    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
    };
    const handleLoChange = (lo) => setSelectedLo(lo);

    return (
        <Layout header={false} noPad={true}>
            {loading ? <Spinner /> : (
                <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
                    <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <FileSpreadsheet className="w-8 h-8 text-teal-600" />
                                <div>
                                    <h1 className="text-xl font-bold text-gray-800">Daily Collection Sheet</h1>
                                    <p className="text-sm text-gray-500">
                                        {isLoanOfficer 
                                            ? 'View your daily collection report' 
                                            : 'Daily collection reports by loan officer'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={exportToExcel} disabled={!data || data.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Download className="w-4 h-4" /><span>Export Excel</span>
                            </button>
                        </div>
                        <div className="flex items-center space-x-6 bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Date:</span>
                                <div className="w-40">
                                    <input 
                                        type="date" 
                                        name="selectedDate" 
                                        value={selectedDate}
                                        max={moment().format('YYYY-MM-DD')}
                                        onChange={handleDateChange}
                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 block w-full h-10 pl-3 pr-3"
                                    />
                                </div>
                            </div>
                            {/* Only show LO filter for branch managers */}
                            {isBranchManager && (
                                <div className="flex items-center space-x-2">
                                    <User className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Loan Officer:</span>
                                    <div className="w-48">
                                        <Select 
                                            options={[{ value: '', label: 'All Loan Officers', _id: null }, ...loanOfficers]} 
                                            value={selectedLo} 
                                            styles={modernSelectStyles} 
                                            components={{ DropdownIndicator }} 
                                            onChange={handleLoChange} 
                                            isClearable 
                                            placeholder="All Loan Officers" 
                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null} 
                                            menuPosition="fixed" 
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center space-x-2 ml-auto">
                                <Building2 className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-600">
                                    Branch: <span className="font-semibold">{getBranchName()}</span>
                                </span>
                                {isLoanOfficer && (
                                    <span className="text-sm text-gray-500 ml-2">
                                        | LO: <span className="font-semibold">{currentUser?.firstName} {currentUser?.lastName}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-6 overflow-auto min-h-0">
                        {data && data.length > 0 ? (
                            <div className="bg-white rounded-lg shadow-lg">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">No.</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">Name of LO</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">Name of Group</th>
                                                <th colSpan={2} className="border px-3 py-2 text-center">MCBU Collection</th>
                                                <th colSpan={6} className="border px-3 py-2 text-center">CLIENT'S LOAN COLLECTION</th>
                                                <th colSpan={2} className="border px-3 py-2 text-center whitespace-nowrap">Admission Fee</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center">LRF</th>
                                                <th colSpan={2} className="border px-3 py-2 text-center">C.B.H.B</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">Add'l Hosp.</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">Other Inc.</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">TOTAL</th>
                                                <th colSpan={3} className="border px-3 py-2 text-center">LESS RETURNS</th>
                                                <th rowSpan={3} className="border px-3 py-2 text-center whitespace-nowrap">NET</th>
                                                <th colSpan={5} className="border px-3 py-2 text-center">Full Payment Info</th>
                                            </tr>
                                            <tr className="bg-gray-100">
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Target</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Actual</th>
                                                <th colSpan={3} className="border px-2 py-1 text-center text-xs">Regular (60 Days)</th>
                                                <th colSpan={3} className="border px-2 py-1 text-center text-xs">Other (Weekly)</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">No.</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Amt.</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">No.</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">₱200</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">MCBU WD</th>
                                                <th colSpan={2} className="border px-2 py-1 text-center text-xs">MCBU Ret.</th>
                                                <th colSpan={2} className="border px-2 py-1 text-center text-xs">Renewal</th>
                                                <th colSpan={2} className="border px-2 py-1 text-center text-xs">Offset</th>
                                                <th rowSpan={2} className="border px-2 py-1 text-center text-xs">Clients</th>
                                            </tr>
                                            <tr className="bg-gray-100">
                                                <th className="border px-2 py-1 text-center text-xs">Tgt</th>
                                                <th className="border px-2 py-1 text-center text-xs">Adv</th>
                                                <th className="border px-2 py-1 text-center text-xs">Act</th>
                                                <th className="border px-2 py-1 text-center text-xs">Tgt</th>
                                                <th className="border px-2 py-1 text-center text-xs">Adv</th>
                                                <th className="border px-2 py-1 text-center text-xs">Act</th>
                                                <th className="border px-2 py-1 text-center text-xs">No.</th>
                                                <th className="border px-2 py-1 text-center text-xs">Amt</th>
                                                <th className="border px-2 py-1 text-center text-xs">No.</th>
                                                <th className="border px-2 py-1 text-center text-xs">Amt</th>
                                                <th className="border px-2 py-1 text-center text-xs">No.</th>
                                                <th className="border px-2 py-1 text-center text-xs">Amt</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((item, index) => (
                                                <tr key={`${item.loId}-${item.groupId}-${index}`} className="hover:bg-gray-50">
                                                    <td className="border px-2 py-1 text-center">{item.groupNo}</td>
                                                    {item.isFirstInLo ? (
                                                        <td rowSpan={item.loRowSpan} className="border px-2 py-1 text-left text-xs align-top bg-gray-50 font-medium">{item.loName}</td>
                                                    ) : null}
                                                    <td className="border px-2 py-1 text-left text-xs">{item.groupName}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuTarget)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuActual)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanTarget)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanAdvance)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.regularLoanActual)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanTarget)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanAdvance)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherLoanActual)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.admissionNo}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.admissionAmount)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.lrfCollection)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.cbhbNo}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.cbhbAmount)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.addHospitalization)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.otherIncome)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(item.totalCollection)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuWithdrawal)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.mcbuReturnNo}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.mcbuReturnAmount)}</td>
                                                    <td className="border px-2 py-1 text-right text-xs font-semibold">{formatPricePhp(item.netCollection)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.renewalNo}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.renewalAmount)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.offsetNo}</td>
                                                    <td className="border px-2 py-1 text-right text-xs">{formatPricePhp(item.offsetAmount)}</td>
                                                    <td className="border px-2 py-1 text-center text-xs">{item.fullPaymentClients}</td>
                                                </tr>
                                            ))}
                                            {totals && (
                                                <tr className="bg-yellow-50 font-bold">
                                                    <td className="border px-2 py-2 text-center"></td>
                                                    <td className="border px-2 py-2 text-left" colSpan={2}>TOTAL</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuTarget)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuActual)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanTarget)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanAdvance)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.regularLoanActual)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanTarget)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanAdvance)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherLoanActual)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.admissionNo}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.admissionAmount)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.lrfCollection)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.cbhbNo}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.cbhbAmount)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.addHospitalization)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.otherIncome)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.totalCollection)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuWithdrawal)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.mcbuReturnNo}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.mcbuReturnAmount)}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.netCollection)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.renewalNo}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.renewalAmount)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.offsetNo}</td>
                                                    <td className="border px-2 py-2 text-right text-xs">{formatPricePhp(totals.offsetAmount)}</td>
                                                    <td className="border px-2 py-2 text-center text-xs">{totals.fullPaymentClients}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {totals && (
                                    <div className="p-6 bg-gray-50 border-t">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Summary</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Active Clients</p>
                                                <p className="text-xl font-bold text-gray-800">{totals.activeClients}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Active Borrowers</p>
                                                <p className="text-xl font-bold text-gray-800">{totals.activeBorrowers}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Total Loan Balance</p>
                                                <p className="text-xl font-bold text-teal-600">{formatPricePhp(totals.totalLoanBalance)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">MCBU Balance</p>
                                                <p className="text-xl font-bold text-teal-600">{formatPricePhp(totals.mcbuBalance)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Past Due (No.)</p>
                                                <p className="text-xl font-bold text-red-600">{totals.pastDueNo}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Past Due Amount</p>
                                                <p className="text-xl font-bold text-red-600">{formatPricePhp(totals.pastDueAmount)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Mispayments</p>
                                                <p className="text-xl font-bold text-orange-600">{totals.mispayCount}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                                <p className="text-sm text-gray-500">Pending Clients</p>
                                                <p className="text-xl font-bold text-gray-800">{totals.pendingClients}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-96 bg-white rounded-lg shadow-lg">
                                <FileSpreadsheet className="w-16 h-16 text-gray-300 mb-4" />
                                <p className="text-gray-500 text-lg">No data available</p>
                                <p className="text-gray-400 text-sm mt-2">No collection records found for {moment(selectedDate).format('MMMM D, YYYY')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DailyCollectionSheet;