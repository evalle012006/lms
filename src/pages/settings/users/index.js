import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { setFilteredData, setIsFiltering, setUser, setUserList } from "@/redux/actions/userActions";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { UppercaseFirstLetter } from "@/lib/utils";
import moment from 'moment';
import { useRouter } from "node_modules/next/router";
import AddUpdateUser from "@/components/settings/users/AddUpdateUserDrawer";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Dialog from "@/lib/ui/Dialog";
import { setBranchList } from "@/redux/actions/branchActions";
import { getApiBaseUrl } from "@/lib/constants";
import UserFilters from "@/components/settings/users/UserFilters";

const TeamPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.user.list);
    const [loading, setLoading] = useState(true);
    const [userListData, setUserListData] = useState([]);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [userData, setUserData] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [platformRoles, setPlatformRoles] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListUsers = async () => {
        let url = getApiBaseUrl() + 'users/list';
        // not in used since user list is for root user only
        if (currentUser.root !== true && currentUser.role.rep === 3) { 
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
        } else if (currentUser.root !== true && currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
        }

        const response = await fetchWrapper.get(url);
        let users = [];
        response.users && response.users.filter(u => !u.root).map((user) => {
            users.push({
                _id: user._id,
                name: user.firstName + ' ' + user.lastName,
                email: user.email,
                number: user.number,
                position: user.position,
                designatedBranch: user.designatedBranch,
                designatedBranchId: user.designatedBranchId,
                roleId: user.role.rep + "-" + user.role.shortCode,
                role: UppercaseFirstLetter(user.role.name),
                loNo: user.loNo,
                profile: user.profile ? user.profile : '',
                lastActivity: user.lastLogin ? moment.utc(user.lastLogin).local().startOf('seconds').fromNow() : '-',
                root: user.root ? user.root : false,
                // hidden columns used for update
                firstName: user.firstName,
                lastName: user.lastName,
                label: user.firstName + ' ' + user.lastName,
                value: user._id,
                transactionType: user.transactionType,
                branchManagerName: user.branchManagerName,
                areaId: user.areaId,
                regionId: user.regionId,
                divisionId: user.divisionId
            });
        });

        dispatch(setUserList(users));
        setLoading(false);
    }

    // if area manager and branch manager status need to popup what branch/es
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
                        loNo: tempUser.loNo,
                        transactionType: tempUser.transactionType
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
        const response = await fetchWrapper.get(getApiBaseUrl() + 'roles/list');
        if (response.success) {
            let roles = [];
            response.roles && response.roles.map(role => {
                roles.push(
                    {
                        ...role,
                        value: role.rep + '-' + role.shortCode,
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
        const response = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
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
            dispatch(setBranchList(branchList));
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
            imgAccessor: "profile",
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
            Filter: SelectColumnFilter,
            filter: 'includes',
        },
        {
            Header: "Transaction Type",
            accessor: 'transactionType',
            Filter: SelectColumnFilter,
            filter: 'includes'
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
        setMode('add');
        setUserData({});
        getListUsers();
    }

    const actionButtons = [
        <ButtonSolid key="add-user" label="Add User" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" key="plus-icon" />, 'left']} />
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

    const [rowActionButtons, setRowActionButtons] = useState([]);

    const handleDelete = () => {
        if (userData) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'users/delete', userData)
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

    const handleResetUserPassword = (row) => {
        let rowOriginal = row.original;
        setLoading(true);
        const apiUrl = getApiBaseUrl() + 'users/reset-password';
        fetchWrapper.post(apiUrl, rowOriginal)
            .then(response => {
                setLoading(false);
                if (response.success) {
                    toast.success('User password was reset. Please login the user and use any kind of password and enter a new password on the next screen.', {autoClose: 5000});
                }
            }).catch(error => {
                console.log(error);
            });
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    const fetchData = async () => {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListUsers(), getListPlatformRoles(), getListBranch()]);
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
    }, []);

    useEffect(() => {
        setUserListData(list);
    }, [list]);

    useEffect(() => {
        let rowActionBtn = [];
        if (currentUser.role && currentUser.role.rep === 1) {
            rowActionBtn = [
                { label: 'Edit', action: handleEditAction },
                { label: 'Delete', action: handleDeleteAction },
                { label: 'Reset Password', action: handleResetUserPassword }
            ];
        } else {
            rowActionBtn = [
                { label: 'Edit', action: handleEditAction },
                { label: 'Delete', action: handleDeleteAction }
            ];
        }

        setRowActionButtons(rowActionBtn);
    }, [currentUser]);

    return (
        <Layout actionButtons={rootUser || (currentUser.role && currentUser.role.rep < 4) ? actionButtons : []}>
            <div className="pb-4">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <UserFilters 
                            userList={list}
                            setUserListData={setUserListData}
                        />
                        <TableComponent 
                            columns={columns} 
                            data={userListData} 
                            showFilters={false} 
                            hasActionButtons={true} 
                            rowActionButtons={rowActionButtons} 
                        />
                    </div>
                )}
            </div>
            <AddUpdateUser mode={mode} user={userData} roles={platformRoles} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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