import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState, useCallback, useRef } from "react";
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

const FundTransferPage = () => {
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const fundTransferList = useSelector(state => state.fundTransfer.list);
    const fundTransferHistoryList = useSelector(state => state.fundTransfer.historyList);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [mode, setMode] = useState('add');
    const [fundTransfer, setFundTransfer] = useState();
    const [dropDownActions, setDropDownActions] = useState();
    const [approvalAction, setApprovalAction] = useState('');

    const isMountedRef = useRef(true);
    const isLoadingRef = useRef(false);

    const [selectedTab, setSelectedTab] = useTabs([
        'fund-transfer-transactions',
        'fund-transfer-history'
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    // Columns for Transactions tab
    const transactionColumns = [
        {
            Header: "Transfer Date",
            accessor: 'insertedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY') : ''
        },
        {
            Header: "From Branch",
            accessor: 'giverBranch.name'
        },
        {
            Header: "To Branch",
            accessor: 'receiverBranch.name'
        },
        {
            Header: "Amount",
            accessor: 'amountStr'
        },
        {
            Header: "Account",
            accessor: 'account'
        },
        {
            Header: "Description",
            accessor: 'description'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill
        },
        {
            Header: "Requested By",
            accessor: 'insertedBy',
            Cell: ({ value }) => value ? `${value.firstName} ${value.lastName}` : ''
        },
        {
            Header: "Giver Approval",
            accessor: 'giverApprovalStatus',
            Cell: StatusPill
        },
        {
            Header: "Receiver Approval",
            accessor: 'receiverApprovalStatus',
            Cell: StatusPill
        }
    ];

    // Columns for History tab
    const historyColumns = [
        {
            Header: "Transfer Date",
            accessor: 'insertedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY') : ''
        },
        {
            Header: "From Branch",
            accessor: 'giverBranch.name'
        },
        {
            Header: "To Branch",
            accessor: 'receiverBranch.name'
        },
        {
            Header: "Amount",
            accessor: 'amountStr'
        },
        {
            Header: "Account",
            accessor: 'account'
        },
        {
            Header: "Description",
            accessor: 'description'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill
        },
        {
            Header: "Requested By",
            accessor: 'insertedBy',
            Cell: ({ value }) => value ? `${value.firstName} ${value.lastName}` : ''
        },
        {
            Header: "Final Action Date",
            accessor: 'approvedRejectedDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : ''
        },
        {
            Header: "Giver Approval Date",
            accessor: 'giverApprovalDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : 'Pending'
        },
        {
            Header: "Receiver Approval Date",
            accessor: 'receiverApprovalDate',
            Cell: ({ value }) => value ? moment(value).format('MMM DD, YYYY HH:mm') : 'Pending'
        }
    ];

    const handleEditAction = (row) => {
        if (row.original.status === 'pending') {
            setMode("edit");
            setFundTransfer(row.original);
            handleShowAddDrawer();
        } else {
            toast.error("Cannot edit approved/rejected transfers.");
        }
    }

    const handleDeleteAction = (row) => {
        if (row.original.status === 'pending') {
            setFundTransfer(row.original);
            setShowDeleteDialog(true);
        } else {
            toast.error("Cannot delete approved/rejected transfers.");
        }
    }

    const handleApproveAction = (row) => {
        setFundTransfer(row.original);
        setApprovalAction('approve');
        setShowApprovalDialog(true);
    }

    const handleRejectAction = (row) => {
        setFundTransfer(row.original);
        setApprovalAction('reject');
        setShowApprovalDialog(true);
    }

    const handleApprovalConfirm = async () => {
        if (fundTransfer && !isRefreshing) {
            setIsRefreshing(true);
            const url = getApiBaseUrl() + 'transactions/fund-transfer/approve';
            const payload = {
                _id: fundTransfer._id,
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

    const handleDelete = async () => {
        if (fundTransfer && !isRefreshing) {
            setIsRefreshing(true);
            try {
                const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/fund-transfer/delete', { 
                    _id: fundTransfer._id 
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

                const currentBranch = branches.find(branch => branch._id == currentUser.designatedBranchId);
                if (currentBranch) {
                    dispatch(setBranch(currentBranch));
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
                    amountStr: new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'PHP' 
                    }).format(transfer.amount || 0),
                    giverApprovalStatus: transfer.giverApprovalDate ? 'approved' : 'pending',
                    receiverApprovalStatus: transfer.receiverApprovalDate ? 'approved' : 'pending'
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
        if (currentUser?.role?.rep <= 3) {
            const actions = [
                {
                    label: 'Edit Transfer',
                    action: handleEditAction,
                    icon: <PencilIcon className="w-5 h-5" title="Edit Transfer" />,
                    hidden: (row) => row.original.status !== 'pending' || 
                                   (selectedTab === 'fund-transfer-transactions' && 
                                    row.original.insertedById !== currentUser._id)
                },
                {
                    label: 'Approve Transfer',
                    action: handleApproveAction,
                    icon: <CheckIcon className="w-5 h-5" title="Approve Transfer" />,
                    hidden: (row) => {
                        if (selectedTab !== 'fund-transfer-transactions' || row.original.status !== 'pending') {
                            return true;
                        }
                        
                        const canApprove = ['area_manager', 'finance'].includes(currentUser.role?.short_code);
                        if (!canApprove) return true;
                        
                        if (currentUser.role?.short_code === 'area_manager') {
                            const canApproveGiver = currentUser.designatedBranchId === row.original.giverBranchId && !row.original.giverApprovalDate;
                            const canApproveReceiver = currentUser.designatedBranchId === row.original.receiverBranchId && !row.original.receiverApprovalDate;
                            return !(canApproveGiver || canApproveReceiver);
                        }
                        
                        if (currentUser.role?.short_code === 'finance') {
                            return !row.original.giverApprovalDate || !row.original.receiverApprovalDate;
                        }
                        
                        return true;
                    }
                },
                {
                    label: 'Reject Transfer',
                    action: handleRejectAction,
                    icon: <XMarkIcon className="w-5 h-5" title="Reject Transfer" />,
                    hidden: (row) => {
                        if (selectedTab !== 'fund-transfer-transactions' || row.original.status !== 'pending') {
                            return true;
                        }
                        
                        const canReject = ['area_manager', 'finance'].includes(currentUser.role?.short_code);
                        if (!canReject) return true;
                        
                        if (currentUser.role?.short_code === 'area_manager') {
                            return currentUser.designatedBranchId !== row.original.giverBranchId && 
                                   currentUser.designatedBranchId !== row.original.receiverBranchId;
                        }
                        
                        return false;
                    }
                },
                {
                    label: 'Delete Transfer',
                    action: handleDeleteAction,
                    icon: <TrashIcon className="w-5 h-5" title="Delete Transfer" />,
                    hidden: (row) => selectedTab !== 'fund-transfer-transactions' || 
                                   row.original.status !== 'pending' ||
                                   row.original.insertedById !== currentUser._id
                }
            ];

            setDropDownActions(actions);
        }
    }, [currentUser, selectedTab]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
        <Layout actionButtons={currentUser?.role?.rep <= 3 ? 
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
                                    data={fundTransferList || []} 
                                    pageSize={20} 
                                    hasActionButtons={false} 
                                    dropDownActions={dropDownActions} 
                                    dropDownActionOrigin="fund-transfer" 
                                    showFilters={true}
                                />
                            </TabPanel>
                            
                            <TabPanel hidden={selectedTab !== "fund-transfer-history"}>
                                <TableComponent 
                                    columns={historyColumns} 
                                    data={fundTransferHistoryList || []} 
                                    pageSize={20} 
                                    hasActionButtons={false} 
                                    dropDownActions={[]} 
                                    dropDownActionOrigin="fund-transfer-history" 
                                    showFilters={true}
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
                        
                        <Dialog show={showDeleteDialog}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start justify-center">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                        <div className="mt-2">
                                            <p className="text-2xl font-normal text-dark-color">
                                                Are you sure you want to delete this fund transfer?
                                            </p>
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
                                                Are you sure you want to {approvalAction} this fund transfer?
                                            </p>
                                            {fundTransfer && (
                                                <div className="mt-4 text-sm text-gray-600">
                                                    <p><strong>Amount:</strong> {fundTransfer.amountStr}</p>
                                                    <p><strong>From:</strong> {fundTransfer.giverBranch?.name}</p>
                                                    <p><strong>To:</strong> {fundTransfer.receiverBranch?.name}</p>
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
                                    label={`Yes, ${approvalAction}`} 
                                    type="button" 
                                    className="p-2" 
                                    onClick={handleApprovalConfirm} 
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