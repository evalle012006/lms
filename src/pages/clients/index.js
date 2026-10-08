// src/pages/clients/index.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { UppercaseFirstLetter } from "@/lib/utils";
import ViewClientsByGroupPage from "@/components/clients/ViewClientsByGroup";
import ClientDetailPage from "@/components/clients/ClientDetailPage";
import Modal from "@/lib/ui/Modal";
import ClientListToolbar from "@/components/clients/ClientListToolbar";
import ClientList from "@/components/clients/ClientList";
import ClientQuickEditModal from "@/components/clients/ClientQuickEditModal";
import { useClientList } from "@/hooks/useClientList";
import { setBranchList } from "@/redux/actions/branchActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { setUserList } from "@/redux/actions/userActions";
import { setClient } from "@/redux/actions/clientActions";
import Spinner from "@/components/Spinner";
import AddUpdateClientCoMaker from "@/components/transactions/AddUpdateClientCoMakerDrawer";
import { getApiBaseUrl } from "@/lib/constants";
import ClientSearchV2 from "@/components/clients/ClientSearchV2";
import ClientQRModal from "@/components/clients/ClientQRModal";

// Active/Offset/Prospect all render the new server-paginated experience.
// Rollout gated to root only — see isEligibleForNewClientExperience below.
const NEW_EXPERIENCE_STATUSES = ['active', 'offset', 'pending'];

// Rollout gate. Widen this function (not the call sites) when ready to
// expand — e.g. `currentUser.root || currentUser.role.rep <= 2` next.
function isEligibleForNewClientExperience(currentUser) {
    return currentUser?.root === true || currentUser?.role?.rep > 1;
}

