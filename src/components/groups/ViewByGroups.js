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
import { setGroupList } from "@/redux/actions/groupActions";
import AddUpdateGroup from "@/components/groups/AddUpdateGroupDrawer";
import { UppercaseFirstLetter } from "@/lib/utils";
import { setBranchList } from "@/redux/actions/branchActions";
import { setUserList } from "@/redux/actions/userActions";

const ViewByGroupsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.group.list);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [group, setGroup] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const router = useRouter();
    const { uuid } = router.query;

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

    const getListUser = async () => {
        if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4) && branchList.length > 0) {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
            url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push(
                        {
                            ...u,
                            value: u._id,
                            label: UppercaseFirstLetter(name)
                        }
                    );
                });
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        } else if (branchList.length > 0) {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push(
                        {
                            ...u,
                            value: u._id,
                            label: UppercaseFirstLetter(name)
                        }
                    );
                });
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-all';
        
        if (uuid && userList.length > 0 ) {
            const lo = userList.find(u => u._id === uuid);

            if (lo) {
                url = url + '?' + new URLSearchParams({ branchId: lo.designatedBranchId, loId: uuid });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let groups = [];
                    await response.groups && response.groups.map(group => {
                        groups.push({
                            ...group,
                            day: UppercaseFirstLetter(group.day)
                        });
                    });
                    groups.sort((a, b) => { return a.groupNo - b.groupNo; });
                    dispatch(setGroupList(groups));
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            }
        } else {
            if (currentUser.root !== true && currentUser.role.rep === 4&& branchList.length > 0) { 
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let groups = [];
                    await response.groups && response.groups.map(group => {
                        groups.push({
                            ...group,
                            day: UppercaseFirstLetter(group.day)
                        });
                    });
                    groups.sort((a, b) => { return a.groupNo - b.groupNo; });
                    dispatch(setGroupList(groups));
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let groups = [];
                    await response.groups && response.groups.map(group => {
                        groups.push({
                            ...group,
                            day: UppercaseFirstLetter(group.day)
                        });
                    });
                    groups.sort((a, b) => { return a.groupNo - b.groupNo; });
                    dispatch(setGroupList(groups));
                    setLoading(false);
                } else if (response.error) {
                    setLoading(false);
                    toast.error(response.message);
                }
            }
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'name'
        },
        {
            Header: "Branch",
            accessor: 'branchName'
        },
        {
            Header: "Occurence",
            accessor: 'occurence'
        },
        {
            Header: "Day",
            accessor: 'day'
        },
        {
            Header: "Day No.",
            accessor: 'dayNo'
        },
        {
            Header: "Time",
            accessor: 'time'
        },
        {
            Header: "Group No.",
            accessor: 'groupNo'
        },
        {
            Header: "Loan Officer",
            accessor: 'loanOfficerName'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setGroup({});
        getListGroup();
    }

    const actionButtons = [
        <ButtonSolid label="Add Group" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setGroup(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setGroup(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (group) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'groups/delete', {_id: group._id})
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Group successfully deleted.');
                        setLoading(false);
                        getListGroup();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    } else {
                        setLoading(false);
                        console.log(response);
                    }
                });
        }
    }

    const handleRowClick = (selected) => {
        router.push('/groups/clients/' + selected._id);
    };

    // useEffect(() => {
    //     if ((currentUser.role && currentUser.role.rep !== 1)) {
    //         router.push('/');
    //     }
    // }, []);


    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();
        // mounted && getListPlatformRoles();

        if (uuid) {
            mounted && getListGroup();
        }

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        if (branchList) {
            getListUser();
        }
    }, [branchList]);

    useEffect(() => {
        if (branchList && userList) {
            getListGroup();
        }
    }, [branchList, userList]);

    return (
        <React.Fragment>
            {currentUser.role.rep < 3 ? (
                <div className="pb-4">
                    {loading ?
                        (
                            <div className="absolute top-1/2 left-1/2">
                                <Spinner />
                            </div>
                        ) : <TableComponent columns={columns} data={list} pageSize={50} hasActionButtons={false} showFilters={false} rowClick={handleRowClick} />}
                </div>
            ) : (
                <Layout actionButtons={currentUser.role.rep > 2 && actionButtons}>
                    <div className="pb-4">
                        {loading ?
                            (
                                <div className="absolute top-1/2 left-1/2">
                                    <Spinner />
                                </div>
                            ) : (
                                <div>
                                    <TableComponent columns={columns} data={list} pageSize={50} hasActionButtons={currentUser.role.rep > 2 ? true : false} rowActionButtons={currentUser.role.rep > 2 && rowActionButtons} showFilters={false} rowClick={handleRowClick} />
                                </div>
                            )}
                    </div>
                    <AddUpdateGroup mode={mode} group={group} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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
            )}
        </React.Fragment>
    );
}

export default ViewByGroupsPage;