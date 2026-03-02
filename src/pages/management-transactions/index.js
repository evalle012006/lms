import React, { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import moment from 'moment';
import DatePicker from "@/lib/ui/DatePicker";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { formatPricePhp } from "@/lib/utils";
import { useRouter } from 'next/router';
import { ChevronLeft, ChevronDown, FileText } from 'lucide-react';

// Account Group Options - matching the ones in account types page
const ACCOUNT_GROUPS = {
    other_receipts: 'Other Receipts',
    management_expenses: 'Management Expenses',
    other_payments: 'Other Payments'
};

// Display Group Options
const DISPLAY_GROUPS = {
    assets: 'Assets',
    liabilities: 'Liabilities',
    management_expenses: 'Management Expenses'
};

// Tab order for summary view (excluding current account type which is always first)
const GROUP_TAB_ORDER = ['other_receipts', 'management_expenses', 'other_payments'];

const ManagementTransactionsPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const router = useRouter();

    // Check access permission - exclude loan_officer, cashier, finance
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

    const [loading, setLoading] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Account Types from API
    const [accountTypes, setAccountTypes] = useState([]);
    const [selectedAccountType, setSelectedAccountType] = useState(null);
    const [accountTypeDropdownOpen, setAccountTypeDropdownOpen] = useState(false);
    const accountTypeDropdownRef = useRef(null);
    
    // Branches for filter (extracted from aggregated data)
    const [availableBranches, setAvailableBranches] = useState([]);
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [tempSelectedBranches, setTempSelectedBranches] = useState([]);
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const branchDropdownRef = useRef(null);
    
    // Drill-down state
    const [viewingBranchDetail, setViewingBranchDetail] = useState(false);
    const [selectedBranchDetail, setSelectedBranchDetail] = useState(null);

    // Single date filter
    const [dateFilter, setDateFilter] = useState(null);

    // Accounts - single state object for all types
    const [accounts, setAccounts] = useState({});

    // Transactions with new structure
    const [transactions, setTransactions] = useState([]);
    const [newTransactions, setNewTransactions] = useState({});
    
    // Previous balances from last transaction
    const [previousBalances, setPreviousBalances] = useState({});
    
    // Grand totals
    const [grandTotals, setGrandTotals] = useState({
        previousBalance: 0,
        debit: 0,
        credit: 0,
        totalBalance: 0
    });

    // Aggregated data for upper management
    const [aggregatedData, setAggregatedData] = useState([]);

    // Summary view state
    const [showSummary, setShowSummary] = useState(false);
    const [summaryActiveTab, setSummaryActiveTab] = useState('current');
    const [summaryData, setSummaryData] = useState({});
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [showAllAccounts, setShowAllAccounts] = useState(false);
    const [allAccountsSummaryData, setAllAccountsSummaryData] = useState({});

    // Display Group view state
    const [selectedDisplayGroup, setSelectedDisplayGroup] = useState(null);
    const [displayGroupDropdownOpen, setDisplayGroupDropdownOpen] = useState(false);
    const [displayGroupData, setDisplayGroupData] = useState(null);
    const [loadingDisplayGroup, setLoadingDisplayGroup] = useState(false);
    const displayGroupDropdownRef = useRef(null);

    // Check if user can edit (role.rep = 1 or branch manager role.rep = 3)
    const canEdit = currentUser?.role?.rep === 1 || 
                    (currentUser?.role?.rep === 3 && currentDate === dateFilter);

    // Determine view mode: 'branch' for role.rep = 3, 'aggregated' for role.rep <= 2
    const baseViewMode = currentUser?.role?.rep === 3 ? 'branch' : 'aggregated';
    
    // Override view mode when drilling down into branch detail
    const viewMode = viewingBranchDetail ? 'branch' : baseViewMode;

    // Get page title based on view mode
    const getPageTitle = () => {
        if (showSummary) {
            return 'Transaction Summary';
        }
        if (viewMode === 'branch') {
            return 'General Ledger Transaction';
        }
        return 'General Ledger - Aggregated View';
    };

    const getPageSubtitle = () => {
        if (showSummary) {
            return 'View summary of non-zero transactions grouped by category';
        }
        if (viewMode === 'branch') {
            if (viewingBranchDetail) {
                return `Branch: ${selectedBranchDetail?.code} - ${selectedBranchDetail?.name}`;
            }
            return 'Record and track financial transactions by account';
        }
        return 'View aggregated transactions across all branches';
    };

    // Build summary tabs based on summaryData that has transactions (or all accounts if showAllAccounts is true)
    const getSummaryTabs = () => {
        const tabs = [];
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;

        // Add tabs for each group that has data
        GROUP_TAB_ORDER.forEach(groupCode => {
            const groupData = dataSource[groupCode];
            // Only show tab if there are account types in this group
            if (groupData && groupData.accountTypes && groupData.accountTypes.length > 0) {
                tabs.push({
                    key: groupCode,
                    label: ACCOUNT_GROUPS[groupCode],
                    group: groupCode
                });
            }
        });

        return tabs;
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setBranchDropdownOpen(false);
                setTempSelectedBranches(selectedBranches);
                setBranchSearchTerm('');
            }
            if (accountTypeDropdownRef.current && !accountTypeDropdownRef.current.contains(event.target)) {
                setAccountTypeDropdownOpen(false);
            }
            if (displayGroupDropdownRef.current && !displayGroupDropdownRef.current.contains(event.target)) {
                setDisplayGroupDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedBranches]);

    // Initialize from router query
    useEffect(() => {
        if (router.query.branchId) {
            const branch = availableBranches.find(b => b._id === router.query.branchId);
            if (branch) {
                setSelectedBranchDetail(branch);
                setViewingBranchDetail(true);
            }
        } else {
            setViewingBranchDetail(false);
            setSelectedBranchDetail(null);
        }
    }, [router.query.branchId, availableBranches]);

    // Initialize date when currentDate is available
    useEffect(() => {
        if (currentDate) {
            setDateFilter(currentDate);
        }
    }, [currentDate]);

    // Load account types on mount
    useEffect(() => {
        loadAccountTypes();
    }, []);

    // Set initial account type when loaded
    useEffect(() => {
        if (accountTypes.length > 0 && !selectedAccountType) {
            setSelectedAccountType(accountTypes[0]);
        }
    }, [accountTypes]);

    // Load accounts for selected account type (branch view only)
    useEffect(() => {
        if (selectedAccountType && viewMode === 'branch') {
            loadAccounts(selectedAccountType.type_code);
        }
    }, [selectedAccountType, viewMode]);

    // Load data when filters change
    useEffect(() => {
        if (selectedAccountType && dateFilter) {
            if (viewMode === 'branch') {
                if (viewingBranchDetail && selectedBranchDetail) {
                    loadTransactions(selectedAccountType.type_code, selectedBranchDetail._id);
                } else if (currentUser.role.rep === 3) {
                    loadTransactions(selectedAccountType.type_code);
                }
            } else {
                loadAggregatedData(selectedAccountType.type_code, null);
            }
        }
    }, [selectedAccountType, dateFilter, viewMode, viewingBranchDetail, selectedBranchDetail]);

    // Load summary data when entering summary view
    useEffect(() => {
        if (showSummary && dateFilter) {
            loadAllSummaryData();
        }
    }, [showSummary, dateFilter]);

    const loadAccountTypes = async () => {
        setLoadingAccounts(true);
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-types/list';
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                // Account types are already ordered by display_order from API
                setAccountTypes(response.accountTypes);
            }
        } catch (error) {
            console.error('Error loading account types:', error);
            toast.error('Failed to load account types');
        } finally {
            setLoadingAccounts(false);
        }
    };

    const loadAccounts = async (accountType) => {
        try {
            const apiUrl = getApiBaseUrl() + `management-transactions/account-names/list?accountType=${accountType}`;
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                // Account names are already ordered by display_order from API
                setAccounts(prev => ({
                    ...prev,
                    [accountType]: response.accounts
                }));
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
            toast.error('Failed to load accounts');
        }
    };

    const loadPreviousBalances = async (transactionType, branchId) => {
        try {
            // Get the date before the current filter date to fetch previous balances
            const previousDate = moment(dateFilter).subtract(1, 'day').format('YYYY-MM-DD');
            
            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/previous-balances?transactionType=${transactionType}` +
                `&branchId=${branchId}` +
                `&date=${previousDate}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success && response.previousBalances) {
                setPreviousBalances(response.previousBalances);
                return response.previousBalances;
            }
            return {};
        } catch (error) {
            console.error('Error loading previous balances:', error);
            return {};
        }
    };

    const loadTransactions = async (transactionType, branchId = null) => {
        if (!dateFilter) {
            console.log('Date not initialized yet');
            return;
        }

        setLoading(true);
        try {
            let effectiveBranchId = branchId;
            if (!effectiveBranchId && currentUser.role.rep === 3) {
                effectiveBranchId = currentUser.designatedBranchId;
            }

            // Load previous balances first
            const prevBalances = await loadPreviousBalances(transactionType, effectiveBranchId);

            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/list?transactionType=${transactionType}` +
                `&branchId=${effectiveBranchId || ''}` +
                `&dateFrom=${dateFilter}&dateTo=${dateFilter}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setTransactions(response.transactions);
                
                // Pre-populate the input fields
                const existingData = {};
                response.transactions.forEach(transaction => {
                    existingData[transaction.account_id] = {
                        previousBalance: transaction.previous_balance || 0,
                        debit: transaction.debit || 0,
                        credit: transaction.credit || 0
                    };
                });
                
                // If no existing transactions for today, use previous balances
                if (response.transactions.length === 0) {
                    Object.keys(prevBalances).forEach(accountId => {
                        existingData[accountId] = {
                            previousBalance: prevBalances[accountId] || 0,
                            debit: 0,
                            credit: 0
                        };
                    });
                }
                
                setNewTransactions(existingData);
                
                // Calculate grand totals
                calculateGrandTotals(response.transactions.length > 0 ? response.transactions : null);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const loadAggregatedData = async (transactionType, branchIdsToFilter = null) => {
        if (!dateFilter) {
            console.log('Date not initialized yet');
            return;
        }

        setLoading(true);
        try {
            const branchesToUse = branchIdsToFilter !== null ? branchIdsToFilter : selectedBranches;
            const branchIdsParam = branchesToUse.length > 0 
                ? `&branchIds=${branchesToUse.join(',')}` 
                : '';

            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/aggregated?transactionType=${transactionType}` +
                `&date=${dateFilter}${branchIdsParam}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setAggregatedData(response.aggregatedData || []);
                
                // Set grand totals from aggregated data
                setGrandTotals(response.grandTotals || {
                    previousBalance: 0,
                    debit: 0,
                    credit: 0,
                    totalBalance: 0
                });
                
                if (response.availableBranches) {
                    setAvailableBranches(response.availableBranches);
                    
                    if (selectedBranches.length === 0 && tempSelectedBranches.length === 0) {
                        const allBranchIds = response.availableBranches.map(b => b._id);
                        setSelectedBranches(allBranchIds);
                        setTempSelectedBranches(allBranchIds);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading aggregated data:', error);
            toast.error('Failed to load aggregated data');
        } finally {
            setLoading(false);
        }
    };

    // Load all summary data for all account types grouped by category
    const loadAllSummaryData = async () => {
        if (!dateFilter) return;

        setLoadingSummary(true);
        try {
            let branchId;
            if (currentUser.role.rep === 3) {
                branchId = currentUser.designatedBranchId;
            } else if (viewingBranchDetail && selectedBranchDetail) {
                branchId = selectedBranchDetail._id;
            }

            if (!branchId) {
                setLoadingSummary(false);
                return;
            }

            // Fetch both summary data (with transactions only) and all accounts data
            const [summaryResponse, allAccountsResponse] = await Promise.all([
                fetchWrapper.get(getApiBaseUrl() + 
                    `management-transactions/transactions/summary?branchId=${branchId}&date=${dateFilter}`),
                fetchWrapper.get(getApiBaseUrl() + 
                    `management-transactions/transactions/summary-all?branchId=${branchId}&date=${dateFilter}`)
            ]);
            
            if (summaryResponse.success) {
                setSummaryData(summaryResponse.summaryData || {});
                
                // Calculate grand totals from summary
                if (summaryResponse.grandTotals) {
                    setGrandTotals(summaryResponse.grandTotals);
                }
            }

            if (allAccountsResponse.success) {
                setAllAccountsSummaryData(allAccountsResponse.summaryData || {});
            }
        } catch (error) {
            console.error('Error loading summary data:', error);
            toast.error('Failed to load summary data');
        } finally {
            setLoadingSummary(false);
        }
    };

    // Load display group data (Assets, Liabilities, Management Expenses)
    const loadDisplayGroupData = async (displayGroup) => {
        if (!dateFilter || !displayGroup) return;

        setLoadingDisplayGroup(true);
        try {
            let branchId;
            if (currentUser.role.rep === 3) {
                branchId = currentUser.designatedBranchId;
            } else if (viewingBranchDetail && selectedBranchDetail) {
                branchId = selectedBranchDetail._id;
            }

            if (!branchId) {
                setLoadingDisplayGroup(false);
                return;
            }

            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/display-group?branchId=${branchId}&date=${dateFilter}&displayGroup=${displayGroup}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setDisplayGroupData(response.data || null);
                
                // Update grand totals from display group data
                if (response.grandTotals) {
                    setGrandTotals(response.grandTotals);
                }
            }
        } catch (error) {
            console.error('Error loading display group data:', error);
            toast.error('Failed to load display group data');
        } finally {
            setLoadingDisplayGroup(false);
        }
    };

    // Handle display group selection
    const handleDisplayGroupSelect = (groupCode) => {
        setSelectedDisplayGroup(groupCode);
        setDisplayGroupDropdownOpen(false);
        setShowSummary(false);
        
        if (groupCode) {
            loadDisplayGroupData(groupCode);
        } else {
            setDisplayGroupData(null);
        }
    };

    // Clear display group when switching views
    const clearDisplayGroup = () => {
        setSelectedDisplayGroup(null);
        setDisplayGroupData(null);
    };

    const calculateGrandTotals = (transactionsData = null) => {
        const dataToUse = transactionsData || Object.entries(newTransactions).map(([accountId, data]) => ({
            account_id: accountId,
            previous_balance: parseFloat(data.previousBalance) || 0,
            debit: parseFloat(data.debit) || 0,
            credit: parseFloat(data.credit) || 0
        }));

        const totals = dataToUse.reduce((acc, transaction) => {
            const prevBalance = parseFloat(transaction.previous_balance) || 0;
            const debit = parseFloat(transaction.debit) || 0;
            const credit = parseFloat(transaction.credit) || 0;
            
            acc.previousBalance += prevBalance;
            acc.debit += debit;
            acc.credit += credit;
            acc.totalBalance += (prevBalance + debit - credit);
            
            return acc;
        }, {
            previousBalance: 0,
            debit: 0,
            credit: 0,
            totalBalance: 0
        });

        setGrandTotals(totals);
    };

    const handleFieldChange = (accountId, field, value) => {
        // Allow empty string or valid numbers
        let cleanedValue = value;
        
        // If it's empty, keep it empty
        if (value === '') {
            cleanedValue = '';
        } else {
            // Remove non-numeric characters except decimal point and minus
            cleanedValue = value.replace(/[^0-9.-]/g, '');
        }
        
        setNewTransactions(prev => {
            const updated = {
                ...prev,
                [accountId]: {
                    ...(prev[accountId] || {}),
                    [field]: cleanedValue
                }
            };
            
            // Recalculate grand totals with updated data
            setTimeout(() => calculateGrandTotals(), 0);
            
            return updated;
        });
    };

    const calculateTotalBalance = (accountId) => {
        const data = newTransactions[accountId];
        if (!data) return 0;
        
        const prevBalance = parseFloat(data.previousBalance) || 0;
        const debit = parseFloat(data.debit) || 0;
        const credit = parseFloat(data.credit) || 0;
        
        return prevBalance + debit - credit;
    };

    const handleTempBranchToggle = (branchId) => {
        setTempSelectedBranches(prev => {
            if (prev.includes(branchId)) {
                return prev.filter(id => id !== branchId);
            } else {
                return [...prev, branchId];
            }
        });
    };

    const handleTempSelectAllBranches = () => {
        if (tempSelectedBranches.length === availableBranches.length) {
            setTempSelectedBranches([]);
        } else {
            setTempSelectedBranches(availableBranches.map(b => b._id));
        }
    };

    const handleApplyBranchFilter = () => {
        setSelectedBranches(tempSelectedBranches);
        setBranchDropdownOpen(false);
        setBranchSearchTerm('');
        
        if (selectedAccountType && dateFilter) {
            loadAggregatedData(selectedAccountType.type_code, tempSelectedBranches);
        }
    };

    const handleOpenDropdown = () => {
        setTempSelectedBranches(selectedBranches);
        setBranchDropdownOpen(true);
    };

    const handleBranchClick = (branch) => {
        router.push({
            pathname: router.pathname,
            query: {
                date: dateFilter,
                branchId: branch.branchId
            }
        }, undefined, { shallow: true });
    };

    const handleBackToAggregated = () => {
        router.push({
            pathname: router.pathname,
            query: {
                date: dateFilter
            }
        }, undefined, { shallow: true });
        
        setNewTransactions({});
        setShowSummary(false);
    };

    const handleViewSummary = () => {
        setShowSummary(true);
        // Set the first available tab based on data source (using summaryData by default since showAllAccounts starts as false)
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;
        const firstAvailableTab = GROUP_TAB_ORDER.find(groupCode => {
            const groupData = dataSource[groupCode];
            return groupData && groupData.accountTypes && groupData.accountTypes.length > 0;
        });
        setSummaryActiveTab(firstAvailableTab || GROUP_TAB_ORDER[0]);
    };

    const handleSubmitAll = async () => {
        // Validate that at least one transaction has data
        const hasData = Object.values(newTransactions).some(data => {
            const prevBalance = parseFloat(data.previousBalance) || 0;
            const debit = parseFloat(data.debit) || 0;
            const credit = parseFloat(data.credit) || 0;
            return prevBalance > 0 || debit > 0 || credit > 0;
        });
        
        if (!hasData) {
            toast.error('Please enter at least one transaction before submitting');
            return;
        }

        let branchId;
        if (currentUser.role.rep === 3) {
            branchId = currentUser.designatedBranchId;
        } else if (viewingBranchDetail && selectedBranchDetail) {
            branchId = selectedBranchDetail._id;
        } else {
            toast.error('Invalid user role for submission');
            return;
        }

        if (!branchId) {
            toast.error('Branch information not found');
            return;
        }

        setSubmitting(true);

        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/transactions/save';
            
            const transactionsData = Object.entries(newTransactions)
                .filter(([_, data]) => {
                    const prevBalance = parseFloat(data.previousBalance) || 0;
                    const debit = parseFloat(data.debit) || 0;
                    const credit = parseFloat(data.credit) || 0;
                    return prevBalance > 0 || debit > 0 || credit > 0;
                })
                .map(([accountId, data]) => ({
                    accountId: accountId,
                    previousBalance: parseFloat(data.previousBalance) || 0,
                    debit: parseFloat(data.debit) || 0,
                    credit: parseFloat(data.credit) || 0
                }));

            const response = await fetchWrapper.post(apiUrl, {
                transactionType: selectedAccountType.type_code,
                branchId: branchId,
                dateAdded: dateFilter,
                userId: currentUser._id,
                transactions: transactionsData
            });

            if (response.success) {
                toast.success('Transactions submitted successfully');
                if (viewingBranchDetail && selectedBranchDetail) {
                    loadTransactions(selectedAccountType.type_code, selectedBranchDetail._id);
                } else {
                    loadTransactions(selectedAccountType.type_code);
                }
            } else {
                toast.error(response.message || 'Failed to submit transactions');
            }
        } catch (error) {
            console.error('Error submitting transactions:', error);
            toast.error('Failed to submit transactions');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredBranches = availableBranches.filter(branch => {
        const searchLower = branchSearchTerm.toLowerCase();
        return branch.code.toLowerCase().includes(searchLower) || 
               branch.name.toLowerCase().includes(searchLower);
    });

    const currentAccounts = selectedAccountType ? (accounts[selectedAccountType.type_code] || []) : [];
    const hasExistingTransactions = transactions.length > 0;
    const isEditable = !hasExistingTransactions || canEdit;

    // Filter accounts for summary view - only show accounts with values > 0
    const summaryAccounts = currentAccounts.filter(account => {
        const data = newTransactions[account._id];
        if (!data) return false;
        
        const prevBalance = parseFloat(data.previousBalance) || 0;
        const debit = parseFloat(data.debit) || 0;
        const credit = parseFloat(data.credit) || 0;
        const total = calculateTotalBalance(account._id);
        
        return prevBalance > 0 || debit > 0 || credit > 0 || total > 0;
    });

    // Check if previous balance should be disabled
    // Only disable if the transaction already exists in the database (has been saved)
    const isPreviousBalanceDisabled = (accountId) => {
        if (!isEditable) return true;
        
        // Check if this account has an existing transaction from the database
        const existingTransaction = transactions.find(t => t.account_id === accountId);
        if (existingTransaction && existingTransaction.previous_balance > 0) {
            return true;
        }
        
        // Check if this account has a previous balance from a prior date
        if (previousBalances[accountId] && previousBalances[accountId] > 0) {
            return true;
        }
        
        return false;
    };

    // Get data for a specific summary tab
    const getSummaryTabData = (tabKey) => {
        // Return data for grouped account types based on showAllAccounts setting
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;
        return dataSource[tabKey] || { accountTypes: [], totals: {} };
    };

    // Calculate totals for current tab
    const calculateTabTotals = (tabKey) => {
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;
        const groupData = dataSource[tabKey];
        if (!groupData || !groupData.totals) {
            return { previousBalance: 0, debit: 0, credit: 0, totalBalance: 0 };
        }
        return groupData.totals;
    };

    // Render summary table for a specific tab (group)
    const renderSummaryTable = (tabKey) => {
        // Render grouped account types based on showAllAccounts setting
        const dataSource = showAllAccounts ? allAccountsSummaryData : summaryData;
        const groupData = dataSource[tabKey];
        const tabTotals = calculateTabTotals(tabKey);

        if (!groupData || !groupData.accountTypes || groupData.accountTypes.length === 0) {
            return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                    {showAllAccounts 
                        ? `No accounts found for ${ACCOUNT_GROUPS[tabKey]}.`
                        : `No transactions found for ${ACCOUNT_GROUPS[tabKey]}.`
                    }
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {groupData.accountTypes.map((typeData) => (
                    <div key={typeData.type_code} className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-semibold text-gray-800">
                                {typeData.type_name}
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Account Name
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {typeData.accounts.map((account) => (
                                        <tr key={account._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {account.account_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                {formatPricePhp(account.total_balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr>
                                        <td className="px-6 py-3 text-left text-sm font-bold text-gray-700">
                                            Subtotal - {typeData.type_name}
                                        </td>
                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                                            {formatPricePhp(typeData.totals.totalBalance)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}

                {/* Group Total */}
                <div className="bg-teal-50 rounded-lg border border-teal-200 p-4">
                    <div className="flex justify-between items-center px-6">
                        <span className="font-bold text-teal-800">
                            {ACCOUNT_GROUPS[tabKey]} Total:
                        </span>
                        <span className="font-bold text-teal-800 text-lg">
                            {formatPricePhp(tabTotals.totalBalance)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    if (loadingAccounts) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-96">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    if (accountTypes.length === 0) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-96">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    const summaryTabs = getSummaryTabs();

    return (
        <Layout>
            <div className="flex flex-col h-full bg-white">
                {/* Header */}
                <div className="flex flex-col gap-4 p-6 border-b border-gray-200 relative z-30">
                    <div className="flex flex-row justify-between items-start">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold text-gray-800">{getPageTitle()}</h1>
                            <p className="text-sm text-gray-500 mt-1">{getPageSubtitle()}</p>
                        </div>
                    </div>
                    
                    {/* Filters Row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Back Button */}
                        {viewingBranchDetail && (
                            <button
                                onClick={handleBackToAggregated}
                                className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                <ChevronLeft size={18} />
                                <span className="text-sm font-medium">Back to Aggregated View</span>
                            </button>
                        )}

                        {/* Summary Toggle Button */}
                        {viewMode === 'branch' && !showSummary && !selectedDisplayGroup && (currentUser.role.rep === 3 || viewingBranchDetail) && (
                            <button
                                onClick={() => {
                                    handleViewSummary();
                                    clearDisplayGroup();
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-teal-600 bg-white border border-teal-600 rounded-md hover:bg-teal-50 transition-colors"
                            >
                                <FileText size={18} />
                                <span className="text-sm font-medium">View Summary</span>
                            </button>
                        )}

                        {/* Display Group Dropdown */}
                        {viewMode === 'branch' && !showSummary && (currentUser.role.rep === 3 || viewingBranchDetail) && (
                            <div className="relative" ref={displayGroupDropdownRef}>
                                <button
                                    onClick={() => setDisplayGroupDropdownOpen(!displayGroupDropdownOpen)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                                        selectedDisplayGroup 
                                            ? 'bg-purple-600 text-white hover:bg-purple-700' 
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-sm font-medium">
                                        {selectedDisplayGroup ? DISPLAY_GROUPS[selectedDisplayGroup] : 'Display Group'}
                                    </span>
                                    <ChevronDown 
                                        size={16} 
                                        className={`transition-transform ${displayGroupDropdownOpen ? 'rotate-180' : ''}`} 
                                    />
                                </button>

                                {displayGroupDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden z-50">
                                        <button
                                            onClick={() => handleDisplayGroupSelect(null)}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                                                !selectedDisplayGroup ? 'bg-gray-100 font-medium' : 'text-gray-700'
                                            }`}
                                        >
                                            None (Show Account Type)
                                        </button>
                                        {Object.entries(DISPLAY_GROUPS).map(([code, label]) => (
                                            <button
                                                key={code}
                                                onClick={() => handleDisplayGroupSelect(code)}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                                                    selectedDisplayGroup === code
                                                        ? 'bg-purple-50 text-purple-700 font-medium'
                                                        : 'text-gray-700'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(showSummary || selectedDisplayGroup) && (
                            <button
                                onClick={() => {
                                    setShowSummary(false);
                                    clearDisplayGroup();
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <span className="text-sm font-medium">Back to Input</span>
                            </button>
                        )}

                        {/* Account Type Dropdown - Hide in summary view and display group view */}
                        {!showSummary && !selectedDisplayGroup && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Account Type:</span>
                                <div className="relative" ref={accountTypeDropdownRef}>
                                    <button
                                        onClick={() => setAccountTypeDropdownOpen(!accountTypeDropdownOpen)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
                                    >
                                        <span className="text-sm font-medium text-gray-700 flex-1 text-left">
                                            {selectedAccountType?.type_name || 'Select Type'}
                                        </span>
                                        <ChevronDown 
                                            size={16} 
                                            className={`transition-transform ${accountTypeDropdownOpen ? 'rotate-180' : ''}`} 
                                        />
                                    </button>

                                    {accountTypeDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden z-50">
                                            <div className="max-h-60 overflow-y-auto">
                                                {accountTypes.map(accountType => (
                                                    <button
                                                        key={accountType.type_code}
                                                        onClick={() => {
                                                            setSelectedAccountType(accountType);
                                                            setAccountTypeDropdownOpen(false);
                                                            setShowSummary(false);
                                                        }}
                                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                                                            selectedAccountType?.type_code === accountType.type_code
                                                                ? 'bg-teal-50 text-teal-700 font-medium'
                                                                : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span>{accountType.type_name}</span>
                                                            {accountType.account_group && (
                                                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                                                                    {ACCOUNT_GROUPS[accountType.account_group]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Date:</span>
                            <DatePicker
                                name="dateFilter"
                                value={dateFilter}
                                onChange={(e) => {
                                    setDateFilter(e.target.value);
                                    setShowSummary(false);
                                }}
                                maxDate={currentDate}
                                height="h-9"
                            />
                        </div>

                        {/* Branch Filter Dropdown */}
                        {baseViewMode === 'aggregated' && !viewingBranchDetail && availableBranches.length > 0 && !showSummary && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Branches:</span>
                                
                                <div className="relative" ref={branchDropdownRef}>
                                    <button
                                        onClick={handleOpenDropdown}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <span className="text-sm font-medium text-gray-700">
                                            {selectedBranches.length === 0
                                                ? 'No branches selected'
                                                : selectedBranches.length === availableBranches.length 
                                                    ? 'All Branches' 
                                                    : `${selectedBranches.length} of ${availableBranches.length} selected`}
                                        </span>
                                        <ChevronDown 
                                            size={16} 
                                            className={`transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} 
                                        />
                                    </button>

                                    {branchDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden z-50">
                                            <div className="p-3 border-b border-gray-200 space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Search branches..."
                                                    value={branchSearchTerm}
                                                    onChange={(e) => setBranchSearchTerm(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                                />
                                                <button
                                                    onClick={handleTempSelectAllBranches}
                                                    className="w-full px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-md"
                                                >
                                                    {tempSelectedBranches.length === availableBranches.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>

                                            <div className="max-h-80 overflow-y-auto">
                                                {filteredBranches.length === 0 ? (
                                                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                                        No branches found
                                                    </div>
                                                ) : (
                                                    filteredBranches.map(branch => (
                                                        <label
                                                            key={branch._id}
                                                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={tempSelectedBranches.includes(branch._id)}
                                                                onChange={() => handleTempBranchToggle(branch._id)}
                                                                className="rounded text-teal-600 focus:ring-teal-500"
                                                            />
                                                            <span className="text-sm text-gray-700">
                                                                {branch.code} - {branch.name}
                                                            </span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>

                                            <div className="p-3 border-t border-gray-200 bg-gray-50">
                                                <button
                                                    onClick={handleApplyBranchFilter}
                                                    className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-sm"
                                                >
                                                    Apply Filter
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Spacer to push Submit All to the right */}
                        <div className="flex-grow"></div>

                        {/* Submit All Button - Always on the right */}
                        {viewMode === 'branch' && !showSummary && !selectedDisplayGroup && (currentUser.role.rep === 3 || viewingBranchDetail) && (
                            <ButtonSolid
                                label={submitting ? 'Submitting...' : 'Submit All'}
                                onClick={handleSubmitAll}
                                disabled={submitting || !isEditable || loading}
                                width="w-auto"
                            />
                        )}
                    </div>
                </div>

                {/* Permission notice */}
                {viewMode === 'branch' && hasExistingTransactions && !canEdit && !showSummary && (
                    <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md relative z-20">
                        <p className="text-sm text-yellow-800">
                            Transactions for this date have already been submitted. Only administrators can edit submitted transactions.
                        </p>
                    </div>
                )}

                {/* Summary Tabs */}
                {showSummary && (
                    <div className="px-6 pt-4 border-b border-gray-200">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex gap-1 overflow-x-auto">
                                {summaryTabs.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setSummaryActiveTab(tab.key)}
                                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                                            summaryActiveTab === tab.key
                                                ? 'bg-teal-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <label className="text-sm text-gray-600 whitespace-nowrap">
                                    Show All Accounts
                                </label>
                                <button
                                    onClick={() => setShowAllAccounts(!showAllAccounts)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        showAllAccounts ? 'bg-teal-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            showAllAccounts ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-grow overflow-auto p-6 relative z-10">
                    {loading || loadingSummary || loadingDisplayGroup ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner />
                        </div>
                    ) : selectedDisplayGroup && displayGroupData ? (
                        // Display Group View
                        <div className="space-y-6">
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                                <h2 className="text-lg font-semibold text-purple-800">
                                    {DISPLAY_GROUPS[selectedDisplayGroup]} - Transaction Summary
                                </h2>
                                <p className="text-sm text-purple-600 mt-1">
                                    Showing all account names with transactions for {moment(dateFilter).format('MMMM D, YYYY')}
                                </p>
                            </div>
                            
                            {displayGroupData.accountTypes && displayGroupData.accountTypes.length > 0 ? (
                                displayGroupData.accountTypes.map((typeData) => (
                                    <div key={typeData.type_code} className="bg-white rounded-lg shadow-sm border border-gray-200">
                                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                                            <h3 className="text-lg font-semibold text-gray-800">
                                                {typeData.type_name}
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Account Name
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                            Previous Balance
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                            Debit
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                            Credit
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                            Total Balance
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {typeData.accounts.map((account) => (
                                                        <tr key={account._id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {account.account_name}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(account.previous_balance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(account.debit)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(account.credit)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium bg-gray-50">
                                                                {formatPricePhp(account.total_balance)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-100">
                                                    <tr>
                                                        <td className="px-6 py-3 text-left text-sm font-bold text-gray-700">
                                                            Subtotal - {typeData.type_name}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                                                            {formatPricePhp(typeData.totals.previousBalance)}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                                                            {formatPricePhp(typeData.totals.debit)}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700">
                                                            {formatPricePhp(typeData.totals.credit)}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-200">
                                                            {formatPricePhp(typeData.totals.totalBalance)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                                    No transactions found for {DISPLAY_GROUPS[selectedDisplayGroup]} on this date.
                                </div>
                            )}

                            {/* Display Group Total */}
                            {displayGroupData.totals && (
                                <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full">
                                            <tbody>
                                                <tr>
                                                    <td className="px-6 py-2 text-left font-bold text-purple-800">
                                                        {DISPLAY_GROUPS[selectedDisplayGroup]} Total:
                                                    </td>
                                                    <td className="px-6 py-2 text-right w-48 font-bold text-purple-800">
                                                        {formatPricePhp(displayGroupData.totals.previousBalance)}
                                                    </td>
                                                    <td className="px-6 py-2 text-right w-48 font-bold text-purple-800">
                                                        {formatPricePhp(displayGroupData.totals.debit)}
                                                    </td>
                                                    <td className="px-6 py-2 text-right w-48 font-bold text-purple-800">
                                                        {formatPricePhp(displayGroupData.totals.credit)}
                                                    </td>
                                                    <td className="px-6 py-2 text-right w-48 font-bold text-purple-800">
                                                        {formatPricePhp(displayGroupData.totals.totalBalance)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : showSummary ? (
                        // Summary View with Tabs
                        renderSummaryTable(summaryActiveTab)
                    ) : viewMode === 'aggregated' ? (
                        // Aggregated View
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Branch
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Previous Balance
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Debit
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Credit
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Total Balance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {aggregatedData.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                    {selectedBranches.length === 0 
                                                        ? 'Please select at least one branch to view transactions.'
                                                        : 'No transactions found for selected branches and date.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            aggregatedData.map((item, index) => (
                                                <tr 
                                                    key={index} 
                                                    onClick={() => handleBranchClick(item)}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {item.branchDisplay}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                        {formatPricePhp(item.previousBalance)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                        {formatPricePhp(item.debit)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                        {formatPricePhp(item.credit)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                        {formatPricePhp(item.totalBalance)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // Branch Input View
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Account Name
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                Previous Balance
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                Debit
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                Credit
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                                                Total Balance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {currentAccounts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                    No accounts available for {selectedAccountType?.type_name}. Please add accounts in Settings.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentAccounts.map((account) => {
                                                const totalBalance = calculateTotalBalance(account._id);
                                                const isPrevBalDisabled = isPreviousBalanceDisabled(account._id);
                                                
                                                return (
                                                    <tr key={account._id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {account.account_name}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTransactions[account._id]?.previousBalance || ''}
                                                                onChange={(e) => handleFieldChange(account._id, 'previousBalance', e.target.value)}
                                                                onWheel={(e) => e.target.blur()}
                                                                placeholder="0.00"
                                                                disabled={isPrevBalDisabled}
                                                                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-right ${
                                                                    isPrevBalDisabled ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTransactions[account._id]?.debit || ''}
                                                                onChange={(e) => handleFieldChange(account._id, 'debit', e.target.value)}
                                                                onWheel={(e) => e.target.blur()}
                                                                placeholder="0.00"
                                                                disabled={!isEditable}
                                                                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-right ${
                                                                    !isEditable ? 'bg-gray-100 cursor-not-allowed' : ''
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={newTransactions[account._id]?.credit || ''}
                                                                onChange={(e) => handleFieldChange(account._id, 'credit', e.target.value)}
                                                                onWheel={(e) => e.target.blur()}
                                                                placeholder="0.00"
                                                                disabled={!isEditable}
                                                                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-right ${
                                                                    !isEditable ? 'bg-gray-100 cursor-not-allowed' : ''
                                                                }`}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium bg-gray-50">
                                                            {formatPricePhp(totalBalance)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grand Total Footer */}
                <footer className="bg-white px-6 py-4 shadow-inner border-t-4 border-gray-200 relative z-20">
                    {showSummary ? (
                        // Summary view - only show total
                        <div className="flex justify-between items-center px-6">
                            <span className="font-bold text-gray-600">
                                Grand Total:
                            </span>
                            <span className="text-lg font-bold text-red-600">
                                {formatPricePhp(grandTotals.totalBalance)}
                            </span>
                        </div>
                    ) : (
                        // Input view - show all columns
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <tbody>
                                    <tr>
                                        <td className="px-6 py-2 text-left font-bold text-gray-600">
                                            Grand Total:
                                        </td>
                                        <td className="px-6 py-2 text-right w-48">
                                            <span className="text-base font-bold text-red-600">
                                                {formatPricePhp(grandTotals.previousBalance)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2 text-right w-48">
                                            <span className="text-base font-bold text-red-600">
                                                {formatPricePhp(grandTotals.debit)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2 text-right w-48">
                                            <span className="text-base font-bold text-red-600">
                                                {formatPricePhp(grandTotals.credit)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-2 text-right w-48">
                                            <span className="text-base font-bold text-red-600">
                                                {formatPricePhp(grandTotals.totalBalance)}
                                            </span>
                                        </td>
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