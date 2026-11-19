import React, { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "@/redux/actions/userActions";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { UppercaseFirstLetter } from "@/lib/utils";
import moment from 'moment';
import { useRouter } from "node_modules/next/router";
// NEW: drawer replaced by /settings/users/add and /settings/users/edit/[uuid] pages.
// AddUpdateUserDrawer is intentionally left in place (unused here) rather than
// deleted — see project notes on keeping it as a temporary fallback.
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Dialog from "@/lib/ui/Dialog";
import { setBranchList } from "@/redux/actions/branchActions";
import { getApiBaseUrl } from "@/lib/constants";
import UserFilters from "@/components/settings/users/UserFilters";
import { setAreaList } from "@/redux/actions/areaActions";
import { setRegionList } from "@/redux/actions/regionActions";
import { setDivisionList } from "@/redux/actions/divisionActions";
import { PasswordRevealModal } from "@/components/settings/users/AddUpdateUserPage";


const TeamPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const branchOptions = useSelector(state => state.branch.list);

    // Users are fetched one page at a time. This stays in local state on purpose:
    // state.user.list is shared with other screens and must not be replaced by a single page.
    const [userListData, setUserListData] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState({ search: '', role: '', position: '', branch: '' });
    const [positionOptions, setPositionOptions] = useState([]);
    const positionsLoaded = useRef(false);
    const listRequestId = useRef(0);

    // NEW: userData is now only needed for the delete confirmation dialog —
    // add/edit no longer need local state since they live on their own pages.
    const [userData, setUserData] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // NEW: mirrors AddUpdateUserPage.js's passwordModal state — holds the
    // plaintext temp password just long enough for the admin to copy it.
    const [passwordModal, setPasswordModal] = useState(null); // { password, context: 'reset', userName }
    const [resettingUserId, setResettingUserId] = useState(null);

    const [platformRoles, setPlatformRoles] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListUsers = async () => {
        const requestId = ++listRequestId.current;
        setListLoading(true);

        try {
            const params = new URLSearchParams({ page, limit: pageSize });
            if (filters.search) params.set('search', filters.search);
            if (filters.role) params.set('role', filters.role);
            if (filters.position) params.set('position', filters.position);
            if (filters.branch) params.set('branch', filters.branch);
            if (!positionsLoaded.current) params.set('includePositions', '1');

            const response = await fetchWrapper.get(getApiBaseUrl() + 'users/list-paginated?' + params.toString());

            // A newer request (fast paging / typing) has started — drop this answer
            if (requestId !== listRequestId.current) return;

            if (!response?.success) {
                toast.error(response?.message || 'Error retrieving users list.');
                return;
            }

            const { pagination } = response;

            // Page no longer exists (e.g. last user on the last page was deleted)
            if (response.users.length === 0 && pagination.total > 0 && page > pagination.totalPages) {
                setPage(pagination.totalPages);
                return;
            }

            if (response.positions) {
                setPositionOptions(response.positions);
                positionsLoaded.current = true;
            }

            setTotal(pagination.total);
            setUserListData(response.users.map((user) => ({
                _id: user._id,
                name: user.firstName + ' ' + user.lastName,
                email: user.email,
                number: user.number,
                position: user.position,
                designatedBranch: user.designatedBranch,
                designatedBranchId: user.designatedBranchId,
                roleId: user?.role?.rep + "-" + user?.role?.shortCode,
                role: UppercaseFirstLetter(user?.role?.name),
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
            })));
        } catch (error) {
            console.log(error);
            if (requestId === listRequestId.current) toast.error('Error retrieving users list.');
        } finally {
            if (requestId === listRequestId.current) {
                setListLoading(false);
                setLoading(false);
            }
        }
    }

    const handleFiltersChange = (nextFilters) => {
        setFilters(nextFilters);
        setPage(1);
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
                setUserListData(prev => prev.map(o => {
                    let obj = { ...o };
                    if (obj.email === tempUser.email) {
                        obj.roleId = selectedRole.rep;
                        obj.role = UppercaseFirstLetter(selectedRole.name)
                    }

                    return obj;
                }));
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


    const getListArea = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'areas/list');
        if (response.success) {
            let list = response.areas?.map(area => ({
                ...area,
                value: area._id,
                label: UppercaseFirstLetter(area.name)
            })) ?? [];
            dispatch(setAreaList(list));
        } else {
            toast.error('Error retrieving area list.');
        }

        setLoading(false);
    }

    const getListRegion = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'regions/list');
        if (response.success) {
            let list = response.regions?.map(region => ({
                ...region,
                 value: region._id,
                label: UppercaseFirstLetter(region.name)
            })) ?? [];
            dispatch(setRegionList(list));
        } else {
            toast.error('Error retrieving area list.');
        }

        setLoading(false);
    }

    const getListDivision = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'divisions/list');
        if (response.success) {
            let list = response.divisions?.map(division => ({
                ...division,
                value: division._id,
                label: UppercaseFirstLetter(division.name)
            })) ?? [];
            dispatch(setDivisionList(list));
        } else {
            toast.error('Error retrieving area list.');
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

    // NEW: was setShowAddDrawer(true) — now navigates to the dedicated add page.
    const handleShowAddPage = () => {
        router.push('/settings/users/add');
    }

    const actionButtons = [
        <ButtonSolid key="add-user" label="Add User" type="button" className="p-2 mr-3" onClick={handleShowAddPage} icon={[<PlusIcon className="w-5 h-5" key="plus-icon" />, 'left']} />
    ];

    // NEW: was setMode('edit') + setUserData(rowOriginal) + handleShowAddDrawer() —
    // now navigates to the edit page, which loads the user itself via userId.
    const handleEditAction = (row) => {
        router.push(`/settings/users/edit/${row.original._id}`);
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

    // CHANGED: aligned with the Reset Password action on the edit page
    // (AddUpdateUserPage.js's handleResetPassword) — same confirmation
    // copy, same minimal payload ({_id} instead of the whole row object,
    // which the endpoint never needed), and now actually surfaces
    // response.tempPassword through the shared PasswordRevealModal instead
    // of discarding it and showing stale "use any kind of password" text
    // that predates real temp-password generation.
    const handleResetUserPassword = (row) => {
        const rowOriginal = row.original;
        if (!confirm(
            `Reset password for ${rowOriginal.name}? ` +
            `This will also remove their fingerprint login — they'll need to sign in with a new password and re-register biometrics.`
        )) return;

        setResettingUserId(rowOriginal._id);
        fetchWrapper.post(getApiBaseUrl() + 'users/reset-password', { _id: rowOriginal._id })
            .then(response => {
                if (response.success) {
                    setPasswordModal({
                        password: response.tempPassword,
                        context: 'reset',
                        userName: rowOriginal.name,
                    });
                } else {
                    toast.error(response.message || 'Failed to reset password.');
                }
            })
            .catch(error => {
                console.log(error);
                toast.error('An error occurred while resetting the password.');
            })
            .finally(() => {
                setResettingUserId(null);
            });
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    const fetchData = async () => {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([
                getListPlatformRoles(), 
                getListBranch(),
                getListArea(),
                getListDivision(),
                getListRegion(),
            ]);
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

    // Fetch the current page whenever the page, size or filters change
    useEffect(() => {
        if (currentUser.role && currentUser.role.rep > 2) return;
        getListUsers();
    }, [page, pageSize, filters]);

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
            {passwordModal && (
                <PasswordRevealModal
                    password={passwordModal.password}
                    context={passwordModal.context}
                    userName={passwordModal.userName}
                    onClose={() => {
                        setPasswordModal(null);
                        toast.success('Password reset. The user will need to sign in with the new password and re-register biometrics.', { autoClose: 6000 });
                    }}
                />
            )}
            <div className="pb-4">
                {(loading || resettingUserId) ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <UserFilters
                            filters={filters}
                            onChange={handleFiltersChange}
                            roleOptions={platformRoles}
                            positionOptions={positionOptions}
                            branchOptions={branchOptions}
                        />
                        <div className={listLoading ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                            <TableComponent
                                columns={columns}
                                data={userListData}
                                showFilters={false}
                                hasActionButtons={true}
                                rowActionButtons={rowActionButtons}
                                serverPagination={{
                                    page,
                                    pageSize,
                                    total,
                                    onPageChange: setPage,
                                    onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
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