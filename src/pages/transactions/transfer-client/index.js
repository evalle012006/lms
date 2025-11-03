import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { setBranchList } from "@/redux/actions/branchActions";
import TableComponent, { AvatarCell, StatusPill } from "@/lib/table";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { PlusIcon, XMarkIcon, WrenchScrewdriverIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid';
import { useRouter } from "node_modules/next/router";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import AddUpdateTransferClient from "@/components/transactions/transfer/AddUpdateTransferClientDrawer";
import Dialog from "@/lib/ui/Dialog";
import { getLastWeekdayOfTheMonth, isEndMonthDate, getLastWorkingDayOfWeek } from "@/lib/date-utils";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import RevertTransferPage from "@/components/transactions/transfer/RevertTransfer";
import { getApiBaseUrl } from "@/lib/constants";
import { setTransferList } from "@/redux/actions/transferActions";
import moment from 'moment'
import TransferFilters from "@/components/transactions/transfer/TransferFilters";

const TransferClientPage = () => {
    const holidayList = useSelector(state => state.holidays.list);
    const lastMonthDate = useSelector(state => state.systemSettings.lastDay);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const transferList = useSelector(state => state.transfer.list);
    
    // State for filtered data
    const [transferListData, setTransferListData] = useState([]);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();
    const [dropDownActions, setDropDownActions] = useState();

    const [selectedTab, setSelectedTab] = useTabs([
        'transfer-transaction',
        'history-revert-transfer'
    ]);

    const handleShowAddDrawer = () => {
        setMode('add');
        setClient({});
        setShowAddDrawer(true);
    }

    // UPDATED: Removed SelectColumnFilter from columns
    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'fullName',
            Cell: AvatarCell,
            imgAccessor: "profile",
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "Target Collection",
            accessor: 'targetCollectionStr'
        },
        {
            Header: "Actual Collection",
            accessor: 'actualCollectionStr'
        },
        {
            Header: "Total MCBU",
            accessor: 'totalMcbuStr'
        },
        {
            Header: "Loan Status",
            accessor: 'loanStatus',
            Cell: StatusPill
        },
        {
            Header: "Source Slot No",
            accessor: 'currentSlotNo'
        },
        {
            Header: "Source Branch",
            accessor: 'sourceBranchName',
        },
        {
            Header: "Source LO",
            accessor: 'sourceUserName',
        },
        {
            Header: "Source Group",
            accessor: 'sourceGroupName',
        },
        {
            Header: "Target Slot No",
            accessor: 'selectedSlotNo'
        },
        {
            Header: "Target Branch",
            accessor: 'targetBranchName',
        },
        {
            Header: "Target LO",
            accessor: 'targetUserName',
        },
        {
            Header: "Target Group",
            accessor: 'targetGroupName',
        },
        {
            Header: "Transfer Status",
            accessor: 'transferStatus',
            Cell: StatusPill,
        },
        {
            Header: "Error Message",
            accessor: 'errorMsg',
        },
    ]);

    const checkGroupsStatus = async (groupIds) => {
        let errorMsg;
        const url = getApiBaseUrl()
                    + 'transactions/cash-collections/update-group-transaction-status?' 
                    + new URLSearchParams({ groupIds: groupIds, currentDate: currentDate, currentTime: currentTime });
        const response = await fetchWrapper.get(url);
            
        if (response.success) {
            const data = response.data;
            if (data.length > 0) {
                const pendings = data.filter(cc => cc.groupStatus === 'pending');
                if (pendings.length > 0) {
                    errorMsg = "One or more group transactions are not yet closed!";
                }
            } else {
                errorMsg = "No transaction found for the day";
            }
        }

        return errorMsg;
    }

    const processTransfer = (data) => {
        let transfer = {...data};

        transfer.branchId = transfer.targetBranchId;
        transfer.loId = transfer.targetUserId;
        transfer.groupId = transfer.targetGroupId;
        transfer.occurence = transfer.sourceGroup?.occurence;
        transfer.sameLo = transfer.clientLoId === transfer.targetUserId;
        transfer.loToLo = transfer.targetBranchId === transfer.clientBranchId;
        transfer.branchToBranch = transfer.targetBranchId !== transfer.clientBranchId;
        transfer.oldGroupId = transfer.clientGroupId;
        transfer.oldBranchId = transfer.clientBranchId;
        transfer.oldLoId = transfer.clientLoId;
        transfer.dateAdded = currentDate;
        transfer.status = "approved";

        return transfer;
    }

    // FIXED: Optimized to avoid unnecessary calls to getTransferList()
    const updateTransferStatus = async (data, status) => {
        setLoading(true);
        
        let transfer = {...data};
        if (transfer.withError && status == 'approved') {
            setLoading(false);
            toast.error(transfer.errorMsg)
        } else {
            const errorMsg = await checkGroupsStatus([transfer.sourceGroupId, transfer.targetGroupId]);
            if (errorMsg) {
                setLoading(false);
                toast.error(errorMsg);
            } else {
                let msg = 'Selected client successfully transferred.';
                if (status === "approved") {
                    transfer = processTransfer(transfer);
                } else {
                    transfer.status = "reject";
                    transfer.dateAdded = currentDate;
                    msg = 'Selected transfer was rejected.';
                }

                const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/transfer-client/approve-reject', [transfer]);

                if (response.success) {
                    console.log(response)
                    setLoading(false);
                    toast.success(msg);
                    // FIXED: Call getTransferList directly instead of setTimeout
                    await getTransferList();
                }
            }
        }
    }

    const handleEditAction = (row) => {
        setMode("edit");
        setClient(row);
        setShowAddDrawer(true);
    }

    const handleDeleteAction = (row) => {
        setClient(row);
        setShowDeleteDialog(true);
    }

    const handleApprove = (row) => {
        updateTransferStatus(row.original, 'approved');
    }

    const handleReject = (row) => {
        updateTransferStatus(row, 'reject');
    }

    // FIXED: Optimized to avoid unnecessary calls
    const handleDelete = async () => {
        if (client) {
            setLoading(true);
            try {
                const response = await fetchWrapper.postCors(getApiBaseUrl() + 'transactions/transfer-client/delete', { id: client._id });
                
                if (response.success) {
                    setShowDeleteDialog(false);
                    toast.success('Transfer successfully deleted.');
                    // FIXED: Call getTransferList directly instead of setTimeout
                    await getTransferList();
                } else if (response.error) {
                    toast.error(response.message);
                } else {
                    console.log(response);
                }
            } catch (error) {
                console.error('Delete error:', error);
                toast.error('An error occurred while deleting the transfer.');
            } finally {
                setLoading(false);
            }
        }
    }

    // FIXED: Only refresh data when needed
    const handleCloseAddDrawer = (shouldRefresh = false) => {
        setMode('add');
        setClient({});
        setShowAddDrawer(false);
        
        // Only refresh data if something was actually changed
        if (shouldRefresh) {
            getTransferList();
        }
    }

    const handleMultiSelect = (mode, selectAll, rows, currentPageIndex) => {
        if (!transferList) return;
    
        const pageSize = 20; // Match this with your table's pageSize
        const startIndex = currentPageIndex * pageSize;
        const endIndex = Math.min(startIndex + pageSize, transferList.length);
    
        const updateTransferList = () => {
            if (mode === 'all') {
                return transferList.map((loan, index) => {
                    let temp = { ...loan };
                    
                    // Only update items on the current page that meet the conditions
                    if (index >= startIndex && index < endIndex) {
                        // Check conditions before updating selection
                        if (temp.status === 'pending' && !temp.withError) {
                            // Set to the new selectAll value (true or false)
                            temp.selected = selectAll;
                        }
                    }
                    
                    return temp;
                });
            } else if (mode === 'row') {
                const absoluteIndex = currentPageIndex * pageSize + rows.index;
                
                return transferList.map((loan, index) => {
                    let temp = { ...loan };
                    
                    // Toggle selection for the specific row if conditions met
                    if (index === absoluteIndex && temp.status === 'pending' && !temp.withError) {
                        temp.selected = !temp.selected;
                    }
    
                    return temp;
                });
            }
    
            return transferList; // Return unchanged list if mode is invalid
        };
    
        try {
            const updatedList = updateTransferList();
            // NOTE: Don't re-sort here to avoid confusing users during multi-select
            dispatch(setTransferList(updatedList));
        } catch (error) {
            console.error('Error updating transfer list:', error);
        }
    };

    // FIXED: Optimized to avoid window.location.reload()
    const handleMultiApprove = async () => {
        setLoading(true);
        let selectedList = transferList && transferList.filter(t => t.selected === true);
        
        if (selectedList.length > 0) {
            const sourceGroupIds = selectedList.map(sg => sg.sourceGroupId);
            const targetGroupIds = selectedList.map(sg => sg.targetGroupId);
            const groupIds = [...sourceGroupIds, ...targetGroupIds];

            if (selectedList.some(s => s.withError)) {
                setLoading(false);
                toast.error('One or more selected clients have error. Please check and try again.');
            } else {
                const errorMsg = await checkGroupsStatus(groupIds);
                if (errorMsg) {
                    setLoading(false);
                    toast.error(errorMsg);
                } else {
                    selectedList = selectedList.map(transfer => {
                        let temp = {...transfer};
                        temp.status = "approved";
                        temp.currentDate = currentDate;
                        return temp;
                    });

                    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/transfer-client/approve-reject', selectedList);

                    if (response.success) {
                        setLoading(false);
                        toast.success('Selected clients successfully transferred.');
                        // FIXED: Call getTransferList directly instead of window.location.reload()
                        await getTransferList();
                    }
                }
            }
        } else {
            setLoading(false);
            toast.error('No client selected!');
        }
    }

    // FIXED: Optimized to avoid unnecessary calls
    const handleRepair = async (data) => {
        if (data) {
            if (data.errorMsg?.includes('slot number')) {
                toast.info('Please contact system administrator!');
            } else {
                setLoading(true);
                try {
                    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/transfer-client/repair', { _id: data._id });
                    
                    if (response.success) {
                        setLoading(false);
                        toast.success('Transfer successfully repaired.');
                        // FIXED: Call getTransferList directly instead of setTimeout
                        await getTransferList();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                } catch (error) {
                    console.error('Repair error:', error);
                    toast.error('An error occurred while repairing the transfer.');
                } finally {
                    setLoading(false);
                }
            }
        }
    }

    const [actionButtons, setActionButtons] = useState();

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
                } else if (response.error) {
                    toast.error(response.message);
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
                } else if (response.error) {
                    toast.error(response.message);
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
                } else if (response.error) {
                    toast.error(response.message);
                }
            }
        } catch (error) {
            console.error('Error fetching branch list:', error);
            toast.error('Failed to fetch branch list.');
        }
    }

    // FIXED: Add sorting function to prioritize pending transfers with no errors
    const sortTransferList = (transfers) => {
        return transfers.sort((a, b) => {
            // Priority 1: Pending with no errors (highest priority)
            const aIsPendingNoError = a.status === 'pending' && !a.withError;
            const bIsPendingNoError = b.status === 'pending' && !b.withError;
            
            if (aIsPendingNoError && !bIsPendingNoError) return -1;
            if (!aIsPendingNoError && bIsPendingNoError) return 1;
            
            // Priority 2: Pending with errors (second priority)
            const aIsPendingWithError = a.status === 'pending' && a.withError;
            const bIsPendingWithError = b.status === 'pending' && b.withError;
            
            if (aIsPendingWithError && !bIsPendingWithError) return -1;
            if (!aIsPendingWithError && bIsPendingWithError) return 1;
            
            // Priority 3: All other statuses (maintain current order)
            return 0;
        });
    };

    const getTransferList = async () => {
        const holidays = holidayList.map(holiday => holiday.date);
        const previousMonthEndDate = getLastWeekdayOfTheMonth(moment().subtract(1, 'months').format('YYYY'), moment().subtract(1, 'months').format('MM'), holidays);
        const endMonthDate = isEndMonthDate(currentDate, holidays);
        const previousLastMonthDate = endMonthDate ? currentDate : previousMonthEndDate;
        
        if (!previousLastMonthDate) {
            return;
        }

        let url = getApiBaseUrl() + 'transactions/transfer-client';
        
        try {
            if (currentUser.role.rep === 1) {
                url = url + '?' + new URLSearchParams({ previousLastMonthDate: previousLastMonthDate });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    // FIXED: Sort the data before dispatching to Redux
                    const sortedData = sortTransferList([...response.data]);
                    dispatch(setTransferList(sortedData));
                } else if (response.error) {
                    toast.error(response.message);
                }
            } else if (currentUser.role.rep === 2) {
                url = url + '?' + new URLSearchParams({ _id: currentUser._id, previousLastMonthDate: previousLastMonthDate });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    // FIXED: Sort the data before dispatching to Redux
                    const sortedData = sortTransferList([...response.data]);
                    dispatch(setTransferList(sortedData));
                } else if (response.error) {
                    toast.error(response.message);
                }
            } else if (currentUser.role.rep === 3) {
                url = url + '?' + new URLSearchParams({ branchId: currentUser.designatedBranchId, previousLastMonthDate: previousLastMonthDate });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    // FIXED: Sort the data before dispatching to Redux
                    const sortedData = sortTransferList([...response.data]);
                    dispatch(setTransferList(sortedData));
                } else if (response.error) {
                    toast.error(response.message);
                }
            }
        } catch (error) {
            console.error('Error fetching transfer list:', error);
            toast.error('Failed to fetch transfer list.');
        }
    }

    useEffect(() => {
        if (currentUser?.role?.rep > 3) {
            router.push('/');
        }
    }, [currentUser?.role?.rep, router]); // FIXED: Add proper dependencies

    // FIXED: Add guards to prevent unnecessary API calls
    const fetchData = async () => {
        // Don't fetch if user data isn't loaded yet
        if (!currentUser?.role?.rep) {
            return;
        }
        
        setLoading(true);
        try {
            await Promise.all([getListBranch(), getTransferList()]);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('An error occurred while fetching data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        if (mounted && currentDate && holidayList.length > 0) {
            fetchData();
        }

        return (() => {
            mounted = false;
        })
    }, [currentDate, holidayList.length]); // FIXED: Use holidayList.length instead of the whole array

    // UPDATED: Sync transferListData with transferList
    useEffect(() => {
        if (transferList) {
            setTransferListData(transferList);
        }
    }, [transferList]);

    useEffect(() => {
        if (currentUser.role.rep < 4) {
            const holidays = holidayList.map(holiday => holiday.date);
            const lastWorkingDayOfWeek = getLastWorkingDayOfWeek(currentDate, holidays);

            if (currentUser.role.rep < 3 && lastWorkingDayOfWeek.format("YYYY-MM-DD") == currentDate && !isHoliday && !isWeekend) {
                setActionButtons([
                    <ButtonOutline key="approve-btn" label="Approved Selected Transfer" type="button" className="p-2 mr-3" onClick={handleMultiApprove} disabled={loading} />,
                    <ButtonSolid key="add-btn" label="Add Transfer" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
                ]);
            } else {
                setActionButtons([
                    <ButtonSolid key="add-btn" label="Add Transfer" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
                ]);
            }

            setDropDownActions([
                {
                    label: 'Edit Transfer',
                    action: handleEditAction,
                    icon: <PencilIcon className="w-5 h-5" title="Edit Transfer" />,
                    hidden: true
                },
                {
                    label: 'Reject Transfer',
                    action: handleReject,
                    icon: <XMarkIcon className="w-5 h-5" title="Reject Transfer" />,
                    hidden: true
                },
                {
                    label: 'Repair Transfer',
                    action: handleRepair,
                    icon: <WrenchScrewdriverIcon className="w-5 h-5" title="Repair Transfer" />,
                    hidden: true
                },
                {
                    label: 'Delete Transfer',
                    action: handleDeleteAction,
                    icon: <TrashIcon className="w-5 h-5" title="Delete Transfer" />,
                    hidden: true
                },
            ]);
        }
    }, [currentDate, transferList, lastMonthDate]);

    return (
        <Layout actionButtons={currentUser.role.rep <= 3 && actionButtons}>
            <div className="pb-4">
                { loading ? (
                    <Spinner />
                ) : (
                    <React.Fragment>
                        <nav className="flex pl-10 bg-white border-b border-gray-300">
                            <TabSelector
                                isActive={selectedTab === "transfer-transaction"}
                                onClick={() => setSelectedTab("transfer-transaction")}>
                                    Transactions
                            </TabSelector>
                            {currentUser.role.rep < 3 && (
                                <TabSelector
                                    isActive={selectedTab === "history-revert-transfer"}
                                    onClick={() => setSelectedTab("history-revert-transfer")}>
                                    Revert Transfer
                                </TabSelector>
                            )}
                        </nav>
                        <React.Fragment>
                            <TabPanel hidden={selectedTab !== "transfer-transaction"}>
                                {/* FIXED: Show sorting info only when there are pending transfers */}
                                {transferList && transferList.some(t => t.status === 'pending') && (
                                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 mx-4 mt-4">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm text-blue-700">
                                                    <strong>Sorted by Priority:</strong> Pending transfers without errors appear first for easier processing.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* UPDATED: Added custom TransferFilters component */}
                                <TransferFilters 
                                    transferList={transferList}
                                    setTransferListData={setTransferListData}
                                />
                                {/* UPDATED: Changed data to transferListData and showFilters to false */}
                                <TableComponent 
                                    columns={columns} 
                                    data={transferListData} 
                                    pageSize={20} 
                                    hasActionButtons={false} 
                                    dropDownActions={dropDownActions} 
                                    dropDownActionOrigin="transfer" 
                                    showFilters={false} 
                                    multiSelect={currentUser.role.rep <= 3 ? true : false} 
                                    multiSelectActionFn={handleMultiSelect} 
                                />
                            </TabPanel>
                            {currentUser.role.rep < 3 && (
                                <TabPanel className="px-4" hidden={selectedTab !== "history-revert-transfer"}>
                                    <RevertTransferPage />
                                </TabPanel>
                            )}
                        </React.Fragment> 
                        <AddUpdateTransferClient mode={mode} client={client} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
                        <Dialog show={showDeleteDialog}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start justify-center">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                        <div className="mt-2">
                                            <p className="text-2xl font-normal text-dark-color">Are you sure you want to delete?</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                                <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowDeleteDialog(false)} />
                                <ButtonSolid label="Yes, delete" type="button" className="p-2" onClick={handleDelete} />
                            </div>
                        </Dialog>
                    </React.Fragment>
                )}
            </div>
        </Layout>
    )
}

export default TransferClientPage;