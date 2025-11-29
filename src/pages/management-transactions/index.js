import React, { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { getApiBaseUrl } from "@/lib/constants";
import moment from 'moment';
import DatePicker from "@/lib/ui/DatePicker";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { formatPricePhp } from "@/lib/utils";
import { useRouter } from 'next/router';
import { ChevronLeft } from 'lucide-react';

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
    
    // Branches for filter (extracted from aggregated data)
    const [availableBranches, setAvailableBranches] = useState([]);
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [tempSelectedBranches, setTempSelectedBranches] = useState([]); // Temporary state for dropdown
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [branchSearchTerm, setBranchSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    
    // Drill-down state
    const [viewingBranchDetail, setViewingBranchDetail] = useState(false);
    const [selectedBranchDetail, setSelectedBranchDetail] = useState(null);
    
    // FIX: Initialize useTabs with empty array first, then update when accountTypes load
    const [selectedTab, setSelectedTab] = useTabs(
        accountTypes.length > 0 
            ? accountTypes.map(at => at.type_code) 
            : ['loading']
    );

    // Single date filter
    const [dateFilter, setDateFilter] = useState(null);

    // Accounts - single state object for all types
    const [accounts, setAccounts] = useState({});

    // Transactions
    const [transactions, setTransactions] = useState([]);
    const [newTransactions, setNewTransactions] = useState({});
    const [grandTotal, setGrandTotal] = useState(0);

    // Aggregated data for upper management
    const [aggregatedData, setAggregatedData] = useState([]);

    // Check if user can edit (role.rep = 1 or branch manager role.rep = 3)
    const canEdit = currentUser?.role?.rep === 1 || 
                    (currentUser?.role?.rep === 3 && currentDate === dateFilter);

    // Determine view mode: 'branch' for role.rep = 3, 'aggregated' for role.rep <= 2
    const baseViewMode = currentUser?.role?.rep === 3 ? 'branch' : 'aggregated';
    
    // Override view mode when drilling down into branch detail
    const viewMode = viewingBranchDetail ? 'branch' : baseViewMode;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setBranchDropdownOpen(false);
                // Reset temp selection to current selection when closing without applying
                setTempSelectedBranches(selectedBranches);
                setBranchSearchTerm('');
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

    // Set initial tab when account types are loaded
    useEffect(() => {
        if (accountTypes.length > 0 && selectedTab === 'loading') {
            setSelectedTab(accountTypes[0].type_code);
        }
    }, [accountTypes]);

    // Load accounts for selected tab (branch view only)
    useEffect(() => {
        if (selectedTab && selectedTab !== 'loading' && viewMode === 'branch') {
            loadAccounts(selectedTab);
        }
    }, [selectedTab, viewMode]);

    // Load data when filters change
    useEffect(() => {
        if (selectedTab && selectedTab !== 'loading' && dateFilter) {
            if (viewMode === 'branch') {
                if (viewingBranchDetail && selectedBranchDetail) {
                    loadTransactions(selectedTab, selectedBranchDetail._id);
                } else if (currentUser.role.rep === 3) {
                    loadTransactions(selectedTab);
                }
            } else {
                loadAggregatedData(selectedTab, null);
            }
        }
    }, [selectedTab, dateFilter, viewMode, viewingBranchDetail, selectedBranchDetail]);

    const loadAccountTypes = async () => {
        setLoadingAccounts(true);
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-types/list';
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
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

    const loadTransactions = async (transactionType, branchId = null) => {
        if (!dateFilter) {
            console.log('Date not initialized yet');
            return;
        }

        setLoading(true);
        try {
            // Determine which branch ID to use
            let effectiveBranchId = branchId;
            if (!effectiveBranchId && currentUser.role.rep === 3) {
                effectiveBranchId = currentUser.designatedBranchId;
            }

            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/list?transactionType=${transactionType}` +
                `&branchId=${effectiveBranchId || ''}` +
                `&dateFrom=${dateFilter}&dateTo=${dateFilter}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setTransactions(response.transactions);
                setGrandTotal(response.grandTotal);
                
                // Pre-populate the input fields with existing transaction amounts
                const existingAmounts = {};
                response.transactions.forEach(transaction => {
                    existingAmounts[transaction.account_id] = transaction.amount;
                });
                setNewTransactions(existingAmounts);
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
            // Use the passed parameter or fall back to state
            const branchesToUse = branchIdsToFilter !== null ? branchIdsToFilter : selectedBranches;
            
            // Build branch filter query parameter - allow empty selection
            const branchIdsParam = branchesToUse.length > 0 
                ? `&branchIds=${branchesToUse.join(',')}` 
                : '';

            console.log('Loading aggregated data with branches:', branchesToUse.length);

            const apiUrl = getApiBaseUrl() + 
                `management-transactions/transactions/aggregated?transactionType=${transactionType}` +
                `&date=${dateFilter}${branchIdsParam}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setAggregatedData(response.aggregatedData || []);
                setGrandTotal(response.grandTotal || 0);
                
                // Extract available branches from response
                if (response.availableBranches) {
                    setAvailableBranches(response.availableBranches);
                    
                    // Only initialize selection on first load (when both are empty)
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

    const handleAmountChange = (accountId, value) => {
        let cleanedValue = value.replace(/[^0-9.-]/g, '');
        
        setNewTransactions(prev => ({
            ...prev,
            [accountId]: cleanedValue
        }));
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
        
        // Pass the new branch IDs directly to avoid state timing issues
        if (selectedTab && selectedTab !== 'loading' && dateFilter) {
            loadAggregatedData(selectedTab, tempSelectedBranches);
        }
    };

    const handleOpenDropdown = () => {
        // Sync temp state with current state when opening
        setTempSelectedBranches(selectedBranches);
        setBranchDropdownOpen(true);
    };

    // Handle branch row click for drill-down
    const handleBranchClick = (branch) => {
        router.push({
            pathname: router.pathname,
            query: {
                date: dateFilter,
                branchId: branch.branchId
            }
        }, undefined, { shallow: true });
    };

    // Handle back navigation
    const handleBackToAggregated = () => {
        router.push({
            pathname: router.pathname,
            query: {
                date: dateFilter
            }
        }, undefined, { shallow: true });
        
        // Clear the transaction data
        setNewTransactions({});
    };

    const handleSubmitAll = async () => {
        // Validate that at least one amount is entered
        const hasData = Object.values(newTransactions).some(val => val && parseFloat(val) > 0);
        
        if (!hasData) {
            toast.error('Please enter at least one amount before submitting');
            return;
        }

        // Get the correct branch ID
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
            
            // Prepare transactions data
            const transactionsData = Object.entries(newTransactions)
                .filter(([_, amount]) => amount && parseFloat(amount) > 0)
                .map(([accountId, amount]) => ({
                    accountId: accountId,
                    amount: parseFloat(amount)
                }));

            const response = await fetchWrapper.post(apiUrl, {
                transactionType: selectedTab,
                branchId: branchId,
                dateAdded: dateFilter,
                userId: currentUser._id,
                transactions: transactionsData
            });

            if (response.success) {
                toast.success('Transactions submitted successfully');
                // Reload transactions
                if (viewingBranchDetail && selectedBranchDetail) {
                    loadTransactions(selectedTab, selectedBranchDetail._id);
                } else {
                    loadTransactions(selectedTab);
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

    // Filter branches based on search term
    const filteredBranches = availableBranches.filter(branch => {
        const searchLower = branchSearchTerm.toLowerCase();
        return branch.code.toLowerCase().includes(searchLower) || 
               branch.name.toLowerCase().includes(searchLower);
    });

    const currentAccounts = accounts[selectedTab] || [];
    const hasExistingTransactions = transactions.length > 0;
    const isEditable = !hasExistingTransactions || canEdit;

    if (loadingAccounts) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-96">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    // Don't render tabs until accountTypes are loaded
    if (accountTypes.length === 0) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-96">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="flex flex-col h-full bg-white">
                {/* Header */}
                <div className="flex flex-col gap-4 p-6 border-b border-gray-200 relative z-30">
                    <div className="flex flex-row justify-between items-start">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold text-gray-800">Management Transactions</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {viewMode === 'branch' 
                                    ? viewingBranchDetail 
                                        ? `Branch: ${selectedBranchDetail?.code} - ${selectedBranchDetail?.name}`
                                        : 'Record and track management expenses and income'
                                    : 'View aggregated management transactions by branch'}
                            </p>
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

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Date:</span>
                            <DatePicker
                                name="dateFilter"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                maxDate={currentDate}
                                height="h-9"
                            />
                        </div>

                        {/* Branch Filter Dropdown - Only for Aggregated View and not drilling down */}
                        {baseViewMode === 'aggregated' && !viewingBranchDetail && availableBranches.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">Branches:</span>
                                
                                {/* Dropdown */}
                                <div className="relative" ref={dropdownRef}>
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
                                        <svg 
                                            className={`w-4 h-4 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {branchDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden z-50">
                                            {/* Search and Select All */}
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

                                            {/* Branch List - Scrollable */}
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

                                            {/* Apply Filter Button - Always visible at bottom */}
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

                        {viewMode === 'branch' && (currentUser.role.rep === 3 || viewingBranchDetail) && (
                            <ButtonSolid
                                label={submitting ? 'Submitting...' : 'Submit All'}
                                onClick={handleSubmitAll}
                                disabled={submitting || !isEditable || loading}
                                width="w-auto"
                            />
                        )}
                    </div>
                </div>

                {/* Permission notice - only for branch view */}
                {viewMode === 'branch' && hasExistingTransactions && !canEdit && (
                    <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md relative z-20">
                        <p className="text-sm text-yellow-800">
                            Transactions for this date have already been submitted. Only administrators can edit submitted transactions.
                        </p>
                    </div>
                )}
                
                {/* Tabs Navigation */}
                <nav className="flex border-b border-gray-300 px-6 bg-gray-50 overflow-x-auto min-h-12">
                    {accountTypes.map((accountType) => (
                        <TabSelector
                            key={accountType.type_code}
                            isActive={selectedTab === accountType.type_code}
                            onClick={() => setSelectedTab(accountType.type_code)}
                        >
                            {accountType.type_name}
                        </TabSelector>
                    ))}
                </nav>

                {/* Content with proper z-index to prevent overlap */}
                <div className="flex-grow overflow-auto p-6 relative z-10">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner />
                        </div>
                    ) : viewMode === 'aggregated' ? (
                        // Aggregated View for Upper Management
                        accountTypes.map((accountType) => (
                            <TabPanel key={accountType.type_code} hidden={selectedTab !== accountType.type_code}>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Branch
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Amount Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {aggregatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
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
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                                {formatPricePhp(item.totalAmount)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabPanel>
                        ))
                    ) : (
                        // Branch Input View
                        accountTypes.map((accountType) => (
                            <TabPanel key={accountType.type_code} hidden={selectedTab !== accountType.type_code}>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Account Name
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                                                        Amount
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {currentAccounts.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={2} className="px-6 py-8 text-center text-gray-500">
                                                            No accounts available for {accountType.type_name}. Please add accounts in Settings.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentAccounts.map((account) => (
                                                        <tr key={account._id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {account.account_name}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={newTransactions[account._id] || ''}
                                                                    onChange={(e) => handleAmountChange(account._id, e.target.value)}
                                                                    onWheel={(e) => e.target.blur()}
                                                                    placeholder="0.00"
                                                                    disabled={!isEditable}
                                                                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-right ${
                                                                        !isEditable ? 'bg-gray-100 cursor-not-allowed' : ''
                                                                    }`}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </TabPanel>
                        ))
                    )}
                </div>

                {/* Grand Total Footer - Aligned with Amount Column */}
                <footer className="bg-white px-6 py-4 shadow-inner border-t-4 border-gray-200 relative z-20">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <tbody>
                                <tr>
                                    <td className="px-6 py-2 text-left">
                                        {/* Empty cell to align with first column */}
                                    </td>
                                    <td className="px-6 py-2 text-right w-64">
                                        <div className="flex justify-end items-center gap-4">
                                            <span className="text-lg font-bold text-gray-600">Grand Total:</span>
                                            <span className="text-lg font-bold text-teal-600">{formatPricePhp(grandTotal)}</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </footer>
            </div>
        </Layout>
    );
};

export default ManagementTransactionsPage;