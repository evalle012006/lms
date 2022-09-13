import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { UppercaseFirstLetter } from "@/lib/utils";
import { setClientList } from "@/redux/actions/clientActions";
import AddUpdateClient from "@/components/clients/AddUpdateClientDrawer";

const ClientsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.client.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [groups, setGroups] = useState([]);
    const [branches, setBranches] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
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
            setBranches(branches);
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getListGroup = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'groups/list');
        if (response.success) {
            let groupList = [];
            await response.groups && response.groups.map(group => {
                groupList.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });
            setGroups(groupList);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListClient = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'clients/list');
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    delinquent: client.delinquent === true ? 'Yes' : 'No'
                });
            });
            dispatch(setClientList(clients));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const [columns, setColumns] = useState([
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
            Header: "Last Name",
            accessor: 'lastName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Birthdate",
            accessor: 'birthdate',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "No. Street, Sitio/Purok",
            accessor: 'addressStreetNo',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Barangay District",
            accessor: 'addressBarangayDistrict',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Municipality or City",
            accessor: 'addressMunicipalityCity',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Province",
            accessor: 'addressProvince',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Zip Code",
            accessor: 'addressZipCode',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Contact Number",
            accessor: 'contactNumber',
            Filter: SelectColumnFilter,
            filter: 'includes'
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
            Header: "Status",
            accessor: 'status',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Delinquent",
            accessor: 'delinquent',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        getListClient();
    }

    const actionButtons = [
        <ButtonSolid label="Add Client" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setClient(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setClient(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

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

        mounted && getListBranch();
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
            <AddUpdateClient mode={mode} client={client} groups={groups} branches={branches} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default ClientsPage;