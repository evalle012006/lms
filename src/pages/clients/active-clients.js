import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { UppercaseFirstLetter } from "@/lib/utils";
import { setClientList } from "@/redux/actions/clientActions";
import AddUpdateClient from "@/components/clients/AddUpdateClientDrawer";
import ViewClientsByGroupPage from "@/components/clients/ViewClientsByGroup";
import { setBranchList } from "@/redux/actions/branchActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { getApiBaseUrl } from "@/lib/constants";

const ClientsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [client, setClient] = useState();

    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListBranch = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
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

    const getListGroup = async () => {
        let url = getApiBaseUrl() + 'groups/list'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
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
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListClient = async () => {
        const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/list');
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    groupName: client.loans.length > 0 ? client.loans[0].groupName : '-',
                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                    activeLoan: client.loans.length > 0 ?  client.loans[0].activeLoan : 0.00,
                    loanBalance: client.loans.length > 0 ?  client.loans[0].loanBalance : 0.00,
                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                    delinquent: client.delinquent === true ? 'Yes' : 'No'
                });
            });
            dispatch(setClientList(clients));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
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

    const actionButtons = [
        <ButtonSolid label="Add Client" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    // useEffect(() => {
    //     if ((currentUser.role && currentUser.role.rep !== 1)) {
    //         router.push('/');
    //     }
    // }, []);


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
        }
    }, [branchList]);

    return (
        <Layout>
            <ViewClientsByGroupPage client={client} status="active" setClientParent={setClient} setMode={setMode} handleShowAddDrawer={handleShowAddDrawer} />
            <AddUpdateClient mode={mode} client={client} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
        </Layout>
    );
}

export default ClientsPage;