const ClientsPage = () => {
    const router = useRouter();
    const { status } = router.query;
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const currentBranch = useSelector(state => state.branch.data);
    const [showCoMakerModal, setShowCoMakerModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Add flow — owned by ClientSearchV2 (search-first, then add-if-not-found).
    // Prospect only, unchanged from the legacy flow.
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClientLocal] = useState();
    const [qrModalClient, setQrModalClient] = useState(null);

    const isNewExperience = NEW_EXPERIENCE_STATUSES.includes(status)
        && isEligibleForNewClientExperience(currentUser);

    // View (read-only detail modal) — Active/Offset/Prospect, new experience.
    const [viewingClient, setViewingClient] = useState(null);

    // Quick-edit (Active/Offset only) — restricted to duplicate/groupLeader,
    // per the confirmed authorization boundary: branchId/groupId/loId/status
    // must go through their proper reassignment flows, never through this
    // shortcut. Prospect editing does NOT use this — it routes directly to
    // the existing /clients/edit/[clientId] full page instead (see
    // ClientRowActions.handleEdit).
    const [quickEditClient, setQuickEditClient] = useState(null);

    const listKind = status === 'pending' ? 'prospect' : (status || 'active');
    const clientListState = useClientList(listKind, { enabled: router.isReady });

    const handleQrGenerated = (clientId, qr) => {
        clientListState.patchClient(clientId, { qrToken: qr.qrToken, qrGeneratedAt: qr.qrGeneratedAt });
        setQrModalClient({
            ...qr,
            url: `${window.location.origin}/transactions/cash-collection/qr-collect/${qr.qrToken}`,
        });
    };

    const handleRegenerateQr = async () => {
        if (!qrModalClient) return;
        const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/generate-qr', { clientId: qrModalClient.clientId });
        if (res.success) {
            clientListState.patchClient(qrModalClient.clientId, { qrToken: res.qr.qrToken, qrGeneratedAt: res.qr.qrGeneratedAt });
            setQrModalClient({
                ...res.qr,
                url: `${window.location.origin}/transactions/cash-collection/qr-collect/${res.qr.qrToken}`,
            });
            toast.success(res.message);
        } else {
            toast.error(res.message);
        }
    };

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        if (currentUser.role.rep == 2) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
        }
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push({ ...branch, value: branch._id, label: UppercaseFirstLetter(branch.name) });
            });
            if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                branches = [branches.find(b => b.code === currentUser.designatedBranch)];
            }
            dispatch(setBranchList(branches));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const getListGroup = async () => {
        let url = getApiBaseUrl() + 'groups/list'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams(
                status == 'pending'
                    ? { branchId: branchList[0]._id, loId: currentUser._id, mode: 'all' }
                    : { branchId: branchList[0]._id, loId: currentUser._id }
            );
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                response.groups && response.groups.map(group => {
                    groupList.push({ ...group, value: group._id, label: UppercaseFirstLetter(group.name) });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams(
                status == 'pending'
                    ? { branchId: branchList[0]._id, mode: 'all' }
                    : { branchId: branchList[0]._id }
            );
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                response.groups && response.groups.map(group => {
                    groupList.push({ ...group, value: group._id, label: UppercaseFirstLetter(group.name) });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (currentUser.role.rep === 2 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams(
                status == 'pending'
                    ? { currentUserId: currentUser._id, mode: 'all' }
                    : { currentUserId: currentUser._id }
            );
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                response.groups && response.groups.map(group => {
                    groupList.push({ ...group, value: group._id, label: UppercaseFirstLetter(group.name) });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (branchList.length > 0) {
            if (status == 'pending') {
                url = url + '?' + new URLSearchParams({ mode: 'all' });
            }
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                response.groups && response.groups.map(group => {
                    groupList.push({ ...group, value: group._id, label: UppercaseFirstLetter(group.name) });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        }
    }

    const getListUser = async () => {
        if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4) && branchList.length > 0) {
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode: branchList[0].code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.map(u => {
                    userList.push({ ...u, value: u._id, label: UppercaseFirstLetter(`${u.firstName} ${u.lastName}`) });
                });
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }
            setLoading(false);
        } else if (currentUser.role.rep === 2) {
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ currentUserId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    userList.push({ ...u, value: u._id, label: UppercaseFirstLetter(`${u.firstName} ${u.lastName}`) });
                });
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }
            setLoading(false);
        } else if (branchList.length > 0) {
            const response = await fetchWrapper.get(getApiBaseUrl() + 'users/list');
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    userList.push({ ...u, value: u._id, label: UppercaseFirstLetter(`${u.firstName} ${u.lastName}`) });
                });
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }
            setLoading(false);
        }
    }

    // ── Add flow handlers (Prospect only, owned by ClientSearchV2) ─────────
    const handleShowAddDrawer = () => {
        if (currentBranch?.clientFlowVersion === 'v1') {
            setShowAddDrawer(true);
        } else {
            router.push('/clients/add');
        }
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setClientLocal({});
        window.location.reload();
    }

    const handleShowSearchModal = () => setShowSearchModal(true);
    const handleCloseSearchModal = () => setShowSearchModal(false);
    const handleShowCoMakerDrawer = () => setShowCoMakerModal(true);
    const handleCloseCoMakerDrawer = () => setClientLocal({});

    // ── View (read-only) ────────────────────────────────────────────────
    const handleViewClient = (clickedClient) => {
        dispatch(setClient(clickedClient));
        setViewingClient(clickedClient);
    };
    const handleCloseClientDetail = () => setViewingClient(null);

    // ── Quick-edit (Active/Offset — duplicate/groupLeader only) ────────────
    // Prospect edits bypass this entirely and route to /clients/edit/[id]
    // directly from ClientRowActions — see its handleEdit.
    const handleQuickEdit = (clickedClient) => setQuickEditClient(clickedClient);
    const handleCloseQuickEdit = () => setQuickEditClient(null);
    const handleQuickEditSaved = (clientId, changes) => {
        // No refetch — patch the already-loaded row in place.
        clientListState.patchClient(clientId, changes);
    };

    const actionButtons = [
        <ButtonSolid key="add-client" label="Add Client" type="button" className="p-2 mr-3" onClick={handleShowSearchModal} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    useEffect(() => {
        let mounted = true;
        mounted && getListBranch();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (branchList && !isNewExperience) {
            getListGroup();
            getListUser();
        }
    }, [branchList, isNewExperience]);

    return (
        <Layout
            actionButtons={
                (status === 'pending' && currentUser.role.rep > 2 && currentBranch?.clientFlowVersion === 'v1') && actionButtons
            }
        >
            {loading ? (
                <Spinner />
            ) : isNewExperience ? (
                <div className="p-4">
                    {status === 'pending' && (
                        <div className="flex gap-2 mb-3">
                            {['new', 'duplicate', 'excluded'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => clientListState.setTab(t)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors
                                        ${clientListState.filters.tab === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}

                    <ClientListToolbar
                        currentUser={currentUser}
                        filters={clientListState.filters}
                        setFilter={clientListState.setFilter}
                        setSearch={clientListState.setSearch}
                        searchValue={clientListState.filters.search}
                        resolvedBranchId={clientListState.resolvedBranchId}
                        allowedBranches={clientListState.allowedBranchIds}
                    />
                    <ClientList
                        clients={clientListState.clients}
                        loading={clientListState.loading}
                        error={clientListState.error}
                        pagination={clientListState.pagination}
                        page={clientListState.page}
                        goToPage={clientListState.goToPage}
                        onClientClick={handleViewClient}
                        rowVariant={status === 'pending' ? 'prospect' : 'loan'}
                        currentUser={currentUser}
                        onQuickEdit={handleQuickEdit}
                        onQrGenerated={handleQrGenerated}
                        removeClient={clientListState.removeClient}
                        patchClient={clientListState.patchClient}
                    />

                    {viewingClient && (
                        <Modal show={!!viewingClient} onClose={handleCloseClientDetail} title="Client Details" size="2xl">
                            <ClientDetailPage />
                        </Modal>
                    )}

                    {quickEditClient && (
                        <ClientQuickEditModal
                            client={quickEditClient}
                            show={!!quickEditClient}
                            onClose={handleCloseQuickEdit}
                            onSaved={handleQuickEditSaved}
                        />
                    )}
                </div>
            ) : (
                <React.Fragment>
                    <ViewClientsByGroupPage status={status} client={client} setClientParent={setClientLocal} setMode={setMode} handleShowAddDrawer={handleShowAddDrawer} handleShowCoMakerDrawer={handleShowCoMakerDrawer} />
                    <AddUpdateClientCoMaker client={client} showSidebar={showCoMakerModal} setShowSidebar={setShowCoMakerModal} setMode={setMode} onClose={handleCloseCoMakerDrawer} />
                </React.Fragment>
            )}

            {currentBranch?.clientFlowVersion === 'v1' && (
                <ClientSearchV2
                    origin="client_list"
                    show={showSearchModal}
                    onClose={handleCloseSearchModal}
                    handleShowAddDrawer={handleShowAddDrawer}
                    mode={mode}
                    showAddDrawer={showAddDrawer}
                    setShowAddDrawer={setShowAddDrawer}
                    handleCloseAddDrawer={handleCloseAddDrawer}
                    client={client}
                />
            )}

            {qrModalClient && (
                <ClientQRModal
                    show={!!qrModalClient}
                    onClose={() => setQrModalClient(null)}
                    onRegenerate={handleRegenerateQr}
                    qrData={qrModalClient}
                />
            )}
        </Layout>
    );
}

export default ClientsPage;