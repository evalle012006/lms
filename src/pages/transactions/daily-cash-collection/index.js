import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { setGroupList } from "@/redux/actions/groupActions";
import { formatPricePhp, UppercaseFirstLetter } from "@/lib/utils";
import { setBranchList } from "@/redux/actions/branchActions";
import moment from 'moment';
import { setCashCollection, setCashCollectionGroup, setCashCollectionList } from "@/redux/actions/cashCollectionActions";
import DetailsHeader from "@/components/transactions/DetailsHeaderMain";
import { setUserList } from "@/redux/actions/userActions";
import TableComponent, { SelectColumnFilter } from "@/lib/table";

const DailyCashCollectionPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const groupList = useSelector(state => state.group.list);
    const branchList = useSelector(state => state.branch.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const [loading, setLoading] = useState(true);
    const [currentCollection, setCurrentCollection] = useState([]);

    const router = useRouter();

    const getListBranch = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        // value: branch._id,
                        // label: UppercaseFirstLetter(branch.name)
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
        const currentDay = moment(new Date()).format('dddd').toLowerCase();
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-day'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, day: currentDay, occurence: 'daily' });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, day: currentDay, occurence: 'daily' });
        } else {
            url = url + '?' + new URLSearchParams({ day: currentDay, occurence: 'daily' });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    day: UppercaseFirstLetter(group.day),
                    // value: group._id,
                    // label: UppercaseFirstLetter(group.name)
                });
            });
            dispatch(setGroupList(groups));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListUser = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
        if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
        } else if (currentUser.root !== true && currentUser.role.rep === 2 && branchList.length > 0) {
            // url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
        }
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name
                        // value: u._id,
                        // label: UppercaseFirstLetter(name)
                    }
                );
            });
            dispatch(setUserList(userList));
        } else {
            toast.error('Error retrieving user list.');
        }

        setLoading(false);
    }

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-by-date';

        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', loId: currentUser._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', branchId: branchList[0]._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 2) { // for area manager
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', areaManagerId: currentUser._id });
        } else { // administrator
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily' });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            dispatch(setCashCollection(response.data));

            // aggregation for cashcollection by group list
            let collectionData = [];
            response.data && response.data.map(cc => {
                const groupExist = collectionData.find(c => c.groupId === cc.groupId);
                if (groupExist) {
                    const index = collectionData.indexOf(groupExist);
                    let existing = {...collectionData[index]};
                    existing.noOfClients = cc.paymentCollection > 0 ? existing.noOfClients + 1 : existing.noOfClients;
                    existing.mispayments = cc.mispayment ? existing.mispayments + 1 : existing.mispayments;
                    existing.loanTarget = existing.loanTarget + cc.activeLoan;
                    existing.collection = existing.collection + cc.paymentCollection;
                    existing.excess = existing.excess + cc.excess;
                    existing.total = existing.total + cc.paymentCollection;

                    collectionData[index] = existing;
                } else {
                    const group = groupList.find(g => g._id === cc.groupId);

                    if (group) {
                        collectionData.push({
                            groupId: group._id,
                            group: group.name,
                            totalNoOfGroup: group.noOfClients,
                            noOfClients: cc.paymentCollection > 0 ? 1 : 0,
                            mispayments: cc.mispayment ? 1 : 0,
                            loanTarget: cc.activeLoan,
                            collection: cc.paymentCollection,
                            excess: cc.excess,
                            total: cc.paymentCollection
                        });
                    }
                }
            });

            collectionData.map(cc => {
                cc.noOfClients  = cc.noOfClients + '/' + cc.totalNoOfGroup;
                cc.loanTarget = formatPricePhp(cc.loanTarget);
                cc.collection = formatPricePhp(cc.collection);
                cc.excess = formatPricePhp(cc.excess);
                cc.total = formatPricePhp(cc.total);
            });

            groupList.map(group => {
                const groupExist = collectionData.find(c => c.groupId === group._id);

                if (!groupExist) {
                    collectionData.push({
                        groupId: group._id,
                        group: group.name,
                        noOfClients: `0/${group.noOfClients}`,
                        mispayments: 0,
                        loanTarget: formatPricePhp(0),
                        collection: formatPricePhp(0),
                        excess: formatPricePhp(0),
                        total: formatPricePhp(0)
                    });
                }
            });

            dispatch(setCashCollectionList(collectionData));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }


    const handleRowClick = (selected) => {
        router.push('./daily-cash-collection/' + selected.groupId);
    };

    // useEffect(() => {
    //     if ((currentUser.role && currentUser.role.rep !== 1)) {
    //         router.push('/');
    //     }
    // }, []);

    const columns = [
        {
            Header: "Group",
            accessor: 'group',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "# of Clients",
            accessor: 'noOfClients',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Mispayments",
            accessor: 'mispayments',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Target", // sum of all current collection of the day
            accessor: 'loanTarget',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Collection", // sum of all collected
            accessor: 'collection',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Excess", // sum of all excess 
            accessor: 'excess',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Total",
            accessor: 'total',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
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

    useEffect(() => {
        if (groupList) {
            getCashCollections();
        }
    }, [groupList]);

    useEffect(() => {
        let cashCollectionData = [];
        if (cashCollectionList.length > 0) {
            // process here...
            cashCollectionData = cashCollectionList; // temp
        } else {
            groupList && groupList.map(group => {
                cashCollectionData.push({
                    groupId: group._id,
                    group: group.name,
                    noOfClients: `0/${group.noOfClients}`,
                    mispayments: 0,
                    loanTarget: '0.00',
                    collection: '0.00',
                    excess: '0.00',
                    total: '0.00'
                });
            });
        }

        setCurrentCollection(cashCollectionData);
    }, [cashCollectionList, groupList]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <DetailsHeader pageTitle='Daily Cash Transactions' mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} />
                    <div className="p-4 mt-[8rem]">
                        <TableComponent columns={columns} data={currentCollection} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default DailyCashCollectionPage;