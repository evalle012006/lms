import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useDispatch, useSelector } from "react-redux";
import TableComponent from "@/lib/table";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { 
    setBadDebt, 
    setBadDebtList, 
    setBadDebtCollectionList, 
    setOriginalBadDebtList, 
    setOriginalBadDebtCollectionList 
} from "@/redux/actions/badDebtCollectionActions";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { PlusIcon, BanknotesIcon, UsersIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import AddUpdateBadDebtCollection from "@/components/other-transactions/badDebtCollection/AddUpdateBadDebtDrawer";
import { formatPricePhp } from "@/lib/utils";
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { getApiBaseUrl } from "@/lib/constants";
import { toast } from "react-toastify";
import BadDebtFilters from "@/components/other-transactions/badDebtCollection/BadDebtFilters";

// Stats Card Component
const StatsCard = ({ icon: Icon, label, value, subValue, iconBgColor = "bg-blue-100", iconColor = "text-blue-600" }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between">
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {subValue && (
                    <p className="text-xs text-gray-500 mt-1">{subValue}</p>
                )}
            </div>
            <div className={`p-3 ${iconBgColor} rounded-lg`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
        </div>
    </div>
);

// Empty State Component
const EmptyState = ({ message, actionButton }) => (
    <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <BanknotesIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
        <p className="text-gray-500 mb-6">{message}</p>
        {actionButton}
    </div>
);

export default function BadDebtCollectionPage() {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('add');
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [selectedTab, setSelectedTab] = useTabs(['list', 'collection']);
    
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.badDebtCollection.list);
    const collectionList = useSelector(state => state.badDebtCollection.collectionList);
    const originalList = useSelector(state => state.badDebtCollection.originalList);
    const originalCollectionList = useSelector(state => state.badDebtCollection.originalCollectionList);

    // Stats calculation
    const stats = {
        totalBadDebts: list.filter(item => !item.totalData).length,
        totalCollections: collectionList.filter(item => !item.totalData).length,
        totalOutstanding: list.reduce((sum, item) => {
            if (!item.totalData) {
                return sum + (parseFloat(item.netBalance) || 0);
            }
            return sum;
        }, 0),
        totalCollected: collectionList.reduce((sum, item) => {
            if (!item.totalData) {
                return sum + (parseFloat(item.paymentCollection) || 0);
            }
            return sum;
        }, 0)
    };

    // Column definitions for List of Bad Debts
    const listColumns = [
        {
            Header: "Client Name",
            accessor: 'fullName',
            Cell: ({ value }) => (
                <div className="font-medium text-gray-900">{value}</div>
            )
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr',
            Cell: ({ value }) => (
                <div className="text-right font-medium">{value}</div>
            )
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr',
            Cell: ({ value }) => (
                <div className="text-right font-medium text-orange-600">{value}</div>
            )
        },
        {
            Header: "MCBU",
            accessor: 'mcbuReturnAmtStr',
            Cell: ({ value }) => (
                <div className="text-right">{value}</div>
            )
        },
        {
            Header: "Net Balance",
            accessor: 'netBalanceStr',
            Cell: ({ value }) => (
                <div className="text-right font-semibold text-red-600">{value}</div>
            )
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
            accessor: 'fullPaymentDate',
            Cell: ({ value }) => (
                <div className="text-gray-600">{value || 'N/A'}</div>
            )
        },
        {
            Header: "Remarks",
            accessor: 'remarks',
            Cell: ({ value }) => (
                <div className="text-gray-600 text-sm">{value || '-'}</div>
            )
        }
    ];

    // Column definitions for Collection of Bad Debts
    const collectionColumns = [
        {
            Header: "Client Name",
            accessor: 'fullName',
            Cell: ({ value }) => (
                <div className="font-medium text-gray-900">{value}</div>
            )
        },
        {
            Header: "Amount Collected",
            accessor: 'paymentCollectionStr',
            Cell: ({ value }) => (
                <div className="text-right font-semibold text-green-600">{value}</div>
            )
        },
        {
            Header: "Loan Release",
            accessor: 'loanReleaseStr',
            Cell: ({ value }) => (
                <div className="text-right">{value}</div>
            )
        },
        {
            Header: "Matured Past Due",
            accessor: 'maturedPastDueStr',
            Cell: ({ value }) => (
                <div className="text-right text-orange-600">{value}</div>
            )
        },
        {
            Header: "MCBU",
            accessor: 'mcbuStr',
            Cell: ({ value }) => (
                <div className="text-right">{value}</div>
            )
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
            accessor: 'dateAdded',
            Cell: ({ value }) => (
                <div className="text-gray-600">{value}</div>
            )
        }
    ];

    const handleShowAddDrawer = () => {
        setMode('add');
        setShowAddDrawer(true);
    };

    const handleCloseAddDrawer = () => {
        setShowAddDrawer(false);
        setLoading(true);
        window.location.reload();
    };

    const handleFilterChange = (filters, tabName) => {
        const sourceList = tabName === 'list' ? originalList : originalCollectionList;
        const setListAction = tabName === 'list' ? setBadDebtList : setBadDebtCollectionList;

        let filteredData = sourceList;

        if (filters.branchId) {
            filteredData = filteredData.filter(item => item.branchId === filters.branchId);
        }

        if (filters.loId) {
            filteredData = filteredData.filter(item => item.loId === filters.loId);
        }

        if (filters.groupId) {
            filteredData = filteredData.filter(item => item.groupId === filters.groupId);
        }

        if (filters.clientId) {
            filteredData = filteredData.filter(item => item.clientId === filters.clientId);
        }

        dispatch(setListAction(filteredData));
    };

    // Fetch data on component mount
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            // Prevent multiple simultaneous calls
            if (loading) return;
            
            setLoading(true);
            try {
                const params = new URLSearchParams();
                
                if (currentUser.role.rep === 3) {
                    params.append('branchId', currentUser.designatedBranchId);
                } else if (currentUser.role.rep === 4) {
                    params.append('loId', currentUser._id);
                } else {
                    params.append('currentUserId', currentUser._id);
                }

                // Fetch bad debt list
                const listUrl = getApiBaseUrl() + 'other-transactions/badDebtCollection/list-bad-debts?' + params;
                const listResponse = await fetchWrapper.get(listUrl);
                
                if (isMounted && listResponse.success) {
                    const formattedList = listResponse.data.map(item => {
                        // Extract data from arrays
                        const client = item.client?.length > 0 ? item.client[0] : null;
                        const branch = item.branch?.length > 0 ? item.branch[0] : null;
                        const lo = item.lo?.length > 0 ? item.lo[0] : null;
                        const group = item.group?.length > 0 ? item.group[0] : null;
                        const loan = item.loan?.length > 0 ? item.loan[0] : null;
                        
                        // Calculate values
                        const pastDue = loan?.pastDue || item.maturedPastDue || 0;
                        const mcbuReturnAmt = loan?.mcbuReturnAmt || item.mcbuReturnAmt || 0;
                        const netBalance = pastDue + mcbuReturnAmt;
                        
                        return {
                            ...item,
                            fullName: client?.name || 'N/A',
                            branchName: branch?.name || 'N/A',
                            loName: lo ? `${lo.firstName} ${lo.lastName}` : 'N/A',
                            groupName: group?.name || 'N/A',
                            amountReleaseStr: formatPricePhp(item.amountRelease || 0),
                            loanBalanceStr: formatPricePhp(pastDue),
                            mcbuReturnAmtStr: formatPricePhp(mcbuReturnAmt),
                            netBalance: netBalance,
                            netBalanceStr: formatPricePhp(netBalance),
                            fullPaymentDate: item.fullPaymentDate || '',
                            remarks: item.remarks || ''
                        };
                    });
                    
                    dispatch(setBadDebtList(formattedList));
                    dispatch(setOriginalBadDebtList(formattedList));
                }

                // Fetch collections
                const collectionUrl = getApiBaseUrl() + 'other-transactions/badDebtCollection/list?' + params;
                const collectionResponse = await fetchWrapper.get(collectionUrl);
                
                if (isMounted && collectionResponse.success) {
                    const formattedCollections = collectionResponse.data.map(item => ({
                        ...item,
                        fullName: item.client?.length > 0 ? item.client[0].name : 'N/A',
                        branchName: item.branch?.length > 0 ? item.branch[0].name : 'N/A',
                        loName: item.lo?.length > 0 ? `${item.lo[0].firstName} ${item.lo[0].lastName}` : 'N/A',
                        groupName: item.group?.length > 0 ? item.group[0].name : 'N/A',
                        paymentCollectionStr: formatPricePhp(item.paymentCollection || 0),
                        loanReleaseStr: formatPricePhp(item.loanRelease || 0),
                        maturedPastDueStr: formatPricePhp(item.maturedPastDue || 0),
                        mcbuStr: formatPricePhp(item.mcbu || 0)
                    }));
                    
                    dispatch(setBadDebtCollectionList(formattedCollections));
                    dispatch(setOriginalBadDebtCollectionList(formattedCollections));
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                if (isMounted) {
                    toast.error('Failed to load bad debt data');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (currentUser && !list.length && !collectionList.length) {
            fetchData();
        }

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    return (
        <Layout 
            title="Bad Debt Collection Management"
            showBackButton={false}
            actionButtons={[
                <ButtonSolid 
                    key="add-button" 
                    label="Record Collection" 
                    type="button" 
                    className="shadow-sm" 
                    onClick={handleShowAddDrawer} 
                    icon={[<PlusIcon className="w-5 h-5" />, 'left']} 
                />
            ]}
        >
            <div className="pb-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Spinner />
                    </div>
                ) : (
                    <React.Fragment>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                icon={UsersIcon}
                                label="Total Bad Debts"
                                value={stats.totalBadDebts}
                                iconBgColor="bg-red-100"
                                iconColor="text-red-600"
                            />
                            <StatsCard
                                icon={BanknotesIcon}
                                label="Total Collections"
                                value={stats.totalCollections}
                                iconBgColor="bg-green-100"
                                iconColor="text-green-600"
                            />
                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Outstanding Amount"
                                value={formatPricePhp(stats.totalOutstanding)}
                                iconBgColor="bg-orange-100"
                                iconColor="text-orange-600"
                            />
                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Total Collected"
                                value={formatPricePhp(stats.totalCollected)}
                                iconBgColor="bg-blue-100"
                                iconColor="text-blue-600"
                            />
                        </div>

                        {/* Tabs Navigation */}
                        <div className="bg-white rounded-t-lg shadow-sm border border-gray-200">
                            <nav className="flex border-b border-gray-200">
                                <TabSelector
                                    isActive={selectedTab === "list"}
                                    onClick={() => setSelectedTab("list")}
                                    className="px-6 py-4 text-sm font-medium"
                                >
                                    <div className="flex items-center space-x-2">
                                        <UsersIcon className="h-5 w-5" />
                                        <span>List of Bad Debts</span>
                                        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                                            {stats.totalBadDebts}
                                        </span>
                                    </div>
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "collection"}
                                    onClick={() => setSelectedTab("collection")}
                                    className="px-6 py-4 text-sm font-medium"
                                >
                                    <div className="flex items-center space-x-2">
                                        <BanknotesIcon className="h-5 w-5" />
                                        <span>Collection History</span>
                                        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                                            {stats.totalCollections}
                                        </span>
                                    </div>
                                </TabSelector>
                            </nav>

                            {/* Tab Content */}
                            <div className="p-6">
                                <TabPanel hidden={selectedTab !== 'list'}>
                                    <BadDebtFilters 
                                        onFilterChange={handleFilterChange} 
                                        tabName="list" 
                                    />
                                    
                                    {list.length === 0 ? (
                                        <EmptyState 
                                            message="No bad debts found. This is good news!"
                                        />
                                    ) : (
                                        <TableComponent 
                                            columns={listColumns} 
                                            data={list} 
                                            hasActionButtons={false} 
                                            showFilters={false}
                                            pageSize={20}
                                        />
                                    )}
                                </TabPanel>

                                <TabPanel hidden={selectedTab !== 'collection'}>
                                    <BadDebtFilters 
                                        onFilterChange={handleFilterChange} 
                                        tabName="collection" 
                                    />
                                    
                                    {collectionList.length === 0 ? (
                                        <EmptyState 
                                            message="No collections recorded yet."
                                            actionButton={
                                                <ButtonSolid
                                                    label="Record First Collection"
                                                    onClick={handleShowAddDrawer}
                                                    icon={[<PlusIcon className="w-4 h-4" />, 'left']}
                                                />
                                            }
                                        />
                                    ) : (
                                        <TableComponent 
                                            columns={collectionColumns} 
                                            data={collectionList} 
                                            hasActionButtons={false} 
                                            showFilters={false}
                                            pageSize={20}
                                        />
                                    )}
                                </TabPanel>
                            </div>
                        </div>
                    </React.Fragment>
                )}
            </div>

            {/* Add/Update Drawer */}
            <AddUpdateBadDebtCollection
                mode={mode}
                data={{}}
                showSidebar={showAddDrawer}
                setShowSidebar={setShowAddDrawer}
                onClose={handleCloseAddDrawer}
            />
        </Layout>
    );
}