import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
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
import { isOfflineModeActive, OFFLINE_MODE_DEFAULT_DAYS, OFFLINE_MODE_MAX_DAYS } from "@/lib/offline-mode";

const BranchesPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);

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

    const canToggleCsf = !!(currentUser.root || currentUser.role?.rep === 1);
    const canToggleOfflineMode = canToggleCsf; // same rule: root / admin (rep 1)

    const handleToggleOfflineMode = (branchRow) => {
        const next = !isOfflineModeActive(branchRow); // active -> turn off; off OR expired -> turn on
        let days;
        if (next) {
            const input = window.prompt(
                `Turn OFFLINE MODE ON for ${branchRow.name}?\n\nReal-time client face verification will be SKIPPED at loan approval; the branch uploads each client's photo instead. It turns itself off after the number of days you enter.\n\nDays (1-${OFFLINE_MODE_MAX_DAYS}):`,
                String(OFFLINE_MODE_DEFAULT_DAYS)
            );
            if (input === null) return;
            days = parseInt(input, 10);
            if (!Number.isInteger(days) || days < 1 || days > OFFLINE_MODE_MAX_DAYS) {
                toast.error(`Enter a whole number from 1 to ${OFFLINE_MODE_MAX_DAYS}.`);
                return;
            }
        } else if (!window.confirm(`Turn offline mode OFF for ${branchRow.name}?\n\nClient face verification is required again at loan approval.`)) {
            return;
        }

        fetchWrapper.post(getApiBaseUrl() + 'branches/set-skip-client-face-verify', {
            branchId: branchRow._id, skipClientFaceVerify: next, ...(next ? { days } : {}),
        })
            .then(response => {
                if (response.success) {
                    toast.success(`Offline mode ${next ? 'enabled' : 'disabled'} for ${branchRow.name}.`);
                    getListBranch();
                } else {
                    toast.error(response.message || 'Failed to update offline mode.');
                }
            })
            .catch(() => toast.error('Failed to update offline mode.'));
    };

    const handleToggleCsf = (branchRow) => {
        const next = branchRow.csfEnabled === false; // currently off -> turn on
        const message = next
            ? `Turn CSF back ON for ${branchRow.name}? Groups whose own CSF setting is also on will resume CSF collection / CSF In.`
            : `Turn CSF OFF for ALL groups in ${branchRow.name}?\n\nNo CSF collection or CSF In will be recorded. The minimum CSF amount is added to the MCBU minimum instead.`;
        if (!window.confirm(message)) return;

        fetchWrapper.post(getApiBaseUrl() + 'branches/set-csf-enabled', { branchId: branchRow._id, csfEnabled: next })
            .then(response => {
                if (response.success) {
                    toast.success(`CSF ${next ? 'enabled' : 'disabled'} for ${branchRow.name}.`);
                    getListBranch();
                } else {
                    toast.error(response.message || 'Failed to update CSF setting.');
                }
            })
            .catch(() => toast.error('Failed to update CSF setting.'));
    };

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
        ...(canToggleCsf ? [{
            Header: "CSF / CSF In",
            accessor: 'csfEnabled',
            Cell: ({ row }) => {
                const enabled = row.original.csfEnabled;
                // Not returned by branches/list: show a dash instead of a misleading "Enabled".
                if (enabled === undefined || enabled === null) {
                    return <span className="text-gray-400">—</span>;
                }
                return (
                    <button
                        type="button"
                        onClick={() => handleToggleCsf(row.original)}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                            enabled
                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                        }`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </button>
                );
            },
        }] : []),
        ...(canToggleOfflineMode ? [{
            Header: "Offline Mode",
            accessor: 'skipClientFaceVerify',
            Cell: ({ row }) => {
                                const flag = row.original.skipClientFaceVerify;
                if (flag === undefined || flag === null) return <span className="text-gray-400">—</span>;
                const active  = isOfflineModeActive(row.original);
                const expired = flag === true && !active;
                const until   = row.original.skipClientFaceVerifyUntil;
                const label   = active
                    ? `On · until ${new Date(until).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
                    : expired ? 'Expired' : 'Off';
                return (
                    <button type="button" onClick={() => handleToggleOfflineMode(row.original)}
                        title={active
                            ? `Face verification skipped; client photo upload required. Ends ${new Date(until).toLocaleString()}`
                            : expired ? 'Offline mode expired — click to enable again' : 'Normal face verification'}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                            active
                                ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                                : expired
                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}>
                        {label}
                    </button>
                );
            },
        }] : []),
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

    return (
        <Layout actionButtons={currentUser.root || (currentUser.role && currentUser.role.rep < 2) ? actionButtons : null}>
            <div className="pb-4">
                {loading ?
                    (
                        // <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        // </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
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