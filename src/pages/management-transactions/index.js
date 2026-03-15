import React, { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import { formatPricePhp } from "@/lib/utils";
import { useRouter } from 'next/router';
import moment from 'moment';
import DatePicker from "@/lib/ui/DatePicker";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { ChevronLeft, ChevronDown, FileText } from 'lucide-react';

import BranchInputTable from "@/components/management-transactions/BranchInputTable";
import AggregatedView   from "@/components/management-transactions/AggregatedView";
import SummaryView      from "@/components/management-transactions/SummaryView";
import DisplayGroupView from "@/components/management-transactions/DisplayGroupView";

const ACCOUNT_GROUPS = {
    other_receipts: 'Other Receipts',
    management_expenses: 'Management Expenses',
    other_payments: 'Other Payments',
};
const DISPLAY_GROUPS = {
    assets: 'Assets',
    liabilities: 'Liabilities',
    management_expenses: 'Management Expenses',
};
const GROUP_TAB_ORDER = ['other_receipts', 'management_expenses', 'other_payments'];

const ManagementTransactionsPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const router = useRouter();

    const excludedRoles = ['loan_officer', 'cashier', 'finance'];
    if (!currentUser || excludedRoles.includes(currentUser.role?.shortCode)) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-96">
                    <h1 className="text-2xl font-bold text-gray-700">Access Denied</h1>
                    <p className="text-gray-500 mt-2">You don't have permission to access this page.</p>
                </div>
            </Layout>
        );
    }

    // ── State ─────────────────────────────────────────────────────────────────
    const [loading, setLoading]               = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [submitting, setSubmitting]         = useState(false);

    const [accountTypes, setAccountTypes]     = useState([]);
    const [selectedAccountType, setSelectedAccountType] = useState(null);
    const [accountTypeDropdownOpen, setAccountTypeDropdownOpen] = useState(false);
    const accountTypeDropdownRef = useRef(null);

    const [availableBranches, setAvailableBranches] = useState([]);
    const [selectedBranches, setSelectedBranches]   = useState([]);
    const [tempSelectedBranches, setTempSelectedBranches] = useState([]);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [branchSearchTerm, setBranchSearchTerm]   = useState('');
    const branchDropdownRef = useRef(null);

    const [viewingBranchDetail, setViewingBranchDetail] = useState(false);
    const [selectedBranchDetail, setSelectedBranchDetail] = useState(null);

    const [dateFilter, setDateFilter]         = useState(null);
    const [accounts, setAccounts]             = useState({});
    const [transactions, setTransactions]     = useState([]);
    const [newTransactions, setNewTransactions] = useState({});
    const [previousBalances, setPreviousBalances] = useState({});
    const [grandTotals, setGrandTotals]       = useState({ previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 });
    const [aggregatedData, setAggregatedData] = useState([]);

    const [showSummary, setShowSummary]       = useState(false);
    const [summaryActiveTab, setSummaryActiveTab] = useState('other_receipts');
    const [summaryData, setSummaryData]       = useState({});
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [showAllAccounts, setShowAllAccounts] = useState(false);
    const [allAccountsSummaryData, setAllAccountsSummaryData] = useState({});

    const [selectedDisplayGroup, setSelectedDisplayGroup] = useState(null);
    const [displayGroupDropdownOpen, setDisplayGroupDropdownOpen] = useState(false);
    const [displayGroupData, setDisplayGroupData] = useState(null);
    const [loadingDisplayGroup, setLoadingDisplayGroup] = useState(false);
    const displayGroupDropdownRef = useRef(null);

    const canEdit       = currentUser?.role?.rep === 1 || (currentUser?.role?.rep === 3 && currentDate === dateFilter);
    const baseViewMode  = currentUser?.role?.rep === 3 ? 'branch' : 'aggregated';
    const viewMode      = viewingBranchDetail ? 'branch' : baseViewMode;
    const isBranchUser  = viewMode === 'branch';
    const currentAccounts = selectedAccountType ? (accounts[selectedAccountType.type_code] || []) : [];
    const hasExistingTransactions = transactions.length > 0;
    const isEditable    = !hasExistingTransactions || canEdit;

    // ── Click-outside for dropdowns ───────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target)) {
                setBranchDropdownOpen(false); setTempSelectedBranches(selectedBranches); setBranchSearchTerm('');
            }
            if (accountTypeDropdownRef.current && !accountTypeDropdownRef.current.contains(e.target)) setAccountTypeDropdownOpen(false);
            if (displayGroupDropdownRef.current && !displayGroupDropdownRef.current.contains(e.target)) setDisplayGroupDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [selectedBranches]);

    useEffect(() => {
        if (router.query.branchId) {
            const branch = availableBranches.find(b => b._id === router.query.branchId);
            if (branch) { setSelectedBranchDetail(branch); setViewingBranchDetail(true); }
        } else { setViewingBranchDetail(false); setSelectedBranchDetail(null); }
    }, [router.query.branchId, availableBranches]);

    useEffect(() => { if (currentDate) setDateFilter(currentDate); }, [currentDate]);
    useEffect(() => { loadAccountTypes(); }, []);
    useEffect(() => { if (accountTypes.length > 0 && !selectedAccountType) setSelectedAccountType(accountTypes[0]); }, [accountTypes]);
    useEffect(() => { if (selectedAccountType && viewMode === 'branch') loadAccounts(selectedAccountType.type_code); }, [selectedAccountType, viewMode]);

    useEffect(() => {
        if (selectedAccountType && dateFilter) {
            if (viewMode === 'branch') {
                if (viewingBranchDetail && selectedBranchDetail) loadTransactions(selectedAccountType.type_code, selectedBranchDetail._id);
                else if (currentUser.role.rep === 3) loadTransactions(selectedAccountType.type_code);
            } else {
                loadAggregatedData(selectedAccountType.type_code, null);
            }
        }
    }, [selectedAccountType, dateFilter, viewMode, viewingBranchDetail, selectedBranchDetail]);

    useEffect(() => { if (showSummary && dateFilter) loadAllSummaryData(); }, [showSummary, dateFilter]);

    // ── API calls ─────────────────────────────────────────────────────────────
    const loadAccountTypes = async () => {
        setLoadingAccounts(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'management-transactions/account-types/list');
            if (res.success) setAccountTypes(res.accountTypes);
        } catch { toast.error('Failed to load account types'); }
        finally { setLoadingAccounts(false); }
    };

    const loadAccounts = async (accountType) => {
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/account-names/list?accountType=${accountType}`);
            if (res.success) setAccounts(prev => ({ ...prev, [accountType]: res.accounts }));
        } catch { toast.error('Failed to load accounts'); }
    };

    const loadPreviousBalances = async (transactionType, branchId) => {
        try {
            const prevDate = moment(dateFilter).subtract(1, 'day').format('YYYY-MM-DD');
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/previous-balances?transactionType=${transactionType}&branchId=${branchId}&date=${prevDate}`);
            if (res.success && res.previousBalances) { setPreviousBalances(res.previousBalances); return res.previousBalances; }
        } catch {}
        return {};
    };

    const loadTransactions = async (transactionType, branchId = null) => {
        if (!dateFilter) return;
        setLoading(true);
        try {
            let effectiveBranchId = branchId || (currentUser.role.rep === 3 ? currentUser.designatedBranchId : null);
            const prevBalances = await loadPreviousBalances(transactionType, effectiveBranchId);
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/list?transactionType=${transactionType}&branchId=${effectiveBranchId||''}&dateFrom=${dateFilter}&dateTo=${dateFilter}`);
            if (res.success) {
                setTransactions(res.transactions);
                const existingData = {};
                res.transactions.forEach(t => {
                    existingData[t.account_id] = { previousBalance: t.previous_balance||0, debit: t.debit||0, credit: t.credit||0 };
                });
                if (res.transactions.length === 0) {
                    Object.keys(prevBalances).forEach(id => {
                        existingData[id] = { previousBalance: prevBalances[id]||0, debit: 0, credit: 0 };
                    });
                }

                // Remove computed (non-SC formula) accounts from existingData.
                // Their values are derived from other accounts' formulas — saving
                // them to newTransactions would corrupt the grand total.
                const accts = accounts[transactionType] || [];
                const computedIds = new Set(
                    accts
                        .filter(a => !a.service_charge && (
                            a.prev_balance_formula || a.debit_formula || a.credit_formula || a.balance_formula
                        ))
                        .map(a => a._id)
                );
                computedIds.forEach(id => delete existingData[id]);

                setNewTransactions(existingData);

                const sourceEntries = Object.entries(existingData).map(([,d]) => ({
                    previous_balance: parseFloat(d.previousBalance)||0,
                    debit:            parseFloat(d.debit)||0,
                    credit:           parseFloat(d.credit)||0,
                }));
                // For DB transactions use the filtered source; computed rows excluded above
                const source = res.transactions.length > 0
                    ? res.transactions.filter(t => !computedIds.has(t.account_id))
                    : sourceEntries;
                calculateGrandTotals(source);
            }
        } catch { toast.error('Failed to load transactions'); }
        finally { setLoading(false); }
    };

    const loadAggregatedData = async (transactionType, branchIdsToFilter = null) => {
        if (!dateFilter) return;
        setLoading(true);
        try {
            const branches = branchIdsToFilter !== null ? branchIdsToFilter : selectedBranches;
            const branchParam = branches.length > 0 ? `&branchIds=${branches.join(',')}` : '';
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/aggregated?transactionType=${transactionType}&date=${dateFilter}${branchParam}`);
            if (res.success) {
                setAggregatedData(res.aggregatedData || []);
                setGrandTotals(res.grandTotals || { previousBalance:0,debit:0,credit:0,totalBalance:0 });
                if (res.availableBranches) {
                    setAvailableBranches(res.availableBranches);
                    if (selectedBranches.length === 0 && tempSelectedBranches.length === 0) {
                        const all = res.availableBranches.map(b => b._id);
                        setSelectedBranches(all); setTempSelectedBranches(all);
                    }
                }
            }
        } catch { toast.error('Failed to load aggregated data'); }
        finally { setLoading(false); }
    };

    const loadAllSummaryData = async () => {
        if (!dateFilter) return;
        setLoadingSummary(true);
        try {
            let branchId = currentUser.role.rep === 3 ? currentUser.designatedBranchId : (viewingBranchDetail && selectedBranchDetail ? selectedBranchDetail._id : null);
            if (!branchId) { setLoadingSummary(false); return; }
            const [sumRes, allRes] = await Promise.all([
                fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/summary?branchId=${branchId}&date=${dateFilter}`),
                fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/summary-all?branchId=${branchId}&date=${dateFilter}`),
            ]);
            if (sumRes.success) { setSummaryData(sumRes.summaryData||{}); if (sumRes.grandTotals) setGrandTotals(sumRes.grandTotals); }
            if (allRes.success) setAllAccountsSummaryData(allRes.summaryData||{});
        } catch { toast.error('Failed to load summary data'); }
        finally { setLoadingSummary(false); }
    };

    const loadDisplayGroupData = async (displayGroup) => {
        if (!dateFilter || !displayGroup) return;
        setLoadingDisplayGroup(true);
        try {
            let branchId = currentUser.role.rep === 3 ? currentUser.designatedBranchId : (viewingBranchDetail && selectedBranchDetail ? selectedBranchDetail._id : null);
            if (!branchId) { setLoadingDisplayGroup(false); return; }
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/transactions/display-group?branchId=${branchId}&date=${dateFilter}&displayGroup=${displayGroup}`);
            if (res.success) { setDisplayGroupData(res.data||null); if (res.grandTotals) setGrandTotals(res.grandTotals); }
        } catch { toast.error('Failed to load display group data'); }
        finally { setLoadingDisplayGroup(false); }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Returns a Set of account IDs for computed (non-SC formula) rows.
    // These rows derive their display values from formulas referencing other
    // accounts — including them in the grand total would double-count.
    const getComputedAccountIds = () => {
        const accts = selectedAccountType ? (accounts[selectedAccountType.type_code] || []) : [];
        return new Set(
            accts
                .filter(a => !a.service_charge && (
                    a.prev_balance_formula || a.debit_formula || a.credit_formula || a.balance_formula
                ))
                .map(a => a._id)
        );
    };

    const calculateGrandTotals = (data = null) => {
        const computedIds = getComputedAccountIds();

        let src;
        if (data) {
            // When called with DB transaction data, filter out computed accounts
            src = data.filter(t => !computedIds.has(t.account_id));
        } else {
            // When called from state, skip computed accounts entirely
            src = Object.entries(newTransactions)
                .filter(([id]) => !computedIds.has(id))
                .map(([,d]) => ({
                    previous_balance: parseFloat(d.previousBalance)||0,
                    debit:            parseFloat(d.debit)||0,
                    credit:           parseFloat(d.credit)||0,
                }));
        }

        const totals = src.reduce((acc, t) => {
            const p = parseFloat(t.previous_balance)||0, d = parseFloat(t.debit)||0, c = parseFloat(t.credit)||0;
            acc.previousBalance += p; acc.debit += d; acc.credit += c; acc.totalBalance += (p+d-c);
            return acc;
        }, { previousBalance:0, debit:0, credit:0, totalBalance:0 });
        setGrandTotals(totals);
    };

    const calculateTotalBalance = (accountId) => {
        const d = newTransactions[accountId];
        if (!d) return 0;
        return (parseFloat(d.previousBalance)||0) + (parseFloat(d.debit)||0) - (parseFloat(d.credit)||0);
    };

    const isPreviousBalanceDisabled = (accountId) => {
        if (!isEditable) return true;
        const existing = transactions.find(t => t.account_id === accountId);
        if (existing && existing.previous_balance > 0) return true;
        if (previousBalances[accountId] && previousBalances[accountId] > 0) return true;
        return false;
    };

    const handleFieldChange = (accountId, field, value) => {
        const cleanedValue = value === '' ? '' : value.replace(/[^0-9.-]/g, '');
        setNewTransactions(prev => ({ ...prev, [accountId]: { ...(prev[accountId]||{}), [field]: cleanedValue } }));
        setTimeout(() => calculateGrandTotals(), 0);
    };

    const handleDisplayGroupSelect = (groupCode) => {
        setSelectedDisplayGroup(groupCode); setDisplayGroupDropdownOpen(false); setShowSummary(false);
        if (groupCode) loadDisplayGroupData(groupCode); else setDisplayGroupData(null);
    };

    const handleBranchClick = (branch) => {
        router.push({ pathname: router.pathname, query: { date: dateFilter, branchId: branch.branchId } }, undefined, { shallow: true });
    };

    const handleBackToAggregated = () => {
        router.push({ pathname: router.pathname, query: { date: dateFilter } }, undefined, { shallow: true });
        setNewTransactions({}); setShowSummary(false);
    };

    const handleViewSummary = () => {
        setShowSummary(true);
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;
        const firstTab = GROUP_TAB_ORDER.find(g => { const d=dataSource[g]; return d&&d.accountTypes&&d.accountTypes.length>0; });
        setSummaryActiveTab(firstTab || GROUP_TAB_ORDER[0]);
    };

    const handleApplyBranchFilter = () => {
        setSelectedBranches(tempSelectedBranches); setBranchDropdownOpen(false); setBranchSearchTerm('');
        if (selectedAccountType && dateFilter) loadAggregatedData(selectedAccountType.type_code, tempSelectedBranches);
    };

    const handleSubmitAll = async () => {
        const hasData = Object.values(newTransactions).some(d => (parseFloat(d.previousBalance)||0)>0 || (parseFloat(d.debit)||0)>0 || (parseFloat(d.credit)||0)>0);
        if (!hasData) { toast.error('Please enter at least one transaction before submitting'); return; }
        let branchId = currentUser.role.rep === 3 ? currentUser.designatedBranchId : (viewingBranchDetail && selectedBranchDetail ? selectedBranchDetail._id : null);
        if (!branchId) { toast.error('Branch information not found'); return; }
        setSubmitting(true);
        try {
            const transactionsData = Object.entries(newTransactions)
                .filter(([,d]) => (parseFloat(d.previousBalance)||0)>0||(parseFloat(d.debit)||0)>0||(parseFloat(d.credit)||0)>0)
                .map(([accountId,d]) => ({ accountId, previousBalance:parseFloat(d.previousBalance)||0, debit:parseFloat(d.debit)||0, credit:parseFloat(d.credit)||0 }));
            const res = await fetchWrapper.post(getApiBaseUrl()+'management-transactions/transactions/save', {
                transactionType:selectedAccountType.type_code, branchId, dateAdded:dateFilter, userId:currentUser._id, transactions:transactionsData,
            });
            if (res.success) {
                toast.success('Transactions submitted successfully');
                if (viewingBranchDetail && selectedBranchDetail) loadTransactions(selectedAccountType.type_code, selectedBranchDetail._id);
                else loadTransactions(selectedAccountType.type_code);
            } else toast.error(res.message||'Failed to submit transactions');
        } catch { toast.error('Failed to submit transactions'); }
        finally { setSubmitting(false); }
    };

    const filteredBranches = availableBranches.filter(b => {
        const s = branchSearchTerm.toLowerCase();
        return b.code.toLowerCase().includes(s) || b.name.toLowerCase().includes(s);
    });

    if (loadingAccounts || accountTypes.length === 0) {
        return <Layout><div className="flex justify-center items-center h-96"><Spinner /></div></Layout>;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Layout>
            <div className="flex flex-col h-full bg-white">
                {/* Header */}
                <div className="flex flex-col gap-3 p-6 border-b border-gray-200 relative z-30">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {showSummary ? 'Transaction Summary' : isBranchUser ? 'General Ledger Transaction' : 'General Ledger — Aggregated View'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {viewingBranchDetail ? `Branch: ${selectedBranchDetail?.code} — ${selectedBranchDetail?.name}` : ''}
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {viewingBranchDetail && (
                            <button onClick={handleBackToAggregated} className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">
                                <ChevronLeft size={16} /> Back to Aggregated View
                            </button>
                        )}

                        {isBranchUser && !showSummary && !selectedDisplayGroup && (
                            <button onClick={() => { handleViewSummary(); setSelectedDisplayGroup(null); setDisplayGroupData(null); }}
                                className="flex items-center gap-2 px-4 py-2 text-teal-600 bg-white border border-teal-600 rounded-md hover:bg-teal-50 text-sm font-medium">
                                <FileText size={16} /> View Summary
                            </button>
                        )}

                        {isBranchUser && !showSummary && (
                            <div className="relative" ref={displayGroupDropdownRef}>
                                <button onClick={() => setDisplayGroupDropdownOpen(!displayGroupDropdownOpen)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${selectedDisplayGroup ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                    {selectedDisplayGroup ? DISPLAY_GROUPS[selectedDisplayGroup] : 'Display Group'}
                                    <ChevronDown size={14} className={`transition-transform ${displayGroupDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {displayGroupDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-300 rounded-md shadow-lg z-50">
                                        <button onClick={() => handleDisplayGroupSelect(null)} className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${!selectedDisplayGroup ? 'bg-gray-100 font-medium' : 'text-gray-700'}`}>
                                            None (Show Account Type)
                                        </button>
                                        {Object.entries(DISPLAY_GROUPS).map(([code, label]) => (
                                            <button key={code} onClick={() => handleDisplayGroupSelect(code)}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${selectedDisplayGroup===code ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700'}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(showSummary || selectedDisplayGroup) && (
                            <button onClick={() => { setShowSummary(false); setSelectedDisplayGroup(null); setDisplayGroupData(null); }}
                                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium">
                                Back to Input
                            </button>
                        )}

                        {!showSummary && !selectedDisplayGroup && (
                            <div className="flex items-center gap-2" ref={accountTypeDropdownRef}>
                                <span className="text-sm font-medium text-gray-600">Account Type:</span>
                                <div className="relative">
                                    <button onClick={() => setAccountTypeDropdownOpen(!accountTypeDropdownOpen)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 min-w-[220px] text-sm">
                                        <span className="flex-1 text-left text-gray-700">{selectedAccountType?.type_name || 'Select Type'}</span>
                                        <ChevronDown size={14} className={`transition-transform ${accountTypeDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {accountTypeDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                                            {accountTypes.map(at => (
                                                <button key={at.type_code} onClick={() => { setSelectedAccountType(at); setAccountTypeDropdownOpen(false); setShowSummary(false); }}
                                                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${selectedAccountType?.type_code===at.type_code ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'}`}>
                                                    {at.type_name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Date:</span>
                            <DatePicker name="dateFilter" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setShowSummary(false); }} maxDate={currentDate} height="h-9" />
                        </div>

                        {baseViewMode === 'aggregated' && !viewingBranchDetail && availableBranches.length > 0 && !showSummary && (
                            <div className="flex items-center gap-2" ref={branchDropdownRef}>
                                <span className="text-sm font-medium text-gray-600">Branches:</span>
                                <div className="relative">
                                    <button onClick={() => { setTempSelectedBranches(selectedBranches); setBranchDropdownOpen(true); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm">
                                        <span className="text-gray-700">
                                            {selectedBranches.length === 0 ? 'No branches selected'
                                            : selectedBranches.length === availableBranches.length ? 'All Branches'
                                            : `${selectedBranches.length} of ${availableBranches.length} selected`}
                                        </span>
                                        <ChevronDown size={14} className={`transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {branchDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-300 rounded-md shadow-lg z-50">
                                            <div className="p-3 border-b border-gray-200 space-y-2">
                                                <input type="text" placeholder="Search branches…" value={branchSearchTerm} onChange={e => setBranchSearchTerm(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                                                <button onClick={() => setTempSelectedBranches(tempSelectedBranches.length===availableBranches.length?[]:[...availableBranches.map(b=>b._id)])}
                                                    className="w-full px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-md">
                                                    {tempSelectedBranches.length===availableBranches.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredBranches.map(branch => (
                                                    <label key={branch._id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                                                        <input type="checkbox" checked={tempSelectedBranches.includes(branch._id)} onChange={() => setTempSelectedBranches(prev => prev.includes(branch._id)?prev.filter(id=>id!==branch._id):[...prev,branch._id])}
                                                            className="rounded text-teal-600 focus:ring-teal-500" />
                                                        <span className="text-sm text-gray-700">{branch.code} — {branch.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="p-3 border-t border-gray-200 bg-gray-50">
                                                <button onClick={handleApplyBranchFilter}
                                                    className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium text-sm">
                                                    Apply Filter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex-grow" />

                        {isBranchUser && !showSummary && !selectedDisplayGroup && (
                            <ButtonSolid label={submitting ? 'Submitting…' : 'Submit All'} onClick={handleSubmitAll} disabled={submitting || !isEditable || loading} width="w-auto" />
                        )}
                    </div>
                </div>

                {/* Permission notice */}
                {isBranchUser && hasExistingTransactions && !canEdit && !showSummary && (
                    <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md relative z-20">
                        <p className="text-sm text-yellow-800">Transactions for this date have already been submitted. Only administrators can edit submitted transactions.</p>
                    </div>
                )}

                {/* Main content */}
                <div className="flex-grow overflow-auto relative z-10">
                    {loading || loadingSummary || loadingDisplayGroup ? (
                        <div className="flex justify-center items-center h-64"><Spinner /></div>
                    ) : selectedDisplayGroup && displayGroupData ? (
                        <DisplayGroupView selectedDisplayGroup={selectedDisplayGroup} displayGroupData={displayGroupData} dateFilter={dateFilter} />
                    ) : showSummary ? (
                        <SummaryView
                            summaryData={summaryData} allAccountsSummaryData={allAccountsSummaryData}
                            showAllAccounts={showAllAccounts} onToggleShowAll={() => setShowAllAccounts(p => !p)}
                            activeTab={summaryActiveTab} onTabChange={setSummaryActiveTab}
                        />
                    ) : viewMode === 'aggregated' ? (
                        <div className="p-6">
                            <AggregatedView aggregatedData={aggregatedData} selectedBranches={selectedBranches} onBranchClick={handleBranchClick} />
                        </div>
                    ) : (
                        <div className="p-6">
                            <BranchInputTable
                                accounts={currentAccounts}
                                newTransactions={newTransactions}
                                isEditable={isEditable}
                                onFieldChange={handleFieldChange}
                                calculateTotalBalance={calculateTotalBalance}
                                isPreviousBalanceDisabled={isPreviousBalanceDisabled}
                            />
                        </div>
                    )}
                </div>

                {/* Grand Total Footer */}
                <footer className="bg-white px-6 py-4 shadow-inner border-t-4 border-gray-200 relative z-20">
                    {showSummary ? (
                        <div className="flex justify-between items-center px-6">
                            <span className="font-bold text-gray-600">Grand Total:</span>
                            <span className="text-lg font-bold text-red-600">{formatPricePhp(grandTotals.totalBalance)}</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <tbody>
                                    <tr>
                                        <td className="px-6 py-2 text-left font-bold text-gray-600">Grand Total:</td>
                                        <td className="px-6 py-2 text-right w-44"><span className="text-base font-bold text-red-600">{formatPricePhp(grandTotals.previousBalance)}</span></td>
                                        <td className="px-6 py-2 text-right w-44"><span className="text-base font-bold text-red-600">{formatPricePhp(grandTotals.debit)}</span></td>
                                        <td className="px-6 py-2 text-right w-44"><span className="text-base font-bold text-red-600">{formatPricePhp(grandTotals.credit)}</span></td>
                                        <td className="px-6 py-2 text-right w-44"><span className="text-base font-bold text-red-600">{formatPricePhp(grandTotals.totalBalance)}</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </footer>
            </div>
        </Layout>
    );
};

export default ManagementTransactionsPage;