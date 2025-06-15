/*
 * Fund Transfer Page Component
 * 
 * API Requirements:
 * - Branches should have areaManagerId field for approval workflow
 * - Create update endpoint: PUT /transactions/fund-transfer/update
 * - User role should have short_code field ('area_manager', 'finance', etc.)
 * 
 * Approval Workflow:
 * 1. Area managers approve transfers for their designated branches
 * 2. Finance can only approve after both giver and receiver area managers approve
 * 3. Any authorized user can reject at any stage
 */

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { setBranchList } from "@/redux/actions/branchActions";
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
    const router = useRouter();x
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
    const [approvalAction, setApprovalAction] = useState(''); // 'approve' or 'reject'

    const [selectedTab, setSelectedTab] = useTabs([
        'fund-transfer-transactions',
        'fund-transfer-history'
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    // Columns for Transactions tab
    const [transactionColumns, setTransactionColumns] = useState([
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
    ]);

    // Columns for History tab
    const [historyColumns, setHistoryColumns] = useState([
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
    ]);

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
        if (fundTransfer) {
            setLoading(true);
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
                    setTimeout(() => {
                        getFundTransferList();
                    }, 500);
                } else {
                    toast.error(response.message || `Failed to ${approvalAction} transfer.`);
                }
            } catch (error) {
                toast.error(`Error ${approvalAction}ing transfer.`);
            }
            setLoading(false);
        }
    }

    const handleDelete = async () => {
        if (fundTransfer) {
            setLoading(true);
            try {
                const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/fund-transfer/delete', { 
                    _id: fundTransfer._id 
                });
                if (response.success) {
                    setShowDeleteDialog(false);
                    toast.success('Fund transfer successfully deleted.');
                    getFundTransferList();
                } else {
                    toast.error(response.message || 'Failed to delete fund transfer.');
                }
            } catch (error) {
                toast.error('Error deleting fund transfer.');
            }
            setLoading(false);
        }
    }

    const handleCloseAddDrawer = () => {
        setMode('add');
        setFundTransfer({});
        setShowAddDrawer(false);
        getFundTransferList();
    }

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        
        try {
            if (currentUser.role.rep === 1) {
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
                }
            } else if (currentUser.role.rep === 2) {
                url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
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
                }
            } else if (currentUser.role.rep === 3) {
                const branchCodes = currentUser.designatedBranch;
                url = url + '?' + new URLSearchParams({ branchCode: [branchCodes] });
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
                }
            }
        } catch (error) {
            toast.error('Error loading branches.');
        }
    }

    const getFundTransferList = async () => {
        try {
            let url = getApiBaseUrl() + 'transactions/fund-transfer/list';
            
            // Get pending transfers for Transactions tab
            const transactionsUrl = url + '?' + new URLSearchParams({ 
                status: 'pending'
            });
            
            // Get completed transfers for History tab (approved/rejected)
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

            if (transactionsResponse.success) {
                // Process transactions data to add formatted amounts and status
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

            // Combine approved and rejected for history
            let historyData = [];
            if (historyApprovedResponse.success) {
                historyData = [...historyData, ...historyApprovedResponse.data];
            }
            if (historyRejectedResponse.success) {
                historyData = [...historyData, ...historyRejectedResponse.data];
            }

            if (historyData.length > 0) {
                // Process history data
                const processedHistory = historyData.map(transfer => ({
                    ...transfer,
                    amountStr: new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'PHP' 
                    }).format(transfer.amount || 0)
                }));
                // Sort by approved/rejected date descending
                processedHistory.sort((a, b) => new Date(b.approvedRejectedDate) - new Date(a.approvedRejectedDate));
                dispatch(setFundTransferHistoryList(processedHistory));
            }

        } catch (error) {
            toast.error('Error loading fund transfers.');
        }
    }

    const [actionButtons, setActionButtons] = useState();

    useEffect(() => {
        if (currentUser?.role?.rep > 3) {
            router.push('/');
        }
    }, []);

    const fetchData = async () => {
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
        mounted && fetchData();
        return () => {
            mounted = false;
        }
    }, [currentDate]);

    useEffect(() => {
        if (currentUser.role.rep < 4) {
            setActionButtons([
                <ButtonSolid 
                    key="add-transfer"
                    label="Add Fund Transfer" 
                    type="button" 
                    className="p-2 mr-3" 
                    onClick={handleShowAddDrawer} 
                    icon={[<PlusIcon className="w-5 h-5" />, 'left']} 
                />
            ]);

            // Set dropdown actions based on user permissions and current tab
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
                        
                        // Only area managers and finance can approve
                        const canApprove = ['area_manager', 'finance'].includes(currentUser.role?.short_code);
                        if (!canApprove) return true;
                        
                        // Area managers can only approve for their designated branches
                        if (currentUser.role?.short_code === 'area_manager') {
                            const canApproveGiver = currentUser.designatedBranchId === row.original.giverBranchId && !row.original.giverApprovalDate;
                            const canApproveReceiver = currentUser.designatedBranchId === row.original.receiverBranchId && !row.original.receiverApprovalDate;
                            return !(canApproveGiver || canApproveReceiver);
                        }
                        
                        // Finance can approve only after both area managers approved
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
                        
                        // Only area managers and finance can reject
                        const canReject = ['area_manager', 'finance'].includes(currentUser.role?.short_code);
                        if (!canReject) return true;
                        
                        // Area managers can reject for their designated branches
                        if (currentUser.role?.short_code === 'area_manager') {
                            return currentUser.designatedBranchId !== row.original.giverBranchId && 
                                   currentUser.designatedBranchId !== row.original.receiverBranchId;
                        }
                        
                        // Finance can always reject pending transfers
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
    }, [currentDate, fundTransferList, selectedTab]);

    return (
        <Layout actionButtons={currentUser.role.rep <= 3 && actionButtons}>
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
                    </React.Fragment>
                )}
            </div>
        </Layout>
    )
}

export default FundTransferPage;