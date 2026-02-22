import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import moment from 'moment';
import { FileText, Eye, CheckCircle, Clock, Info } from 'lucide-react';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp } from '@/lib/utils';
import ClaimTransactionModal from '@/components/transactions/ClaimTransactionModal';
import DocumentViewerModal from '@/components/transactions/DocumentViewerModal';

/**
 * Tab selector component
 */
const TabSelector = ({ isActive, onClick, children }) => (
    <button
        className={`
            px-6 py-3 text-sm font-medium border-b-2 transition-colors
            ${isActive 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
        `}
        onClick={onClick}
    >
        {children}
    </button>
);

/**
 * Tab panel component
 */
const TabPanel = ({ hidden, children }) => (
    <div className={hidden ? 'hidden' : 'block'}>
        {children}
    </div>
);

/**
 * Main component for Unclaimed Amount Transactions
 */
export default function UnclaimedTransactions() {
    const currentUser = useSelector((state) => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState('unclaimed');
    const [unclaimedList, setUnclaimedList] = useState([]);
    const [claimedList, setClaimedList] = useState([]);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Document viewer modal state
    const [showDocumentViewer, setShowDocumentViewer] = useState(false);
    const [viewingDocument, setViewingDocument] = useState(null);
    
    // Filter states
    const [dateFilter, setDateFilter] = useState(''); // Empty to show all past transactions by default
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedLo, setSelectedLo] = useState('');
    const [branchList, setBranchList] = useState([]);
    const [loList, setLoList] = useState([]);
    
    // Batch selection states
    const [selectedTransactions, setSelectedTransactions] = useState([]);
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [batchProcessing, setBatchProcessing] = useState(false);

    // Fetch branches for filter (role.rep 1 or 2)
    const fetchBranches = useCallback(async () => {
        if (currentUser.role.rep > 2) return; // Only for admin and regional managers
        
        try {
            let url = `${getApiBaseUrl()}branches/list`;
            
            if (currentUser.role.shortCode === 'regional_manager') {
                url += `?regionId=${currentUser.regionId}`;
            }
            
            const response = await fetchWrapper.get(url);
            if (response.success) {
                setBranchList(response.branches.filter(b => b.code !== 'B000'));
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    }, [currentUser]);

    // Fetch loan officers for filter (role.rep 1, 2, or 3)
    const fetchLoanOfficers = useCallback(async () => {
        if (currentUser.role.rep > 3) return; // Only for admin, regional, area, and branch managers
        
        try {
            let url = `${getApiBaseUrl()}users/list?`;
            
            if (selectedBranch) {
                url += `branchId=${selectedBranch}`;
            } else if (currentUser.role.rep === 3) {
                url += `branchId=${currentUser.designatedBranchId}`;
            } else if (currentUser.role.shortCode === 'regional_manager') {
                url += `regionId=${currentUser.regionId}`;
            } else if (currentUser.role.shortCode === 'area_admin') {
                url += `areaId=${currentUser.areaId}`;
            }
            
            const response = await fetchWrapper.get(url);
            if (response.success) {
                setLoList(response.users.filter(u => u.role.rep === 4)); // Only loan officers
            }
        } catch (error) {
            console.error('Error fetching loan officers:', error);
        }
    }, [currentUser, selectedBranch]);

    // Load filters on mount
    useEffect(() => {
        if (currentUser) {
            fetchBranches();
            fetchLoanOfficers();
        }
    }, [currentUser, fetchBranches, fetchLoanOfficers]);

    // Reload LOs when branch changes
    useEffect(() => {
        if (selectedBranch) {
            fetchLoanOfficers();
        }
    }, [selectedBranch, fetchLoanOfficers]);

    // Fetch unclaimed transactions
    const fetchUnclaimedTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'unclaimed'
            });
            
            if (selectedBranch) params.append('branchId', selectedBranch);
            if (selectedLo) params.append('loId', selectedLo);
            
            // Only apply date filter if:
            // 1. Date is selected AND
            // 2. Date is NOT current date (current date means "show all")
            const isCurrentDate = dateFilter && dateFilter === moment(currentDate).format('YYYY-MM-DD');
            if (dateFilter && !isCurrentDate) {
                params.append('date', dateFilter);
            }
            
            const url = `${getApiBaseUrl()}transactions/unclaimed-transactions/list?${params.toString()}`;
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                setUnclaimedList(response.data || []);
            } else {
                toast.error('Failed to fetch unclaimed transactions');
            }
        } catch (error) {
            console.error('Error fetching unclaimed transactions:', error);
            toast.error('Error loading unclaimed transactions');
        } finally {
            setLoading(false);
        }
    }, [selectedBranch, selectedLo, dateFilter, currentDate]);

    // Fetch claimed transactions
    const fetchClaimedTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'claimed'
            });
            
            if (selectedBranch) params.append('branchId', selectedBranch);
            if (selectedLo) params.append('loId', selectedLo);
            
            // Only apply date filter if:
            // 1. Date is selected AND
            // 2. Date is NOT current date (current date means "show all")
            const isCurrentDate = dateFilter && dateFilter === moment(currentDate).format('YYYY-MM-DD');
            if (dateFilter && !isCurrentDate) {
                params.append('date', dateFilter);
            }
            
            const url = `${getApiBaseUrl()}transactions/unclaimed-transactions/list?${params.toString()}`;
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                setClaimedList(response.data || []);
            } else {
                toast.error('Failed to fetch claimed transactions');
            }
        } catch (error) {
            console.error('Error fetching claimed transactions:', error);
            toast.error('Error loading claimed transactions');
        } finally {
            setLoading(false);
        }
    }, [selectedBranch, selectedLo, dateFilter, currentDate]);

    // Load data based on selected tab and filters
    useEffect(() => {
        if (selectedTab === 'unclaimed') {
            fetchUnclaimedTransactions();
        } else {
            fetchClaimedTransactions();
        }
    }, [selectedTab, selectedBranch, selectedLo, dateFilter, fetchUnclaimedTransactions, fetchClaimedTransactions]);

    // Handle claim transaction
    const handleClaimTransaction = async (transactionData) => {
        try {
            const url = `${getApiBaseUrl()}transactions/unclaimed-transactions/claim`;
            const response = await fetchWrapper.post(url, transactionData);
            
            if (response.success) {
                toast.success('Transaction claimed successfully!');
                setShowClaimModal(false);
                setSelectedTransaction(null);
                
                // Refresh both lists to update the UI
                await fetchUnclaimedTransactions();
                await fetchClaimedTransactions();
            } else {
                toast.error(response.message || 'Failed to claim transaction');
            }
        } catch (error) {
            console.error('Error claiming transaction:', error);
            toast.error('Error claiming transaction');
        }
    };

    // Handle batch claim transactions
    const handleBatchClaim = async (transactions) => {
        if (!transactions || transactions.length === 0) {
            toast.error('No transactions selected');
            return;
        }

        setBatchProcessing(true);
        try {
            const url = `${getApiBaseUrl()}transactions/unclaimed-transactions/claim`;
            const response = await fetchWrapper.post(url, {
                mode: 'batch',
                transactions: transactions
            });
            
            if (response.success) {
                const { successCount, errorCount } = response;
                if (errorCount === 0) {
                    toast.success(`All ${successCount} transactions claimed successfully!`);
                } else {
                    toast.warning(`${successCount} succeeded, ${errorCount} failed`);
                }
                
                // Close modal first
                setShowClaimModal(false);
                
                // Clear selections and exit batch mode
                setSelectedTransactions([]);
                setIsBatchMode(false);
                
                // Refresh both lists to update the UI
                await fetchUnclaimedTransactions();
                await fetchClaimedTransactions();
            } else {
                toast.error(response.message || 'Failed to claim transactions');
            }
        } catch (error) {
            console.error('Error batch claiming transactions:', error);
            toast.error('Error claiming transactions');
        } finally {
            setBatchProcessing(false);
        }
    };

    // Toggle single transaction selection
    const toggleTransactionSelection = (transaction) => {
        setSelectedTransactions(prev => {
            const isSelected = prev.some(t => t.cashCollectionId === transaction.cashCollectionId);
            if (isSelected) {
                return prev.filter(t => t.cashCollectionId !== transaction.cashCollectionId);
            } else {
                return [...prev, transaction];
            }
        });
    };

    // Toggle select all
    const toggleSelectAll = () => {
        if (selectedTransactions.length === filteredData.length) {
            setSelectedTransactions([]);
        } else {
            setSelectedTransactions(filteredData);
        }
    };

    // Check if transaction is selected
    const isTransactionSelected = (transaction) => {
        return selectedTransactions.some(t => t.cashCollectionId === transaction.cashCollectionId);
    };

    // Reset all filters
    const handleResetFilters = () => {
        setDateFilter('');
        setSelectedBranch('');
        setSelectedLo('');
        setSearchTerm('');
    };

    // Handle view document - open in modal viewer
    const handleViewDocument = (transaction) => {
        if (!transaction?.documentUrl) {
            toast.error('No document available');
            return;
        }
        setViewingDocument(transaction);
        setShowDocumentViewer(true);
    };

    // Filter data based on search term (searches: client, branch, group, slot)
    const filteredData = useMemo(() => {
        const data = selectedTab === 'unclaimed' ? unclaimedList : claimedList;
        
        if (!searchTerm) return data;

        const search = searchTerm.toLowerCase();
        return data.filter(item => 
            item.clientName?.toLowerCase().includes(search) ||
            item.branchName?.toLowerCase().includes(search) ||
            item.groupName?.toLowerCase().includes(search) ||
            item.slotNo?.toLowerCase().includes(search)
        );
    }, [selectedTab, unclaimedList, claimedList, searchTerm]);

    // Table columns definition
    const columns = [
        { key: 'dateOfOffset', label: 'Date of Offset', sortable: true },
        { key: 'branchName', label: 'Branch Name', sortable: true },
        { key: 'groupName', label: 'Group Name', sortable: true },
        { key: 'slotNo', label: 'Slot No', sortable: true },
        { key: 'clientName', label: 'Client Name', sortable: true },
        { key: 'amountRelease', label: 'Amount Release', sortable: true, align: 'right' },
        { key: 'loanBalance', label: 'Loan Balance', sortable: true, align: 'right' },
        { key: 'mcbu', label: 'MCBU', sortable: true, align: 'right' },
        { key: 'csf', label: 'CSF', sortable: true, align: 'right' },
        { key: 'unclaimedAmount', label: 'Unclaimed Amount', sortable: true, align: 'right' },
        { key: 'status', label: 'Status', sortable: true },
        ...(selectedTab === 'claimed' ? [{ key: 'dateClaimed', label: 'Date Claimed', sortable: true }] : []),
        { key: 'actions', label: 'Actions', sortable: false }
    ];

    return (
        <Layout 
            title="Unclaimed Amount Transactions"
            showBackButton={false}
        >
            <div className="pb-4">
                {loading && selectedTab !== selectedTab ? (
                    <Spinner />
                ) : (
                    <>
                        {/* Tabs */}
                        <nav className="flex bg-white border-b border-gray-300">
                            <TabSelector
                                isActive={selectedTab === 'unclaimed'}
                                onClick={() => setSelectedTab('unclaimed')}
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Unclaimed List
                                </div>
                            </TabSelector>
                            <TabSelector
                                isActive={selectedTab === 'claimed'}
                                onClick={() => setSelectedTab('claimed')}
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Claimed List
                                </div>
                            </TabSelector>
                        </nav>

                        {/* Filters Section - Compact Single Row */}
                        <div className="p-4 bg-white border-b border-gray-200">
                            <div className="flex flex-wrap items-end gap-3">
                                {/* Date Filter */}
                                <div className="w-40">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        {selectedTab === 'unclaimed' ? 'Offset Date' : 'Claimed Date'}
                                    </label>
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Branch Filter - only for role.rep 1 or 2 */}
                                {currentUser.role.rep <= 2 && (
                                    <div className="w-48">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                                        <select
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">All Branches</option>
                                            {branchList.map(branch => (
                                                <option key={branch._id} value={branch._id}>
                                                    {branch.code} - {branch.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Loan Officer Filter - only for role.rep 1, 2, or 3 */}
                                {currentUser.role.rep <= 3 && (
                                    <div className="w-48">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Loan Officer</label>
                                        <select
                                            value={selectedLo}
                                            onChange={(e) => setSelectedLo(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">All Loan Officers</option>
                                            {loList.map(lo => (
                                                <option key={lo._id} value={lo._id}>
                                                    {lo.firstName} {lo.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Search Box */}
                                <div className="flex-1 min-w-[250px]">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                                    <input
                                        type="text"
                                        placeholder="Search by client, branch, group, or slot no..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Reset Filters Button */}
                                <div>
                                    <button
                                        onClick={handleResetFilters}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                        title="Clear all filters"
                                    >
                                        Reset Filters
                                    </button>
                                </div>

                                {/* Batch Mode Button */}
                                {selectedTab === 'unclaimed' && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setIsBatchMode(!isBatchMode);
                                                setSelectedTransactions([]);
                                            }}
                                            className={`px-4 py-2 border rounded-md font-medium transition-colors text-sm whitespace-nowrap ${
                                                isBatchMode 
                                                    ? 'bg-blue-600 text-white border-blue-600' 
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {isBatchMode ? 'Cancel Batch' : 'Batch Mode'}
                                        </button>
                                        
                                        {isBatchMode && selectedTransactions.length > 0 && (
                                            <button
                                                onClick={() => setShowClaimModal(true)}
                                                disabled={batchProcessing}
                                                className="px-4 py-2 bg-green-600 text-white border border-transparent rounded-md font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm whitespace-nowrap"
                                            >
                                                {batchProcessing ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle className="h-4 w-4" />
                                                        Claim ({selectedTransactions.length})
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Unclaimed Tab */}
                        <TabPanel hidden={selectedTab !== 'unclaimed'}>
                            <div className="p-4">
                                {/* Info Message */}
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
                                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-blue-800">
                                        <strong>Note:</strong> Only showing past offset transactions (before today). 
                                        Same-day transactions must settle before they can be claimed.
                                        {dateFilter && dateFilter !== moment(currentDate).format('YYYY-MM-DD') 
                                            ? ` Filtered by date: ${moment(dateFilter).format('MMM DD, YYYY')}.` 
                                            : ' Showing all past transactions.'}
                                    </p>
                                </div>

                                {loading ? (
                                    <Spinner />
                                ) : (
                                    <div className="overflow-x-auto bg-white rounded-lg shadow">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {isBatchMode && (
                                                        <th className="px-6 py-3 text-left">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTransactions.length === filteredData.length && filteredData.length > 0}
                                                                onChange={toggleSelectAll}
                                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                            />
                                                        </th>
                                                    )}
                                                    {columns.filter(col => col.key !== 'dateClaimed').map(column => (
                                                        <th
                                                            key={column.key}
                                                            className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                                                                column.align === 'right' ? 'text-right' : 'text-left'
                                                            }`}
                                                        >
                                                            {column.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {filteredData.length > 0 ? (
                                                    filteredData.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            {isBatchMode && (
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isTransactionSelected(row)}
                                                                        onChange={() => toggleTransactionSelection(row)}
                                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {moment(row.dateOfOffset).format('MMM DD, YYYY')}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.branchName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.groupName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.slotNo}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.clientName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.amountRelease)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.loanBalance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.mcbu)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.csf)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                                                                {formatPricePhp(row.unclaimedAmount)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                                    Unclaimed
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedTransaction(row);
                                                                        setShowClaimModal(true);
                                                                    }}
                                                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                                >
                                                                    <FileText className="h-4 w-4 mr-1" />
                                                                    Claim
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={columns.length - 1} className="px-6 py-8 text-center text-sm text-gray-500">
                                                            No unclaimed transactions found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </TabPanel>

                        {/* Claimed Tab */}
                        <TabPanel hidden={selectedTab !== 'claimed'}>
                            <div className="p-4">
                                {loading ? (
                                    <Spinner />
                                ) : (
                                    <div className="overflow-x-auto bg-white rounded-lg shadow">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    {columns.map(column => (
                                                        <th
                                                            key={column.key}
                                                            className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                                                                column.align === 'right' ? 'text-right' : 'text-left'
                                                            }`}
                                                        >
                                                            {column.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {filteredData.length > 0 ? (
                                                    filteredData.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {moment(row.dateOfOffset).format('MMM DD, YYYY')}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.branchName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.groupName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.slotNo}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.clientName}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.amountRelease)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.loanBalance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.mcbu)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {formatPricePhp(row.csf)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                                                                {formatPricePhp(row.unclaimedAmount)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                    Claimed
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.dateClaimed ? moment(row.dateClaimed).format('MMM DD, YYYY') : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                {row.documentUrl && (
                                                                    <button
                                                                        onClick={() => handleViewDocument(row)}
                                                                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                                    >
                                                                        <Eye className="h-4 w-4 mr-1" />
                                                                        View
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-gray-500">
                                                            No claimed transactions found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </TabPanel>
                    </>
                )}
            </div>

            {/* Claim Transaction Modal */}
            <ClaimTransactionModal
                isOpen={showClaimModal}
                onClose={() => {
                    setShowClaimModal(false);
                    setSelectedTransaction(null);
                }}
                onClaim={isBatchMode ? handleBatchClaim : handleClaimTransaction}
                transaction={selectedTransaction}
                transactions={selectedTransactions}
                isBatch={isBatchMode && selectedTransactions.length > 0}
            />

            {/* Document Viewer Modal */}
            <DocumentViewerModal
                isOpen={showDocumentViewer}
                onClose={() => {
                    setShowDocumentViewer(false);
                    setViewingDocument(null);
                }}
                documentUrl={viewingDocument?.documentUrl}
                clientName={viewingDocument?.clientName}
                unclaimedAmount={viewingDocument?.unclaimedAmount}
            />
        </Layout>
    );
}