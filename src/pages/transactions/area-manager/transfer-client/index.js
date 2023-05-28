import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
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
import { formatPricePhp } from "@/lib/utils";

const TransferClientPage = () => {
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const transferList = useSelector(state => state.client.transferList);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Last Name",
            accessor: 'lastName',
            Cell: AvatarCell,
            imgAccessor: "imgUrl",
        },
        {
            Header: "First Name",
            accessor: 'firstName'
        },
        {
            Header: "Client Status",
            accessor: 'status',
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
        },
        // {
        //     Header: "Client Status",
        //     accessor: 'status',
        // }
    ]);

    const updateTransferStatus = async (data, status) => {
        setLoading(true);
        
        let transfer = {...data};
        let msg = 'Selected client successfully transferred.';

        if (status === "approved") {
            const clientData = transfer.client;

            transfer.branchId = transfer.targetBranchId;
            transfer.loId = transfer.targetUserId;
            transfer.groupId = transfer.targetGroupId;
            transfer.sameLo = clientData.loId === transfer.targetUserId;
            transfer.oldGroupId = clientData.groupId;
            transfer.oldBranchId = clientData.branchId;
            transfer.oldLoId = clientData.loId;
            transfer.dateAdded = currentDate;
            transfer.status = "approved";
        } else {
            transfer.status = "rejected";
            transfer.dateAdded = currentDate;
            msg = 'Selected transfer was rejected.';
        }

        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client/approve-reject', [transfer]);

        if (response.success) {
            setLoading(false);
            toast.success(msg);
            setTimeout(() => {
                getTransferList();
            }, 500);
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
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client/delete', { id: client._id })
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
        getTransferList();
        setMode('add');
        setClient({});
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (transferList) {
            if (mode === 'all') {
                const tempList = transferList.map(loan => {
                    let temp = {...loan};

                    temp.selected = selectAll;
                    
                    return temp;
                });
                dispatch(setTransferClientList(tempList));
            } else if (mode === 'row') {
                const tempList = transferList.map((loan, index) => {
                    let temp = {...loan};
    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;
                    }
    
                    return temp;
                });
                dispatch(setTransferClientList(tempList));
            }
        }
    }

    const handleMultiApprove = async () => {
        let selectedList = transferList && transferList.filter(t => t.selected === true);
        
        if (selectedList.length > 0) {
            selectedList = selectedList.map(transfer => {
                let temp = {...transfer};
                const clientData = transfer.client;

                temp.branchId = temp.targetBranchId;
                temp.loId = temp.targetUserId;
                temp.groupId = temp.targetGroupId;
                temp.sameLo = clientData.loId === temp.targetUserId;
                temp.oldGroupId = clientData.groupId;
                temp.oldBranchId = clientData.branchId;
                temp.oldLoId = clientData.loId;
                temp.dateAdded = currentDate;
                temp.status = "approved";

                return temp;
            });

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client/approve-reject', selectedList);

            if (response.success) {
                setLoading(false);
                toast.success('Selected clients successfully transferred.');
                setTimeout(() => {
                    getTransferList();
                }, 500);
            }
        } else {
            toast.error('No client selected!');
        }
    }

    const actionButtons = [
        <ButtonOutline label="Approved Selected Transfer" type="button" className="p-2 mr-3" onClick={handleMultiApprove} />,
        <ButtonSolid label="Add Transfer" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const rowActionButtons = [
        { label: 'Approve', action: handleApprove},
        { label: 'Reject', action: handleReject},
        // { label: 'Edit', action: handleEditAction},
        { label: 'Delete', action: handleDeleteAction}
    ];

    const getTransferList = async () => {
        // determined all the closed loans it should be highlited with red and option to delete only...
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const list = [];
                response.data.map(transfer => {
                    let temp = {...transfer};
                    const client = transfer.client;
                    const loan = transfer.loans.length > 0 ? transfer.loans[0] : [];

                    temp.lastName = client.lastName;
                    temp.firstName = client.firstName;
                    temp.status = client.status;

                    if (transfer.loans.length > 0) {
                        temp.amountRelease = loan.amountRelease;
                        temp.amountReleaseStr = temp.amountRelease > 0 ? formatPricePhp(temp.amountRelease) : '-';
                        temp.loanBalance = loan.loanBalance;
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : '-';
                        temp.targetCollection = loan.amountRelease - loan.loanBalance;
                        temp.targetCollectionStr = temp.targetCollection > 0 ? formatPricePhp(temp.targetCollection) : '-';
                        temp.actualCollection = loan.amountRelease - loan.loanBalance;
                        temp.actualCollectionStr = temp.actualCollection > 0 ? formatPricePhp(temp.actualCollection) : '-';
                        temp.totalMcbu = loan.mcbu;
                        temp.totalMcbuStr = temp.totalMcbu > 0 ? formatPricePhp(temp.totalMcbu) : '-';
                        temp.loanStatus = loan.status;

                        if (temp.loanStatus === "closed") {
                            temp.delinquent = true;
                        }
                    }

                    list.push(temp);
                });
                dispatch(setTransferClientList(list));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ _id: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const list = [];
                response.data.map(transfer => {
                    let temp = {...transfer};
                    const client = transfer.client;
                    const loan = transfer.loans.length > 0 ? transfer.loans[0] : [];

                    temp.lastName = client.lastName;
                    temp.firstName = client.firstName;
                    temp.status = client.status;

                    if (transfer.loans.length > 0) {
                        temp.amountRelease = loan.amountRelease;
                        temp.amountReleaseStr = temp.amountRelease > 0 ? formatPricePhp(temp.amountRelease) : '-';
                        temp.loanBalance = loan.loanBalance;
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : '-';
                        temp.targetCollection = loan.amountRelease - loan.loanBalance;
                        temp.targetCollectionStr = temp.targetCollection > 0 ? formatPricePhp(temp.targetCollection) : '-';
                        temp.actualCollection = loan.amountRelease - loan.loanBalance;
                        temp.actualCollectionStr = temp.actualCollection > 0 ? formatPricePhp(temp.actualCollection) : '-';
                        temp.totalMcbu = loan.mcbu;
                        temp.totalMcbuStr = temp.totalMcbu > 0 ? formatPricePhp(temp.totalMcbu) : '-';
                        temp.loanStatus = loan.status;

                        if (temp.loanStatus === "closed") {
                            temp.delinquent = true;
                        }
                    }

                    list.push(temp);
                });
                dispatch(setTransferClientList(list));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    useEffect(() => {
        if ((currentUser?.role?.rep > 2)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const getListBranch = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
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
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            } else if (currentUser.role.rep === 2) {
                url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch });
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
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            }
        }

        mounted && getListBranch();
        mounted && getTransferList();

        return (() => {
            mounted = false;
        })
    }, [currentUser]);

    return (
        <Layout actionButtons={(currentUser.role.rep <= 2 && !isWeekend && !isHoliday) && actionButtons}>
            <div className="pb-4">
                { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <React.Fragment>
                        <TableComponent columns={columns} data={transferList} pageSize={50} hasActionButtons={(currentUser.role.rep <= 2 && !isWeekend && !isHoliday) ? true : false} rowActionButtons={!isWeekend && !isHoliday && rowActionButtons} showFilters={false} multiSelect={currentUser.role.rep <= 2 ? true : false} multiSelectActionFn={handleMultiSelect} />
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