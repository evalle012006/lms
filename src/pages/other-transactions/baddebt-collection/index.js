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
import { setBadDebt, setBadDebtList, setBadDebtCollectionList, setOriginalBadDebtList, setOriginalBadDebtCollectionList } from "@/redux/actions/badDebtCollectionActions";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { PlusIcon } from '@heroicons/react/24/solid';
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import AddUpdateDebtCollection from "@/components/other-transactions/badDebtCollection/AddUpdateBadDebtDrawer";
import { formatPricePhp } from "@/lib/utils";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { getApiBaseUrl } from "@/lib/constants";
import { toast } from "react-toastify";
import BadDebtFilters from "@/components/other-transactions/badDebtCollection/BadDebtFilters";

export default function BadDebtCollectionPage() {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.badDebtCollection.list);
    const collectionList = useSelector(state => state.badDebtCollection.collectionList);
    const data = useSelector(state => state.badDebtCollection.data);
    const branchList = useSelector(state => state.branch.list);
    const state = useSelector(state => state); // Access entire Redux state

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        list: {
            branchId: '',
            loId: '',
            groupId: '',
            clientId: ''
        },
        collection: {
            branchId: '',
            loId: '',
            groupId: '',
            clientId: ''
        }
    });

    const [selectedTab, setSelectedTab] = useTabs([
        'list',
        'collection'
    ]);

    const handleFilterChange = (filters, tabName) => {
        setActiveFilters({
            ...activeFilters,
            [tabName]: filters
        });

        // Apply filters directly to the data
        if (tabName === 'list') {
            applyListFilters(filters);
        } else {
            applyCollectionFilters(filters);
        }
    };
    
    // Filter data locally instead of making API calls
    const applyListFilters = (filters) => {
        setLoading(true);
        const { branchId, loId, groupId, clientId } = filters;
        
        // Use state from outside the function instead of calling useSelector here
        const allData = state.badDebtCollection.originalList || [];
        if (!allData || allData.length === 0) {
            setLoading(false);
            return;
        }
        
        let filteredData = [...allData];
        
        // Apply filters
        if (branchId) {
            filteredData = filteredData.filter(item => item.branchId === branchId);
        }
        
        if (loId) {
            filteredData = filteredData.filter(item => item.loId === loId);
        }
        
        if (groupId) {
            filteredData = filteredData.filter(item => item.groupId === groupId);
        }
        
        if (clientId) {
            filteredData = filteredData.filter(item => item.clientId === clientId);
        }
        
        // Add totals row if there's data
        if (filteredData.length > 0) {
            filteredData.push(processListTotals(filteredData));
        }
        
        dispatch(setBadDebtList(filteredData));
        setLoading(false);
    };
    
    const applyCollectionFilters = (filters) => {
        setLoading(true);
        const { branchId, loId, groupId, clientId } = filters;
        
        // Use state from outside the function instead of calling useSelector here
        const allData = state.badDebtCollection.originalCollectionList || [];
        if (!allData || allData.length === 0) {
            setLoading(false);
            return;
        }
        
        let filteredData = [...allData];
        
        // Apply filters
        if (branchId) {
            filteredData = filteredData.filter(item => item.branchId === branchId);
        }
        
        if (loId) {
            filteredData = filteredData.filter(item => item.loId === loId);
        }
        
        if (groupId) {
            filteredData = filteredData.filter(item => item.groupId === groupId);
        }
        
        if (clientId) {
            filteredData = filteredData.filter(item => item.clientId === clientId);
        }
        
        // Add totals row if there's data
        if (filteredData.length > 0) {
            filteredData.push(processCollectionListTotals(filteredData));
        }
        
        dispatch(setBadDebtCollectionList(filteredData));
        setLoading(false);
    };

    const getList = async (filters = activeFilters.list) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'other-transactions/badDebtCollection/list-bad-debts';
        let params = {};

        if (currentUser.role.rep === 1) {
            if (filters.branchId) params.branchId = filters.branchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 2) {
            params.currentUserId = currentUser._id;
            if (filters.branchId) params.branchId = filters.branchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 3) {
            params.branchId = currentUser.designatedBranchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 4) {
            params.loId = currentUser._id;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        }

        if (Object.keys(params).length > 0) {
            url = url + '?' + new URLSearchParams(params);
        }

        try {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    let netBalance = bd.maturedPastDue;
                    let mcbu = bd.mcbuReturnAmt;
                    if (netBalance <= 0) {
                        mcbu = 0;
                    }

                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        amountRelease: bd.history.amountRelease,
                        amountReleaseStr: bd.history.amountRelease > 0 ? formatPricePhp(bd.history.amountRelease) : '-',
                        mcbuReturnAmt: mcbu,
                        mcbuReturnAmtStr: mcbu > 0 ? formatPricePhp(mcbu) : '-',
                        loanBalance: bd.history.loanBalance,
                        loanBalanceStr: bd.history.loanBalance > 0 ? formatPricePhp(bd.history.loanBalance) : '-',
                        netBalance: netBalance,
                        netBalanceStr: netBalance > 0 ? formatPricePhp(netBalance) : '-',
                        remarks: netBalance <= 0 ? 'Fully Paid' : '-'
                    });
                });
                if (responseData.length > 0) {
                    responseData.push(processListTotals(responseData));
                }
                // Store original list for filtering
                dispatch(setOriginalBadDebtList(responseData.filter(item => !item.totalData)));
                dispatch(setBadDebtList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } catch (error) {
            setLoading(false);
            toast.error('An error occurred while fetching bad debt list');
            console.error(error);
        }
    }

    const processListTotals = (responseData) => {
        let totalAmountRelease = 0;
        let totalLoanBalance = 0;
        let totalMcbu = 0;
        let totalNetBalance = 0;

        responseData.map(data => {
            totalNetBalance += data.netBalance ? data.netBalance : 0;
            totalAmountRelease += data.amountRelease ? data.amountRelease : 0;
            totalLoanBalance += data.loanBalance ? data.loanBalance : 0;
            totalMcbu += data.mcbuReturnAmt ? data.mcbuReturnAmt : 0;
        });

        return {
            groupName: '-',
            fullName: 'TOTALS',
            loName: '-',
            branchName: '-',
            netBalance: totalNetBalance,
            netBalanceStr: totalNetBalance > 0 ? formatPricePhp(totalNetBalance) : '-',
            loanBalance: totalLoanBalance,
            loanBalanceStr: totalLoanBalance > 0 ? formatPricePhp(totalLoanBalance) : '-',
            amountRelease: totalAmountRelease,
            amountReleaseStr: totalAmountRelease > 0 ? formatPricePhp(totalAmountRelease) : '-',
            mcbuReturnAmt: totalMcbu,
            mcbuReturnAmtStr: totalMcbu > 0 ? formatPricePhp(totalMcbu) : '-',
            totalData: true
        }
    }

    const getCollectionList = async (filters = activeFilters.collection) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'other-transactions/badDebtCollection/list';
        let params = {};

        if (currentUser.role.rep === 1) {
            if (filters.branchId) params.branchId = filters.branchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 2) {
            params.currentUserId = currentUser._id;
            if (filters.branchId) params.branchId = filters.branchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 3) {
            params.branchId = currentUser.designatedBranchId;
            if (filters.loId) params.loId = filters.loId;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        } else if (currentUser.role.rep === 4) {
            params.loId = currentUser._id;
            if (filters.groupId) params.groupId = filters.groupId;
            if (filters.clientId) params.clientId = filters.clientId;
        }

        if (Object.keys(params).length > 0) {
            url = url + '?' + new URLSearchParams(params);
        }

        try {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.data.map(bd => {
                    let netBalance = bd.maturedPastDue;
                    if (netBalance <= 0) {
                        netBalance = 0;
                    }
                    responseData.push({
                        ...bd,
                        groupName: bd.group.length > 0 ? bd.group[0].name : '-',
                        fullName: bd.client.length > 0 ? bd.client[0].name : '-',
                        loName: bd.lo.length > 0 ? bd.lo[0].firstName + ' ' + bd.lo[0].lastName : '-',
                        branchName: bd.branch.length > 0 ? bd.branch[0].name : '-',
                        paymentCollection: bd.paymentCollection,
                        paymentCollectionStr: formatPricePhp(bd.paymentCollection),
                        netBalance: netBalance,
                        netBalanceStr: netBalance > 0 ? formatPricePhp(netBalance) : '-',
                        amountRelease: bd.loanRelease ? bd.loanRelease : 0,
                        amountReleaseStr: bd.loanRelease > 0 ? formatPricePhp(bd.loanRelease) : '-'
                    });
                });
                if (responseData.length > 0) {
                    responseData.push(processCollectionListTotals(responseData));
                }
                // Store original collection list for filtering
                dispatch(setOriginalBadDebtCollectionList(responseData.filter(item => !item.totalData)));
                dispatch(setBadDebtCollectionList(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } catch (error) {
            setLoading(false);
            toast.error('An error occurred while fetching collection list');
            console.error(error);
        }
    }

    const processCollectionListTotals = (responseData) => {
        let totalAmountRelease = 0;
        let totalAmountCollected = 0;
        let totalNetBalance = 0;

        const unique = [];
        responseData.map(data => {
            const existIdx = unique.findIndex(u => u.clientId == data.clientId);
            if (existIdx == -1) {
                unique.push(data);
            } else {
                unique[existIdx] = data;
            }
            totalAmountCollected += data.paymentCollection;
        });

        unique.map(data => {
            totalAmountRelease += data.amountRelease;
            totalNetBalance += data.netBalance;
        });

        return {
            groupName: '-',
            fullName: 'TOTALS',
            loName: '-',
            branchName: '-',
            paymentCollection: totalAmountCollected,
            paymentCollectionStr: totalAmountCollected > 0 ? formatPricePhp(totalAmountCollected) : '-',
            amountRelease: totalAmountRelease,
            amountReleaseStr: totalAmountRelease > 0 ? formatPricePhp(totalAmountRelease) : '-',
            netBalance: totalNetBalance,
            netBalanceStr: totalNetBalance > 0 ? formatPricePhp(totalNetBalance) : '-',
            totalData: true
        }
    }

    const getListBranch = async () => {
        setLoading(true);
        let url = getApiBaseUrl() + 'branches/list';
        try {
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
                url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
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
        } catch (error) {
            setLoading(false);
            toast.error('An error occurred while fetching branches');
            console.error(error);
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'fullName'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Amount Collected",
            accessor: 'paymentCollectionStr'
        },
        {
            Header: "Net Balance",
            accessor: 'netBalanceStr'
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
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "MCBU",
            accessor: 'mcbuReturnAmtStr'
        },
        {
            Header: "Net Balance",
            accessor: 'netBalanceStr'
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
        },
        {
            Header: "Remarks",
            accessor: 'remarks'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        window.location.reload();
    }

    const actionButtons = [
        <ButtonSolid key="add-button" label="Add Bad Debt" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
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
            fetchWrapper.postCors(getApiBaseUrl() + 'branches/delete', data)
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
                
                // Set initial filters for branch manager and loan officer
                if (currentUser.role.rep == 3) {
                    setActiveFilters({
                        list: {
                            ...activeFilters.list,
                            branchId: currentUser.designatedBranchId
                        },
                        collection: {
                            ...activeFilters.collection,
                            branchId: currentUser.designatedBranchId
                        }
                    });
                } else if (currentUser.role.rep == 4) {
                    setActiveFilters({
                        list: {
                            ...activeFilters.list,
                            branchId: branchList[0]._id,
                            loId: currentUser._id
                        },
                        collection: {
                            ...activeFilters.collection,
                            branchId: branchList[0]._id,
                            loId: currentUser._id
                        }
                    });
                }
            }
        }
    }, [branchList]);

    return (
        <Layout actionButtons={(selectedTab == 'collection' && (currentUser?.role?.rep == 3 || currentUser.role.rep == 4)) ? actionButtons : null}>
            <div className="pb-4">
                {loading ? (
                    <Spinner />
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
                                <BadDebtFilters 
                                    onFilterChange={handleFilterChange} 
                                    tabName="list" 
                                />
                                <TableComponent 
                                    columns={listColumns} 
                                    data={list} 
                                    hasActionButtons={false} 
                                    showFilters={false} 
                                />
                            </TabPanel>
                            <TabPanel hidden={selectedTab !== 'collection'}>
                                <BadDebtFilters 
                                    onFilterChange={handleFilterChange} 
                                    tabName="collection" 
                                />
                                <TableComponent 
                                    columns={columns} 
                                    data={collectionList} 
                                    hasActionButtons={false} 
                                    showFilters={false} 
                                />
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