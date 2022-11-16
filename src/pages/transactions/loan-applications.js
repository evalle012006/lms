import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { setBranchList } from "@/redux/actions/branchActions";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setLoanList } from "@/redux/actions/loanActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList } from "@/redux/actions/clientActions";
import { formatPricePhp, getEndDate, UppercaseFirstLetter } from "@/lib/utils";
import AddUpdateLoan from "@/components/transactions/AddUpdateLoanDrawer";
import moment from 'moment';

const LoanApplicationPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.loan.list);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [loan, setLoan] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const router = useRouter();

    const getListBranch = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        value: branch._id,
                        label: UppercaseFirstLetter(branch.name)
                    }
                );
            });

            if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                branches = [branches.find(b => b.code === currentUser.designatedBranch)];
            } 
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getListGroup = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, occurence: 'daily' });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, occurence: 'daily' });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });
            dispatch(setGroupList(groups));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    // const getListClient = async () => {
    //     let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list';
    //     if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
    //         url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", loId: currentUser._id, status: 'pending' });
    //     } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
    //         url = url + '?' + new URLSearchParams({ mode: "view_only_no_exist_loan", branchId: branchList[0]._id, status: 'pending' });
    //     }

    //     const response = await fetchWrapper.get(url);
    //     if (response.success) {
    //         let clients = [];
    //         await response.clients && response.clients.map(client => {
    //             clients.push({
    //                 ...client,
    //                 label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
    //                 value: client._id
    //             });
    //         });
    //         dispatch(setClientList(clients));
    //     } else if (response.error) {
    //         toast.error(response.message);
    //     }
    //     setLoading(false);
    // }

    const getListLoan = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ status: 'pending', branchId: branchList[0]._id, loId: currentUser._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ status: 'pending', branchId: branchList[0]._id });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let loanList = [];
            await response.loans && response.loans.map(loan => {
                loanList.push({
                    ...loan,
                    groupName: loan.group.name,
                    principalLoanStr: formatPricePhp(loan.principalLoan),
                    mcbuStr: formatPricePhp(loan.mcbu),
                    activeLoanStr: formatPricePhp(loan.activeLoan),
                    loanBalanceStr: formatPricePhp(loan.loanBalance),
                    fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`)
                });
            });

            dispatch(setLoanList(loanList));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const updateClientStatus = async (data, updatedValue) => {
        setLoading(true);
        const group = data.group;
        let loanData = {...data};
        delete loanData.group;
        delete loanData.client;
        delete loanData.branch;
        delete loanData.principalLoanStr;
        delete loanData.activeLoanStr;
        delete loanData.loanBalanceStr;
        delete loanData.mcbuStr;

        if (loanData.status === 'pending' && updatedValue === 'active') {
            loanData.dateGranted = moment(new Date()).format('YYYY-MM-DD');
            loanData.status = updatedValue;
            loanData.startDate = moment(new Date()).add(1, 'days').format('YYYY-MM-DD');
            loanData.endDate = getEndDate(loanData.dateGranted, group.occurence === 'daily' ? 60 : 24 );
            loanData.mispayment = 0;

            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-loan', loanData)
                .then(response => {
                    if (response.success) {
                        setLoading(false);
                        toast.success('Loan successfully updated.');
                        window.location.reload();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }).catch(error => {
                    console.log(error);
                });
        } else {
            loanData.status = updatedValue;
            // loanData.slotNo = null;
            
            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-loan', loanData)
                .then(response => {
                    if (response.success) {
                        setLoading(false);
                        toast.success('Loan successfully updated.');
                        window.location.reload();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const [columns, setColumns] = useState([]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        // getListClient();
        getListLoan();
        getListGroup();
        setMode('add');
        setLoan({});
    }

    const actionButtons = [
        <ButtonSolid label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setLoan(row.original);
        let clientListData = [...clientList];
        let client = row.original.client;
        client.label = `${client.lastName}, ${client.firstName} ${client.middleName ? client.middleName : ''}`;
        client.value = client._id;
        clientListData.push(client);
        dispatch(setClientList(clientListData));
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setLoan(row.original);
        setShowDeleteDialog(true);
    }

    const handleApprove = (row) => {
        updateClientStatus(row.original, 'active');
    }

    const handleReject = (row) => {
        updateClientStatus(row.original, 'reject');
    }

    const [rowActionButtons, setRowActionButtons] = useState([]);

    const handleDelete = () => {
        if (loan) {
            setLoading(true);
            const loanData = {...loan, deleted: true, deletedBy: currentUser._id, dateDeleted: moment(new Date()).format('YYYY-MM-DD')};
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/delete', loanData)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Loan successfully deleted.');
                        setLoading(false);
                        getListLoan();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (branchList) {
            getListGroup();
            // getListClient();
            getListLoan();
        }
    }, [branchList]);

    useEffect(() => {
        if (groupList) {
            let cols = [];
            cols.push(
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Client Name",
                    accessor: 'fullName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Admission Date",
                    accessor: 'admissionDate',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                // {
                //     Header: "MCBU",
                //     accessor: 'mcbuStr',
                //     Filter: SelectColumnFilter,
                //     filter: 'includes'
                // },
                {
                    Header: "Principal Loan",
                    accessor: 'principalLoanStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Active Loan",
                    accessor: 'activeLoanStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill,
                    // Cell: SelectCell,
                    // Options: statuses,
                    // valueIdAccessor: 'status',
                    // selectOnChange: updateClientStatus,
                    Filter: SelectColumnFilter,
                    filter: 'includes',
                }
            );

            // let updatedColumns = cols.map(col => {
            //     let temp = {...col}; 
            //     if ((currentUser.role && currentUser.role.rep > 3)) {        
            //         if (col.accessor === 'status') {
            //             // delete temp.Cell;
            //             temp.Cell = StatusPill;
            //         }
            //     } else {
            //         // need to set the Options again since it was blank after checking for permissions
            //         if (col.accessor === 'status') {
            //             // temp.Options = statuses;
            //             // temp.selectOnChange = updateClientStatus;
            //         }
            //     }

            //     return temp;
            // });

            let rowActionBtn = [];

            if (currentUser.role.rep <= 3) {
                rowActionBtn = [
                    { label: 'Approve', action: handleApprove},
                    { label: 'Reject', action: handleReject},
                    { label: 'Edit Loan', action: handleEditAction},
                    { label: 'Delete Loan', action: handleDeleteAction}
                ];
            } else {
                rowActionBtn = [
                    { label: 'Edit Loan', action: handleEditAction},
                    { label: 'Delete Loan', action: handleDeleteAction}
                ];
            }

            setColumns(cols);
            setRowActionButtons(rowActionBtn);
        }
    }, [groupList]);

    return (
        <Layout actionButtons={actionButtons}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
            <AddUpdateLoan mode={mode} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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
        </Layout>
    );
}

export default LoanApplicationPage;