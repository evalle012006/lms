import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/solid';
import TableComponent from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { getApiBaseUrl } from "@/lib/constants";
import AddUpdateMcbuWithdrawalDrawer from "@/components/transactions/mcbu-withdrawal/AddUpdateMcbuWithdrawalDrawer";

const McbuWithdrawalPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState([]);
    const [currentLevel, setCurrentLevel] = useState(null);
    const [filterParams, setFilterParams] = useState({});
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [columns, setColumns] = useState([]);
    const [dateRange, setDateRange] = useState([null, null]);

    const [mode, setMode] = useState('add');
    const [showSidebar, setShowSidebar] = useState(false);
    const [actionButtons, setActionButtons] = useState([]);

    // Define column configurations for each hierarchy level
    const columnConfigs = {
        admin: [
            {
                Header: "DIVISION",
                accessor: row => row.division && row.division.length > 0 ? row.division[0].name : '',
                id: 'division',
                width: 'w-1/3'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        division: [
            {
                Header: "REGION",
                accessor: row => row.region && row.region.length > 0 ? row.region[0].name : '',
                id: 'region',
                width: 'w-1/3'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        region: [
            {
                Header: "AREA",
                accessor: row => row.area && row.area.length > 0 ? row.area[0].name : '',
                id: 'area',
                width: 'w-1/3'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        area: [
            {
                Header: "BRANCH",
                accessor: row => row.branch && row.branch.length > 0 ? row.branch[0].name : '',
                id: 'branch',
                width: 'w-1/3'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        branch: [
            {
                Header: "LOAN OFFICER",
                accessor: row => row.loanOfficer && row.loanOfficer.length > 0 ? 
                    `${row.loanOfficer[0].firstName} ${row.loanOfficer[0].lastName}` : '',
                id: 'loanOfficer',
                width: 'w-1/3'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        loan_officer: [
            {
                Header: "GROUP",
                accessor: row => row.group && row.group.length > 0 ? row.group[0].name : '',
                id: 'group',
                width: 'w-1/4'
            },
            {
                Header: "TOTAL MCBU WITHDRAWAL AMOUNT",
                accessor: 'totalMcbuWithdrawalAmount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/3'
            },
            {
                Header: "TOTAL NO. OF MCBU WITHDRAWALS",
                accessor: 'totalNoOfMcbuWithdrawals',
                width: 'w-1/3'
            }
        ],
        group: [
            {
                Header: "CLIENT",
                accessor: row => row.client && row.client.length > 0 ? row.client[0].name : '',
                id: 'client',
                width: 'w-1/5'
            },
            {
                Header: "MCBU WITHDRAWAL AMOUNT",
                accessor: 'mcbu_withdrawal_amount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/5'
            },
            {
                Header: "STATUS",
                accessor: 'status',
                width: 'w-1/5'
            },
            {
                Header: "DATE",
                accessor: 'inserted_date',
                Cell: ({ value }) => formatDate(value),
                width: 'w-1/5'
            },
            {
                Header: "REMARKS",
                accessor: 'reason',
                width: 'w-1/5'
            }
        ]
    };

    // Helper function to format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(value || 0);
    };

    // Helper function to format date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Initialize user role and starting level
    useEffect(() => {
        let initialLevel;
        if (currentUser.role.rep === 1) {
            initialLevel = 'admin';
        } else if (currentUser.role.rep === 2) {
            if (currentUser.shortCode === 'deputy_director') {
                initialLevel = 'division';
            } else if (currentUser.shortCode === 'regional_manager') {
                initialLevel = 'region';
            } else if (currentUser.shortCode === 'area_admin') {
                initialLevel = 'area';
            }
        } else if (currentUser.role.rep === 3) {
            initialLevel = 'branch';
        } else if (currentUser.role.rep === 4) {
            initialLevel = 'loan_officer';
        }
        
        // Initialize columns and set current level
        setCurrentLevel(initialLevel);
        setColumns(columnConfigs[initialLevel]);

        // Initialize filter params based on user role
        const params = {};
        if (initialLevel === 'division') {
            params.division_id = currentUser.divisionId;
        } else if (initialLevel === 'region') {
            params.region_id = currentUser.regionId;
        } else if (initialLevel === 'area') {
            params.area_id = currentUser.areaId;
        } else if (initialLevel === 'branch') {
            params.branch_id = currentUser.designatedBranchId;
        } else if (initialLevel === 'loan_officer') {
            // Directly pass the current user's ID as loan officer ID
            params.lo_id = currentUser._id;
        }
        
        setFilterParams(params);
        
        // Initialize breadcrumbs based on user role
        const initialBreadcrumbs = [];
        if (initialLevel !== 'admin') {
            initialBreadcrumbs.push({ 
                level: initialLevel, 
                name: currentUser[initialLevel]?.name || `${currentUser.firstName} ${currentUser.lastName}`,
                id: params.division_id || params.region_id || params.area_id || params.branch_id || params.lo_id
            });
        }
        setBreadcrumbs(initialBreadcrumbs);
        
    }, [currentUser]);

    // Fetch data whenever filter params change
    useEffect(() => {
        if (currentLevel) {
            fetchMcbuWithdrawals();
        }
    }, [filterParams, currentLevel]);

    // Function to fetch MCBU withdrawals with filters
    const fetchMcbuWithdrawals = async () => {
        setLoading(true);
        try {
            const url = getApiBaseUrl() + 'transactions/mcbu-withdrawal/list?' + new URLSearchParams(filterParams);
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                // Process data to aggregate based on current level
                const processedData = processDataByLevel(response.data, currentLevel);
                setList(processedData);
            } else {
                toast.error(response.message || 'Failed to fetch data');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('An error occurred while fetching data');
        } finally {
            setLoading(false);
        }
    };

    // Process data based on current level - aggregate values
    const processDataByLevel = (data, level) => {
        if (!data || data.length === 0) return [];
        
        // For the lowest level (client), return raw data
        if (level === 'group') {
            return data;
        }
        
        // Field to group by for each level
        const groupByFields = {
            admin: 'division',
            division: 'region',
            region: 'area',
            area: 'branch',
            branch: 'loanOfficer',
            loan_officer: 'group'
        };
        
        const groupByField = groupByFields[level];
        if (!groupByField) return data;
        
        // Group and aggregate
        const groupedData = {};
        
        data.forEach(item => {
            // Skip if the item doesn't have the required field
            if (!item[groupByField] || item[groupByField].length === 0) return;
            
            const entityInfo = item[groupByField][0];
            const id = entityInfo._id;
            
            if (!groupedData[id]) {
                groupedData[id] = {
                    [groupByField]: [entityInfo],
                    totalMcbuWithdrawalAmount: 0,
                    totalNoOfMcbuWithdrawals: 0,
                    _id: id
                };
            }
            
            // Add withdrawal amount
            groupedData[id].totalMcbuWithdrawalAmount += parseFloat(item.mcbu_withdrawal_amount || 0);
            // Increment count
            groupedData[id].totalNoOfMcbuWithdrawals += 1;
        });
        
        return Object.values(groupedData);
    };

    // Handle row click to drill down
    const handleRowClick = (rowData) => {
        const nextLevelMap = {
            admin: 'division',
            division: 'region',
            region: 'area',
            area: 'branch',
            branch: 'loan_officer',
            loan_officer: 'group',
            group: null // No further drilling
        };
        
        const nextLevel = nextLevelMap[currentLevel];
        if (!nextLevel) return; // At the lowest level
        
        // Create new filter parameter based on clicked row
        const newParams = { ...filterParams };
        
        // Set the appropriate filter param based on current level
        if (currentLevel === 'admin') {
            newParams.division_id = rowData._id;
        } else if (currentLevel === 'division') {
            newParams.region_id = rowData._id;
        } else if (currentLevel === 'region') {
            newParams.area_id = rowData._id;
        } else if (currentLevel === 'area') {
            newParams.branch_id = rowData._id;
        } else if (currentLevel === 'branch') {
            newParams.lo_id = rowData._id;
        } else if (currentLevel === 'loan_officer') {
            newParams.group_id = rowData._id;
        }
        
                    // Update filter params
        setFilterParams(newParams);
        
        // Update current level
        setCurrentLevel(nextLevel);
        setColumns(columnConfigs[nextLevel]);
        
        // Update breadcrumbs
        const entityName = getEntityName(rowData, currentLevel);
        const newBreadcrumb = { level: currentLevel, name: entityName, id: rowData._id };
        setBreadcrumbs([...breadcrumbs, newBreadcrumb]);
        
        // Get fresh data with new filters
        fetchMcbuWithdrawals();
    };

    // Helper to get entity name from row based on level
    const getEntityName = (rowData, level) => {
        if (level === 'admin' && rowData.division && rowData.division.length > 0) {
            return rowData.division[0].name;
        } else if (level === 'division' && rowData.region && rowData.region.length > 0) {
            return rowData.region[0].name;
        } else if (level === 'region' && rowData.area && rowData.area.length > 0) {
            return rowData.area[0].name;
        } else if (level === 'area' && rowData.branch && rowData.branch.length > 0) {
            return rowData.branch[0].name;
        } else if (level === 'branch' && rowData.loanOfficer && rowData.loanOfficer.length > 0) {
            return `${rowData.loanOfficer[0].firstName} ${rowData.loanOfficer[0].lastName}`;
        } else if (level === 'loan_officer' && rowData.group && rowData.group.length > 0) {
            return rowData.group[0].name;
        }
        return 'Unknown';
    };

    // Handle breadcrumb click
    const handleBreadcrumbClick = (breadcrumb, index) => {
        // Don't do anything if clicking the last breadcrumb
        if (index === breadcrumbs.length - 1) return;
        
        // Get level to go back to
        const targetLevel = breadcrumb.level;
        const levelMap = ['admin', 'division', 'region', 'area', 'branch', 'loan_officer', 'group'];
        
        // Determine the next level after the target
        const targetIndex = levelMap.indexOf(targetLevel);
        const nextLevel = levelMap[targetIndex + 1];
        
        // Set level and columns
        setCurrentLevel(nextLevel);
        setColumns(columnConfigs[nextLevel]);
        
        // Update filter params
        const newParams = {};
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        
        // Reconstruct filter params from breadcrumbs
        newBreadcrumbs.forEach(crumb => {
            if (crumb.level === 'admin') {
                newParams.admin = true;
            } else if (crumb.level === 'division') {
                newParams.division_id = crumb.id;
            } else if (crumb.level === 'region') {
                newParams.region_id = crumb.id;
            } else if (crumb.level === 'area') {
                newParams.area_id = crumb.id;
            } else if (crumb.level === 'branch') {
                newParams.branch_id = crumb.id;
            } else if (crumb.level === 'loan_officer') {
                newParams.lo_id = crumb.id;
            }
        });
        
        setFilterParams(newParams);
        setBreadcrumbs(newBreadcrumbs);
    };
    
    // Handle date filter change
    const handleDateFilter = () => {
        if (dateRange[0] && dateRange[1]) {
            const formattedDates = [
                dateRange[0].toISOString().split('T')[0],
                dateRange[1].toISOString().split('T')[0]
            ];
            setFilterParams({ ...filterParams, dateFilter: formattedDates });
        }
    };

    // Clear date filter
    const clearDateFilter = () => {
        setDateRange([null, null]);
        const newParams = { ...filterParams };
        delete newParams.dateFilter;
        setFilterParams(newParams);
    };

    // Reset to home based on user role
    const resetToHome = () => {
        let initialLevel;
        if (currentUser.role.rep === 1) {
            initialLevel = 'admin';
            setFilterParams({});
            setBreadcrumbs([]);
        } else {
            // For other users, keep their initial filters
            handleBreadcrumbClick(breadcrumbs[0], 0);
        }
        setCurrentLevel(initialLevel);
        setColumns(columnConfigs[initialLevel]);
    };

    const handleShowAddDrawer = () => {
        setMode('add');
        setShowSidebar(true);
    }

    const handleCloseSidebar = () => {
        setMode('add');
        setShowSidebar(false);
    }

    useEffect(() => {
        const actnBtn = [];
        if (currentUser.role.rep >= 3) {
            actnBtn.push([
                <ButtonSolid label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
            ]);
        }

        setActionButtons(actnBtn);
    }, []);

    return (
        <Layout actionButtons={currentUser.role.rep >= 3 && actionButtons}>
            <div className="px-4 py-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">MCBU Withdrawals</h1>
                
                {/* Filter and Breadcrumb Bar */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="p-4">
                        {/* Breadcrumb Navigation */}
                        {breadcrumbs.length > 0 && (
                            <div className="flex items-center mb-4">
                                <span 
                                    className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer" 
                                    onClick={resetToHome}
                                >
                                    Home
                                </span>
                                
                                {breadcrumbs.map((breadcrumb, index) => (
                                    <React.Fragment key={index}>
                                        <span className="mx-2 text-gray-400">/</span>
                                        <span 
                                            className={`${index === breadcrumbs.length - 1 ? 'text-gray-700 font-semibold' : 'text-blue-600 hover:text-blue-800 font-medium cursor-pointer'}`}
                                            onClick={() => handleBreadcrumbClick(breadcrumb, index)}
                                        >
                                            {breadcrumb.name}
                                        </span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        
                        {/* Date Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 pr-10"
                                        value={dateRange[0] ? dateRange[0].toISOString().split('T')[0] : ''}
                                        onChange={(e) => setDateRange([new Date(e.target.value), dateRange[1]])}
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 pr-10"
                                        value={dateRange[1] ? dateRange[1].toISOString().split('T')[0] : ''}
                                        onChange={(e) => setDateRange([dateRange[0], new Date(e.target.value)])}
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex space-x-2">
                                <ButtonSolid 
                                    label="Apply" 
                                    type="button" 
                                    className="w-full justify-center bg-blue-600 hover:bg-blue-700" 
                                    onClick={handleDateFilter} 
                                />
                                <ButtonOutline 
                                    label="Clear" 
                                    type="button" 
                                    className="w-full justify-center border-gray-300 text-gray-700" 
                                    onClick={clearDateFilter} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Data Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner />
                        </div>
                    ) : (
                        <TableComponent 
                            columns={columns} 
                            data={list} 
                            hasActionButtons={false}
                            rowClick={handleRowClick}
                            showFilters={true}
                            showPagination={true}
                            title=""
                            pageSize={30}
                            noPadding={false}
                            border={true}
                        />
                    )}
                    {showSidebar && <AddUpdateMcbuWithdrawalDrawer origin='list' mode={mode} showSidebar={showSidebar} setShowSidebar={setShowSidebar} onClose={handleCloseSidebar} /> }
                </div>
            </div>
        </Layout>
    );
};

export default McbuWithdrawalPage;