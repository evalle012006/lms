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

const ViewClientsByGroupPage = ({groupId, status, client, setClientParent, setMode, handleShowAddDrawer, handleShowCoMakerDrawer}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const list = useSelector(state => state.client.list);
    const [loading, setLoading] = useState(true);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    // admin: should be viewed first per branch -> group -> clients
    // am: branch -> group -> clients
    // bm: all groups -> clients
    // lo: assigned groups -> clients
    const getListClient = async () => {
        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list';
        if (groupId) {
            url = url + '?' + new URLSearchParams({ mode: "view_by_group", groupId: groupId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let clients = [];
                await response.clients && response.clients.map(loan => {
                    const name = `${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName}`;
                    clients.push({
                        ...loan.client,
                        ...loan,
                        name: name,
                        middleName: loan.client.middleName ? loan.client.middleName : '',
                        imgUrl: loan.client.profile ? imgpath + '/images/clients/' + loan.client.profile : '',
                        loanStatus: loan.status ? loan.status : '-',
                        activeLoanStr: loan.activeLoan ? formatPricePhp(loan.activeLoan) : '0.00',
                        loanBalanceStr: loan.loanBalance ? formatPricePhp(loan.loanBalance) : '0.00',
                        missPayments: loan.missPayments ?  loan.missPayments : 0,
                        noOfPayment: loan.noOfPayment ? loan.noOfPayment : 0,
                        delinquent: loan.client.delinquent === true ? 'Yes' : 'No',
                        loName: loan.lo.length > 0 ? `${loan.lo[0].lastName}, ${loan.lo[0].firstName}` : '',
                        coMaker: (loan?.coMaker && typeof loan?.coMaker === 'number') ? loan.coMaker : ''
                    });
                });
                dispatch(setClientList(clients));
            } else if (response.error) {
                toast.error(response.message);
            }
        } else if (!currentUser.root) {
            if (currentUser.role.rep > 2) {
                const currentUserBranch = branchList.find(b => b.code === currentUser.designatedBranch);
                if (status === 'offset') {
                    url = url + '?' + new URLSearchParams({ mode: "view_offset", status: status });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let clients = [];
                        await response.clients && response.clients.map(client => {
                            const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                            clients.push({
                                ...client,
                                name: name,
                                middleName: client.middleName ? client.middleName : '',
                                imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                                slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                delinquent: client.delinquent === true ? 'Yes' : 'No',
                                loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : ''
                            });
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
                            let clients = [];
                            await response.clients && response.clients.map(client => {
                                const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                clients.push({
                                    ...client,
                                    name: name,
                                    middleName: client.middleName ? client.middleName : '',
                                    imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                    delinquent: client.delinquent === true ? 'Yes' : 'No',
                                    loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                    coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : ''
                                });
                            });
                            dispatch(setClientList(clients));
                        } else if (response.error) {
                            toast.error(response.message);
                        }
                    } else if (currentUser.role.rep === 3 && branchList.length > 0 && currentUserBranch) {
                        url = url + '?' + new URLSearchParams({ mode: "view_all_by_branch", branchId: currentUserBranch._id, status: status });
                        const response = await fetchWrapper.get(url);
                        if (response.success) {
                            let clients = [];
                            await response.clients && response.clients.map(client => {
                                const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                                clients.push({
                                    ...client,
                                    name: name,
                                    middleName: client.middleName ? client.middleName : '',
                                    imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                    delinquent: client.delinquent === true ? 'Yes' : 'No',
                                    loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                    coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : ''
                                });
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
                    let clients = [];
                    await response.clients && response.clients.map(branch => {
                        branch.clients.map(client => {
                            const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                            clients.push({
                                ...client,
                                name: name,
                                middleName: client.middleName ? client.middleName : '',
                                imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                                slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                                loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                                activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                                loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                                missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                                noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                                delinquent: client.delinquent === true ? 'Yes' : 'No',
                                loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                                branchName: branch.name,
                                coMaker: (client.loans[0]?.coMaker && typeof client.loans[0]?.coMaker === 'number') ? client.loans[0]?.coMaker : ''
                            });
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
                let clients = [];
                await response.clients && response.clients.map(client => {
                    const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
                    clients.push({
                        ...client,
                        name: name,
                        middleName: client.middleName ? client.middleName : '',
                        imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                        groupName: client.groupName ? client.groupName : '-',
                        slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                        loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                        activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '0.00',
                        loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '0.00',
                        missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                        noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                        delinquent: client.delinquent === true ? 'Yes' : 'No',
                        loName: client.lo.length > 0 ? `${client.lo[0].lastName}, ${client.lo[0].firstName}` : '',
                        coMaker: (client.loans?.coMaker && typeof client?.loans.coMaker === 'number') ? client.loans.coMaker : ''
                    });
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

    const handleShowClientInfoModal = (selectedRow) => {
        let clientData = selectedRow.hasOwnProperty("client") ? selectedRow.client : selectedRow;
        dispatch(setClient(clientData));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
    }

    const [rowActionButtons, setRowActionButtons] = useState(status !== 'active' ? [
        { label: 'Edit', action: handleEditAction },
        // { label: 'Delete', action: handleDeleteAction }
    ] : [
        { label: 'Edit', action: handleEditAction },
        { label: 'Update', action: handleCoMakerAction, title: 'Update CoMaker' },
        // { label: 'Delete', action: handleDeleteAction }
    ]);

    const handleDelete = () => {
        if (client) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'clients/delete', {_id: client._id})
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
                    imgAccessor: "imgUrl"
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
                }
            ];
        } else if (currentUser.role.rep === 3) {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "imgUrl"
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
                }
            ];
        } else {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "imgUrl"
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
                }
            ];
        }

        setColumns(activeColumns);
    }, [currentUser]);

    return (
        <React.Fragment>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={groupId ? false : true} rowActionButtons={currentUser.role.rep > 2 && rowActionButtons} showFilters={true} rowClick={handleShowClientInfoModal}/>}
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