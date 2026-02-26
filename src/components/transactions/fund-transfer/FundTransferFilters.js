import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import SelectDropdown from '@/lib/ui/select';
import moment from 'moment';

const FundTransferFilters = ({ 
    transactionList, 
    historyList, 
    setFilteredTransactionData, 
    setFilteredHistoryData,
    activeTab 
}) => {
    const branchList = useSelector(state => state.branch.list);
    
    // Set default dates - current month (from 1st to today)
    const getDefaultDates = () => {
        const now = moment();
        return {
            dateFrom: now.clone().startOf('month').format('YYYY-MM-DD'),
            dateTo: now.format('YYYY-MM-DD')
        };
    };

    const [filters, setFilters] = useState({
        ...getDefaultDates(), // Set default dates
        giverBranchId: '',
        receiverBranchId: '',
        account: '',
        status: ''
    });

    // Account options
    const accountOptions = [
        { value: '', label: 'All Accounts' },
        { value: 'BMC', label: 'Bank Manager\'s Check' },
        { value: 'B2B', label: 'Bank to Bank' },
        { value: 'REC', label: 'Remittance Center' },
        { value: 'CFT', label: 'Cash Fund Transfer' },
        { value: 'FFPAY', label: 'Payment for Furniture & Fixture' },
        { value: 'FTMO', label: 'FT to Main Office' },
        { value: 'MCPAY', label: 'Payment for Motorcycle' },
        { value: 'OSPAY', label: 'Payment for Office Supplies' },
        { value: 'MEDPAY', label: 'Payment for Medicine due to Medical Mission' },
        { value: 'RGGPAY', label: 'Payment for Relief Goods & Grants due to Calamity' },
        { value: 'UCRPAY', label: 'Unclaim Return of Client' },
        { value: 'ADVPAY', label: 'Advances due to Accident & Others' },
        { value: 'RENTPAY', label: 'Payment for Rental' },
        { value: 'DBPAY', label: 'Payment for Death Benefits' },
        { value: 'CPPAY', label: 'Payment for Communication & Postage' },
        { value: 'BDPPAY', label: 'Payment for Business Development' },
        { value: 'CLIPAY', label: 'Payment of Client' },
        { value: 'SDTR', label: 'Salary Disbursement due to Staff Transfer' },
        { value: 'EXPOTH', label: 'Any Expenses not Mentioned Above' }
    ];

    // Status options for transactions tab
    const transactionStatusOptions = [
        { value: '', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
    ];

    // Status options for history tab
    const historyStatusOptions = [
        { value: '', label: 'All Statuses' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
    ];

    // Approval status options for transactions tab
    const approvalStatusOptions = [
        { value: '', label: 'All Approval Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' }
    ];

    // Branch options
    const branchOptions = [
        { value: '', label: 'All Branches' },
        ...(branchList || []).map(branch => ({
            value: branch._id,
            label: `${branch.code} ${branch.name}`
        }))
    ];

    const applyFilters = (data, isHistoryTab = false) => {
        if (!data || data.length === 0) return [];

        return data.filter(item => {
            // Date filter
            if (filters.dateFrom || filters.dateTo) {
                const itemDate = moment(item.insertedDate);
                if (filters.dateFrom && itemDate.isBefore(moment(filters.dateFrom), 'day')) {
                    return false;
                }
                if (filters.dateTo && itemDate.isAfter(moment(filters.dateTo), 'day')) {
                    return false;
                }
            }

            // Giver branch filter
            if (filters.giverBranchId && item.giverBranchId !== filters.giverBranchId) {
                return false;
            }

            // Receiver branch filter
            if (filters.receiverBranchId && item.receiverBranchId !== filters.receiverBranchId) {
                return false;
            }

            // Account filter
            if (filters.account && item.account !== filters.account) {
                return false;
            }

            // Status filter
            if (filters.status && item.status !== filters.status) {
                return false;
            }

            return true;
        });
    };

    useEffect(() => {
        if (activeTab === 'fund-transfer-transactions') {
            const filteredData = applyFilters(transactionList, false);
            setFilteredTransactionData(filteredData);
        } else if (activeTab === 'fund-transfer-history') {
            const filteredData = applyFilters(historyList, true);
            setFilteredHistoryData(filteredData);
        }
    }, [filters, transactionList, historyList, activeTab]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const clearFilters = () => {
        setFilters({
            ...getDefaultDates(), // Reset to default dates instead of empty
            giverBranchId: '',
            receiverBranchId: '',
            account: '',
            status: ''
        });
    };

    // Helper functions for quick date ranges
    const setCurrentMonth = () => {
        const dates = getDefaultDates();
        setFilters(prev => ({
            ...prev,
            dateFrom: dates.dateFrom,
            dateTo: dates.dateTo
        }));
    };

    const setLast30Days = () => {
        const now = moment();
        setFilters(prev => ({
            ...prev,
            dateFrom: now.clone().subtract(30, 'days').format('YYYY-MM-DD'),
            dateTo: now.format('YYYY-MM-DD')
        }));
    };

    const setLast7Days = () => {
        const now = moment();
        setFilters(prev => ({
            ...prev,
            dateFrom: now.clone().subtract(7, 'days').format('YYYY-MM-DD'),
            dateTo: now.format('YYYY-MM-DD')
        }));
    };

    const setToday = () => {
        const today = moment().format('YYYY-MM-DD');
        setFilters(prev => ({
            ...prev,
            dateFrom: today,
            dateTo: today
        }));
    };

    // Check if current filters are not the default
    const hasActiveFilters = () => {
        const defaults = getDefaultDates();
        return filters.dateFrom !== defaults.dateFrom || 
               filters.dateTo !== defaults.dateTo ||
               filters.giverBranchId !== '' ||
               filters.receiverBranchId !== '' ||
               filters.account !== '' ||
               filters.status !== '';
    };

    return (
        <div className="bg-white border-b border-gray-200 p-4 mb-4">
            {/* Quick Date Range Buttons */}
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600 mr-2">Quick Dates:</span>
                <button
                    onClick={setToday}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                    Today
                </button>
                <button
                    onClick={setLast7Days}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                >
                    Last 7 Days
                </button>
                <button
                    onClick={setLast30Days}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
                >
                    Last 30 Days
                </button>
                <button
                    onClick={setCurrentMonth}
                    className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
                >
                    Current Month
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                {/* Date Range Filters */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Date From:
                    </label>
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Date To:
                    </label>
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Giver Branch Filter */}
                <div className="min-w-[200px]">
                    <SelectDropdown
                        name="giverBranch"
                        field="giverBranch"
                        value={filters.giverBranchId}
                        label=""
                        options={branchOptions}
                        onChange={(field, value) => handleFilterChange('giverBranchId', value)}
                        placeholder="Giver Branch"
                        className="text-sm"
                        containerClassName="mb-0"
                    />
                </div>

                {/* Receiver Branch Filter */}
                <div className="min-w-[200px]">
                    <SelectDropdown
                        name="receiverBranch"
                        field="receiverBranch"
                        value={filters.receiverBranchId}
                        label=""
                        options={branchOptions}
                        onChange={(field, value) => handleFilterChange('receiverBranchId', value)}
                        placeholder="Receiver Branch"
                        className="text-sm"
                        containerClassName="mb-0"
                    />
                </div>

                {/* Account Filter */}
                <div className="min-w-[160px]">
                    <SelectDropdown
                        name="account"
                        field="account"
                        value={filters.account}
                        label=""
                        options={accountOptions}
                        onChange={(field, value) => handleFilterChange('account', value)}
                        placeholder="Account Type"
                        className="text-sm"
                        containerClassName="mb-0"
                    />
                </div>

                {/* Status Filter */}
                <div className="min-w-[140px]">
                    <SelectDropdown
                        name="status"
                        field="status"
                        value={filters.status}
                        label=""
                        options={activeTab === 'fund-transfer-history' ? historyStatusOptions : transactionStatusOptions}
                        onChange={(field, value) => handleFilterChange('status', value)}
                        placeholder="Status"
                        className="text-sm"
                        containerClassName="mb-0"
                    />
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters() && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-md transition-colors"
                    >
                        Reset to Current Month
                    </button>
                )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters() && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-medium text-gray-600">Active filters:</span>
                        {filters.dateFrom && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                From: {moment(filters.dateFrom).format('MMM DD, YYYY')}
                            </span>
                        )}
                        {filters.dateTo && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                To: {moment(filters.dateTo).format('MMM DD, YYYY')}
                            </span>
                        )}
                        {filters.giverBranchId && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                Giver: {branchList?.find(b => b._id === filters.giverBranchId)?.name}
                            </span>
                        )}
                        {filters.receiverBranchId && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                Receiver: {branchList?.find(b => b._id === filters.receiverBranchId)?.name}
                            </span>
                        )}
                        {filters.account && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                Account: {accountOptions.find(a => a.value === filters.account)?.label}
                            </span>
                        )}
                        {filters.status && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                                Status: {filters.status}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundTransferFilters;