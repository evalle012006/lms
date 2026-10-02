import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import { setBranchList } from "@/redux/actions/branchActions";
import AddUpdateBranch from "@/components/branches/AddUpdateBranchDrawer";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { getApiBaseUrl } from "@/lib/constants";
import { UppercaseFirstLetter } from "@/lib/utils";
import { setAreaList } from "@/redux/actions/areaActions";

const BranchesPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [branch, setBranch] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [platformRoles, setPlatformRoles] = useState([]);
    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const handleClientFlowVersionChange = async (branchRow, newValue) => {
        const updatedBranch = { ...branchRow, clientFlowVersion: newValue };

        fetchWrapper.post(getApiBaseUrl() + 'branches', updatedBranch)
            .then(response => {
                if (response.success) {
                    toast.success(`Client flow version updated to ${newValue}.`);
                    setTimeout(() => {
                        getListBranch();
                    }, 3000);
                } else if (response.error) {
                    toast.error(response.message);
                }
            })
            .catch(error => {
                console.log(error);
                toast.error('Failed to update client flow version.');
            });
    }

    const handleLockBranchTransaction = async (row) => {
        const branch = { ...row.original };
        let updatedBranch = { ...branch, lockTransaction: !branch.lockTransaction };

        const apiUrl = getApiBaseUrl() + 'branches';
        fetchWrapper.post(apiUrl, updatedBranch)
            .then(response => {
                if (response.success) {
                    toast.success("Selected branch successfully locked.");
                    setTimeout(() => {
                        getListBranch();
                    }, 3000);
                } else if (response.error) {
                    toast.error(response.message);
                }
            }).catch(error => {
                console.log(error);
            });
    }

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            // const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            // url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Code",
            accessor: 'code',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Phone Number",
            accessor: 'phoneNumber',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Address",
            accessor: 'address',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Email",
            accessor: 'email',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Client Flow Version",
            accessor: 'clientFlowVersion',
            Cell: SelectCell,
            Options: [
                { value: 'v1', label: 'v1' },
                { value: 'v2', label: 'v2' },
            ],
            selectOnChange: handleClientFlowVersionChange,
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setBranch({});
        getListBranch();
    }

    const actionButtons = [
        <ButtonSolid label="Add Branch" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setBranch(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setBranch(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Lock', action: handleLockBranchTransaction },
    ];

    const handleDelete = () => {
        if (branch) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'branches/delete', branch)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Branch successfully deleted.');
                        setLoading(false);
                        getListBranch();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 3)) {
            router.push('/');
        }
    }, []);


    useEffect(() => {
        let mounted = true;

        mounted && getListBranch() && getListArea()

        return () => {
            mounted = false;
        };
    }, []);


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
    const filteredBranches = list?.filter((branch) => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) return true;

    return (
        branch.code?.toLowerCase().includes(search) ||
        branch.name?.toLowerCase().includes(search) ||
        branch.phoneNumber?.toLowerCase().includes(search) ||
        branch.address?.toLowerCase().includes(search) ||
        branch.email?.toLowerCase().includes(search) ||
        branch.clientFlowVersion?.toLowerCase().includes(search)
    );
}) || [];

    return (
        <Layout actionButtons={currentUser.root || (currentUser.role && currentUser.role.rep < 2) ? actionButtons : null}>
    <div className="pb-4">
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search branches..."
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-10 pr-10 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/10"/>

            {searchTerm && (
                <button
                    type="button" onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search">
                    <XMarkIcon className="h-4 w-4" />
                </button>
            )}
            </div>
        {/* Branch Count */}
        <div className="hidden whitespace-nowrap text-sm text-gray-500 sm:block">
            <span className="font-semibold text-gray-700">
                {filteredBranches.length}
            </span>
            {" "}branches
        </div>
        </div>
    </div>

    {/* Branch Table */}
    {loading ? (
        <Spinner />
    ) : (
        <TableComponent
            columns={columns}
            data={filteredBranches}
            hasActionButtons={true}
            rowActionButtons={rowActionButtons}
            showFilters={false}/>
    )}</div>
            <AddUpdateBranch mode={mode} branch={branch} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default BranchesPage;