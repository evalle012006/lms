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

const GroupsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.group.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [group, setGroup] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [branches, setBranches] = useState([]);
    const [users, setUsers] = useState([]);
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

            if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                branches = [branches.find(b => b.code === currentUser.designatedBranch)];
            } 
            
            setBranches(branches);
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getListUser = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
        if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4) && branches.length > 0) {
            url = url + '?' + new URLSearchParams({ branchCode: branches[0].code });
        }
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
            setUsers(userList);
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getListGroup = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branches.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branches[0]._id, loId: currentUser._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branches.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branches[0]._id });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    day: UppercaseFirstLetter(group.day)
                });
            });
            dispatch(setGroupList(groups));
        } else if (response.error) {
            toast.error(response.message);
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
            Header: "Branch",
            accessor: 'branchName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Occurence",
            accessor: 'occurence',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Day",
            accessor: 'day',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Day No.",
            accessor: 'dayNo',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Time",
            accessor: 'time',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Group No.",
            accessor: 'groupNo',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Officer",
            accessor: 'loanOfficerName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
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
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const handleRowClick = (selected) => {
        router.push('./groups/' + selected._id);
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


        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (branches) {
            getListUser();
            getListGroup();
        }
    }, [branches]);

    return (
        <Layout actionButtons={actionButtons}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} rowClick={handleRowClick} />}
            </div>
            <AddUpdateGroup mode={mode} group={group} branches={branches} users={users} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default GroupsPage;