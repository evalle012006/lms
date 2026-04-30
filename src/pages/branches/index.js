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
import { QrCodeIcon } from '@heroicons/react/24/outline';
import QRCode from 'qrcode';

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

    const [showQRModal, setShowQRModal] = useState(false);
    const [qrBranch, setQRBranch] = useState(null);
    const [qrGenerating, setQRGenerating] = useState(false);
    const [qrDataUrl, setQRDataUrl] = useState(null);

    const handleQRAction = (row) => {
        // Only admin (rep === 1) can access this
        if (currentUser.role.rep !== 1 && !currentUser.root) return;
        setQRBranch(row.original);
        setQRDataUrl(null);
        setShowQRModal(true);

        // If branch already has a QR token, render the QR immediately
        if (row.original.qrToken) {
            const publicUrl = `${process.env.NEXT_PUBLIC_LOCAL_HOST}/apply/${row.original.qrToken}`;
            QRCode.toDataURL(publicUrl, { width: 300, margin: 2 })
                .then(setQRDataUrl)
                .catch(() => {});
        }
    };

    const handleGenerateQR = async () => {
        if (!qrBranch) return;
        setQRGenerating(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'laf/qr/generate',
                { branchId: qrBranch._id }
            );
            if (!res.success) {
                toast.error(res.message || 'Failed to generate QR code.');
                return;
            }
            toast.success(`QR code generated for ${qrBranch.name}`);
            
            // Render the QR image
            const publicUrl = `${process.env.NEXT_PUBLIC_LOCAL_HOST}/apply/${res.qrToken}`;
            const dataUrl   = await QRCode.toDataURL(publicUrl, { width: 300, margin: 2 });
            setQRDataUrl(dataUrl);

            // Update the branch in the local list so status shows immediately
            setQRBranch(prev => ({ ...prev, qrToken: res.qrToken }));
            getListBranch(); // refresh table
        } catch {
            toast.error('An error occurred generating the QR code.');
        } finally {
            setQRGenerating(false);
        }
    };

    const handleDownloadQR = () => {
        if (!qrDataUrl || !qrBranch) return;
        const link      = document.createElement('a');
        link.download   = `QR-${qrBranch.name}-${qrBranch.code}.png`;
        link.href       = qrDataUrl;
        link.click();
    };

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
            Header: "QR Status",
            accessor: 'qrToken',
            Cell: ({ value }) => value ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                    text-xs font-medium bg-green-100 text-green-700">
                    <QrCodeIcon className="w-3 h-3" /> Active
                </span>
            ) : (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs
                    font-medium bg-gray-100 text-gray-500">
                    No QR
                </span>
            )
        },
        {
            Header: "QR Generated",
            accessor: 'qrGeneratedAt',
            Cell: ({ value }) => value
                ? new Date(value).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'short', day: 'numeric'
                })
                : '—'
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
        // Only rendered for admin — guard is inside handleQRAction
        ...(currentUser.role.rep === 1 || currentUser.root
            ? [{ label: 'Manage QR', action: handleQRAction }]
            : [])
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
            {/* QR Code Modal */}
            {showQRModal && qrBranch && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center 
                    justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Branch QR Code
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {qrBranch.name} — {qrBranch.code}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 
                                    hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 flex flex-col items-center gap-4">

                            {/* QR display */}
                            {qrDataUrl ? (
                                <div className="flex flex-col items-center gap-2">
                                    <img
                                        src={qrDataUrl}
                                        alt={`QR for ${qrBranch.name}`}
                                        className="w-64 h-64 rounded-lg border border-gray-200"
                                    />
                                    <p className="text-xs text-gray-400 text-center">
                                        Scan to open the loan application form for{' '}
                                        <strong>{qrBranch.name}</strong>
                                    </p>
                                </div>
                            ) : (
                                <div className="w-64 h-64 rounded-lg border-2 border-dashed 
                                    border-gray-300 flex flex-col items-center justify-center 
                                    gap-3 text-gray-400">
                                    <QrCodeIcon className="w-16 h-16" />
                                    <p className="text-sm text-center px-4">
                                        {qrBranch.qrToken
                                            ? 'Loading QR code…'
                                            : 'No QR code generated yet'}
                                    </p>
                                </div>
                            )}

                            {/* Warning when regenerating */}
                            {qrBranch.qrToken && (
                                <div className="w-full p-3 bg-amber-50 border border-amber-200 
                                    rounded-lg text-xs text-amber-700">
                                    ⚠️ Regenerating will invalidate the previous QR code. 
                                    Any printed QR codes will stop working.
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={handleGenerateQR}
                                disabled={qrGenerating}
                                className="flex-1 py-2.5 text-sm font-medium border border-blue-300 
                                    text-blue-600 rounded-lg hover:bg-blue-50 
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    flex items-center justify-center gap-2"
                            >
                                {qrGenerating ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" 
                                            viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" 
                                                r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                        </svg>
                                        Generating…
                                    </>
                                ) : qrBranch.qrToken ? 'Regenerate QR' : 'Generate QR'}
                            </button>

                            {qrDataUrl && (
                                <button
                                    onClick={handleDownloadQR}
                                    className="flex-1 py-2.5 text-sm font-medium bg-blue-600 
                                        text-white rounded-lg hover:bg-blue-700
                                        flex items-center justify-center gap-2"
                                >
                                    ⬇ Download PNG
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default BranchesPage;