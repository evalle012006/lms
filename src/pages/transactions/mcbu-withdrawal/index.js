import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon, CalendarIcon, FunnelIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/solid';
import TableComponent from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { getApiBaseUrl } from "@/lib/constants";
import AddUpdateMcbuWithdrawalDrawer from "@/components/transactions/mcbu-withdrawal/AddUpdateMcbuWithdrawalDrawer";
import Modal from "@/lib/ui/Modal";

const McbuWithdrawalPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState([]);
    const [currentLevel, setCurrentLevel] = useState(null);
    const [filterParams, setFilterParams] = useState({});
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [columns, setColumns] = useState([]);
    const [dateRange, setDateRange] = useState([null, null]);
    const [showFilters, setShowFilters] = useState(false);

    const [mode, setMode] = useState('add');
    const [showSidebar, setShowSidebar] = useState(false);
    const [actionButtons, setActionButtons] = useState([]);

    const [editItem, setEditItem] = useState(null);

    const isFilterActive = filterParams.dateFilter !== undefined;
    
    // State for modals
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [deleteItem, setDeleteItem] = useState(null);

    // Column configs remain the same
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
        // Other column configs remain the same
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
                width: 'w-1/6'
            },
            {
                Header: "MCBU WITHDRAWAL AMOUNT",
                accessor: 'mcbu_withdrawal_amount',
                Cell: ({ value }) => formatCurrency(value),
                width: 'w-1/6'
            },
            {
                Header: "STATUS",
                accessor: 'status',
                width: 'w-1/6'
            },
            {
                Header: "ADDED DATE",
                accessor: 'inserted_date',
                Cell: ({ value }) => formatDate(value),
                width: 'w-1/6'
            },
            {
                Header: "STATUS DATE",
                id: 'status_date',
                accessor: row => {
                    if (row.status === 'approved' && row.approved_date) {
                        return formatDate(row.approved_date);
                    } else if (row.status === 'rejected' && row.rejected_date) {
                        return formatDate(row.rejected_date);
                    }
                    return '';
                },
                width: 'w-1/6'
            },
            {
                Header: "REMARKS",
                accessor: 'reason',
                width: 'w-1/6'
            }
        ]
    };

    // Helper functions remain the same
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2
        }).format(value || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    // Initialize user role and starting level - unchanged
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

    // Fetch data whenever filter params change - unchanged
    useEffect(() => {
        if (currentLevel) {
            fetchMcbuWithdrawals();
        }
    }, [filterParams, currentLevel]);

    // Enhanced fetch function with better error handling and data validation
    const fetchMcbuWithdrawals = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams(filterParams);
            const url = getApiBaseUrl() + 'transactions/mcbu-withdrawal/list?' + queryParams;
            
            console.log('Fetching data for level:', currentLevel);
            console.log('Request URL:', url);
            console.log('Filter params:', filterParams);
            
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                console.log('Raw API response:', response);
                
                if (!response.data || !Array.isArray(response.data)) {
                    console.error('API returned invalid data format:', response.data);
                    setList([]);
                    toast.error('Received invalid data format from server');
                    return;
                }
                
                if (response.data.length === 0) {
                    console.log('API returned empty data array');
                    setList([]);
                    return;
                }
                
                // Process data for the current level
                const processedData = processDataByLevel(response.data, currentLevel);
                console.log('Processed data for level', currentLevel, ':', processedData);
                
                if (processedData.length === 0) {
                    console.log('No data available after processing for level:', currentLevel);
                }
                
                setList(processedData);
            } else {
                console.error('API error:', response.message);
                toast.error(response.message || 'Failed to fetch data');
                setList([]);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('An error occurred while fetching data');
            setList([]);
        } finally {
            setLoading(false);
        }
    };

    // Enhanced data processing function with better error handling
    const processDataByLevel = (data, level) => {
        console.log(`Processing ${data.length} items for level: ${level}`);
        
        if (!data || data.length === 0) {
            console.log('No data to process');
            return [];
        }
        
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
        if (!groupByField) {
            console.error('Invalid level or missing groupByField mapping:', level);
            return data;
        }
        
        // Sample the data to understand its structure
        console.log(`Sample data item for level ${level}:`, data[0]);
        console.log(`Looking for ${groupByField} property in data`);
        
        // Group and aggregate
        const groupedData = {};
        let validItemCount = 0;
        let invalidItemCount = 0;
        
        data.forEach(item => {
            // Skip if the item doesn't have the required field
            if (!item[groupByField] || !Array.isArray(item[groupByField]) || item[groupByField].length === 0) {
                invalidItemCount++;
                return;
            }
            
            validItemCount++;
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
            
            // Add withdrawal amount (with error handling)
            const amount = parseFloat(item.mcbu_withdrawal_amount || 0);
            if (!isNaN(amount)) {
                groupedData[id].totalMcbuWithdrawalAmount += amount;
            }
            
            // Increment count
            groupedData[id].totalNoOfMcbuWithdrawals += 1;
        });
        
        console.log(`Processed ${validItemCount} valid items and skipped ${invalidItemCount} invalid items`);
        console.log(`Grouped into ${Object.keys(groupedData).length} unique entities`);
        
        return Object.values(groupedData);
    };

    // Handle row click to drill down - unchanged
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
        
        // Create new filter parameter based on clicked row, preserving existing ones
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
    };

    // Helper to get entity name from row based on level - unchanged
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

    const handleBreadcrumbClick = (breadcrumb, index) => {
        // Don't do anything if clicking the last breadcrumb
        if (index === breadcrumbs.length - 1) return;
        
        // Set up level map for reference
        const levelMap = ['admin', 'division', 'region', 'area', 'branch', 'loan_officer', 'group'];
        
        // When clicking on a breadcrumb, we want to view THAT level
        // Not the next level after it
        const targetLevel = breadcrumb.level;
        
        // Create a completely new filter parameters object
        // Only include parameters up to the PREVIOUS level (not including the clicked level)
        let newParams = {};
        
        // First, add filters for all levels BEFORE the clicked breadcrumb
        for (let i = 0; i < index; i++) {
            const crumb = breadcrumbs[i];
            if (crumb.level === 'division') {
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
        }
        
        // Keep date filters if they exist
        if (filterParams.dateFilter) {
            newParams.dateFilter = filterParams.dateFilter;
        }
        
        // Set new breadcrumbs up to (but not including) the clicked one
        const newBreadcrumbs = breadcrumbs.slice(0, index);
        setBreadcrumbs(newBreadcrumbs);
        
        // Update state in the correct order
        setCurrentLevel(targetLevel);
        setColumns(columnConfigs[targetLevel] || []);
        setFilterParams(newParams);
    };
    
    // Handle date filter change - unchanged
    const handleDateFilter = () => {
        if (dateRange[0] && dateRange[1]) {
            const formattedDates = [
                dateRange[0].toISOString().split('T')[0],
                dateRange[1].toISOString().split('T')[0]
            ];
            setFilterParams({ ...filterParams, dateFilter: formattedDates });
            setShowFilters(false); // Hide filters after applying
        }
    };

    // Clear date filter - unchanged
    const clearDateFilter = () => {
        setDateRange([null, null]);
        const newParams = { ...filterParams };
        delete newParams.dateFilter;
        setFilterParams(newParams);
    };

    // Reset to home based on user role - FIXED to prevent infinite loop
    const resetToHome = () => {
        let initialLevel;
        let initialParams = {};
        
        if (currentUser.role.rep === 1) {
            initialLevel = 'admin';
            initialParams.admin = true; // Special case for admin
            setBreadcrumbs([]);
        } else {
            // For other users, set their base level and params
            if (currentUser.role.rep === 2) {
                if (currentUser.shortCode === 'deputy_director') {
                    initialLevel = 'division';
                    initialParams.division_id = currentUser.divisionId;
                } else if (currentUser.shortCode === 'regional_manager') {
                    initialLevel = 'region';
                    initialParams.region_id = currentUser.regionId;
                } else if (currentUser.shortCode === 'area_admin') {
                    initialLevel = 'area';
                    initialParams.area_id = currentUser.areaId;
                }
            } else if (currentUser.role.rep === 3) {
                initialLevel = 'branch';
                initialParams.branch_id = currentUser.designatedBranchId;
            } else if (currentUser.role.rep === 4) {
                initialLevel = 'loan_officer';
                initialParams.lo_id = currentUser._id;
            }
            
            // Reset breadcrumbs to only contain the base level
            const initialBreadcrumbs = [{
                level: initialLevel,
                name: currentUser[initialLevel]?.name || `${currentUser.firstName} ${currentUser.lastName}`,
                id: initialParams.division_id || initialParams.region_id || initialParams.area_id || 
                    initialParams.branch_id || initialParams.lo_id
            }];
            setBreadcrumbs(initialBreadcrumbs);
        }
        
        // Clear date filter
        setDateRange([null, null]);
        
        // Important: Set these in order to prevent race conditions
        setCurrentLevel(initialLevel);
        setColumns(columnConfigs[initialLevel]);
        setFilterParams(initialParams);
    };

    const handleShowAddDrawer = () => {
        setMode('add');
        setShowSidebar(true);
    }

    const handleCloseSidebar = () => {
        setMode('add');
        setShowSidebar(false);
        fetchMcbuWithdrawals();
    }

    // Toggle filter visibility
    const toggleFilters = () => {
        setShowFilters(!showFilters);
    }

    useEffect(() => {
        const actnBtn = [];
        if (currentUser.role.rep >= 3) {
            actnBtn.push([
                <ButtonSolid key="add-loan" label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
            ]);
        }

        setActionButtons(actnBtn);
    }, []);

    // State for selected clients
    const [selectedClients, setSelectedClients] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    
    // Handle selecting individual clients
    const handleClientSelect = (client) => {
        if (selectedClients.some(c => c._id === client._id)) {
            setSelectedClients(selectedClients.filter(c => c._id !== client._id));
        } else {
            setSelectedClients([...selectedClients, client]);
        }
    };
    
    // Handle select all clients
    const handleSelectAllClients = () => {
        if (selectAll) {
            setSelectedClients([]);
        } else {
            setSelectedClients([...list]);
        }
        setSelectAll(!selectAll);
    };
    
    // Handle bulk approve
    const handleBulkApprove = async () => {
        if (selectedClients.length === 0) {
            toast.warning('Please select at least one client');
            return;
        }
        
        setLoading(true);
        try {
            const currentDate = new Date().toISOString();
            
            // Example API call with proper fields for approval
            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/mcbu-withdrawal/bulk-approve', {
                withdrawals: selectedClients.map(client => ({
                    id: client._id,
                    loan_id: client.loan_id,
                    mcbu_withdrawal_amount: client.mcbu_withdrawal_amount,
                    status: 'approved',
                    approved_date: currentDate,
                    modified_date: currentDate,
                    modified_by: currentUser._id
                }))
            });
            
            if (response.success) {
                toast.success(`Successfully approved ${selectedClients.length} withdrawal requests`);
                setSelectedClients([]);
                setSelectAll(false);
                fetchMcbuWithdrawals(); // Refresh data
            } else {
                toast.error(response.message || 'Failed to approve withdrawals');
            }
        } catch (error) {
            console.error('Error approving withdrawals:', error);
            toast.error('An error occurred while approving withdrawals');
        } finally {
            setLoading(false);
        }
    };
    
    // Handle opening reject modal
    const handleOpenRejectModal = () => {
        if (selectedClients.length === 0) {
            toast.warning('Please select at least one client');
            return;
        }
        setRejectReason('');
        setShowRejectModal(true);
    };
    
    // Handle closing reject modal
    const handleCloseRejectModal = () => {
        setShowRejectModal(false);
    };
    
    // Handle bulk reject with reason
    const handleBulkReject = async () => {
        if (!rejectReason.trim()) {
            toast.warning('Please provide a reason for rejection');
            return;
        }
        
        setLoading(true);
        try {
            const currentDate = new Date().toISOString();
            
            // Example API call with proper fields for rejection
            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/mcbu-withdrawal/bulk-reject', {
                withdrawals: selectedClients.map(client => ({
                    id: client._id,
                    status: 'rejected',
                    rejected_date: currentDate,
                    reason: rejectReason,
                    modified_date: currentDate,
                    modified_by: currentUser._id
                }))
            });
            
            if (response.success) {
                toast.success(`Successfully rejected ${selectedClients.length} withdrawal requests`);
                setSelectedClients([]);
                setSelectAll(false);
                setShowRejectModal(false);
                fetchMcbuWithdrawals(); // Refresh data
            } else {
                toast.error(response.message || 'Failed to reject withdrawals');
            }
        } catch (error) {
            console.error('Error rejecting withdrawals:', error);
            toast.error('An error occurred while rejecting withdrawals');
        } finally {
            setLoading(false);
        }
    };
    
    // Handle edit row
    const handleEditRow = (rowData) => {
        setMode('edit');
        setEditItem(rowData);
        setShowSidebar(true);
    };
    
    // Handle delete row - open confirmation modal
    const handleDeleteRow = (rowData) => {
        setDeleteItem(rowData);
        setShowDeleteModal(true);
    };
    
    // Handle confirm delete
    const handleConfirmDelete = async () => {
        if (!deleteItem) return;
        
        try {
            // Example API call - replace with actual implementation
            const response = await fetchWrapper.delete(
                `${getApiBaseUrl()}transactions/mcbu-withdrawal/${deleteItem._id}`
            );
            
            if (response.success) {
                toast.success('Withdrawal successfully deleted');
                fetchMcbuWithdrawals(); // Refresh data
                setShowDeleteModal(false);
                setDeleteItem(null);
            } else {
                toast.error(response.message || 'Failed to delete withdrawal');
            }
        } catch (error) {
            console.error('Error deleting withdrawal:', error);
            toast.error('An error occurred while deleting withdrawal');
        }
    };
    
    // Close delete modal
    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setDeleteItem(null);
    };
    
    // Define dropdown actions for ActionDropDown component
    const rowActions = [
        {
            label: 'Edit',
            action: handleEditRow,
            hidden: false
        },
        {
            label: 'Delete',
            action: (rowData) => {
                handleDeleteRow(rowData);
            },
            hidden: false
        }
    ];
    
    // Get custom columns for client level that include checkboxes
    const getClientLevelColumns = () => {
        if (currentLevel === 'group') {
            return [
                {
                    Header: () => (
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAllClients}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                        </div>
                    ),
                    accessor: '_selection',
                    Cell: ({ row }) => (
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={selectedClients.some(c => c._id === row.original._id)}
                                onChange={() => handleClientSelect(row.original)}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                        </div>
                    ),
                    width: 'w-12',
                    disableSortBy: true
                },
                ...columnConfigs.group
                // Removed the actions column definition from here
                // The ActionDropDown will be handled by the TableComponent's built-in actions mechanism
            ];
        }
        
        return columns;
    };
    
    // Update columns when at client level
    useEffect(() => {
        if (currentLevel === 'group') {
            setColumns(getClientLevelColumns());
        } else {
            setColumns(columnConfigs[currentLevel] || []);
        }
    }, [currentLevel, selectedClients, selectAll]);
    
    // Clear selections when changing levels
    useEffect(() => {
        setSelectedClients([]);
        setSelectAll(false);
    }, [currentLevel]);

    return (
        <Layout actionButtons={currentUser.role.rep >= 3 && actionButtons}>
            <div className="px-4 py-6">
                {/* Compact Filter and Breadcrumb Bar */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="px-4 py-3">
                        {/* Breadcrumb Navigation */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center flex-grow overflow-x-auto">
                                <button 
                                    className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                                    onClick={resetToHome}
                                    type="button"
                                >
                                    Home
                                </button>
                                
                                {breadcrumbs.map((breadcrumb, index) => (
                                    <React.Fragment key={index}>
                                        <span className="mx-2 text-gray-400">/</span>
                                        <button 
                                            className={`whitespace-nowrap ${index === breadcrumbs.length - 1 ? 'text-gray-700 font-semibold' : 'text-blue-600 hover:text-blue-800 font-medium'}`}
                                            onClick={() => handleBreadcrumbClick(breadcrumb, index)}
                                            disabled={index === breadcrumbs.length - 1}
                                            type="button"
                                        >
                                            {breadcrumb.name}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                            
                            {/* Filter Toggle Button */}
                            <div className="flex items-center ml-4">
                                <button
                                    type="button"
                                    onClick={toggleFilters}
                                    className={`inline-flex items-center px-3 py-1.5 border ${isFilterActive ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 bg-white text-gray-700'} rounded-md text-sm font-medium hover:bg-gray-50`}
                                >
                                    <FunnelIcon className="h-4 w-4 mr-1" />
                                    {isFilterActive ? 'Filters Applied' : 'Filters'}
                                </button>
                            </div>
                        </div>
                        
                        {/* Collapsible Date Filter */}
                        {showFilters && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-medium text-gray-700">Date Range Filter</h3>
                                    <button
                                        type="button"
                                        onClick={toggleFilters}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="relative">
                                        <div className="flex items-center">
                                            <span className="text-xs text-gray-500 mr-2">From:</span>
                                            <div className="relative flex-grow">
                                                <input 
                                                    type="date" 
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1.5 text-sm"
                                                    value={dateRange[0] ? dateRange[0].toISOString().split('T')[0] : ''}
                                                    onChange={(e) => setDateRange([new Date(e.target.value), dateRange[1]])}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="relative">
                                        <div className="flex items-center">
                                            <span className="text-xs text-gray-500 mr-2">To:</span>
                                            <div className="relative flex-grow">
                                                <input 
                                                    type="date" 
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-1.5 text-sm"
                                                    value={dateRange[1] ? dateRange[1].toISOString().split('T')[0] : ''}
                                                    onChange={(e) => setDateRange([dateRange[0], new Date(e.target.value)])}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex space-x-2">
                                    <ButtonSolid 
                                        label="Apply" 
                                        type="button" 
                                        className="text-xs py-1.5 w-full justify-center bg-blue-600 hover:bg-blue-700" 
                                        onClick={handleDateFilter} 
                                    />
                                    <ButtonOutline 
                                        label="Clear" 
                                        type="button" 
                                        className="text-xs py-1.5 w-full justify-center border-gray-300 text-gray-700" 
                                        onClick={clearDateFilter} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Bulk Actions for Group Level */}
                {currentLevel === 'group' && (
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-700">
                            {selectedClients.length} clients selected
                        </span>
                        <div className="flex space-x-2">
                            <ButtonSolid
                                label="Approve"
                                type="button"
                                className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-sm"
                                onClick={handleBulkApprove}
                                disabled={selectedClients.length === 0}
                            />
                            <ButtonSolid
                                label="Reject"
                                type="button"
                                className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-sm"
                                onClick={handleOpenRejectModal}
                                disabled={selectedClients.length === 0}
                            />
                        </div>
                    </div>
                )}
                
                {/* Rejection Reason Modal */}
                {showRejectModal && (
                    <Modal
                        title="Reject Withdrawals"
                        show={showRejectModal}
                        onClose={handleCloseRejectModal}
                        width="30rem"
                    >
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-medium mb-2">
                                Reason for Rejection
                            </label>
                            <textarea
                                className="block w-full px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                rows="4"
                                placeholder="Enter reason for rejection"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            ></textarea>
                            <p className="mt-2 text-sm text-gray-600">
                                Rejecting {selectedClients.length} withdrawal request{selectedClients.length !== 1 ? 's' : ''}.
                            </p>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <ButtonOutline
                                label="Cancel"
                                type="button"
                                className="py-1.5 px-3 text-sm"
                                onClick={handleCloseRejectModal}
                            />
                            <ButtonSolid
                                label="Confirm Rejection"
                                type="button"
                                className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-sm"
                                onClick={handleBulkReject}
                                disabled={!rejectReason.trim()}
                            />
                        </div>
                    </Modal>
                )}
                
                {/* Delete Confirmation Modal */}
                {showDeleteModal && <Modal
                    title="Delete Withdrawal"
                    show={showDeleteModal}
                    onClose={handleCloseDeleteModal}
                    width="30rem"
                >
                    <div className="mb-4">
                        <p className="text-gray-700">
                            Are you sure you want to delete this withdrawal? This action cannot be undone.
                        </p>
                        {deleteItem && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-md">
                                <p className="text-sm font-medium text-gray-700">
                                    Client: {deleteItem.client && deleteItem.client.length > 0 ? deleteItem.client[0].name : 'Unknown'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Amount: {formatCurrency(deleteItem.mcbu_withdrawal_amount)}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Date: {formatDate(deleteItem.inserted_date)}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end space-x-2">
                        <ButtonOutline
                            label="Cancel"
                            type="button"
                            className="py-1.5 px-3 text-sm"
                            onClick={handleCloseDeleteModal}
                        />
                        <ButtonSolid
                            label="Confirm Delete"
                            type="button"
                            className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-sm"
                            onClick={handleConfirmDelete}
                        />
                    </div>
                </Modal>}
                
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
                            hasActionButtons={currentLevel === 'group'} 
                            rowClick={currentLevel !== 'group' ? handleRowClick : null}
                            showFilters={true}
                            showPagination={true}
                            title=""
                            pageSize={30}
                            noPadding={false}
                            border={true}
                            dropDownActions={currentLevel === 'group' ? rowActions : []} 
                            dropDownActionOrigin="mcbu-withdrawal"
                        />
                    )}
                    {showSidebar && <AddUpdateMcbuWithdrawalDrawer origin='list' mode={mode} mcbuData={editItem} showSidebar={showSidebar} setShowSidebar={setShowSidebar} onClose={handleCloseSidebar} /> }
                </div>
            </div>
        </Layout>
    );
};

export default McbuWithdrawalPage;