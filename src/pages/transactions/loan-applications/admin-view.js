import React, { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import { formatPricePhp } from "@/lib/utils";
import moment from "moment";

const LoanApprovalsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    
    const [loading, setLoading] = useState(true);
    const [loans, setLoans] = useState([]);
    const [processedData, setProcessedData] = useState([]);
    const [currentLevel, setCurrentLevel] = useState('');
    const [drillDownPath, setDrillDownPath] = useState([]);
    
    // Summary statistics
    const [totalLoans, setTotalLoans] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);

    // Check access control - only role.rep <= 3
    useEffect(() => {
        if (currentUser && currentUser.role && currentUser.role.rep > 3) {
            toast.error("You don't have permission to access this page");
            return;
        }

        if (currentUser && currentUser.role && currentDate) {
            // Determine initial level based on user role
            let initialLevel = '';
            if (currentUser.role.rep === 1) {
                initialLevel = 'division';
            } else if (currentUser.role.rep === 2) {
                if (currentUser.role.shortCode === 'deputy_director') {
                    initialLevel = 'division';
                } else if (currentUser.role.shortCode === 'regional_manager') {
                    initialLevel = 'region';
                } else if (currentUser.role.shortCode === 'area_admin') {
                    initialLevel = 'area';
                }
            } else if (currentUser.role.rep === 3) {
                initialLevel = 'branch';
            }
            
            setCurrentLevel(initialLevel);
            fetchApprovedLoans();
        }
    }, [currentUser, currentDate]);

    // Fetch pending approval loans using existing API
    const fetchApprovedLoans = async () => {
        try {
            setLoading(true);
            
            const params = new URLSearchParams({
                currentDate: currentDate,
                currentUserId: currentUser._id,
                status: 'pending',
                pendingApproved: 'true'
            });

            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'transactions/loans/list?' + params.toString()
            );

            if (response.success) {
                // Filter loans with pendingApproved = true (double-check)
                const filteredLoans = response.loans?.filter(loan => loan.pendingApproved === true) || [];
                setLoans(filteredLoans);
                
                // Calculate totals
                const total = filteredLoans.length || 0;
                const amount = filteredLoans.reduce((sum, loan) => 
                    sum + (parseFloat(loan.amountRelease) || 0), 0) || 0;
                
                setTotalLoans(total);
                setTotalAmount(amount);
            } else {
                toast.error('Failed to fetch loan approvals');
            }
        } catch (error) {
            console.error('Error fetching pending approval loans:', error);
            toast.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    // Process loans into hierarchical structure based on current level
    useEffect(() => {
        if (loans.length > 0 && currentLevel) {
            const processed = processLoansForLevel(loans, currentLevel, drillDownPath);
            setProcessedData(processed);
        } else {
            setProcessedData([]);
        }
    }, [loans, currentLevel, drillDownPath]);

    // Process loans into groups based on current hierarchy level
    const processLoansForLevel = (loansList, level, path) => {
        let filteredLoans = [...loansList];
        
        // Apply drill-down filters
        path.forEach(filter => {
            if (filter.level === 'division') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.branch?.[0]?.divisionId === filter.id);
            } else if (filter.level === 'region') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.branch?.[0]?.regionId === filter.id);
            } else if (filter.level === 'area') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.branch?.[0]?.areaId === filter.id);
            } else if (filter.level === 'branch') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.branchId === filter.id);
            } else if (filter.level === 'lo') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.loId === filter.id);
            } else if (filter.level === 'group') {
                filteredLoans = filteredLoans.filter(loan => 
                    loan.groupId === filter.id);
            }
        });

        // Group loans by current level
        switch (level) {
            case 'division':
                return groupByDivision(filteredLoans);
            case 'region':
                return groupByRegion(filteredLoans);
            case 'area':
                return groupByArea(filteredLoans);
            case 'branch':
                return groupByBranch(filteredLoans);
            case 'lo':
                return groupByLO(filteredLoans);
            case 'group':
                return groupByGroup(filteredLoans);
            case 'client':
                return filteredLoans.map(loan => ({
                    _id: loan._id,
                    clientName: loan.client?.[0]?.fullName || 'N/A',
                    slotNo: loan.slotNo,
                    loanCycle: loan.loanCycle,
                    principalLoan: loan.principalLoan,
                    amountRelease: loan.amountRelease,
                    dateGranted: loan.dateGranted,
                    groupName: loan.group?.[0]?.name || 'N/A',
                }));
            default:
                return [];
        }
    };

    // Group functions
    const groupByDivision = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const division = loan.branch?.[0]?.division?.[0];
            if (division) {
                if (!grouped[division._id]) {
                    grouped[division._id] = {
                        _id: division._id,
                        name: division.name,
                        code: division.code,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'division'
                    };
                }
                grouped[division._id].loanCount++;
                grouped[division._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    };

    const groupByRegion = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const region = loan.branch?.[0]?.region?.[0];
            if (region) {
                if (!grouped[region._id]) {
                    grouped[region._id] = {
                        _id: region._id,
                        name: region.name,
                        code: region.code,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'region'
                    };
                }
                grouped[region._id].loanCount++;
                grouped[region._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    };

    const groupByArea = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const area = loan.branch?.[0]?.area?.[0];
            if (area) {
                if (!grouped[area._id]) {
                    grouped[area._id] = {
                        _id: area._id,
                        name: area.name,
                        code: area.code,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'area'
                    };
                }
                grouped[area._id].loanCount++;
                grouped[area._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    };

    const groupByBranch = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const branch = loan.branch?.[0];
            if (branch) {
                if (!grouped[branch._id]) {
                    grouped[branch._id] = {
                        _id: branch._id,
                        name: branch.name,
                        code: branch.code,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'branch'
                    };
                }
                grouped[branch._id].loanCount++;
                grouped[branch._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => a.code.localeCompare(b.code));
    };

    const groupByLO = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const lo = loan.loanOfficer?.[0];
            if (lo) {
                if (!grouped[lo._id]) {
                    grouped[lo._id] = {
                        _id: lo._id,
                        name: `${lo.firstName} ${lo.lastName}`,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'lo'
                    };
                }
                grouped[lo._id].loanCount++;
                grouped[lo._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    };

    const groupByGroup = (loansList) => {
        const grouped = {};
        loansList.forEach(loan => {
            const group = loan.group?.[0];
            if (group) {
                if (!grouped[group._id]) {
                    grouped[group._id] = {
                        _id: group._id,
                        name: group.name,
                        groupNo: group.groupNo,
                        loanCount: 0,
                        totalAmount: 0,
                        level: 'group'
                    };
                }
                grouped[group._id].loanCount++;
                grouped[group._id].totalAmount += parseFloat(loan.amountRelease) || 0;
            }
        });
        return Object.values(grouped).sort((a, b) => (a.groupNo || 0) - (b.groupNo || 0));
    };

    // Handle row click for drill-down
    const handleRowClick = (row) => {
        if (currentLevel === 'client') return; // No drill-down from client level

        const nextLevel = getNextLevel();
        const newPath = [...drillDownPath, {
            level: currentLevel,
            id: row._id,
            name: row.name
        }];
        
        setDrillDownPath(newPath);
        setCurrentLevel(nextLevel);
    };

    // Get next level in hierarchy
    const getNextLevel = () => {
        const levelOrder = ['division', 'region', 'area', 'branch', 'lo', 'group', 'client'];
        const currentIndex = levelOrder.indexOf(currentLevel);
        return currentIndex < levelOrder.length - 1 ? levelOrder[currentIndex + 1] : currentLevel;
    };

    // Handle breadcrumb click
    const handleBreadcrumbClick = (index) => {
        if (index === drillDownPath.length) return; // Already at this level

        const newPath = drillDownPath.slice(0, index);
        setDrillDownPath(newPath);
        
        if (index === 0) {
            // Back to initial level
            let initialLevel = '';
            if (currentUser.role.rep === 1) {
                initialLevel = 'division';
            } else if (currentUser.role.rep === 2) {
                if (currentUser.role.shortCode === 'deputy_director') {
                    initialLevel = 'division';
                } else if (currentUser.role.shortCode === 'regional_manager') {
                    initialLevel = 'region';
                } else if (currentUser.role.shortCode === 'area_admin') {
                    initialLevel = 'area';
                }
            } else if (currentUser.role.rep === 3) {
                initialLevel = 'branch';
            }
            setCurrentLevel(initialLevel);
        } else {
            const levelOrder = ['division', 'region', 'area', 'branch', 'lo', 'group', 'client'];
            const lastItem = newPath[newPath.length - 1];
            const nextLevelIndex = levelOrder.indexOf(lastItem.level) + 1;
            setCurrentLevel(levelOrder[nextLevelIndex]);
        }
    };

    // Get columns for current level
    const getColumns = () => {
        const baseColumns = [];

        if (currentLevel === 'client') {
            return [
                { Header: 'Client Name', accessor: 'clientName' },
                { Header: 'Group', accessor: 'groupName' },
                { Header: 'Slot No', accessor: 'slotNo' },
                { Header: 'Loan Cycle', accessor: 'loanCycle' },
                { Header: 'Principal Loan', accessor: 'principalLoan', format: 'currency' },
                { Header: 'Amount to Release', accessor: 'amountRelease', format: 'currency' },
                { Header: 'Expected Date', accessor: 'dateGranted', format: 'date' }
            ];
        }

        baseColumns.push({ Header: 'Name', accessor: 'name', clickable: true });
        
        if (currentLevel === 'branch') {
            baseColumns.push({ Header: 'Code', accessor: 'code' });
        }
        
        if (currentLevel === 'group') {
            baseColumns.push({ Header: 'Group No', accessor: 'groupNo' });
        }
        
        baseColumns.push(
            { Header: 'No. of Loans', accessor: 'loanCount' },
            { Header: 'Total Amount', accessor: 'totalAmount', format: 'currency' }
        );

        return baseColumns;
    };

    const columns = useMemo(() => getColumns(), [currentLevel]);

    // Format cell value based on column format
    const formatCellValue = (value, format) => {
        if (!value && value !== 0) return '-';
        
        switch (format) {
            case 'currency':
                return formatPricePhp(value);
            case 'date':
                return moment(value).format('MMM DD, YYYY');
            default:
                return value;
        }
    };

    // Get level display name
    const getLevelDisplayName = () => {
        const names = {
            division: 'Divisions',
            region: 'Regions',
            area: 'Areas',
            branch: 'Branches',
            lo: 'Loan Officers',
            group: 'Groups',
            client: 'Clients/Loans'
        };
        return names[currentLevel] || 'Data';
    };

    if (!currentUser) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-screen">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    if (currentUser.role && currentUser.role.rep > 3) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-screen">
                    <div className="text-center">
                        <p className="text-xl text-red-600 font-semibold">Access Denied</p>
                        <p className="text-gray-600 mt-2">You don't have permission to access this page</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Loan Approvals</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Loans pending approval for {moment(currentDate).format('MMMM DD, YYYY')}
                    </p>
                </div>

                {/* Breadcrumbs */}
                {drillDownPath.length > 0 && (
                    <div className="mb-4 flex items-center space-x-2 text-sm">
                        <button
                            onClick={() => handleBreadcrumbClick(0)}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            Home
                        </button>
                        {drillDownPath.map((crumb, index) => (
                            <React.Fragment key={index}>
                                <span className="text-gray-400">/</span>
                                <button
                                    onClick={() => handleBreadcrumbClick(index + 1)}
                                    className={`${
                                        index === drillDownPath.length - 1
                                            ? 'text-gray-900 font-medium'
                                            : 'text-blue-600 hover:text-blue-800'
                                    }`}
                                >
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* Summary Statistics */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Current View</p>
                            <p className="text-xl font-bold text-gray-900">{getLevelDisplayName()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Pending Approval</p>
                            <p className="text-xl font-bold text-gray-900">{totalLoans}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Amount to Release</p>
                            <p className="text-xl font-bold text-gray-900">{formatPricePhp(totalAmount)}</p>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        {processedData.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                {loans.length === 0 
                                    ? 'No loans pending approval for today'
                                    : 'No data available at this level'}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {columns.map((column, index) => (
                                                <th
                                                    key={index}
                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                >
                                                    {column.Header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {processedData.map((row, rowIndex) => (
                                            <tr
                                                key={rowIndex}
                                                className={`${
                                                    currentLevel !== 'client' 
                                                        ? 'hover:bg-gray-50 cursor-pointer transition-colors' 
                                                        : ''
                                                }`}
                                            >
                                                {columns.map((column, colIndex) => (
                                                    <td
                                                        key={colIndex}
                                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                        onClick={() => column.clickable && handleRowClick(row)}
                                                    >
                                                        {column.clickable ? (
                                                            <span className="text-blue-600 hover:text-blue-800 font-medium">
                                                                {formatCellValue(row[column.accessor], column.format)}
                                                            </span>
                                                        ) : (
                                                            formatCellValue(row[column.accessor], column.format)
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default LoanApprovalsPage;