import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { setBranchList } from "@/redux/actions/branchActions";
import TableComponent, { AvatarCell, SelectCell, StatusPill } from "@/lib/table";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { PlusIcon } from '@heroicons/react/24/solid';
import { useRouter } from "node_modules/next/router";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { setTransferClientList } from "@/redux/actions/clientActions";
import AddUpdateTransferClient from "@/components/transactions/transfer/AddUpdateTransferClientDrawer";
import Dialog from "@/lib/ui/Dialog";
import { formatPricePhp, getLastWeekdayOfTheMonth } from "@/lib/utils";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import TransferHistoryLOToLOPage from "@/components/transactions/transfer/TransferHistoryLOToLO";
import RevertTransferPage from "@/components/transactions/transfer/RevertTransfer";
import { getApiBaseUrl } from "@/lib/constants";
import { setApprovedTransferList, setPendingTransferList } from "@/redux/actions/transferActions";
import moment from 'moment'

const TransferClientPage = () => {
    const holidayList = useSelector(state => state.systemSettings.holidayList);
    const lastMonthDate = useSelector(state => state.systemSettings.lastDay);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const pendingTransferList = useSelector(state => state.transfer.pendingList);
    const approvedTransferList = useSelector(state => state.transfer.approvedList);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();

    const [selectedTab, setSelectedTab] = useTabs([
        'transfer-giver',
        'transfer-receiver',
        // 'history-branch',
        // 'history-lo',
        'history-revert-transfer'
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'fullName',
            Cell: AvatarCell,
            imgAccessor: "imgUrl",
        },
        {
            Header: "Current Slot No",
            accessor: 'currentSlotNo'
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
            Header: "Source Branch",
            accessor: 'sourceBranchName'
        },
        {
            Header: "Source LO",
            accessor: 'sourceUserName'
        },
        {
            Header: "Source Group",
            accessor: 'sourceGroupName'
        },
        {
            Header: "Target Branch",
            accessor: 'targetBranchName'
        },
        {
            Header: "Target LO",
            accessor: 'targetUserName'
        },
        {
            Header: "Target Group",
            accessor: 'targetGroupName'
        }
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
                    setTimeout(() => {
                        getTransferList();
                    }, 500);
                }
            }
        }
    }

    const handleEditAction = (row) => {
        setMode("edit");
        setClient(row.original);
        // let clientListData = [...clientList];
        // let client = row.original.client;
        // client.label = `${client.lastName}, ${client.firstName} ${client.middleName ? client.middleName : ''}`;
        // client.value = client._id;
        // clientListData.push(client);
        // dispatch(setClientList(clientListData));
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setClient(row.original);
        setShowDeleteDialog(true);
    }

    const handleApprove = (row) => {
        // if (row.original.allowApproved) {
            updateTransferStatus(row.original, 'approved');
        // } else {
        //     toast.error("Group transaction is already closed for the day.");
        // }
    }

    const handleReject = (row) => {
        // if (row.original.allowApproved) {
            updateTransferStatus(row.original, 'reject');
        // } else {
        //     toast.error("Group transaction is already closed for the day.");
        // }
    }

    const handleDelete = () => {
        if (client) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'transactions/transfer-client/delete', { id: client._id })
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Transfer successfully deleted.');
                        setLoading(false);
                        getTransferList();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
            setLoading(false);
        }
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        // getTransferList();
        setMode('add');
        setClient({});
        window.location.reload();
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (pendingTransferList) {
            if (mode === 'all') {
                const tempList = pendingTransferList.map(loan => {
                    let temp = {...loan};
                    
                    temp.selected = selectAll;
                    
                    return temp;
                });

                dispatch(setPendingTransferList(tempList));
            } else if (mode === 'row') {
                const tempList = pendingTransferList.map((loan, index) => {
                    let temp = {...loan};
                    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;
                    }
    
                    return temp;
                });
                dispatch(setPendingTransferList(tempList));
            }
        }
    }

    const handleMultiApprove = async () => {
        let selectedList = pendingTransferList && pendingTransferList.filter(t => t.selected === true);
        
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

                        temp = processTransfer(temp);

                        return temp;
                    });

                    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/transfer-client/approve-reject', selectedList);

                    if (response.success) {
                        setLoading(false);
                        toast.success('Selected clients successfully transferred.');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                }
            }
        } else {
            toast.error('No client selected!');
        }
    }

    const [actionButtons, setActionButtons] = useState();
    const [rowActionButtons, setRowActionButtons] = useState();

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
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
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            // const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            // url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
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
                setLoading(false);
                toast.error(response.message);
            }
        }  else if (currentUser.role.rep === 3) {
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
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getTransferList = async () => {
        // determined all the closed loans it should be highlited with red and option to delete only...
        const previousLastMonthDate = getLastWeekdayOfTheMonth(moment().subtract(1, 'months').format('YYYY'), moment().subtract(1, 'months').format('MM'), holidayList);
        let url = getApiBaseUrl() + 'transactions/transfer-client';
        if (currentUser.role.rep === 1) {
            url = url + '?' + new URLSearchParams({ previousLastMonthDate: previousLastMonthDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setPendingTransferList(response.pending));
                dispatch(setApprovedTransferList(response.approved));
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ _id: currentUser._id, previousLastMonthDate: previousLastMonthDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setPendingTransferList(response.pending));
                dispatch(setApprovedTransferList(response.approved));
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }  else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchId: currentUser.designatedBranchId, previousLastMonthDate: previousLastMonthDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setPendingTransferList(response.pending));
                dispatch(setApprovedTransferList(response.approved));
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    useEffect(() => {
        if ((currentUser?.role?.rep > 3)) {
            router.push('/');
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListBranch(), getTransferList()]);
            resolve(response);
        });

        if (promise) {
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && fetchData();

        return (() => {
            mounted = false;
        })
    }, [currentUser]);

    useEffect(() => {
        if (currentDate === lastMonthDate && currentUser.role.rep < 3) {
            setActionButtons([
                <ButtonOutline label="Approved Selected Transfer" type="button" className="p-2 mr-3" onClick={handleMultiApprove} />,
                <ButtonSolid label="Add Transfer" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
            ]);
            setRowActionButtons([
                { label: 'Approve', action: handleApprove},
                { label: 'Reject', action: handleReject}
                // { label: 'Delete', action: handleDeleteAction}
            ]);
        } else {
            setActionButtons([
                <ButtonSolid label="Add Transfer" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
            ]);
            setRowActionButtons([
                { label: 'Reject', action: handleReject}
                // { label: 'Delete', action: handleDeleteAction}
            ]);
        }
    }, [currentDate, pendingTransferList, approvedTransferList, lastMonthDate]);

    return (
        <Layout actionButtons={currentUser.role.rep <= 3 && actionButtons}>
            <div className="pb-4">
                { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <React.Fragment>
                        <nav className="flex pl-10 bg-white border-b border-gray-300">
                            <TabSelector
                                isActive={selectedTab === "transfer-giver"}
                                onClick={() => setSelectedTab("transfer-giver")}>
                                {/* List of all outgoing transfer that is pending or not successful */}
                                    Giver
                            </TabSelector>
                            <TabSelector
                                isActive={selectedTab === "transfer-receiver"}
                                onClick={() => setSelectedTab("transfer-receiver")}>
                                {/* List of all received transfer that is successful */}
                                    Receiver
                            </TabSelector>
                            {/* <TabSelector
                                isActive={selectedTab === "history-branch"}
                                onClick={() => setSelectedTab("history-branch")}>
                                History Branch to Branch
                            </TabSelector> */}
                            {/* <TabSelector
                                isActive={selectedTab === "history-lo"}
                                onClick={() => setSelectedTab("history-lo")}>
                                History LO to LO
                            </TabSelector> */}
                            {currentUser.role.rep < 3 && (
                                <TabSelector
                                    isActive={selectedTab === "history-revert-transfer"}
                                    onClick={() => setSelectedTab("history-revert-transfer")}>
                                    Revert Transfer
                                </TabSelector>
                            )}
                        </nav>
                        <React.Fragment>
                            <TabPanel hidden={selectedTab !== "transfer-giver"}>
                                <TableComponent columns={columns} data={pendingTransferList} pageSize={50} hasActionButtons={(currentUser.role.rep <= 2 && !isWeekend && !isHoliday) ? true : false} rowActionButtons={!isWeekend && !isHoliday && rowActionButtons} showFilters={false} multiSelect={currentUser.role.rep <= 2 ? true : false} multiSelectActionFn={handleMultiSelect} />
                            </TabPanel>
                            <TabPanel hidden={selectedTab !== "transfer-receiver"}>
                                <TableComponent columns={columns} data={approvedTransferList} pageSize={50}  />
                            </TabPanel>
                            {/* <TabPanel hidden={selectedTab !== "history-branch"}>
                                <div>UNDER CONSTRUCTION</div>
                            </TabPanel>
                            <TabPanel className="px-4" hidden={selectedTab !== "history-lo"}>
                                <TransferHistoryLOToLOPage />
                            </TabPanel> */}
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