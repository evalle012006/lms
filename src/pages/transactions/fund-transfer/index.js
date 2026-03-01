import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { toast } from "react-toastify";
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import TableComponent, { StatusPill } from "@/lib/table";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { PlusIcon, CheckIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useRouter } from "next/router";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import AddUpdateFundTransfer from "@/components/transactions/fund-transfer/AddUpdateFundTransferDrawer";
import Dialog from "@/lib/ui/Dialog";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { getApiBaseUrl } from "@/lib/constants";
import moment from 'moment';
import { setFundTransferHistoryList, setFundTransferList } from "@/redux/actions/fundTransferActions";
import FundTransferFilters from "@/components/transactions/fund-transfer/FundTransferFilters";

const FundTransferPage = () => {
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const router = useRouter();
    const dispatch = useDispatch();
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const fundTransferList = useSelector(state => state.fundTransfer.list);
    const fundTransferHistoryList = useSelector(state => state.fundTransfer.historyList);

    // Filtered data states
    const [filteredTransactionData, setFilteredTransactionData] = useState([]);
    const [filteredHistoryData, setFilteredHistoryData] = useState([]);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [mode, setMode] = useState('add');
    const [fundTransfer, setFundTransfer] = useState();
    const [approvalAction, setApprovalAction] = useState('');
    const [rejectReason, setRejectReason] = useState('');

    const isMountedRef = useRef(true);
    const isLoadingRef = useRef(false);

    const [selectedTab, setSelectedTab] = useTabs([
        'fund-transfer-transactions',
        'fund-transfer-history'
    ]);

    // Calculate totals for transactions
    const transactionTotals = useMemo(() => {
        if (!filteredTransactionData || filteredTransactionData.length === 0) {
            return {
                count: 0,
                totalAmount: 0,
                totalAmountStr: new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'PHP' 
                }).format(0)
            };
        }

        const totalAmount = filteredTransactionData.reduce((sum, transfer) => {
            return sum + (transfer.amount || 0);
        }, 0);

        return {
            count: filteredTransactionData.length,
            totalAmount: totalAmount,
            totalAmountStr: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'PHP' 
            }).format(totalAmount)
        };
    }, [filteredTransactionData]);

    // Calculate totals for history
    const historyTotals = useMemo(() => {
        if (!filteredHistoryData || filteredHistoryData.length === 0) {
            return {
                count: 0,
                totalAmount: 0,
                totalAmountStr: new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'PHP' 
                }).format(0)
            };
        }

        const totalAmount = filteredHistoryData.reduce((sum, transfer) => {
            return sum + (transfer.amount || 0);
        }, 0);

        return {
            count: filteredHistoryData.length,
            totalAmount: totalAmount,
            totalAmountStr: new Intl.NumberFormat('en-US', { 
                style: 'currency', 
                currency: 'PHP' 
            }).format(totalAmount)
        };
    }, [filteredHistoryData]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    // Enhanced columns for Transactions tab with totals configuration
    const transactionColumns = useMemo(() => [
        {
            Header: "Transaction Code",
            accessor: 'transactionCode',
            Cell: ({ value }) => (
                <span className="font-mono text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded border">
                    {value}
                </span>
            ),
            width: 160,
            totalType: 'none' // First column will show "TOTAL"
        },
        {
            Header: "Transfer Date",
            accessor: 'insertedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY') : '',
            totalType: 'none'
        },
        {
            Header: "From Branch",
            accessor: 'giverBranchDisplay',
            totalType: 'none'
        },
        {
            Header: "To Branch",
            accessor: 'receiverBranchDisplay',
            totalType: 'none'
        },
        {
            Header: "Amount",
            accessor: 'amountStr',
            totalType: 'sum',
            totalValue: transactionTotals.totalAmountStr
        },
        {
            Header: "Account",
            accessor: 'account',
            totalType: 'none'
        },
        {
            Header: "Description",
            accessor: 'description',
            totalType: 'none'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill,
            totalType: 'none'
        },
        {
            Header: "Requested By",
            accessor: 'insertedBy',
            Cell: ({ value }) => value ? `${value.firstName} ${value.lastName}` : '',
            totalType: 'none'
        },
        {
            Header: "Giver Approval",
            accessor: 'giverApprovalStatus',
            Cell: StatusPill,
            totalType: 'none'
        },
        {
            Header: "Receiver Approval",
            accessor: 'receiverApprovalStatus',
            Cell: StatusPill,
            totalType: 'none'
        }
    ], [transactionTotals]);

    // Enhanced columns for History tab with totals configuration
    const historyColumns = useMemo(() => [
        {
            Header: "Transaction Code",
            accessor: 'transactionCode',
            Cell: ({ value }) => (
                <span className="font-mono text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded border">
                    {value}
                </span>
            ),
            width: 160,
            totalType: 'none' // First column will show "TOTAL"
        },
        {
            Header: "Transfer Date",
            accessor: 'insertedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY') : '',
            totalType: 'none'
        },
        {
            Header: "From Branch",
            accessor: 'giverBranch.name',
            totalType: 'none'
        },
        {
            Header: "To Branch",
            accessor: 'receiverBranch.name',
            totalType: 'none'
        },
        {
            Header: "Amount",
            accessor: 'amountStr',
            totalType: 'sum',
            totalValue: historyTotals.totalAmountStr
        },
        {
            Header: "Account",
            accessor: 'account',
            totalType: 'none'
        },
        {
            Header: "Description",
            accessor: 'description',
            totalType: 'none'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill,
            totalType: 'none'
        },
        {
            Header: "Requested By",
            accessor: 'insertedBy',
            Cell: ({ value }) => value ? `${value.firstName} ${value.lastName}` : '',
            totalType: 'none'
        },
        {
            Header: "Final Action Date",
            accessor: 'approvedRejectedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : '',
            totalType: 'none'
        },
        {
            Header: "Giver Approval Date",
            accessor: 'giverApproveRejectDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : 'Pending',
            totalType: 'none'
        },
        {
            Header: "Receiver Approval Date",
            accessor: 'receiverApproveRejectDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : 'Pending',
            totalType: 'none'
        },
        {
            Header: "Giver Status",
            accessor: 'giverApprovalStatus',
            Cell: StatusPill,
            totalType: 'none'
        },
        {
            Header: "Receiver Status",
            accessor: 'receiverApprovalStatus',
            Cell: StatusPill,
            totalType: 'none'
        },
        {
            Header: "Reject Reason",
            accessor: 'rejectReason',
            Cell: ({ row }) => {
                const { giverRejectReason, receiverRejectReason } = row.original;
                const reasons = [giverRejectReason, receiverRejectReason].filter(Boolean);
                return reasons.length > 0 ? reasons.join('; ') : '';
            },
            totalType: 'none'
        }
    ], [historyTotals]);

    const handleEditAction = (row) => {
        // Check if user is Finance role - they can edit regardless of status
        const isFinance = currentUser.role?.shortCode === 'finance';
        
        // Allow Finance to edit any fund transfer regardless of status
        if (isFinance) {
            setMode("edit");
            setFundTransfer(row.original);
            handleShowAddDrawer();
            return;
        }
        
        // Regular validation for other users
        if (row.original.status === 'pending') {
            setMode("edit");
            setFundTransfer(row.original);
            handleShowAddDrawer();
        } else {
            toast.error("Cannot edit approved/rejected transfers.");
        }
    }

    const handleDeleteAction = (row) => {
        // Check if transfer is still deletable
        if (row.original.status !== 'pending') {
            toast.error("Cannot delete approved or rejected transfers.");
            return;
        }
        
        // Check if any approval status is already approved
        if (row.original.giverApprovalStatus === 'approved' || 
            row.original.receiverApprovalStatus === 'approved') {
            toast.error("Cannot delete transfer. At least one branch has already approved this transfer.");
            return;
        }
        
        // Check if any approval status is rejected
        if (row.original.giverApprovalStatus === 'rejected' || 
            row.original.receiverApprovalStatus === 'rejected') {
            toast.error("Cannot delete rejected transfers.");
            return;
        }
        
        // Check authorization
        const isCreator = row.original.insertedById === currentUser._id;
        const isGiverBranch = currentUser.role?.shortCode === 'area_admin' && 
                            currentUser.designatedBranchId === row.original.giverBranchId;
        
        if (!isCreator && !isGiverBranch) {
            toast.error("You can only delete transfers that you created or transfers from your designated branch (giver branch only).");
            return;
        }
        
        setFundTransfer(row.original);
        setShowDeleteDialog(true);
    }

    const handleApproveAction = (row) => {
        setFundTransfer(row.original);
        setApprovalAction('approve');
        setShowApprovalDialog(true);
    }

    const handleRejectAction = (row) => {
        setFundTransfer(row.original);
        setApprovalAction('reject');
        setRejectReason('');
        setShowRejectDialog(true);
    }

    const handleApprovalConfirm = async () => {
        if (fundTransfer && !isRefreshing) {
            setIsRefreshing(true);
            const url = getApiBaseUrl() + 'transactions/fund-transfer/approve';
            const payload = {
                _id: fundTransfer._id,
                currentUserId: currentUser._id,
                status: approvalAction === 'approve' ? 'approved' : 'rejected'
            };

            try {
                const response = await fetchWrapper.post(url, payload);
                if (response.success) {
                    setShowApprovalDialog(false);
                    toast.success(`Transfer ${approvalAction}d successfully.`);
                    await refreshFundTransferList();
                } else {
                    toast.error(response.message || `Failed to ${approvalAction} transfer.`);
                }
            } catch (error) {
                toast.error(`Error ${approvalAction}ing transfer.`);
            }
            setIsRefreshing(false);
        }
    }

    const handleRejectConfirm = async () => {
        if (fundTransfer && !isRefreshing && rejectReason.trim()) {
            setIsRefreshing(true);
            const url = getApiBaseUrl() + 'transactions/fund-transfer/approve';
            const payload = {
                _id: fundTransfer._id,
                status: 'rejected',
                rejectReason: rejectReason.trim(),
                currentUserId: currentUser._id
            };

            try {
                const response = await fetchWrapper.post(url, payload);
                if (response.success) {
                    setShowRejectDialog(false);
                    setRejectReason('');
                    toast.success('Transfer rejected successfully.');
                    await refreshFundTransferList();
                } else {
                    toast.error(response.message || 'Failed to reject transfer.');
                }
            } catch (error) {
                toast.error('Error rejecting transfer.');
            }
            setIsRefreshing(false);
        } else if (!rejectReason.trim()) {
            toast.error('Please provide a reason for rejection.');
        }
    }

    const handleDelete = async () => {
        if (fundTransfer && !isRefreshing) {
            setIsRefreshing(true);
            try {
                const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/fund-transfer/delete', { 
                    _id: fundTransfer._id,
                    currentUserId: currentUser._id
                });
                if (response.success) {
                    setShowDeleteDialog(false);
                    toast.success('Fund transfer successfully deleted.');
                    await refreshFundTransferList();
                } else {
                    toast.error(response.message || 'Failed to delete fund transfer.');
                }
            } catch (error) {
                toast.error('Error deleting fund transfer.');
            }
            setIsRefreshing(false);
        }
    }

    const handleCloseAddDrawer = (shouldRefresh = false) => {
        setMode('add');
        setFundTransfer({});
        setShowAddDrawer(false);
        
        if (shouldRefresh) {
            refreshFundTransferList();
        }
    }

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        
        try {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];
                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });
                dispatch(setBranchList(branches));

                if (currentUser.role.rep === 3) {
                    const currentBranch = branches.find(branch => branch._id == currentUser.designatedBranchId);
                    if (currentBranch) {
                        dispatch(setBranch(currentBranch));
                    }
                }
            }
        } catch (error) {
            toast.error('Error loading branches.');
        }
    }

    const getFundTransferList = useCallback(async () => {
        if (isLoadingRef.current || !isMountedRef.current) {
            return;
        }

        isLoadingRef.current = true;

        try {
            let url = getApiBaseUrl() + 'transactions/fund-transfer/list';
            
            const transactionsUrl = url + '?' + new URLSearchParams({ 
                status: 'pending'
            });
            
            const historyUrlApproved = url + '?' + new URLSearchParams({ 
                status: 'approved'
            });
            const historyUrlRejected = url + '?' + new URLSearchParams({ 
                status: 'rejected'
            });

            const [transactionsResponse, historyApprovedResponse, historyRejectedResponse] = await Promise.all([
                fetchWrapper.get(transactionsUrl),
                fetchWrapper.get(historyUrlApproved),
                fetchWrapper.get(historyUrlRejected)
            ]);

            if (!isMountedRef.current) return;

            // Check for access denied response
            if (!transactionsResponse.success && transactionsResponse.message?.includes('Access denied')) {
                setAccessDenied(true);
                toast.error('Access denied. You do not have permission to view this page.');
                return;
            }

            if (transactionsResponse.success) {
                const processedTransactions = transactionsResponse.data.map(transfer => ({
                    ...transfer,
                    giverApprovalStatus: transfer.giverApprovalStatus || 'pending',
                    receiverApprovalStatus: transfer.receiverApprovalStatus || 'pending',
                    amountStr: new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'PHP' 
                    }).format(transfer.amount || 0)
                }));
                dispatch(setFundTransferList(processedTransactions));
            }

            let historyData = [];
            if (historyApprovedResponse.success) {
                historyData = [...historyData, ...historyApprovedResponse.data];
            }
            if (historyRejectedResponse.success) {
                historyData = [...historyData, ...historyRejectedResponse.data];
            }

            if (historyData.length > 0) {
                const processedHistory = historyData.map(transfer => ({
                    ...transfer,
                    amountStr: new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'PHP' 
                    }).format(transfer.amount || 0)
                }));
                processedHistory.sort((a, b) => new Date(b.approvedRejectedDate) - new Date(a.approvedRejectedDate));
                dispatch(setFundTransferHistoryList(processedHistory));
            }

        } catch (error) {
            if (isMountedRef.current) {
                if (error.status === 403) {
                    setAccessDenied(true);
                    toast.error('Access denied. You do not have permission to view this page.');
                } else {
                    toast.error('Error loading fund transfers.');
                }
            }
        } finally {
            isLoadingRef.current = false;
        }
    }, [dispatch]);

    const refreshFundTransferList = useCallback(async () => {
        if (!isRefreshing) {
            setIsRefreshing(true);
            await getFundTransferList();
            setIsRefreshing(false);
        }
    }, [getFundTransferList, isRefreshing]);

    const mapBranchWithCode = (branch) => ({
        ... branch,
        giverBranchDisplay: branch.giverBranch ? `${branch.giverBranch.code} ${branch.giverBranch.name}` : '',
        receiverBranchDisplay: branch.receiverBranch ? `${branch.receiverBranch.code} ${branch.receiverBranch.name}` : ''
    })

    // Initialize filtered data when main data changes
    useEffect(() => {
        setFilteredTransactionData(fundTransferList || []);
    }, [fundTransferList]);

    useEffect(() => {
        setFilteredHistoryData(fundTransferHistoryList || []);
    }, [fundTransferHistoryList]);

    // Check user role access - updated condition
    useEffect(() => {
        if (currentUser?.role?.rep > 3) {
            setAccessDenied(true);
            toast.error('Access denied. You do not have permission to view this page.');
        }
    }, [currentUser?.role?.rep]);

    const fetchData = async () => {
        // Don't fetch data if access is denied
        if (currentUser?.role?.rep > 3) {
            setAccessDenied(true);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            await Promise.all([getListBranch(), getFundTransferList()]);
        } catch (error) {
            toast.error('Error loading data.');
        }
        setLoading(false);
    }

    useEffect(() => {
        let mounted = true;
        if (mounted && currentUser?.role?.rep <= 3) {
            fetchData();
        }
        return () => {
            mounted = false;
        }
    }, [currentDate, currentUser?.role?.rep]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Define row action buttons after all handlers are defined
    const rowActionButtons = [
        { label: 'Edit Transfer', action: handleEditAction },
        { label: 'Approve Transfer', action: handleApproveAction },
        { label: 'Reject Transfer', action: handleRejectAction },
        { label: 'Delete Transfer', action: handleDeleteAction }
    ];

    // Show access denied message if user doesn't have permission
    if (accessDenied || currentUser?.role?.rep > 3) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Access Denied</h2>
                        <p className="text-gray-600">You do not have permission to view this page.</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout actionButtons={(currentUser?.role?.shortCode === 'finance' || currentUser?.role?.shortCode === 'regional_manager' || currentUser?.role?.shortCode === 'deputy_director') ?
            [<ButtonSolid 
                key="add-transfer"
                label="Add Fund Transfer" 
                type="button" 
                className="p-2 mr-3" 
                onClick={handleShowAddDrawer} 
                icon={[<PlusIcon className="w-5 h-5" />, 'left']} 
            />] : undefined}>
            <div className="pb-4">
                {loading ? (
                    <Spinner />
                ) : (
                    <React.Fragment>
                        {/* Filters Component */}
                        <FundTransferFilters
                            transactionList={fundTransferList}
                            historyList={fundTransferHistoryList}
                            setFilteredTransactionData={setFilteredTransactionData}
                            setFilteredHistoryData={setFilteredHistoryData}
                            activeTab={selectedTab}
                        />

                        <nav className="flex pl-10 bg-white border-b border-gray-300">
                            <TabSelector
                                isActive={selectedTab === "fund-transfer-transactions"}
                                onClick={() => setSelectedTab("fund-transfer-transactions")}>
                                Transactions
                            </TabSelector>
                            <TabSelector
                                isActive={selectedTab === "fund-transfer-history"}
                                onClick={() => setSelectedTab("fund-transfer-history")}>
                                History
                            </TabSelector>
                        </nav>
                        
                        <React.Fragment>
                            <TabPanel hidden={selectedTab !== "fund-transfer-transactions"}>
                                <TableComponent 
                                    columns={transactionColumns} 
                                    data={filteredTransactionData.map(mapBranchWithCode)} 
                                    pageSize={20} 
                                    hasActionButtons={true} 
                                    rowActionButtons={rowActionButtons}
                                    showFilters={false} // Disable table filters since we have custom filters
                                    currentUser={currentUser}
                                    dropDownActionOrigin="fund-transfer"
                                    isWeekend={isWeekend}
                                    isHoliday={isHoliday}
                                    showTotals={true}
                                />
                            </TabPanel>
                            
                            <TabPanel hidden={selectedTab !== "fund-transfer-history"}>
                                <TableComponent 
                                    columns={historyColumns} 
                                    data={filteredHistoryData.map(mapBranchWithCode)} 
                                    pageSize={20} 
                                    hasActionButtons={false} 
                                    showFilters={false} // Disable table filters since we have custom filters
                                    currentUser={currentUser}
                                    dropDownActionOrigin="fund-transfer-history"
                                    showTotals={true}
                                />
                            </TabPanel>
                        </React.Fragment>
                        
                        <AddUpdateFundTransfer 
                            mode={mode} 
                            fundTransfer={fundTransfer} 
                            showSidebar={showAddDrawer} 
                            setShowSidebar={setShowAddDrawer} 
                            onClose={handleCloseAddDrawer} 
                        />
                        
                        {/* Dialog components remain the same... */}
                        <Dialog show={showDeleteDialog}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start justify-center">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                        <div className="mt-2">
                                            <p className="text-2xl font-normal text-dark-color">
                                                Delete Fund Transfer
                                            </p>
                                            {fundTransfer && (
                                                <div className="mt-4 text-sm text-gray-600">
                                                    <p><strong>Amount:</strong> {fundTransfer.amountStr}</p>
                                                    <p><strong>From:</strong> {fundTransfer.giverBranch?.code} {fundTransfer.giverBranch?.name}</p>
                                                    <p><strong>To:</strong> {fundTransfer.receiverBranch?.code} {fundTransfer.receiverBranch?.name}</p>
                                                    <div className="mt-3 text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                                        <p className="font-semibold">⚠️ Warning:</p>
                                                        <p>This action cannot be undone. The transfer will be permanently deleted.</p>
                                                        {fundTransfer.giverApprovalStatus === 'pending' && 
                                                         fundTransfer.receiverApprovalStatus === 'pending' && (
                                                            <p className="mt-1">✓ No approvals yet - safe to delete</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                                <ButtonOutline 
                                    label="Cancel" 
                                    type="button" 
                                    className="p-2 mr-3" 
                                    onClick={() => setShowDeleteDialog(false)} 
                                />
                                <ButtonSolid 
                                    label="Yes, delete" 
                                    type="button" 
                                    className="p-2" 
                                    onClick={handleDelete} 
                                />
                            </div>
                        </Dialog>

                        <Dialog show={showApprovalDialog}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start justify-center">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                        <div className="mt-2">
                                            <p className="text-2xl font-normal text-dark-color">
                                                {(() => {
                                                    if (currentUser.role?.shortCode === 'finance') {
                                                        return 'Finalize Fund Transfer Approval';
                                                    } else if (currentUser.designatedBranchId === fundTransfer?.giverBranchId) {
                                                        return 'Approve Fund Transfer (Step 1: Giver Branch)';
                                                    } else if (currentUser.designatedBranchId === fundTransfer?.receiverBranchId) {
                                                        return 'Approve Fund Transfer (Step 2: Receiver Branch)';
                                                    }
                                                    return 'Approve Fund Transfer';
                                                })()}
                                            </p>
                                            {fundTransfer && (
                                                <div className="mt-4 text-sm text-gray-600">
                                                    <p><strong>Amount:</strong> {fundTransfer.amountStr}</p>
                                                    <p><strong>From:</strong> {fundTransfer.giverBranch?.code} {fundTransfer.giverBranch?.name}</p>
                                                    <p><strong>To:</strong> {fundTransfer.receiverBranch?.code} {fundTransfer.receiverBranch?.name}</p>
                                                    {currentUser.role?.shortCode === 'finance' && (
                                                        <div className="mt-2 text-xs text-green-600">
                                                            <p>✓ Step 1: Giver branch approved</p>
                                                            <p>✓ Step 2: Receiver branch approved</p>
                                                            <p className="font-semibold">Ready for final approval</p>
                                                        </div>
                                                    )}
                                                    {currentUser.role?.shortCode === 'area_manager' && 
                                                     currentUser.designatedBranchId === fundTransfer?.receiverBranchId && (
                                                        <div className="mt-2 text-xs text-green-600">
                                                            <p>✓ Step 1: Giver branch approved</p>
                                                            <p className="font-semibold">Proceeding to Step 2</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                                <ButtonOutline 
                                    label="Cancel" 
                                    type="button" 
                                    className="p-2 mr-3" 
                                    onClick={() => setShowApprovalDialog(false)} 
                                />
                                <ButtonSolid 
                                    label={(() => {
                                        if (currentUser.role?.shortCode === 'finance') {
                                            return 'Finalize Approval';
                                        } else if (currentUser.designatedBranchId === fundTransfer?.giverBranchId) {
                                            return 'Approve (Step 1)';
                                        } else if (currentUser.designatedBranchId === fundTransfer?.receiverBranchId) {
                                            return 'Approve (Step 2)';
                                        }
                                        return 'Approve';
                                    })()} 
                                    type="button" 
                                    className="p-2" 
                                    onClick={handleApprovalConfirm} 
                                />
                            </div>
                        </Dialog>

                        <Dialog show={showRejectDialog}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start justify-center">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                        <div className="mt-2">
                                            <p className="text-2xl font-normal text-dark-color mb-4">
                                                Reject Fund Transfer
                                            </p>
                                            {fundTransfer && (
                                                <div className="mt-4 text-sm text-gray-600 mb-4">
                                                    <p><strong>Amount:</strong> {fundTransfer.amountStr}</p>
                                                    <p><strong>From:</strong> {fundTransfer.giverBranch?.code} {fundTransfer.giverBranch?.name}</p>
                                                    <p><strong>To:</strong> {fundTransfer.receiverBranch?.code} {fundTransfer.receiverBranch?.name}</p>
                                                </div>
                                            )}
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Reason for Rejection *
                                                </label>
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                    placeholder="Please provide a reason for rejecting this transfer..."
                                                    rows={4}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                                <ButtonOutline 
                                    label="Cancel" 
                                    type="button" 
                                    className="p-2 mr-3" 
                                    onClick={() => {
                                        setShowRejectDialog(false);
                                        setRejectReason('');
                                    }} 
                                />
                                <ButtonSolid 
                                    label="Reject Transfer" 
                                    type="button" 
                                    className="p-2" 
                                    onClick={handleRejectConfirm}
                                    disabled={!rejectReason.trim()}
                                />
                            </div>
                        </Dialog>

                        {isRefreshing && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <Spinner />
                            </div>
                        )}
                    </React.Fragment>
                )}
            </div>
        </Layout>
    )
}

export default FundTransferPage;