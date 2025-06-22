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
    
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        giverBranchId: '',
        receiverBranchId: '',
        account: '',
        status: ''
    });

    // Account options
    const accountOptions = [
        { value: '', label: 'All Accounts' },
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank' },
        { value: 'petty_cash', label: 'Petty Cash' },
        { value: 'operating_fund', label: 'Operating Fund' },
        { value: 'emergency_fund', label: 'Emergency Fund' },
        { value: 'insurance_fund', label: 'Insurance Fund' }
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
            label: branch.name
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
            dateFrom: '',
            dateTo: '',
            giverBranchId: '',
            receiverBranchId: '',
            account: '',
            status: ''
        });
    };

    const hasActiveFilters = Object.values(filters).some(value => value !== '');

    return (
        <div className="bg-white border-b border-gray-200 p-4 mb-4">
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
                <div className="min-w-[180px]">
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
                <div className="min-w-[180px]">
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
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-md transition-colors"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
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