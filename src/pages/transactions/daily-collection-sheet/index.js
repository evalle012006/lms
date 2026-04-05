import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import moment from 'moment';
import { toast } from 'react-toastify';
import { Download, Calendar, Building2, User, FileSpreadsheet, BookOpen, Sun, Printer } from 'lucide-react';
import Select from 'react-select';

import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { DropdownIndicator, borderStyles } from '@/styles/select';
import { setBranchList } from '@/redux/actions/branchActions';

import DCSTable              from '@/components/transactions/daily-collection-sheet/DCSTable';
import SummaryPanel          from '@/components/transactions/daily-collection-sheet/SummaryPanel';
import MorningAfternoonPanel from '@/components/transactions/daily-collection-sheet/MorningAfternoonPanel';

// ── Separated export / print utilities ───────────────────────────────────────
import { exportDCSExcel } from '@/components/transactions/daily-collection-sheet/exportDCSExcel';
import { printDCS }       from '@/components/transactions/daily-collection-sheet/printDCS';

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
        morningRemittance:   parseFloat(item.morning_remittance   || item.morningRemittance)   || 0,
        afternoonRemittance: parseFloat(item.afternoon_remittance || item.afternoonRemittance) || 0,
        denomNetCollection:  parseFloat(item.denom_net_collection  || item.denomNetCollection)  || 0,
        mcbuTarget:          parseFloat(d.mcbuTarget    || d.mcbu_target)    || 0,
        mcbuActual:          parseFloat(d.mcbuActual    || d.mcbu_actual)    || 0,
        csfCollection:       parseFloat(item.csf_collection || d.csfCollection || d.csf_collection) || 0,
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
        totalCollection:     parseFloat(item.total_collection ?? d.totalCollection ?? d.total_collection) || 0,
        mcbuWithdrawal:      parseFloat(d.mcbuWithdrawal || d.mcbu_withdrawal) || 0,
        mcbuReturnNo:        parseInt(d.mcbuReturnNo  || d.mcbu_return_no)  || 0,
        mcbuReturnAmount:    parseFloat(d.mcbuReturnAmount || d.mcbu_return_amount) || 0,
        csfWithdrawal:       parseFloat(item.csf_withdrawal || d.csfWithdrawal || d.csf_withdrawal) || 0,
        csfReturnNo:         parseInt(item.csf_return_no   || d.csfReturnNo   || d.csf_return_no)   || 0,
        csfReturnAmount:     parseFloat(item.csf_return_amount || d.csfReturnAmount || d.csf_return_amount) || 0,
        netCollection:       parseFloat(item.net_collection ?? d.netCollection ?? d.net_collection) || 0,
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

    const isAdmin            = currentUser?.role?.rep === 1;
    const isLoanOfficer      = currentUser?.role?.rep === 4;
    const isBranchManager    = currentUser?.role?.rep === 3;
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

    // ── Action handlers (delegate to utility files) ───────────────────────────
    const handleExport = () => exportDCSExcel({
        data,
        branchData,
        totals,
        summaryData,
        selectedDate,
        getBranchName,
        isAdmin,
        selectedBranch,
        currentBranch,
    });

    const handlePrint = () => printDCS({
        data,
        branchData,
        totals,
        summaryData,
        selectedDate,
        getBranchName,
        selectedLo,
        isLoanOfficer,
        currentUser,
    });

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
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handlePrint}
                                    disabled={!hasDetailData && !hasBranchData}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print</span>
                                </button>
                                <button
                                    onClick={handleExport}
                                    disabled={!hasDetailData && !hasBranchData}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Export Excel</span>
                                </button>
                            </div>
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