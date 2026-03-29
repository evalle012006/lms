// src/pages/transactions/daily-collection-sheet/index.js
// Updated: CSF Collection + CSF Withdrawal + CSF Return added throughout

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import moment from 'moment';
import { toast } from 'react-toastify';
import { Download, Calendar, Building2, User, FileSpreadsheet, BookOpen, Sun } from 'lucide-react';
import ExcelJS from 'exceljs';
import Select from 'react-select';

import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp } from '@/lib/utils';
import { DropdownIndicator, borderStyles } from '@/styles/select';
import { setBranchList } from '@/redux/actions/branchActions';

import DCSTable            from '@/components/transactions/daily-collection-sheet/DCSTable';
import SummaryPanel        from '@/components/transactions/daily-collection-sheet/SummaryPanel';
import MorningAfternoonPanel from '@/components/transactions/daily-collection-sheet/MorningAfternoonPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const selectStyles = {
    ...borderStyles,
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
        boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
        '&:hover': { borderColor: '#14b8a6' }
    }),
    menu:       (base) => ({ ...base, zIndex: 9999 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

const parseRow = (item) => {
    const d = item.data || item;
    return {
        loId:               item.lo_id   || item.loId,
        loName:             item.lo_name || item.loName,
        groupId:            item.group_id  || item.groupId,
        groupName:          item.group_name || item.groupName,
        // v2 denomination fields (top-level from native query)
        morningRemittance:   parseFloat(item.morning_remittance   || item.morningRemittance)   || 0,
        afternoonRemittance: parseFloat(item.afternoon_remittance || item.afternoonRemittance) || 0,
        denomNetCollection:  parseFloat(item.denom_net_collection  || item.denomNetCollection)  || 0,
        // MCBU
        mcbuTarget:          parseFloat(d.mcbuTarget    || d.mcbu_target)    || 0,
        mcbuActual:          parseFloat(d.mcbuActual    || d.mcbu_actual)    || 0,
        // CSF Collection (new) — top-level column from native query OR jsonb
        csfCollection:       parseFloat(item.csf_collection || d.csfCollection || d.csf_collection) || 0,
        // Regular Loan
        regularLoanTarget:   parseFloat(d.regularLoanTarget  || d.regular_loan_target)  || 0,
        regularLoanAdvance:  parseFloat(d.regularLoanAdvance || d.regular_loan_advance) || 0,
        regularLoanActual:   parseFloat(d.regularLoanActual  || d.regular_loan_actual)  || 0,
        otherLoanTarget:     parseFloat(d.otherLoanTarget  || d.other_loan_target)  || 0,
        otherLoanAdvance:    parseFloat(d.otherLoanAdvance || d.other_loan_advance) || 0,
        otherLoanActual:     parseFloat(d.otherLoanActual  || d.other_loan_actual)  || 0,
        admissionNo:         parseInt(d.admissionNo  || d.admission_no)   || 0,
        admissionAmount:     parseFloat(d.admissionAmount || d.admission_amount) || 0,
        lrfCollection:       parseFloat(d.lrfCollection  || d.lrf_collection)  || 0,
        cbhbNo:              parseInt(d.cbhbNo   || d.cbhb_no)   || 0,
        cbhbAmount:          parseFloat(d.cbhbAmount  || d.cbhb_amount)  || 0,
        addHospitalization:  parseFloat(d.addHospitalization || d.add_hospitalization) || 0,
        otherIncome:         parseFloat(d.otherIncome  || d.other_income)  || 0,
        totalCollection:     parseFloat(d.totalCollection || d.total_collection) || 0,
        // MCBU Less Returns
        mcbuWithdrawal:      parseFloat(d.mcbuWithdrawal || d.mcbu_withdrawal) || 0,
        mcbuReturnNo:        parseInt(d.mcbuReturnNo  || d.mcbu_return_no)  || 0,
        mcbuReturnAmount:    parseFloat(d.mcbuReturnAmount || d.mcbu_return_amount) || 0,
        // CSF Less Returns (new)
        csfWithdrawal:       parseFloat(item.csf_withdrawal || d.csfWithdrawal || d.csf_withdrawal) || 0,
        csfReturnNo:         parseInt(item.csf_return_no   || d.csfReturnNo   || d.csf_return_no)   || 0,
        csfReturnAmount:     parseFloat(item.csf_return_amount || d.csfReturnAmount || d.csf_return_amount) || 0,
        netCollection:       parseFloat(d.netCollection  || d.net_collection)  || 0,
        renewalNo:           parseInt(d.renewalNo  || d.renewal_no)   || 0,
        renewalAmount:       parseFloat(d.renewalAmount || d.renewal_amount) || 0,
        offsetNo:            parseInt(d.offsetNo   || d.offset_no)   || 0,
        offsetAmount:        parseFloat(d.offsetAmount  || d.offset_amount)  || 0,
        fullPaymentClients:  parseInt(d.fullPaymentClients || d.full_payment_clients) || 0,
        activeClients:       parseInt(d.activeClients   || d.active_clients)   || 0,
        activeBorrowers:     parseInt(d.activeBorrowers  || d.active_borrowers) || 0,
        totalLoanBalance:    parseFloat(d.totalLoanBalance || d.total_loan_balance) || 0,
        mcbuBalance:         parseFloat(d.mcbuBalance  || d.mcbu_balance)  || 0,
        csfBalance:          parseFloat(item.csf_balance || d.csfBalance || d.csf_balance) || 0,
        pastDueNo:           parseInt(d.pastDueNo   || d.past_due_no)   || 0,
        pastDueAmount:       parseFloat(d.pastDueAmount || d.past_due_amount) || 0,
        mispayCount:         parseInt(d.mispayCount  || d.mispay_count) || 0,
        pendingClients:      parseInt(d.pendingClients || d.pending_clients) || 0,
        transferClients:     parseInt(d.transferClients || d.transfer_clients) || 0,
    };
};

const calculateTotals = (rows) => {
    const num = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const int = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    return {
        mcbuTarget: num('mcbuTarget'), mcbuActual: num('mcbuActual'),
        csfCollection: num('csfCollection'),
        regularLoanTarget: num('regularLoanTarget'), regularLoanAdvance: num('regularLoanAdvance'), regularLoanActual: num('regularLoanActual'),
        otherLoanTarget: num('otherLoanTarget'), otherLoanAdvance: num('otherLoanAdvance'), otherLoanActual: num('otherLoanActual'),
        admissionNo: int('admissionNo'), admissionAmount: num('admissionAmount'),
        lrfCollection: num('lrfCollection'),
        cbhbNo: int('cbhbNo'), cbhbAmount: num('cbhbAmount'),
        addHospitalization: num('addHospitalization'),
        otherIncome: num('otherIncome'),
        totalCollection: num('totalCollection'),
        mcbuWithdrawal: num('mcbuWithdrawal'),
        mcbuReturnNo: int('mcbuReturnNo'), mcbuReturnAmount: num('mcbuReturnAmount'),
        csfWithdrawal: num('csfWithdrawal'),
        csfReturnNo: int('csfReturnNo'), csfReturnAmount: num('csfReturnAmount'),
        netCollection: num('netCollection'),
        renewalNo: int('renewalNo'), renewalAmount: num('renewalAmount'),
        offsetNo: int('offsetNo'), offsetAmount: num('offsetAmount'),
        fullPaymentClients: int('fullPaymentClients'),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const DailyCollectionSheet = () => {
    const dispatch      = useDispatch();
    const currentUser   = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const branchList    = useSelector(state => state.branch.list);

    const [loading, setLoading]             = useState(true);
    const [data, setData]                   = useState([]);
    const [branchData, setBranchData]       = useState([]);
    const [totals, setTotals]               = useState(null);
    const [selectedDate, setSelectedDate]   = useState(moment().format('YYYY-MM-DD'));
    const [selectedLo, setSelectedLo]       = useState(null);
    const [loanOfficers, setLoanOfficers]   = useState([]);
    const [selectedBranch, setSelectedBranch] = useState(null);

    const [summaryData, setSummaryData]       = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('dcs');

    const isAdmin           = currentUser?.role?.rep === 1;
    const isLoanOfficer     = currentUser?.role?.rep === 4;
    const isBranchManager   = currentUser?.role?.rep === 3;
    const isAdminAllBranches = isAdmin && !selectedBranch;

    // ── Branch list ──────────────────────────────────────────────────────────
    const getListBranch = useCallback(async () => {
        if (!currentUser) return;
        try {
            let url = getApiBaseUrl() + 'branches/list';
            if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
                url += '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
            }
            const response = await fetchWrapper.get(url);
            if (response.success) dispatch(setBranchList(response.branches || []));
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, [currentUser, dispatch]);

    useEffect(() => {
        if (isAdmin && (!branchList || branchList.length === 0)) getListBranch();
    }, [isAdmin, branchList, getListBranch]);

    // ── Loan officers ────────────────────────────────────────────────────────
    const fetchLoanOfficers = useCallback(async (branchId) => {
        if (!branchId) return;
        try {
            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId })
            );
            if (response.success) {
                setLoanOfficers(
                    (response.users || [])
                        .filter(u => u.role.rep === 4)
                        .map(lo => ({ ...lo, value: lo._id, label: `${lo.firstName} ${lo.lastName}` }))
                        .sort((a, b) => (a.loNo || 0) - (b.loNo || 0))
                );
            }
        } catch (error) {
            console.error('Error fetching loan officers:', error);
        }
    }, []);

    useEffect(() => {
        if (isBranchManager && currentUser?.designatedBranchId) {
            fetchLoanOfficers(currentUser.designatedBranchId);
        } else if (isAdmin && selectedBranch?._id) {
            fetchLoanOfficers(selectedBranch._id);
        } else if (!isAdmin && !isBranchManager && !isLoanOfficer && currentBranch?._id) {
            fetchLoanOfficers(currentBranch._id);
        }
    }, [isBranchManager, isAdmin, isLoanOfficer, currentUser?.designatedBranchId, selectedBranch?._id, currentBranch?._id, fetchLoanOfficers]);

    // ── Fetch summary ────────────────────────────────────────────────────────
    const fetchSummary = useCallback(async (branchId, date, loId = null) => {
        setSummaryLoading(true);
        try {
            const params = new URLSearchParams({ branch_id: branchId, selected_date: date });
            if (loId) params.append('lo_id', loId);
            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'data/get_daily_collection_summary?' + params.toString()
            );
            const item = Array.isArray(response.data) ? response.data[0] : response.data;
            setSummaryData(item || null);
        } catch (error) {
            console.error('Error fetching summary data:', error);
            setSummaryData(null);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    // ── Main DCS data fetch ──────────────────────────────────────────────────
    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            if (isAdmin && !selectedBranch && (!branchList || branchList.length === 0)) {
                setLoading(false);
                return;
            }
            setLoading(true);
            setSummaryData(null);

            try {
                if (isAdmin && !selectedBranch && branchList?.length > 0) {
                    const branchResults = [];
                    for (const branch of branchList) {
                        try {
                            const params = new URLSearchParams({ branch_id: branch._id, selected_date: selectedDate });
                            const response = await fetchWrapper.get(
                                getApiBaseUrl() + 'data/get_daily_collection_sheet_v2?' + params.toString()
                            );
                            if (response.data?.length > 0) {
                                const t = calculateTotals(response.data.map(parseRow));
                                branchResults.push({
                                    branchId:   branch._id,
                                    branchCode: branch.code || '-',
                                    branchName: branch.name,
                                    ...t,
                                });
                            }
                        } catch { /* skip failed branch */ }
                    }
                    branchResults.sort((a, b) => (a.branchCode || '').localeCompare(b.branchCode || ''));
                    setBranchData(branchResults);
                    setData([]);
                    setTotals(calculateTotals(branchResults));

                } else {
                    let branchId = null, loId = null;
                    if (isLoanOfficer) {
                        branchId = currentUser.designatedBranchId;
                        loId     = currentUser._id;
                    } else if (isBranchManager) {
                        branchId = currentUser.designatedBranchId;
                        loId     = selectedLo?._id || null;
                    } else if (isAdmin && selectedBranch) {
                        branchId = selectedBranch._id;
                        loId     = selectedLo?._id || null;
                    } else {
                        branchId = currentBranch?._id;
                        loId     = selectedLo?._id || null;
                    }

                    if (!branchId) { setLoading(false); setData([]); setBranchData([]); return; }

                    const params = new URLSearchParams({ branch_id: branchId, selected_date: selectedDate });
                    if (loId) params.append('lo_id', loId);

                    const response = await fetchWrapper.get(
                        getApiBaseUrl() + 'data/get_daily_collection_sheet_v2?' + params.toString()
                    );

                    if (response.data?.length > 0) {
                        const processed = response.data.map(parseRow);
                        const loMap = {};
                        processed.forEach(item => {
                            if (!loMap[item.loId]) loMap[item.loId] = { loId: item.loId, loName: item.loName, groups: [] };
                            loMap[item.loId].groups.push(item);
                        });
                        const flat = [];
                        Object.values(loMap).forEach(lo => {
                            lo.groups.forEach((group, idx) => {
                                flat.push({ ...group, groupNo: idx + 1, isFirstInLo: idx === 0, loRowSpan: lo.groups.length });
                            });
                        });

                        setBranchData([]);
                        setData(flat);
                        setTotals(calculateTotals(flat));
                        fetchSummary(branchId, selectedDate, loId);
                    } else {
                        setData([]); setBranchData([]); setTotals(null);
                    }
                }
            } catch (error) {
                console.error('Error fetching DCS data:', error);
                toast.error('Error fetching daily collection data');
                setData([]); setBranchData([]); setTotals(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, currentBranch?._id, selectedDate, selectedLo?._id, selectedBranch?._id, isAdmin, branchList]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getBranchName = () => {
        if (isLoanOfficer || isBranchManager) return currentUser?.designatedBranch?.name || currentUser?.designatedBranchName || 'Branch';
        if (isAdmin) return selectedBranch?.name || 'All Branches';
        return currentBranch?.name || 'Branch';
    };

    const handleDateChange   = e  => setSelectedDate(e.target.value);
    const handleLoChange     = lo => setSelectedLo(lo);
    const handleBranchChange = branch => {
        setSelectedBranch(branch);
        setSelectedLo(null);
        setLoanOfficers([]);
        setSummaryData(null);
        setActiveTab('dcs');
        if (branch) setBranchData([]); else setData([]);
    };

    const hasDetailData = data?.length > 0;
    const hasBranchData = branchData?.length > 0;

    // ── Excel Export ─────────────────────────────────────────────────────────
    // Column layout (29 data columns + 3 header cols = AE):
    //   A  No.
    //   B  LO
    //   C  Group
    //   D  MCBU Target
    //   E  MCBU Actual
    //   F  CSF Collection       ← NEW
    //   G  Reg Loan Target
    //   H  Reg Loan Adv
    //   I  Reg Loan Actual
    //   J  Other Loan Target
    //   K  Other Loan Adv
    //   L  Other Loan Actual
    //   M  Admission No.
    //   N  Admission Amt
    //   O  LRF
    //   P  CBHB No.
    //   Q  CBHB ₱200
    //   R  Add Hospi
    //   S  Other Income
    //   T  Total Collection
    //   U  MCBU WD
    //   V  MCBU Ret No.
    //   W  MCBU Ret Amt
    //   X  CSF WD               ← NEW
    //   Y  CSF Ret No.          ← NEW
    //   Z  CSF Ret Amt          ← NEW
    //   AA NET
    //   AB Renewal No.
    //   AC Renewal Amt
    //   AD Offset No.
    //   AE Offset Amt
    //   AF Clients

    const exportToExcel = async () => {
        const exportRows = hasDetailData ? data : hasBranchData ? branchData : null;
        if (!exportRows?.length) { toast.warning('No data to export'); return; }

        try {
            const workbook = new ExcelJS.Workbook();

            const branchObj  = isAdmin ? selectedBranch : currentBranch;
            const branchCode = branchObj?.code || 'BRANCH';
            const branchName = branchObj?.name || getBranchName();
            const safeCode   = branchCode.replace(/[\/\\?%*:|"<>]/g, '-');
            const safeName   = branchName.replace(/[\/\\?%*:|"<>]/g, '-');
            const dateStr    = moment(selectedDate).format('YYYYMMDD');
            const fileName   = `${safeCode} - ${safeName} - ${dateStr}.xlsx`;

            const monthName = moment(selectedDate).format('MMM').toUpperCase();
            const ws = workbook.addWorksheet(`DCS - ${monthName}`);

            ws.columns = [
                { width: 5  }, { width: 22 }, { width: 18 }, // A–C
                { width: 11 }, { width: 11 }, // D–E  MCBU
                { width: 11 }, // F  CSF Collection
                { width: 11 }, { width: 11 }, { width: 11 }, // G–I  Regular Loan
                { width: 11 }, { width: 11 }, { width: 11 }, // J–L  Other Loan
                { width: 7  }, { width: 11 }, // M–N  Admission
                { width: 11 }, // O  LRF
                { width: 7  }, { width: 11 }, // P–Q  CBHB
                { width: 11 }, // R  Add Hospi
                { width: 11 }, // S  Other Income
                { width: 12 }, // T  Total
                { width: 11 }, { width: 7  }, { width: 11 }, // U–W  MCBU WD/Ret
                { width: 11 }, { width: 7  }, { width: 11 }, // X–Z  CSF WD/Ret
                { width: 12 }, // AA NET
                { width: 7  }, { width: 11 }, // AB–AC  Renewal
                { width: 7  }, { width: 11 }, // AD–AE  Offset
                { width: 7  }, // AF  Clients
            ];

            const bold     = { bold: true };
            const centerXS = { horizontal: 'center', vertical: 'middle' };
            const rightXS  = { horizontal: 'right',  vertical: 'middle' };
            const leftXS   = { horizontal: 'left',   vertical: 'middle' };
            const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
            const csfFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0E4F7' } }; // light blue for CSF
            const totalFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
            const currFmt = '#,##0.00';
            const intFmt  = '#,##0';

            // ── Title rows ──────────────────────────────────────────────────
            ws.mergeCells('A1:AF1');
            ws.getCell('A1').value = 'AmberCash PH Micro Lending Corp.';
            ws.getCell('A1').font = { bold: true, size: 14 };
            ws.getCell('A1').alignment = { horizontal: 'center' };
            ws.getRow(1).height = 20;

            ws.mergeCells('A2:AF2');
            ws.getCell('A2').value = 'DAILY COLLECTION SHEET';
            ws.getCell('A2').font = { bold: true, size: 12 };
            ws.getCell('A2').alignment = { horizontal: 'center' };

            ws.getCell('A3').value = 'Name of Branch:';
            ws.getCell('B3').value = getBranchName();
            ws.getCell('U3').value = 'DATE:';
            ws.getCell('V3').value = moment(selectedDate).format('MMMM D, YYYY');
            ws.getCell('Y3').value = 'DAY:';
            ws.getCell('Z3').value = moment(selectedDate).format('dddd');

            // ── Header row 4 ────────────────────────────────────────────────
            const h4 = [
                ['A4:A6', 'No.'],
                ['B4:B6', 'Name of LO'],
                ['C4:C6', 'Name of Group'],
                ['D4:E4', 'MCBU Collection'],
                ['F4:F6', 'CSF Collection'],    // ← NEW single-col header
                ['G4:L4', "CLIENT'S LOAN COLLECTION"],
                ['M4:N4', 'Admission Fee'],
                ['O4:O6', 'LRF'],
                ['P4:Q4', 'C.B.H.B'],
                ['R4:R6', "Addt'l Hosp."],
                ['S4:S6', 'Other Income (Passbook/Picture)'],
                ['T4:T6', 'TOTAL COLLECTION'],
                ['U4:Z4', 'LESS RETURN & WITHDRAWALS'],  // ← now spans to Z (was W)
                ['AA4:AA6', 'NET COLLECTION'],
                ['AB4:AF4', 'Info on Full Payment'],
            ];
            h4.forEach(([range, val]) => {
                ws.mergeCells(range);
                const c = ws.getCell(range.split(':')[0]);
                c.value = val;
                c.font = bold;
                c.alignment = centerXS;
                c.fill = range.startsWith('F') ? csfFill : headerFill;
            });
            ws.getRow(4).height = 28;

            // ── Header row 5 ────────────────────────────────────────────────
            const h5 = [
                ['G5:I5', 'Regular Loan (60 Days)'],
                ['J5:L5', 'Other Loan (Weekly)'],
                ['U5:U6', 'MCBU Withdrawals'],
                ['V5:W5', 'MCBU Return'],
                ['X5:X6', 'CSF Withdrawals'],   // ← NEW
                ['Y5:Z5', 'CSF Return'],         // ← NEW
                ['AB5:AC5', 'Renewal (Regular)'],
                ['AD5:AE5', 'Offset (Regular)'],
                ['AF5:AF6', 'No. of Client'],
            ];
            h5.forEach(([range, val]) => {
                ws.mergeCells(range);
                const c = ws.getCell(range.split(':')[0]);
                c.value = val;
                c.font = bold;
                c.alignment = centerXS;
                c.fill = (range.startsWith('X') || range.startsWith('Y')) ? csfFill : headerFill;
            });
            ws.getRow(5).height = 18;

            // ── Header row 6 ────────────────────────────────────────────────
            const r6 = [
                ['D6','Target'], ['E6','Actual'],
                // F6 merged (rowspan 3 already done)
                ['G6','Target'], ['H6','Adv. Pay'], ['I6','Actual'],
                ['J6','Target'], ['K6','Adv. Pay'], ['L6','Actual'],
                ['M6','No.'],    ['N6','Amt.'],
                ['P6','No.'],    ['Q6','₱200'],
                ['V6','No.'],    ['W6','Amt.'],
                ['Y6','No.'],    ['Z6','Amt.'],  // ← NEW
                ['AB6','No.'],   ['AC6','Amt.'],
                ['AD6','No.'],   ['AE6','Amt.'],
            ];
            r6.forEach(([cell, val]) => {
                const c = ws.getCell(cell);
                c.value = val;
                c.font = bold;
                c.alignment = centerXS;
                c.fill = (cell.startsWith('Y') || cell.startsWith('Z')) ? csfFill : headerFill;
            });
            ws.getRow(6).height = 18;

            // ── Data rows ───────────────────────────────────────────────────
            let rowNum = 7;
            exportRows.forEach((item, idx) => {
                const r = ws.getRow(rowNum++);
                r.height = 16;
                const cols = [
                    ['A', idx + 1,                    'center'],
                    ['B', item.loName || item.branchName || '', 'left'],
                    ['C', item.groupName || item.branchCode || '', 'left'],
                    ['D', item.mcbuTarget,             'right', currFmt],
                    ['E', item.mcbuActual,             'right', currFmt],
                    ['F', item.csfCollection,          'right', currFmt],
                    ['G', item.regularLoanTarget,      'right', currFmt],
                    ['H', item.regularLoanAdvance,     'right', currFmt],
                    ['I', item.regularLoanActual,      'right', currFmt],
                    ['J', item.otherLoanTarget,        'right', currFmt],
                    ['K', item.otherLoanAdvance,       'right', currFmt],
                    ['L', item.otherLoanActual,        'right', currFmt],
                    ['M', item.admissionNo,            'center'],
                    ['N', item.admissionAmount,        'right', currFmt],
                    ['O', item.lrfCollection,          'right', currFmt],
                    ['P', item.cbhbNo,                 'center'],
                    ['Q', item.cbhbAmount,             'right', currFmt],
                    ['R', item.addHospitalization,     'right', currFmt],
                    ['S', item.otherIncome,            'right', currFmt],
                    ['T', item.totalCollection,        'right', currFmt],
                    ['U', item.mcbuWithdrawal,         'right', currFmt],
                    ['V', item.mcbuReturnNo,           'center'],
                    ['W', item.mcbuReturnAmount,       'right', currFmt],
                    ['X', item.csfWithdrawal,          'right', currFmt],
                    ['Y', item.csfReturnNo,            'center'],
                    ['Z', item.csfReturnAmount,        'right', currFmt],
                    ['AA', item.netCollection,         'right', currFmt],
                    ['AB', item.renewalNo,             'center'],
                    ['AC', item.renewalAmount,         'right', currFmt],
                    ['AD', item.offsetNo,              'center'],
                    ['AE', item.offsetAmount,          'right', currFmt],
                    ['AF', item.fullPaymentClients,    'center'],
                ];
                cols.forEach(([col, val, align, fmt]) => {
                    const cell = r.getCell(col);
                    cell.value = val;
                    cell.alignment = { horizontal: align, vertical: 'middle' };
                    if (fmt) cell.numFmt = fmt;
                });
            });

            // ── Totals row ──────────────────────────────────────────────────
            if (totals) {
                const tr = ws.getRow(rowNum);
                tr.height = 18;
                tr.getCell('B').value = 'TOTAL';
                tr.getCell('B').font = bold;
                const tCols = [
                    ['D', totals.mcbuTarget,          currFmt],
                    ['E', totals.mcbuActual,          currFmt],
                    ['F', totals.csfCollection,       currFmt],
                    ['G', totals.regularLoanTarget,   currFmt],
                    ['H', totals.regularLoanAdvance,  currFmt],
                    ['I', totals.regularLoanActual,   currFmt],
                    ['J', totals.otherLoanTarget,     currFmt],
                    ['K', totals.otherLoanAdvance,    currFmt],
                    ['L', totals.otherLoanActual,     currFmt],
                    ['M', totals.admissionNo,         intFmt],
                    ['N', totals.admissionAmount,     currFmt],
                    ['O', totals.lrfCollection,       currFmt],
                    ['P', totals.cbhbNo,              intFmt],
                    ['Q', totals.cbhbAmount,          currFmt],
                    ['R', totals.addHospitalization,  currFmt],
                    ['S', totals.otherIncome,         currFmt],
                    ['T', totals.totalCollection,     currFmt],
                    ['U', totals.mcbuWithdrawal,      currFmt],
                    ['V', totals.mcbuReturnNo,        intFmt],
                    ['W', totals.mcbuReturnAmount,    currFmt],
                    ['X', totals.csfWithdrawal,       currFmt],
                    ['Y', totals.csfReturnNo,         intFmt],
                    ['Z', totals.csfReturnAmount,     currFmt],
                    ['AA', totals.netCollection,      currFmt],
                    ['AB', totals.renewalNo,          intFmt],
                    ['AC', totals.renewalAmount,      currFmt],
                    ['AD', totals.offsetNo,           intFmt],
                    ['AE', totals.offsetAmount,       currFmt],
                    ['AF', totals.fullPaymentClients, intFmt],
                ];
                tCols.forEach(([col, val, fmt]) => {
                    const c = tr.getCell(col);
                    c.value = val;
                    c.font = bold;
                    c.fill = totalFill;
                    c.numFmt = fmt;
                    c.alignment = fmt === intFmt ? centerXS : rightXS;
                });
            }

            // ── Summary sheet ────────────────────────────────────────────────
            if (summaryData) {
                const sm = summaryData;
                const wsSummary = workbook.addWorksheet('Summary');
                const boldF  = { bold: true };
                const rightA = { horizontal: 'right', vertical: 'middle' };
                const leftA  = { horizontal: 'left',  vertical: 'middle' };
                const currF  = '#,##0.00';
                const hdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
                const totFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
                const negFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };

                wsSummary.columns = [{ width: 8 }, { width: 38 }, { width: 18 }];

                wsSummary.mergeCells('A1:C1');
                const st = wsSummary.getCell('A1');
                st.value = `CASHBOOK SUMMARY — ${branchName} — ${moment(selectedDate).format('MMMM D, YYYY')}`;
                st.font = { bold: true, size: 12 }; st.alignment = { horizontal: 'center' };
                wsSummary.getRow(1).height = 20;

                const sectionHdr = (label, rowNum) => {
                    wsSummary.mergeCells(`A${rowNum}:C${rowNum}`);
                    const c = wsSummary.getCell(`A${rowNum}`);
                    c.value = label; c.font = boldF; c.alignment = { horizontal: 'center' };
                    c.fill = hdrFill;
                    wsSummary.getRow(rowNum).height = 16;
                };
                const dataRow = (no, label, value, rowNum, isTotal = false) => {
                    const r = wsSummary.getRow(rowNum);
                    r.height = 15;
                    r.getCell('A').value = no ?? '';
                    r.getCell('A').alignment = { horizontal: 'center' };
                    r.getCell('B').value = label;
                    r.getCell('B').alignment = leftA;
                    const vc = r.getCell('C');
                    vc.value = value || 0;
                    vc.numFmt = currF;
                    vc.alignment = rightA;
                    if (isTotal) {
                        ['A','B','C'].forEach(col => {
                            r.getCell(col).font = boldF;
                            r.getCell(col).fill = totFill;
                        });
                    }
                };

                let sr = 2;

                const bbRow = wsSummary.getRow(sr);
                bbRow.height = 16;
                wsSummary.mergeCells(`A${sr}:B${sr}`);
                bbRow.getCell('A').value = 'Beginning Balance';
                bbRow.getCell('A').font = boldF;
                bbRow.getCell('C').value = sm.beginning_balance || 0;
                bbRow.getCell('C').numFmt = currF; bbRow.getCell('C').alignment = rightA;
                ['A','B','C'].forEach(col => bbRow.getCell(col).fill = { type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF3CD'} });
                sr++;

                sectionHdr('RECEIPTS', sr++);
                const receipts = [
                    ['1a','MCBU Collection',              sm.rcpt_mcbu],
                    ['1b','CSF Collection',               sm.rcpt_csf],
                    [2,   'Regular Loan (60 Days)',       sm.rcpt_regular_loan],
                    [3,   'Other Loan (Weekly)',          sm.rcpt_other_loan],
                    [4,   'Staff Collection CBU/CashBond',sm.rcpt_staff_cbu],
                    [5,   'Staff Principal Loan',         sm.rcpt_staff_principal],
                    [6,   'Admin Fees',                   sm.rcpt_admin_fees],
                    [7,   'LRF Collection',               sm.rcpt_lrf],
                    [8,   'C B H B Collection',           sm.rcpt_cbhb],
                    [9,   "ADD-Hospi",                    sm.rcpt_add_hospi],
                    [10,  'W/Tax, EE&ER',                 sm.rcpt_wtax],
                    [11,  'MCBU Unclaimed (In)',          sm.rcpt_mcbu_unclaimed_in],
                    ['12a','Other Income (Passbook)',     sm.rcpt_other_income_passbook],
                    ['12b','Other Income',               sm.rcpt_other_income],
                    ['12c','Other Income CSF W/o Agent', sm.rcpt_other_income_csf],
                    [13,  'Other Receipts (Picture)',     sm.rcpt_other_receipts_picture],
                    [14,  'Other Receipts',              sm.rcpt_other_receipts_gl],
                    [15,  'Fund Transfer (In)',           sm.rcpt_fund_transfer_in],
                    [16,  'Bank Withdrawal',             sm.rcpt_bank_withdrawal],
                ];
                receipts.forEach(([no, label, val]) => dataRow(no, label, val, sr++));
                dataRow('', 'TOTAL RECEIPTS', sm.total_receipts, sr++, true);

                sectionHdr('PAYMENTS', sr++);
                const loReleaseNo = sm.pay_loan_release_no || 0;
                const payments = [
                    [1,   `Client Loan Release (${loReleaseNo} prs.)`, sm.pay_loan_release_amount],
                    ['2a','Client MCBU Withdrawal',      sm.pay_mcbu_withdrawal],
                    ['2b','CSF Withdrawal',              sm.pay_csf_withdrawal],
                    ['3a','MCBU Return',                 sm.pay_mcbu_return],
                    ['3b','CSF Return',                  sm.pay_csf_return],
                    [4,   'Staff Loan Release / CBU Withd.', sm.pay_staff_loan_release],
                    [5,   'Mngt. Expenses',              sm.pay_mngt_expenses],
                    [6,   'CBHB Disbursed',              sm.pay_cbhb_disbursed],
                    [7,   'MCBU Unclaimed (Out)',         sm.pay_mcbu_unclaimed_out],
                    [8,   'Rebates',                     sm.pay_rebates],
                    [9,   'Other Payments',              sm.pay_other_payments],
                    [10,  'Fund Transfer (Out)',          sm.pay_fund_transfer_out],
                    [11,  'Bank Deposits',               sm.pay_bank_deposits],
                ];
                payments.forEach(([no, label, val]) => dataRow(no, label, val, sr++));
                dataRow('', 'TOTAL PAYMENTS', sm.total_payments, sr++, true);

                sr++;
                const cbRow = wsSummary.getRow(sr);
                cbRow.height = 18;
                wsSummary.mergeCells(`A${sr}:B${sr}`);
                cbRow.getCell('A').value = 'Closing Balance';
                cbRow.getCell('A').font = { bold: true, size: 12 };
                const cbVal = sm.closing_balance || 0;
                cbRow.getCell('C').value = cbVal;
                cbRow.getCell('C').numFmt = currF;
                cbRow.getCell('C').alignment = rightA;
                cbRow.getCell('C').font = { bold: true, size: 12, color: { argb: cbVal < 0 ? 'FFFF0000' : 'FF1F6B2A' } };
                const cbFill = cbVal < 0 ? negFill : { type:'pattern',pattern:'solid',fgColor:{argb:'FFD9EAD3'} };
                ['A','B','C'].forEach(col => cbRow.getCell(col).fill = cbFill);
                sr += 2;

                const loReleases = sm.loan_release_per_lo || [];
                if (loReleases.length > 0) {
                    sectionHdr('LOAN RELEASE PER LOAN OFFICER', sr++);
                    const lrHdr = wsSummary.getRow(sr++);
                    lrHdr.height = 15;
                    ['LO', 'Name', '# Clients', 'Release Amount'].forEach((h, i) => {
                        const c = lrHdr.getCell(i + 1);
                        c.value = h; c.font = boldF; c.fill = hdrFill;
                        c.alignment = i === 0 ? { horizontal: 'center' } : i === 1 ? leftA : rightA;
                    });
                    loReleases.forEach(lo => {
                        const r = wsSummary.getRow(sr++);
                        r.height = 15;
                        r.getCell(1).value = `LO-${lo.loNo}`; r.getCell(1).alignment = { horizontal: 'center' };
                        r.getCell(2).value = lo.loName;        r.getCell(2).alignment = leftA;
                        r.getCell(3).value = lo.noClients;     r.getCell(3).alignment = { horizontal: 'center' };
                        r.getCell(4).value = lo.releaseAmount || 0;
                        r.getCell(4).numFmt = currF;           r.getCell(4).alignment = rightA;
                    });
                    const lrTot = wsSummary.getRow(sr++);
                    lrTot.height = 15;
                    lrTot.getCell(2).value = 'TOTAL'; lrTot.getCell(2).font = boldF; lrTot.getCell(2).fill = totFill;
                    lrTot.getCell(3).value = loReleases.reduce((s,lo) => s + (lo.noClients||0), 0);
                    lrTot.getCell(3).font = boldF; lrTot.getCell(3).fill = totFill; lrTot.getCell(3).alignment = { horizontal: 'center' };
                    lrTot.getCell(4).value = loReleases.reduce((s,lo) => s + (lo.releaseAmount||0), 0);
                    lrTot.getCell(4).numFmt = currF; lrTot.getCell(4).font = boldF;
                    lrTot.getCell(4).fill = totFill; lrTot.getCell(4).alignment = rightA;
                }
            }

            // ── Morning & Afternoon sheet ────────────────────────────────────
            const denomRows = summaryData?.denomination_summary || [];
            if (denomRows.length > 0) {
                const wsDenom = workbook.addWorksheet('Morning & Afternoon');
                wsDenom.columns = [{ width: 8 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }];
                const boldF  = { bold: true };
                const centerA = { horizontal: 'center', vertical: 'middle' };
                const rightA  = { horizontal: 'right',  vertical: 'middle' };
                const leftA   = { horizontal: 'left',   vertical: 'middle' };
                const currF   = '#,##0.00';
                const hdrFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
                const totFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };

                wsDenom.mergeCells('A1:G1');
                const dt = wsDenom.getCell('A1');
                dt.value = `MORNING / AFTERNOON DENOMINATION — ${branchName} — ${moment(selectedDate).format('MMMM D, YYYY')}`;
                dt.font = { bold: true, size: 12 }; dt.alignment = { horizontal: 'center' };
                wsDenom.getRow(1).height = 20;

                const dh = wsDenom.getRow(2);
                dh.height = 16;
                ['LO No.', 'Loan Officer', 'Total Net Collection', 'Morning Remittance', 'Afternoon Remittance', 'BCC vs Remittances', 'Status']
                    .forEach((h, i) => {
                        const c = dh.getCell(i + 1);
                        c.value = h; c.font = boldF; c.fill = hdrFill;
                        c.alignment = i <= 1 ? (i === 0 ? centerA : leftA) : rightA;
                    });

                let dr = 3;
                let tNet = 0, tMorn = 0, tAftn = 0, tBcc = 0;
                denomRows.forEach(lo => {
                    const r = wsDenom.getRow(dr++);
                    r.height = 15;
                    r.getCell(1).value = `LO-${lo.loNo}`;            r.getCell(1).alignment = centerA;
                    r.getCell(2).value = lo.loName;                   r.getCell(2).alignment = leftA;
                    r.getCell(3).value = lo.totalNetCollection || 0;  r.getCell(3).numFmt = currF; r.getCell(3).alignment = rightA;
                    r.getCell(4).value = lo.morningRemittance  || 0;  r.getCell(4).numFmt = currF; r.getCell(4).alignment = rightA;
                    r.getCell(5).value = lo.afternoonRemittance|| 0;  r.getCell(5).numFmt = currF; r.getCell(5).alignment = rightA;
                    r.getCell(6).value = lo.bccVsRemittances   || 0;  r.getCell(6).numFmt = currF; r.getCell(6).alignment = rightA;
                    r.getCell(7).value = lo.status || '';              r.getCell(7).alignment = centerA;
                    tNet  += lo.totalNetCollection  || 0;
                    tMorn += lo.morningRemittance   || 0;
                    tAftn += lo.afternoonRemittance || 0;
                    tBcc  += lo.bccVsRemittances    || 0;
                });

                const tr = wsDenom.getRow(dr);
                tr.height = 16;
                tr.getCell(2).value = 'TOTAL'; tr.getCell(2).font = boldF; tr.getCell(2).fill = totFill;
                [[3, tNet],[4, tMorn],[5, tAftn],[6, tBcc]].forEach(([col, val]) => {
                    const c = tr.getCell(col);
                    c.value = val; c.numFmt = currF; c.font = boldF;
                    c.fill = totFill; c.alignment = rightA;
                });

                if (summaryData) {
                    dr += 2;
                    const sm = summaryData;
                    wsDenom.mergeCells(`A${dr}:C${dr}`);
                    wsDenom.getCell(`A${dr}`).value = 'Morning Closing Balance  =  Beginning Balance + Morning Remittance − Loan Releases';
                    wsDenom.getCell(`A${dr}`).font = { italic: true, color: { argb: 'FF555555' } };
                    dr++;
                    const morn_closing = (sm.beginning_balance||0) + tMorn - (sm.pay_loan_release_amount||0);
                    [
                        ['Beginning Balance',      sm.beginning_balance    || 0],
                        ['Morning Remittance',      tMorn],
                        ['Loan Releases',          -(sm.pay_loan_release_amount || 0)],
                        ['Morning Closing Balance', morn_closing],
                        ['Afternoon Remittance',    tAftn],
                        ['Closing Balance (Day)',   sm.closing_balance     || 0],
                    ].forEach(([label, val], i) => {
                        const r = wsDenom.getRow(dr++);
                        r.height = 15;
                        wsDenom.mergeCells(`A${dr-1}:B${dr-1}`);
                        r.getCell('A').value = label;
                        r.getCell('A').font = i === 3 || i === 5 ? boldF : {};
                        r.getCell('C').value = val;
                        r.getCell('C').numFmt = currF;
                        r.getCell('C').alignment = rightA;
                        r.getCell('C').font = i === 3 || i === 5 ? boldF : {};
                        if (i === 3 || i === 5) {
                            ['A','B','C'].forEach(col => r.getCell(col).fill = totFill);
                        }
                    });
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url    = window.URL.createObjectURL(blob);
            const link   = document.createElement('a');
            link.href     = url;
            link.download = fileName;
            document.body.appendChild(link); link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Excel exported successfully!');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            toast.error('Error exporting to Excel');
        }
    };

    // ── Tab button ───────────────────────────────────────────────────────────
    const TabBtn = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </button>
    );

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <Layout header={false} noPad={true}>
            {loading ? <Spinner /> : (
                <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">

                    {/* ── Header ── */}
                    <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <FileSpreadsheet className="w-8 h-8 text-teal-600" />
                                <div>
                                    <h1 className="text-xl font-bold text-gray-800">Daily Collection Sheet</h1>
                                    <p className="text-sm text-gray-500">
                                        {isLoanOfficer ? 'View your daily collection report' : 'Daily collection reports by loan officer'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={exportToExcel}
                                disabled={!hasDetailData && !hasBranchData}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-4 h-4" />
                                <span>Export Excel</span>
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap items-center gap-4 bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Date:</span>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    max={moment().format('YYYY-MM-DD')}
                                    onChange={handleDateChange}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 h-10 px-3 w-40"
                                />
                            </div>

                            {isAdmin && (
                                <div className="flex items-center space-x-2">
                                    <Building2 className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Branch:</span>
                                    <div className="w-52">
                                        <Select
                                            options={branchList?.map(b => ({ ...b, value: b._id, label: b.name })) || []}
                                            value={selectedBranch ? { ...selectedBranch, value: selectedBranch._id, label: selectedBranch.name } : null}
                                            styles={selectStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleBranchChange}
                                            isClearable
                                            placeholder="All Branches"
                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                            menuPosition="fixed"
                                        />
                                    </div>
                                </div>
                            )}

                            {(isBranchManager || (isAdmin && selectedBranch)) && (
                                <div className="flex items-center space-x-2">
                                    <User className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">Loan Officer:</span>
                                    <div className="w-48">
                                        <Select
                                            options={[{ value: '', label: 'All Loan Officers', _id: null }, ...loanOfficers]}
                                            value={selectedLo}
                                            styles={selectStyles}
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

                            {!isAdmin && (
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
                            )}
                        </div>

                        {!isAdminAllBranches && (
                            <div className="flex space-x-1 mt-3 border-b border-gray-200">
                                <TabBtn id="dcs"     label="DCS Table"           icon={FileSpreadsheet} />
                                <TabBtn id="morning" label="Morning / Afternoon"  icon={Sun} />
                            </div>
                        )}
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-auto min-h-0">
                        {activeTab === 'dcs' || isAdminAllBranches ? (
                            <div className="flex h-full">
                                <div className="flex-1 overflow-auto p-6 min-w-0">
                                    <DCSTable
                                        data={data}
                                        branchData={branchData}
                                        totals={totals}
                                        isAdminAllBranches={isAdminAllBranches}
                                        selectedDate={selectedDate}
                                    />
                                </div>

                                {!isAdminAllBranches && (
                                    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
                                        <div className="p-4">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <BookOpen className="w-4 h-4 text-teal-600" />
                                                <span className="text-sm font-bold text-gray-800">Summary</span>
                                                {summaryLoading && (
                                                    <span className="text-xs text-gray-400 animate-pulse ml-1">Loading…</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 mb-3">
                                                {getBranchName()} — {moment(selectedDate).format('MMM D, YYYY')} ({moment(selectedDate).format('ddd')})
                                            </div>
                                            <SummaryPanel summaryData={summaryData} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="mb-3 flex items-center space-x-2">
                                    <Sun className="w-5 h-5 text-amber-500" />
                                    <h2 className="text-base font-bold text-gray-800">
                                        Morning / Afternoon — {getBranchName()} — {moment(selectedDate).format('MMMM D, YYYY')}
                                    </h2>
                                </div>
                                <MorningAfternoonPanel summaryData={summaryData} data={data} />
                            </div>
                        )}
                    </div>

                </div>
            )}
        </Layout>
    );
};

export default DailyCollectionSheet;