import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setLoanList } from "@/redux/actions/loanActions";
import AddUpdateLoan from "@/components/transactions/AddUpdateLoanDrawer";

const LoansPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.loan.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [loan, setLoan] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [groups, setGroups] = useState([]);
    const [clients, setClients] = useState([]);
    const [platformRoles, setPlatformRoles] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListLoan = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'loans/list');
        if (response.success) {
            dispatch(setLoanList(response.loans));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListGroup = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'groups/list');
        if (response.success) {
            setGroups(response.groups);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListClient = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'clients/list');
        if (response.success) {
            setClients(response.clients);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    // const getListPlatformRoles = async () => {
    //     const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'platform-roles/list');
    //     if (response.success) {
    //         let roles = [];
    //         response.roles && response.roles.map(role => {
    //             roles.push(
    //                 {
    //                     ...role,
    //                     value: role.rep,
    //                     label: UppercaseFirstLetter(role.name)
    //                 }
    //             );
    //         });
    //         setPlatformRoles(roles);
    //     } else {
    //         toast.error('Error retrieving platform roles list.');
    //     }

    //     setLoading(false);
    // }

    const [columns, setColumns] = useState([
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
            Header: "Status",
            accessor: 'status',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Last Name",
            accessor: 'lastName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "First Name",
            accessor: 'firstName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Middle Name",
            accessor: 'middleName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Admission Date",
            accessor: 'admissionDate',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "CBU",
            accessor: 'cbu',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "LCBU",
            accessor: 'lcbu',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Cycle",
            accessor: 'loanCycle',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Date Granted",
            accessor: 'dateGranted',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Pricipal Loan",
            accessor: 'principalLoan',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Active Loan",
            accessor: 'activeLoan',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalance',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "No. of Weeks",
            accessor: 'noOfWeeks',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Co-Maker",
            accessor: 'coMaker',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        getListLoan();
    }

    const actionButtons = [
        <ButtonSolid label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setLoan(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setLoan(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (branch) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'loans/delete', branch)
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
        if ((currentUser.role && currentUser.role.rep !== 1)) {
            router.push('/');
        }
    }, []);


    useEffect(() => {
        let mounted = true;

        mounted && getListLoan();
        mounted && getListGroup();
        mounted && getListClient();
        // mounted && getListPlatformRoles();


        return () => {
            mounted = false;
        };
    }, []);

    // useEffect(() => {
    //     // to set user permissions
    //     let updatedColumns = [];
    //     columns.map(col => {
    //         let temp = {...col}; 
    //         if ((currentUser.role && currentUser.role.rep !== 1)) {        
    //             if (col.accessor === 'role') {
    //                 delete temp.Cell;
    //             }
    //         } else {
    //             // need to set the Options again since it was blank after checking for permissions
    //             if (col.accessor === 'role') {
    //                 temp.Options = platformRoles;
    //                 temp.selectOnChange = updateUser;
    //             }
    //         }

    //         updatedColumns.push(temp);
    //     });

    //     setColumns(updatedColumns);
    // }, [platformRoles]);

    return (
        <Layout actionButtons={actionButtons}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} />}
            </div>
            <AddUpdateLoan mode={mode} loan={loan} groups={groups} clients={clients} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default LoansPage;