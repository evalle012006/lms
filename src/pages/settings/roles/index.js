import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import AddUpdateRole from "@/components/settings/roles/AddUpdateRoleDrawer";
import { setAddUpdateRole, setRoleList } from "@/redux/actions/roleActions";
import { UppercaseFirstLetter } from "@/lib/utils";

const RolesPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.role.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [role, setRole] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [permissions, setPermissions] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListRoles = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'roles/list');
        if (response.success) {
            const roleList = response.roles.map(r => {
                r.name = UppercaseFirstLetter(r.name);
                return r;
            });
            dispatch(setRoleList(roleList));
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

    const getListPermission = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'permissions/list');
        if (response.success) {
            const permissionList = response.permissions.sort((a,b) => a.rep - b.rep);;
            setPermissions(permissionList);
        } else {
            toast.error('Error retrieving permissions list.');
        }

        setLoading(false);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Code",
            accessor: 'shortCode',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        getListRoles();
    }

    const actionButtons = [
        <ButtonSolid label="Add Role" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = async (row) => {
        setMode("edit");
        const roleOriginal = row.original;
        const roleApiUrl = process.env.NEXT_PUBLIC_API_URL + 'roles?';
        const params = { id: roleOriginal._id };
        const response = await fetchWrapper.get(roleApiUrl + new URLSearchParams(params));
        if (response.success) {
            await setRole(response.role);
            await dispatch(setAddUpdateRole(response.role));
            await handleShowAddDrawer();
        } else {
            toast.error(response.message);
        }
    }

    const handleDeleteAction = (row) => {
        setRole(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (role) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'roles/delete', branch)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Branch successfully deleted.');
                        setLoading(false);
                        getListRoles();
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

        mounted && getListRoles();
        mounted && getListPermission();
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
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
            <AddUpdateRole mode={mode} permissions={permissions} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default RolesPage;