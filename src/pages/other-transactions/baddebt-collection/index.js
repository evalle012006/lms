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
    const [selectedBadDebt, setSelectedBadDebt] = useState(null);
    const [selectedTab, setSelectedTab] = useTabs(['list', 'collection']);

    /*
    * Admin Branch Summary
    *
    * null = show all branches
    * object = show existing Bad Debts screen
    *          for the selected branch
    */
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [branchSearch, setBranchSearch] = useState('');
    
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.badDebtCollection.list);
    const collectionList = useSelector(state => state.badDebtCollection.collectionList);
    const originalList = useSelector(state => state.badDebtCollection.originalList);
    const originalCollectionList = useSelector(state => state.badDebtCollection.originalCollectionList);

    /*
    * Branch accounts have rep === 3.
    * Loan Officer accounts have rep === 4.
    *
    * Other management/admin accounts receive the
    * unrestricted/role-scoped list from the backend.
    *
    * For now, the Branch Summary is shown only to
    * accounts that are not Branch or LO accounts.
    */
    const showBranchSummary =
        currentUser &&
        currentUser.role?.rep !== 3 &&
        currentUser.role?.rep !== 4 &&
        !selectedBranch;

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
                <div className="text-gray-600 text-sm">
                    {value || '-'}
                </div>
            )
        },
        {
            Header: "Action",
            accessor: "action",
            Cell: ({ row }) => (
                <button
                    type="button"
                    onClick={() => handleShowAddDrawer(row.original)}
                    className="
                        px-3
                        py-1.5
                        text-xs
                        font-semibold
                        text-white
                        bg-blue-600
                        hover:bg-blue-700
                        rounded-md
                        transition-colors
                        whitespace-nowrap
                    "
                >
                    Add Collection
                </button>
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

    const handleShowAddDrawer = (badDebt = null) => {
        setMode('add');
        setSelectedBadDebt(badDebt);
        setShowAddDrawer(true);
    };

    const handleCloseAddDrawer = () => {
        setShowAddDrawer(false);
        setLoading(true);
        window.location.reload();
    };

    const handleFilterChange = (filters, tabName) => {

        const originalSource =
            tabName === 'list'
                ? originalList
                : originalCollectionList;

        const setListAction =
            tabName === 'list'
                ? setBadDebtList
                : setBadDebtCollectionList;

        /*
        * If Admin entered a branch from the summary,
        * the selected branch becomes the maximum scope.
        */
        let filteredData = selectedBranch
            ? originalSource.filter(
                item =>
                    item.branchId ===
                    selectedBranch.branchId
            )
            : originalSource;

        /*
        * Do not allow the Branch dropdown to move Admin
        * outside the selected branch.
        */
        if (
            filters.branchId &&
            !selectedBranch
        ) {
            filteredData =
                filteredData.filter(
                    item =>
                        item.branchId ===
                        filters.branchId
                );
        }

        if (filters.loId) {
            filteredData =
                filteredData.filter(
                    item =>
                        item.loId ===
                        filters.loId
                );
        }

        if (filters.groupId) {
            filteredData =
                filteredData.filter(
                    item =>
                        item.groupId ===
                        filters.groupId
                );
        }

        if (filters.clientId) {
            filteredData =
                filteredData.filter(
                    item =>
                        item.clientId ===
                        filters.clientId
                );
        }

        dispatch(
            setListAction(filteredData)
        );
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

                            clientId: client?._id || item.clientId || '',
                            branchId: branch?._id || item.branchId || '',
                            loId: lo?._id || item.loId || '',
                            groupId: group?._id || item.groupId || '',

                            fullName: client?.name || 'N/A',

                            branchCode:
                                branch?.code || '',

                            branchName:
                                branch?.name || 'N/A',

                            loName: lo
                                ? `${lo.firstName} ${lo.lastName}`
                                : 'N/A',
                            groupName: group?.name || 'N/A',

                            /*
                            * Keep raw values because the Admin Branch
                            * Summary needs to total these fields.
                            */
                            amountRelease:
                                parseFloat(item.amountRelease) || 0,

                            loanBalance:
                                parseFloat(pastDue) || 0,

                            mcbuReturnAmt:
                                parseFloat(mcbuReturnAmt) || 0,

                            netBalance:
                                parseFloat(netBalance) || 0,

                            amountReleaseStr:
                                formatPricePhp(item.amountRelease || 0),

                            loanBalanceStr:
                                formatPricePhp(pastDue),

                            mcbuReturnAmtStr:
                                formatPricePhp(mcbuReturnAmt),

                            netBalanceStr:
                                formatPricePhp(netBalance),

                            fullPaymentDate:
                                item.fullPaymentDate || '',

                            remarks:
                                item.remarks || ''
                        };
                    });
                    
                    dispatch(setBadDebtList(formattedList));
                    dispatch(setOriginalBadDebtList(formattedList));
                }

                // Fetch collections
                const collectionUrl = getApiBaseUrl() + 'other-transactions/badDebtCollection/list?' + params;
                const collectionResponse = await fetchWrapper.get(collectionUrl);
                
                if (isMounted && collectionResponse.success) {
                    const formattedCollections =
                        collectionResponse.data.map(item => {

                            const client =
                                item.client?.length > 0
                                    ? item.client[0]
                                    : null;

                            const branch =
                                item.branch?.length > 0
                                    ? item.branch[0]
                                    : null;

                            const lo =
                                item.lo?.length > 0
                                    ? item.lo[0]
                                    : null;

                            const group =
                                item.group?.length > 0
                                    ? item.group[0]
                                    : null;

                            return {
                                ...item,

                                clientId:
                                    client?._id ||
                                    item.clientId ||
                                    '',

                                branchId:
                                    branch?._id ||
                                    item.branchId ||
                                    '',

                                loId:
                                    lo?._id ||
                                    item.loId ||
                                    '',

                                groupId:
                                    group?._id ||
                                    item.groupId ||
                                    '',

                                fullName:
                                    client?.name || 'N/A',

                                branchName:
                                    branch?.name || 'N/A',

                                loName:
                                    lo
                                        ? `${lo.firstName} ${lo.lastName}`
                                        : 'N/A',

                                groupName:
                                    group?.name || 'N/A',

                                paymentCollection:
                                    parseFloat(
                                        item.paymentCollection
                                    ) || 0,

                                loanRelease:
                                    parseFloat(
                                        item.loanRelease
                                    ) || 0,

                                maturedPastDue:
                                    parseFloat(
                                        item.maturedPastDue
                                    ) || 0,

                                mcbu:
                                    parseFloat(
                                        item.mcbu
                                    ) || 0,

                                paymentCollectionStr:
                                    formatPricePhp(
                                        item.paymentCollection || 0
                                    ),

                                loanReleaseStr:
                                    formatPricePhp(
                                        item.loanRelease || 0
                                    ),

                                maturedPastDueStr:
                                    formatPricePhp(
                                        item.maturedPastDue || 0
                                    ),

                                mcbuStr:
                                    formatPricePhp(
                                        item.mcbu || 0
                                    )
                            };
                        });
                    
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

    /*
    * =========================================================
    * ADMIN BRANCH SUMMARY
    * =========================================================
    *
    * We use originalList because `list` can be changed by
    * BadDebtFilters.
    */
    const branchSummaryMap = {};

    /*
    * Build branch totals from current outstanding
    * Bad Debt records.
    */
    originalList
        .filter(item => !item.totalData)
        .forEach(item => {

            const branchId =
                item.branchId || 'unknown';

            const branchName =
                item.branchName || 'N/A';

            const branchCode =
                item.branchCode || '';

            if (!branchSummaryMap[branchId]) {
                branchSummaryMap[branchId] = {
                    branchId,
                    branchCode,
                    branchName,

                    totalClient: 0,
                    totalMcbu: 0,
                    totalLoanRelease: 0,
                    netBalance: 0,
                    collection: 0,
                    currentBalance: 0
                };
            }

            const branch =
                branchSummaryMap[branchId];

            branch.totalClient += 1;

            branch.totalMcbu +=
                parseFloat(
                    item.mcbuReturnAmt
                ) || 0;

            branch.totalLoanRelease +=
                parseFloat(
                    item.amountRelease
                ) || 0;

            branch.netBalance +=
                parseFloat(
                    item.netBalance
                ) || 0;
        });


    /*
    * Add recorded collections per branch.
    *
    * Collection History contains the payments that
    * have already been recorded.
    */
    originalCollectionList
        .filter(item => !item.totalData)
        .forEach(item => {

            const branchId =
                item.branchId || 'unknown';

            const branchName =
                item.branchName || 'N/A';

            /*
            * A branch could theoretically have collection
            * history but no remaining active Bad Debt,
            * because fully paid loans disappear from the
            * active Bad Debt list.
            */
            if (!branchSummaryMap[branchId]) {
                branchSummaryMap[branchId] = {
                    branchId,
                    branchName,

                    totalClient: 0,
                    totalMcbu: 0,
                    totalLoanRelease: 0,
                    netBalance: 0,
                    collection: 0,
                    currentBalance: 0
                };
            }

            branchSummaryMap[branchId].collection +=
                parseFloat(
                    item.paymentCollection
                ) || 0;
        });


    const branchSummary = Object.values(
        branchSummaryMap
    )
        .map(branch => ({
            ...branch,

            /*
            * IMPORTANT:
            *
            * The existing Bad Debt loan balance is already
            * reduced by save.js whenever a collection is
            * recorded.
            *
            * Therefore Current Balance uses the current
            * outstanding Net Balance directly.
            *
            * We DO NOT subtract Collection again.
            */
            currentBalance:
                branch.netBalance
        }))
        .sort((a, b) =>
            String(a.branchName).localeCompare(
                String(b.branchName)
            )
        );
    
    const filteredBranchSummary = branchSummary.filter((branch) => {
        const search = branchSearch
            .trim()
            .toLowerCase();

        if (!search) return true;

        const branchCode =
            String(branch.branchCode || '')
                .toLowerCase();

        const branchName =
            String(branch.branchName || '')
                .toLowerCase();

        const fullBranch =
            `${branchCode} - ${branchName}`;

        return (
            branchCode.includes(search) ||
            branchName.includes(search) ||
            fullBranch.includes(search)
        );
    });
    
    /*
    * =========================================================
    * OVERALL ADMIN BAD DEBT TOTALS
    * =========================================================
    */
    const branchSummaryTotals = branchSummary.reduce(
        (totals, branch) => {
            totals.totalClient +=
                Number(branch.totalClient || 0);

            totals.totalMcbu +=
                Number(branch.totalMcbu || 0);

            totals.totalNetBalance +=
                Number(branch.netBalance || 0);

            totals.totalCurrentBalance +=
                Number(branch.currentBalance || 0);

            return totals;
        },
        {
            totalClient: 0,
            totalMcbu: 0,
            totalNetBalance: 0,
            totalCurrentBalance: 0
        }
    );


    const branchSummaryColumns = [
        {
            Header: "Branch",
            accessor: "branchName",
            Cell: ({ row }) => {
                const branch = row.original;

                const displayName =
                    branch.branchCode
                        ? `${branch.branchCode} - ${branch.branchName}`
                        : branch.branchName;

                return (
                    <div className="font-semibold text-gray-900">
                        {displayName}
                    </div>
                );
            }
        },
        {
            Header: "Total Client",
            accessor: "totalClient",
            Cell: ({ value }) => (
                <div className="text-center font-semibold">
                    {value}
                </div>
            )
        },
        {
            Header: "Total MCBU",
            accessor: "totalMcbu",
            Cell: ({ value }) => (
                <div className="text-right">
                    {formatPricePhp(value || 0)}
                </div>
            )
        },
        {
            Header: "Total Loan Release",
            accessor: "totalLoanRelease",
            Cell: ({ value }) => (
                <div className="text-right">
                    {formatPricePhp(value || 0)}
                </div>
            )
        },
        {
            Header: "Net Balance",
            accessor: "netBalance",
            Cell: ({ value }) => (
                <div className="text-right font-semibold text-red-600">
                    {formatPricePhp(value || 0)}
                </div>
            )
        },
        {
            Header: "Collection",
            accessor: "collection",
            Cell: ({ value }) => (
                <div className="text-right font-semibold text-green-600">
                    {formatPricePhp(value || 0)}
                </div>
            )
        },
        {
            Header: "Current Balance",
            accessor: "currentBalance",
            Cell: ({ value }) => (
                <div className="text-right font-bold text-orange-600">
                    {formatPricePhp(value || 0)}
                </div>
            )
        },
        {
            Header: "Action",
            accessor: "action",
            Cell: ({ row }) => (
                <button
                    type="button"
                    onClick={() => {
                        const branch =
                            row.original;

                        setSelectedBranch(branch);

                        setSelectedTab("list");

                        dispatch(
                            setBadDebtList(
                                originalList.filter(
                                    item =>
                                        item.branchId ===
                                        branch.branchId
                                )
                            )
                        );

                        dispatch(
                            setBadDebtCollectionList(
                                originalCollectionList.filter(
                                    item =>
                                        item.branchId ===
                                        branch.branchId
                                )
                            )
                        );
                    }}
                    className="
                        px-4
                        py-2
                        text-sm
                        font-semibold
                        text-white
                        bg-blue-600
                        hover:bg-blue-700
                        rounded-md
                        transition-colors
                    "
                >
                    View
                </button>
            )
        }
    ];


    /*
    * Data shown inside the existing screen after
    * Admin clicks a branch.
    */
    const detailList = selectedBranch
        ? originalList.filter(
            item =>
                item.branchId ===
                selectedBranch.branchId
        )
        : list;


    const detailCollectionList = selectedBranch
        ? originalCollectionList.filter(
            item =>
                item.branchId ===
                selectedBranch.branchId
        )
        : collectionList;


    /*
    * Detail-screen statistics.
    */
    const detailStats = {
        totalBadDebts:
            detailList.filter(
                item => !item.totalData
            ).length,

        totalCollections:
            detailCollectionList.filter(
                item => !item.totalData
            ).length,

        totalOutstanding:
            detailList.reduce(
                (sum, item) => {
                    if (!item.totalData) {
                        return (
                            sum +
                            (
                                parseFloat(
                                    item.netBalance
                                ) || 0
                            )
                        );
                    }

                    return sum;
                },
                0
            ),

        totalCollected:
            detailCollectionList.reduce(
                (sum, item) => {
                    if (!item.totalData) {
                        return (
                            sum +
                            (
                                parseFloat(
                                    item.paymentCollection
                                ) || 0
                            )
                        );
                    }

                    return sum;
                },
                0
            )
    };

    return (
        <Layout
            title={
                selectedBranch
                    ? `Bad Debts - ${selectedBranch.branchName}`
                    : "Bad Debt Collection Management"
            }
            showBackButton={false}
            actionButtons={[]}
        >
            <div className="pb-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Spinner />
                    </div>
                ) : showBranchSummary ? (

                    /*
                    * =============================================
                    * ADMIN - BRANCH SUMMARY
                    * =============================================
                    */
                    <div>

                        {/* ============================================
                            ADMIN BAD DEBT TOTAL CARDS
                        ============================================ */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                            <StatsCard
                                icon={UsersIcon}
                                label="Total Client"
                                value={branchSummaryTotals.totalClient}
                                iconBgColor="bg-red-100"
                                iconColor="text-red-600"
                            />

                            <StatsCard
                                icon={BanknotesIcon}
                                label="Total MCBU"
                                value={formatPricePhp(
                                    branchSummaryTotals.totalMcbu
                                )}
                                iconBgColor="bg-green-100"
                                iconColor="text-green-600"
                            />

                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Total Net Balance"
                                value={formatPricePhp(
                                    branchSummaryTotals.totalNetBalance
                                )}
                                iconBgColor="bg-orange-100"
                                iconColor="text-orange-600"
                            />

                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Total Current Balance"
                                value={formatPricePhp(
                                    branchSummaryTotals.totalCurrentBalance
                                )}
                                iconBgColor="bg-blue-100"
                                iconColor="text-blue-600"
                            />

                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Search Branch
                                    </label>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={branchSearch}
                                            onChange={(e) =>
                                                setBranchSearch(e.target.value)
                                            }
                                            placeholder="Search branch code or branch name..."
                                            className="
                                                w-full
                                                border
                                                border-gray-300
                                                rounded-lg
                                                px-4
                                                py-2.5
                                                pr-10
                                                text-sm
                                                text-gray-900
                                                bg-white
                                                focus:outline-none
                                                focus:ring-2
                                                focus:ring-blue-500
                                                focus:border-blue-500
                                            "
                                        />

                                        {branchSearch && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setBranchSearch('')
                                                }
                                                className="
                                                    absolute
                                                    right-3
                                                    top-1/2
                                                    -translate-y-1/2
                                                    text-gray-400
                                                    hover:text-gray-700
                                                    text-lg
                                                "
                                                title="Clear search"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* ============================================
                            BRANCH SUMMARY TABLE
                        ============================================ */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">

                            <div className="px-6 py-5 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900">
                                    Bad Debts by Branch
                                </h2>

                                <p className="text-sm text-gray-500 mt-1">
                                    Select a branch to view its bad debt clients
                                    and collection history.
                                </p>
                            </div>

                            <div className="p-6">

                                {branchSummary.length === 0 ? (
                                    <EmptyState
                                        message="No bad debts found."
                                    />
                                ) : (
                                    <TableComponent
                                        columns={branchSummaryColumns}
                                        data={filteredBranchSummary}
                                        hasActionButtons={false}
                                        showFilters={false}
                                        pageSize={20}
                                    />
                                )}

                            </div>

                        </div>

                    </div>

                ) : (
                    <React.Fragment>
                        {selectedBranch && (
                            <div className="mb-5 flex items-center justify-between">

                                <div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedBranch(null);
                                            setSelectedTab("list");

                                            /*
                                            * Restore the complete Admin lists.
                                            */
                                            dispatch(
                                                setBadDebtList(
                                                    originalList
                                                )
                                            );

                                            dispatch(
                                                setBadDebtCollectionList(
                                                    originalCollectionList
                                                )
                                            );
                                        }}
                                        className="
                                            inline-flex
                                            items-center
                                            px-4
                                            py-2
                                            bg-gray-100
                                            hover:bg-gray-200
                                            text-gray-700
                                            text-sm
                                            font-semibold
                                            rounded-md
                                            transition-colors
                                        "
                                    >
                                        ← Back to Branches
                                    </button>
                                </div>

                                <div className="text-right">
                                    <div className="text-sm text-gray-500">
                                        Selected Branch
                                    </div>

                                    <div className="text-lg font-bold text-gray-900">
                                        {selectedBranch.branchName}
                                    </div>
                                </div>

                            </div>
                        )}
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                icon={UsersIcon}
                                label="Total Bad Debts"
                                value={selectedBranch
                                    ? detailStats.totalBadDebts
                                    : stats.totalBadDebts
                                }
                                iconBgColor="bg-red-100"
                                iconColor="text-red-600"
                            />
                            <StatsCard
                                icon={BanknotesIcon}
                                label="Total Collections"
                                value={selectedBranch
                                    ? detailStats.totalCollections
                                    : stats.totalCollections
                                }
                                iconBgColor="bg-green-100"
                                iconColor="text-green-600"
                            />
                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Outstanding Amount"
                                value={formatPricePhp(
                                    selectedBranch
                                        ? detailStats.totalOutstanding
                                        : stats.totalOutstanding
                                )}
                                iconBgColor="bg-orange-100"
                                iconColor="text-orange-600"
                            />
                            <StatsCard
                                icon={CurrencyDollarIcon}
                                label="Total Collected"
                                value={formatPricePhp(
                                    selectedBranch
                                        ? detailStats.totalCollected
                                        : stats.totalCollected
                                )}
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
                                            {selectedBranch
                                                ? detailStats.totalBadDebts
                                                : stats.totalBadDebts
                                            }
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
                                            {selectedBranch
                                                ? detailStats.totalCollections
                                                : stats.totalCollections
                                            }
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
                data={selectedBadDebt || {}}
                showSidebar={showAddDrawer}
                setShowSidebar={setShowAddDrawer}
                onClose={handleCloseAddDrawer}
            />
        </Layout>
    );
}