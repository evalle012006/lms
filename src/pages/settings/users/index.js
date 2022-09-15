import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { setUser, setUserList } from "@/redux/actions/userActions";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { UppercaseFirstLetter } from "@/lib/utils";
import moment from 'moment';
import { useRouter } from "node_modules/next/router";
import AddUpdateUser from "@/components/settings/users/AddUpdateUserDrawer";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Dialog from "@/lib/ui/Dialog";

const TeamPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.user.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [userData, setUserData] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [platformRoles, setPlatformRoles] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();
    const [branches, setBranches] = useState([]);

    const getListUsers = async () => {
        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'users/list');
        let users = [];
        response.users && response.users.filter(u => !u.root).map((user) => {
            users.push({
                _id: user._id,
                name: user.firstName + ' ' + user.lastName,
                email: user.email,
                number: user.number,
                position: user.position,
                designatedBranch: user.designatedBranch,
                roleId: user.role.rep,
                role: UppercaseFirstLetter(user.role.name),
                loNo: user.loNo,
                imgUrl: user.profile ? imgpath + '/images/profiles/' + user.profile : '',
                lastActivity: user.lastLogin ? moment.utc(user.lastLogin).local().startOf('seconds').fromNow() : '-',
                root: user.root ? user.root : false,
                // hidden columns used for update
                firstName: user.firstName,
                lastName: user.lastName
            });
        });
        dispatch(setUserList(users));
        setLoading(false);
    }

    const updateUser = (u, updatedValue) => {
        setLoading(true);
        const tempUser = { ...u };
        const selectedRole = platformRoles.find(role => role.rep == updatedValue);
        tempUser.role = JSON.stringify(selectedRole);
        delete tempUser.roleId;
        fetchWrapper.sendData('/api/users/', tempUser)
            .then(response => {
                if (currentUser.email === tempUser.email) {
                    dispatch(setUser({
                        ...currentUser,
                        firstName: tempUser.firstName,
                        lastName: tempUser.lastName,
                        email: tempUser.email,
                        number: tempUser.number,
                        position: tempUser.position,
                        role: tempUser.role,
                        designatedBranch: tempUser.designatedBranch,
                        loNo: tempUser.loNo
                    }));
                }
                // update list
                const userList = list.map(o => {
                    let obj = { ...o };
                    if (obj.email === tempUser.email) {
                        obj.roleId = selectedRole.rep;
                        obj.role = UppercaseFirstLetter(selectedRole.name)
                    }

                    return obj;
                });

                dispatch(setUserList(userList));
                setLoading(false);
            }).catch(error => {
                console.log(error);
            });
    }

    const getListPlatformRoles = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'roles/list');
        if (response.success) {
            let roles = [];
            response.roles && response.roles.map(role => {
                roles.push(
                    {
                        ...role,
                        value: role.rep,
                        label: UppercaseFirstLetter(role.name)
                    }
                );
            });
            setPlatformRoles(roles);
        } else {
            toast.error('Error retrieving platform roles list.');
        }

        setLoading(false);
    }

    const getListBranch = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
        if (response.success) {
            let branchList = [];
            response.branches && response.branches.map(branch => {
                branchList.push(
                    {
                        ...branch,
                        value: branch.code,
                        label: UppercaseFirstLetter(branch.name)
                    }
                );
            });
            setBranches(branchList);
        } else {
            toast.error('Error retrieving branch list.');
        }

        setLoading(false);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'name',
            Cell: AvatarCell,
            imgAccessor: "imgUrl",
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Email Address",
            accessor: 'email',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Phone Number",
            accessor: 'number',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Position",
            accessor: 'position',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Platform Role",
            accessor: 'role',
            Cell: SelectCell,
            Options: platformRoles,
            valueIdAccessor: 'roleId',
            selectOnChange: updateUser,
            Filter: SelectColumnFilter,
            filter: 'includes',
        },
        {
            Header: "Designated Branch",
            accessor: 'designatedBranch',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Last Activity",
            accessor: 'lastActivity',
            Filter: SelectColumnFilter,
            filter: 'includes',
        },
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        getListUsers();
    }

    const actionButtons = [
        <ButtonSolid label="Add User" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        let rowOriginal = row.original;
        const selectedRole = platformRoles.find(role => UppercaseFirstLetter(role.name) === rowOriginal.role);
        if (selectedRole) {
            rowOriginal = { ...rowOriginal, role: selectedRole };
        }
        setUserData(rowOriginal);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setUserData(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (userData) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'users/delete', userData)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('User successfully deleted.');
                        setLoading(false);
                        getListUsers();
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

        mounted && getListUsers();
        mounted && getListPlatformRoles();
        mounted && getListBranch();


        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        // to set user permissions
        let updatedColumns = [];
        columns.map(col => {
            let temp = {...col}; 
            if ((currentUser.role && currentUser.role.rep !== 1)) {        
                if (col.accessor === 'role') {
                    delete temp.Cell;
                }
            } else {
                // need to set the Options again since it was blank after checking for permissions
                if (col.accessor === 'role') {
                    temp.Options = platformRoles;
                    temp.selectOnChange = updateUser;
                }
            }

            updatedColumns.push(temp);
        });

        setColumns(updatedColumns);
    }, [platformRoles]);

    return (
        <Layout actionButtons={rootUser || (currentUser.role && currentUser.role.rep === 1) ? actionButtons : []}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} showFilters={false} hasActionButtons={rootUser || (currentUser.role && currentUser.role.rep === 1) ? true : false} rowActionButtons={rootUser || (currentUser.role && currentUser.role.rep === 1) ? rowActionButtons : []} />}
            </div>
            <AddUpdateUser mode={mode} user={userData} roles={platformRoles} branches={branches} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default TeamPage;