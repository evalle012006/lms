import React from "react";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import TableComponent from "@/lib/table";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setBadDebt, setBadDebtList, setBadDebtCollectionList } from "@/redux/actions/badDebtCollectionActions";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { PlusIcon } from '@heroicons/react/24/solid';
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import AddUpdateDebtCollection from "@/components/other-transactions/badDebtCollection/AddUpdateBadDebtDrawer";
import { formatPricePhp } from "@/lib/utils";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";

export default function BadDebtCollectionPage() {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.badDebtCollection.list);
    const collectionList = useSelector(state => state.badDebtCollection.collectionList);
    const data = useSelector(state => state.badDebtCollection.data);
    const branchList = useSelector(state => state.branch.list);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [selectedTab, setSelectedTab] = useTabs([
        'list',
        'collection'
    ]);

    const getList = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'other-transactions/badDebtCollection/list-bad-debts';
        if (currentUser.role.rep == 1) {
            const branchIds = branchList.map(branch => branch._id);
            url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds) });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        pastDueStr: bd.pastDue > 0 ? formatPricePhp(bd.pastDue) : '-',
                        amountReleaseStr: bd.amountRelease > 0 ? formatPricePhp(bd.amountRelease) : '-'
                    })
                });
                dispatch(setBadDebtList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            const branchIds = branchList.map(branch => branchCodes.contains(branch.code));
            url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds) });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        pastDueStr: bd.pastDue > 0 ? formatPricePhp(bd.pastDue) : '-',
                        amountReleaseStr: bd.amountRelease > 0 ? formatPricePhp(bd.amountRelease) : '-'
                    })
                });
                dispatch(setBadDebtList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchId: currentUser.designatedBranchId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        pastDueStr: bd.pastDue > 0 ? formatPricePhp(bd.pastDue) : '-',
                        amountReleaseStr: bd.amountRelease > 0 ? formatPricePhp(bd.amountRelease) : '-'
                    })
                });
                dispatch(setBadDebtList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ loId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        pastDueStr: bd.pastDue > 0 ? formatPricePhp(bd.pastDue) : '-',
                        amountReleaseStr: bd.amountRelease > 0 ? formatPricePhp(bd.amountRelease) : '-'
                    })
                });
                dispatch(setBadDebtList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getCollectionList = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'other-transactions/badDebtCollection/list';
        if (currentUser.role.rep == 1) {
            const branchIds = branchList.map(branch => branch._id);
            url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds) });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        paymentCollectionStr: formatPricePhp(bd.paymentCollection),
                        pastDueStr: bd.loan.length > 0 ? bd.loan[0].pastDue > 0 ? formatPricePhp(bd.loan[0].pastDue) : '-' : '-',
                        amountReleaseStr: bd.loan.length > 0 ? bd.loan[0].amountRelease > 0 ? formatPricePhp(bd.loan[0].amountRelease) : '-' : '-'
                    })
                });
                dispatch(setBadDebtCollectionList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            const branchIds = branchList.map(branch => branchCodes.contains(branch.code));
            url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds) });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        paymentCollectionStr: formatPricePhp(bd.paymentCollection),
                        pastDueStr: bd.loan.length > 0 ? bd.loan[0].pastDue > 0 ? formatPricePhp(bd.loan[0].pastDue) : '-' : '-',
                        amountReleaseStr: bd.loan.length > 0 ? bd.loan[0].amountRelease > 0 ? formatPricePhp(bd.loan[0].amountRelease) : '-' : '-'
                    })
                });
                dispatch(setBadDebtCollectionList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchId: currentUser.designatedBranchId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        paymentCollectionStr: formatPricePhp(bd.paymentCollection),
                        pastDueStr: bd.loan.length > 0 ? bd.loan[0].pastDue > 0 ? formatPricePhp(bd.loan[0].pastDue) : '-' : '-',
                        amountReleaseStr: bd.loan.length > 0 ? bd.loan[0].amountRelease > 0 ? formatPricePhp(bd.loan[0].amountRelease) : '-' : '-'
                    })
                });
                dispatch(setBadDebtCollectionList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ loId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        paymentCollectionStr: formatPricePhp(bd.paymentCollection),
                        pastDueStr: bd.loan.length > 0 ? bd.loan[0].pastDue > 0 ? formatPricePhp(bd.loan[0].pastDue) : '-' : '-',
                        amountReleaseStr: bd.loan.length > 0 ? bd.loan[0].amountRelease > 0 ? formatPricePhp(bd.loan[0].amountRelease) : '-' : '-'
                    })
                });
                dispatch(setBadDebtCollectionList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
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
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
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
            Header: "Name",
            accessor: 'fullName'
        },
        {
            Header: "Amount Collected",
            accessor: 'paymentCollectionStr'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Past Due",
            accessor: 'pastDueStr'
        },
        {
            Header: "Branch",
            accessor: 'branchName'
        },
        {
            Header: "Loan Officer",
            accessor: 'loName'
        },
        {
            Header: "Group",
            accessor: 'groupName'
        },
        {
            Header: "Date Collected",
            accessor: 'dateAdded'
        }
    ]);

    const [listColumns, setListColumns] = useState([
        {
            Header: "Name",
            accessor: 'fullName'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Past Due",
            accessor: 'pastDueStr'
        },
        {
            Header: "Branch",
            accessor: 'branchName'
        },
        {
            Header: "Loan Officer",
            accessor: 'loName'
        },
        {
            Header: "Group",
            accessor: 'groupName'
        },
        {
            Header: "Offset Date",
            accessor: 'fullPaymentDate'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        getList();
    }

    const actionButtons = [
        <ButtonSolid label="Add Bad Debt" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        dispatch(setBadDebt(row.original));
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        dispatch(setBadDebt(row.original));
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        // { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (data) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'branches/delete', branch)
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
        let mounted = true;

        mounted && getListBranch();

        return (() => {
            mounted = false;
        });
    }, []);

    useEffect(() => {
        if (branchList && branchList.length > 0) {
            getList();
            getCollectionList();

            if (currentUser.role.rep == 3 || currentUser.role.rep == 4) {
                dispatch(setBranch(branchList[0]));
            }
        }
    }, [branchList]);

    return (
        <Layout actionButtons={(selectedTab == 'collection' && (currentUser?.role?.rep == 3 || currentUser.role.rep == 4)) ? actionButtons : null}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : (
                        <React.Fragment>
                            <nav className="flex pl-10 bg-white border-b border-gray-300">
                                <TabSelector
                                    isActive={selectedTab === "list"}
                                    onClick={() => setSelectedTab("list")}>
                                    List of Bad Debts
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "collection"}
                                    onClick={() => setSelectedTab("collection")}>
                                    Collection of Bad Debts
                                </TabSelector>
                            </nav>
                            <div>
                                <TabPanel hidden={selectedTab !== 'list'}>
                                    <TableComponent columns={listColumns} data={list} hasActionButtons={false} showFilters={false} />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'collection'}>
                                    <TableComponent columns={columns} data={collectionList} hasActionButtons={false} showFilters={false} />
                                </TabPanel>
                            </div>
                        </React.Fragment>
                    )}
            </div>
            <AddUpdateDebtCollection mode={mode} data={data} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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
    )
}