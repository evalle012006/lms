import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { UppercaseFirstLetter } from "@/lib/utils";
import AddUpdateClient from "@/components/clients/AddUpdateClientDrawer";
import ViewClientsByGroupPage from "@/components/clients/ViewClientsByGroup";
import { setBranchList } from "@/redux/actions/branchActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { setUserList } from "@/redux/actions/userActions";
import Spinner from "@/components/Spinner";
import AddUpdateClientCoMaker from "@/components/transactions/AddUpdateClientCoMakerDrawer";
import { getApiBaseUrl } from "@/lib/constants";
import ClientSearchV2 from "@/components/clients/ClientSearchV2";

const ClientsProspectPage = () => {
    const router = useRouter();
    const { status } = router.query;
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [showCoMakerModal, setShowCoMakerModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        
        if (currentUser.role.rep == 2) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
        }

        const response = await fetchWrapper.get(url);
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
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const getListGroup = async () => {
        let url = getApiBaseUrl() + 'groups/list'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            if (status == 'pending') {
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, mode: 'all' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id });
            }
            
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                await response.groups && response.groups.map(group => {
                    groupList.push({
                        ...group,
                        value: group._id,
                        label: UppercaseFirstLetter(group.name)
                    });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            if (status == 'pending') {
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, mode: 'all' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id });
            }
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                await response.groups && response.groups.map(group => {
                    groupList.push({
                        ...group,
                        value: group._id,
                        label: UppercaseFirstLetter(group.name)
                    });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (currentUser.role.rep === 2 && branchList.length > 0) {
            if (status == 'pending') {
                url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id, mode: 'all' });
            } else {
                url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
            }
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groupList = [];
                await response.groups && response.groups.map(group => {
                    groupList.push({
                        ...group,
                        value: group._id,
                        label: UppercaseFirstLetter(group.name)
                    });
                });
                dispatch(setGroupList(groupList));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
                setLoading(false);
            }
        } else if (branchList.length > 0) {
            const response = await fetchWrapper.get(url);
            if (status == 'pending') {
                url = url + '?' + new URLSearchParams({ mode: 'all' });
            }
            if (response.success) {
                let groupList = [];
                await response.groups && response.groups.map(group => {
                    groupList.push({
                        ...group,
                        value: group._id,
                        label: UppercaseFirstLetter(group.name)
                    });
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
            let url = getApiBaseUrl() + 'users/list';
            url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.map(u => {
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
        } else if (currentUser.role.rep === 2) {
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ currentUserId: currentUser._id });;
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
            let url = getApiBaseUrl() + 'users/list';
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

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setClient({});
        window.location.reload();
    }

    const handleShowSearchModal = () => {
        setShowSearchModal(true);
    }

    const handleCloseSearchModal = () => {
        setShowSearchModal(false);
    }

    const handleShowCoMakerDrawer = () => {
        setShowCoMakerModal(true);
    }

    const handleCloseCoMakerDrawer = () => {
        setClient({});
    }


    const actionButtons = [
        <ButtonSolid label="Add Client" type="button" className="p-2 mr-3" onClick={handleShowSearchModal} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];


    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (branchList) {
            getListGroup();
            getListUser();
        }
    }, [branchList]);

    return (
        <Layout actionButtons={currentUser.role.rep > 2 && actionButtons}>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <React.Fragment>
                    <ViewClientsByGroupPage status={status} client={client} setClientParent={setClient} setMode={setMode} handleShowAddDrawer={handleShowAddDrawer} handleShowCoMakerDrawer={handleShowCoMakerDrawer} />
                    <ClientSearchV2 origin="client_list" show={showSearchModal} onClose={handleCloseSearchModal} handleShowAddDrawer={handleShowAddDrawer} mode={mode} showAddDrawer={showAddDrawer} setShowAddDrawer={setShowAddDrawer} handleCloseAddDrawer={handleCloseAddDrawer} client={client} />
                    {/* <AddUpdateClient mode={mode} client={client} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} /> */}
                    <AddUpdateClientCoMaker client={client} showSidebar={showCoMakerModal} setShowSidebar={setShowCoMakerModal} setMode={setMode} onClose={handleCloseCoMakerDrawer} />
                </React.Fragment>
            )}
        </Layout>
    );
}

export default ClientsProspectPage;