import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setClient, setClientList } from "@/redux/actions/clientActions";
import Modal from "@/lib/ui/Modal";
import ClientDetailPage from "./ClientDetailPage";
import { formatPricePhp } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { TabSelector } from "@/lib/ui/tabSelector";
import { TabPanel, useTabs } from "node_modules/react-headless-tabs/dist/react-headless-tabs";

const ViewClientsByGroupPage = ({groupId, status, client, setClientParent, setMode, handleShowAddDrawer, handleShowCoMakerDrawer}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const list = useSelector(state => state.client.list);
    const [activeList, setActiveList] = useState();
    const [excludedList, setExcludedList] = useState();
    const [duplicateList, setDuplicateList] = useState();
    const [loading, setLoading] = useState(true);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    const [selectedTab, setSelectedTab] = useTabs([
        'new-prospects',
        'duplicate-prospects',
        'excluded-prospects'
    ]);

    // admin: should be viewed first per branch -> group -> clients
    // am: branch -> group -> clients
    // bm: all groups -> clients
    // lo: assigned groups -> clients
    const getListClient = async () => {
        let url = getApiBaseUrl() + 'clients/list';
        if (groupId) {
            url = url + '?' + new URLSearchParams({ mode: "view_by_group", groupId: groupId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const clients = await response.clients && response.clients
                    .sort((a, b) => {
                        const dateA = new Date(a.dateAdded);
                        const dateB = new Date(b.dateAdded);
                        return dateB - dateA;
                    })
                    .map(loan => {
                        const name = `${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName}`;
                        const ciName = loan.client?.ciName ? loan.client.ciName : '';
                        return {
                            ...loan.client,
                            ...loan,
                            name: name,
                            middleName: loan.client.middleName ? loan.client.middleName : '',
                            profile: loan.client.profile ? loan.client.profile : '',
                            loanStatus: loan.status ? loan.status : '-',
                            activeLoanStr: loan.activeLoan ? formatPricePhp(loan.activeLoan) : '0.00',
                            loanBalanceStr: loan.loanBalance ? formatPricePhp(loan.loanBalance) : '0.00',
                            missPayments: loan.missPayments ?  loan.missPayments : 0,
                            noOfPayment: loan.noOfPayment ? loan.noOfPayment : 0,
                            delinquent: loan.client.delinquent === true ? 'Yes' : 'No',
                            loName: loan.lo.length > 0 ? `${loan.lo[0].lastName}, ${loan.lo[0].firstName}` : '',
                            coMaker: (loan?.coMaker && typeof loan?.coMaker === 'number') ? loan.coMaker : '',
                            ciName: loan?.ciName ? loan.ciName : ciName,
                        };
                    });
                dispatch(setClientList(clients));
            } else if (response.error) {
                toast.error(response.message);
            }
        } else if (!currentUser.root) {
            if (currentUser.role.rep > 2) {
                const currentUserBranch = branchList.find(b => b.code === currentUser.designatedBranch);
                if (status === 'offset') {
                    url = url + '?' + new URLSearchParams({ mode: "view_offset", status: status, origin: 'client' });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        const clients = await response.clients && response.clients
                            .sort((a, b) => {
                                const dateA = new Date(a.dateAdded);
                                const dateB = new Date(b.dateAdded);
                                return dateB - dateA;
                            })
                            .map(client => {
                                const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                const ciName = client?.ciName ? client.ciName : '';
                                return {
                                    ...client,
                                    name: name,
                                    middleName: client.middleName ? client.middleName : '',
                                    profile: client.profile ? client.profile : '',
                                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                    delinquent: client.delinquent === true ? 'Yes' : 'No',
                                    loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                    coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : '',
                                    ciName: client.loans.length > 0 ? client.loans[0]?.ciName : ciName
                                };
                            });
                        dispatch(setClientList(clients));
                    } else if (response.error) {
                        toast.error(response.message);
                    }
                } else {
                    if (currentUser.role.rep === 4 && branchList.length > 0) {
                        url = url + '?' + new URLSearchParams({ mode: "view_by_lo", loId: currentUser._id, status: status });
                        const response = await fetchWrapper.get(url);
                        if (response.success) {
                            const clients = await response.clients && response.clients
                                .sort((a, b) => {
                                    const dateA = new Date(a.dateAdded);
                                    const dateB = new Date(b.dateAdded);
                                    return dateB - dateA;
                                })
                                .map(client => {
                                    const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                    const ciName = client?.ciName ? client.ciName : '';
                                    return {
                                        ...client,
                                        name: name,
                                        middleName: client.middleName ? client.middleName : '',
                                        profile: client.profile ? client.profile : '',
                                        slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                        loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                        activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                        loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                        missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                        noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                        delinquent: client.delinquent === true ? 'Yes' : 'No',
                                        loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                        coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : '',
                                        ciName: client.loans.length > 0 ? client.loans[0]?.ciName : ciName
                                    };
                                });
                            dispatch(setClientList(clients));
                        } else if (response.error) {
                            toast.error(response.message);
                        }
                    } else if (currentUser.role.rep === 3 && branchList.length > 0 && currentUserBranch) {
                        url = url + '?' + new URLSearchParams({ mode: "view_all_by_branch", branchId: currentUserBranch._id, status: status });
                        const response = await fetchWrapper.get(url);
                        if (response.success) {
                            const clients = await response.clients && response.clients
                                .sort((a, b) => {
                                    const dateA = new Date(a.dateAdded);
                                    const dateB = new Date(b.dateAdded);
                                    return dateB - dateA;
                                })
                                .map(client => {
                                    const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                    const ciName = client?.ciName ? client.ciName : '';
                                    return {
                                        ...client,
                                        name: name,
                                        middleName: client.middleName ? client.middleName : '',
                                        profile: client.profile ? client.profile : '',
                                        slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                        loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                        activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                        loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                        missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                        noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                        delinquent: client.delinquent === true ? 'Yes' : 'No',
                                        loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                        coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : '',
                                        ciName: client.loans.length > 0 ? client.loans[0]?.ciName : ciName
                                    }
                                });
                            dispatch(setClientList(clients));
                        } else if (response.error) {
                            toast.error(response.message);
                        }
                    }
                }
            } else if (branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ mode: "view_all_by_branch_codes", currentUserId: currentUser._id, status: status });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    const clients = await response.clients && response.clients
                        .sort((a, b) => {
                            const dateA = new Date(a.dateAdded);
                            const dateB = new Date(b.dateAdded);
                            return dateB - dateA;
                        })
                        .map(branch => {
                            branch.clients.map(client => {
                                const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                const ciName = client?.ciName ? client.ciName : '';
                                return {
                                    ...client,
                                    name: name,
                                    middleName: client.middleName ? client.middleName : '',
                                    profile: client.profile ? client.profile : '',
                                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                    delinquent: client.delinquent === true ? 'Yes' : 'No',
                                    loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                    branchName: branch.name,
                                    coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : '',
                                    ciName: client.loans.length > 0 ? client.loans[0]?.ciName : ciName
                                };
                            });
                        });
                    dispatch(setClientList(clients));
                } else if (response.error) {
                    toast.error(response.message);
                }
            }
        }  else {
            const response = await fetchWrapper.get(url + '?' + new URLSearchParams({ status: status }));
            if (response.success) {
                const clients = await response.clients && response.clients.map(client => {
                    const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                    const ciName = client?.ciName ? client.ciName : '';
                    return {
                        ...client,
                        name: name,
                        middleName: client.middleName ? client.middleName : '',
                        profile: client.profile ? client.profile : '',
                        groupName: client.groupName ? client.groupName : '-',
                        slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                        loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                        activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                        loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                        missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                        noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                        delinquent: client.delinquent === true ? 'Yes' : 'No',
                        loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                        coMaker: (client.loans?.coMaker && typeof client?.loans.coMaker === 'number') ? client.loans.coMaker : '',
                        ciName: client.loans.length > 0 ? client.loans[0]?.ciName : ciName
                    };
                });
                dispatch(setClientList(clients));
            } else if (response.error) {
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([]);

    const handleEditAction = (row) => {
        setMode("edit");
        let clientData = row.original.hasOwnProperty("client") ? row.original.client : row.original;
        setClientParent(clientData);
        handleShowAddDrawer();
    }

    const handleCoMakerAction = (row) => {
        let clientData = row.original.hasOwnProperty("client") ? row.original.client : row.original;
        setClientParent(clientData);
        handleShowCoMakerDrawer();
    }

    const handleDeleteAction = (row) => {
        let clientData = row.original.hasOwnProperty("client") ? row.original.client : row.original;
        setClientParent(clientData);
        setShowDeleteDialog(true);
    }

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setClientParent({});
    }

    const handleTransferAction = (row) => {
        setLoading(true)
        let clientData = row.original.hasOwnProperty("client") ? row.original.client : row.original;
        if (clientData.status == 'pending')  {
            if (clientData.hasOwnProperty("archived") && clientData.archived == true) {
                clientData.archived = false;
                clientData.archivedBy = currentUser._id;
            } else {
                clientData.archived = true;
                clientData.archivedBy = currentUser._id;
            }
            delete clientData.group;
            delete clientData.loans;
            delete clientData.lo;
            fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData)
                .then(response => {
                    setTimeout(() => {
                        fetchData();
                    }, 800);
                    toast.success('Client successfully updated.');
                }).catch(error => {
                    console.log(error);
                });
        } else {
            toast.error('Client must be in pending status to transfer.');
        }
    }

    const handleShowClientInfoModal = (selectedRow) => {
        let clientData = selectedRow.hasOwnProperty("client") ? selectedRow.client : selectedRow;
        dispatch(setClient(clientData));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
    }

    const handleUnmarkDuplicateAction = async (row) => {
        let clientData = row.original.hasOwnProperty("client") ? row.original.client : row.original;
        clientData.duplicate = false;
        
        const response = await fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData);
        if (response.success) {
            toast.success('Client successfully updated.');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            toast.error('Failed to update client.');
        }
    }

    const [rowActionButtons, setRowActionButtons] = useState(status !== 'active' ? [
        { label: 'Edit', action: handleEditAction },
        { label: 'Transfer', action: handleTransferAction },
        // { label: 'Delete', action: handleDeleteAction }
    ] : [
        { label: 'Edit', action: handleEditAction },
        { label: 'Update', action: handleCoMakerAction, title: 'Update CoMaker' },
        // { label: 'Delete', action: handleDeleteAction }
    ]);

    const [rowActionButtonsAdmin, setRowActionButtonsAdmin] = useState([
        { label: 'Edit', action: handleEditAction },
        { label: 'Transfer', action: handleTransferAction },
        { label: 'Update', action: handleCoMakerAction, title: 'Update CoMaker' },
        { label: 'Unmark as Duplicate', action: handleUnmarkDuplicateAction, title: 'Unmark as Duplicate' },
    ]);

    const handleDelete = () => {
        if (client) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'clients/delete', {_id: client._id})
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Client successfully deleted.');
                        setLoading(false);
                        getListClient();
                        setClientParent({});
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const fetchData = async () => {
        setLoading(true);
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListClient()]);
            resolve(response);
        });

        if (promise) {
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && fetchData();
        
        return () => {
            mounted = false;
        };
    }, [branchList]);

    useEffect(() => {
        let activeColumns = [];
        if (currentUser.role.rep === 4) {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Loan Status",
                    accessor: 'loanStatus',
                    Cell: StatusPill
                },
                {
                    Header: "Active Loan",
                    accessor: 'activeLoanStr'
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments'
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
            ];
        } else if (currentUser.role.rep === 3) {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Loan Status",
                    accessor: 'loanStatus',
                    Cell: StatusPill
                },
                {
                    Header: "Active Loan",
                    accessor: 'activeLoanStr',
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments',
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
            ];
        } else {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Branch",
                    accessor: 'branchName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Loan Status",
                    accessor: 'loanStatus',
                    Cell: StatusPill
                },
                {
                    Header: "Active Loan",
                    accessor: 'activeLoanStr',
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments',
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
            ];
        }

        setColumns(activeColumns);
    }, [currentUser]);

    useEffect(() => {
        if (list) {
            const active = list.filter(client => !client.archived && !client?.duplicate);
            setActiveList(active);
            const excluded = list.filter(client => client.archived);
            setExcludedList(excluded);
            const duplicates = list.filter(client => client.duplicate);
            setDuplicateList(duplicates);
        }
    }, [list]);

    return (
        <React.Fragment>
            <div className="pb-4">
                {loading ?
                    (
                        // <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        // </div>
                    ) : (
                        <React.Fragment>
                            {status == 'pending' ? (
                                <React.Fragment>
                                    <nav className="flex pl-10 bg-white border-b border-gray-300">
                                        <TabSelector
                                            isActive={selectedTab === "new-prospects"}
                                            onClick={() => setSelectedTab("new-prospects")}>
                                                New Prospects
                                        </TabSelector>
                                        <TabSelector
                                            isActive={selectedTab === "duplicate-prospects"}
                                            onClick={() => setSelectedTab("duplicate-prospects")}>
                                                Marked as Duplicate Prospects
                                        </TabSelector>
                                        <TabSelector
                                            isActive={selectedTab === "excluded-prospects"}
                                            onClick={() => setSelectedTab("excluded-prospects")}>
                                                Excluded Prospects
                                        </TabSelector>
                                    </nav>
                                    <TabPanel hidden={selectedTab !== "new-prospects"}>
                                        <TableComponent columns={columns} data={activeList} hasActionButtons={groupId ? false : true} rowActionButtons={currentUser.role.rep > 2 && rowActionButtons} showFilters={true} rowClick={handleShowClientInfoModal}/>
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== "duplicate-prospects"}>
                                        <TableComponent columns={columns} data={duplicateList} hasActionButtons={currentUser.role.rep < 3} rowActionButtons={currentUser.role.rep < 3 ? rowActionButtonsAdmin : []} showFilters={true} rowClick={handleShowClientInfoModal}/>
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== "excluded-prospects"}>
                                        <TableComponent columns={columns} data={excludedList} hasActionButtons={groupId ? false : true} rowActionButtons={currentUser.role.rep > 2 && rowActionButtons} showFilters={true} rowClick={handleShowClientInfoModal}/>
                                    </TabPanel>
                                </React.Fragment>
                            ) : (
                                <TableComponent columns={columns} data={list} hasActionButtons={groupId ? false : true} rowActionButtons={currentUser.role.rep > 2 && rowActionButtons} showFilters={true} rowClick={handleShowClientInfoModal}/>
                            )}
                        </React.Fragment>
                    )}
            </div>
            <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="70rem">
                <ClientDetailPage />
            </Modal>
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
                    <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={handleCancelDelete} />
                    <ButtonSolid label="Yes, delete" type="button" className="p-2" onClick={handleDelete} />
                </div>
            </Dialog>
        </React.Fragment>
    );
}

export default ViewClientsByGroupPage;