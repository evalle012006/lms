import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useExcelExport } from '@/hooks/useExcelExport';
import { toast } from 'react-toastify';

// Select Field Component
const SelectField = ({ label, options, value, onChange, placeholder, required = false }) => (
    <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </div>
);

// Enhanced Date Field Component
const DateField = ({ label, value, onChange, placeholder, required = false }) => (
    <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        />
    </div>
);

// Export Button Component
const ExportButton = ({ 
    onClick, 
    isLoading = false, 
    disabled = false, 
    className = "",
    size = "md" 
}) => {
    const sizeClasses = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`
                inline-flex items-center gap-2 
                bg-emerald-600 hover:bg-emerald-700 
                disabled:bg-gray-400 disabled:cursor-not-allowed
                text-white font-medium rounded-lg
                transition-all duration-200 ease-in-out
                shadow-sm hover:shadow-md
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                ${sizeClasses[size]}
                ${className}
            `}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Excel...</span>
                </>
            ) : (
                <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export to Excel</span>
                </>
            )}
        </button>
    );
};

const ExcelExportModal = ({ isOpen, onClose, dataSource = 'ldf', historyData = [] }) => {
    const { exportLoansToExcel, isExporting } = useExcelExport();
    
    // Redux selectors
    const currentUser = useSelector(state => state.user?.data);
    const list = useSelector(state => state.loan?.list || []);
    const pendingList = useSelector(state => state.loan?.pendingList || []);
    const tomorrowList = useSelector(state => state.loan?.tomorrowList || []);
    const forecastedList = useSelector(state => state.loan?.forecastedList || []);
    const duplicateList = useSelector(state => state.loan?.duplicateLoanList || []);
    const historyList = useSelector(state => state.loan?.historyList || []);
    const userList = useSelector(state => state.user?.list || []);
    const groupList = useSelector(state => state.group?.list || []);
    
    // Filter states
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        loanOfficer: '',
        group: '',
        dateReleaseFrom: '',
        dateReleaseTo: '',
        admissionDateFrom: '',
        admissionDateTo: '',
        status: 'all'
    });

    // Force re-render when filters change
    const [, forceUpdate] = useState({});
    
    useEffect(() => {
        forceUpdate({});
    }, [filters]);

    // Get current dataset based on source
    const getCurrentData = () => {
        switch (dataSource) {
            case 'application': return pendingList;
            case 'tomorrow': return tomorrowList;
            case 'forecast': return forecastedList;
            case 'history': return historyData.length > 0 ? historyData : (historyList || []);
            case 'duplicate': return duplicateList || [];
            case 'ldf':
            default: return list;
        }
    };

    // Filter the data based on selected filters
    const getFilteredData = () => {
        let data = getCurrentData();
        
        console.log('=== FILTERING DEBUG ===');
        console.log('Original data length:', data?.length || 0);
        console.log('Current filters:', filters);
        console.log('Sample data item:', data?.[0]);
        
        // Always start with all data if no data available
        if (!data || data.length === 0) {
            console.log('No data available');
            return [];
        }
        
        // For status = 'all', don't filter by status at all
        if (filters.status && filters.status !== 'all') {
            console.log('Filtering by status:', filters.status);
            const beforeLength = data.length;
            data = data.filter(item => {
                const itemStatus = item.status;
                console.log('Item status:', itemStatus, 'Filter status:', filters.status);
                return itemStatus === filters.status;
            });
            console.log('After status filter:', beforeLength, '->', data.length);
        } else {
            console.log('Skipping status filter (all selected)');
        }
        
        // Don't filter by month/year if we want all data
        // Only filter if user specifically selects a different month/year
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        if (filters.month && filters.year && 
            (parseInt(filters.month) !== currentMonth || parseInt(filters.year) !== currentYear)) {
            console.log('Filtering by month/year:', filters.month, filters.year);
            const beforeLength = data.length;
            data = data.filter(item => {
                const itemDate = new Date(item.dateGranted || item.dateAdded || item.admissionDate);
                if (isNaN(itemDate.getTime())) {
                    console.log('Invalid date for item:', item._id, 'dates:', item.dateGranted, item.dateAdded, item.admissionDate);
                    return false; // Exclude items with invalid dates when filtering by date
                }
                const itemMonth = itemDate.getMonth() + 1;
                const itemYear = itemDate.getFullYear();
                const matches = itemMonth === parseInt(filters.month) && itemYear === parseInt(filters.year);
                if (!matches) {
                    console.log('Date mismatch - Item:', itemMonth + '/' + itemYear, 'vs Filter:', filters.month + '/' + filters.year);
                }
                return matches;
            });
            console.log('After date filter:', beforeLength, '->', data.length);
        } else {
            console.log('Skipping date filter (current month/year or not specified)');
        }
        
        // Filter by loan officer (only if specific officer selected)
        if (filters.loanOfficer && filters.loanOfficer !== '') {
            console.log('Filtering by loan officer:', filters.loanOfficer);
            const beforeLength = data.length;
            data = data.filter(item => item.loId === filters.loanOfficer);
            console.log('After loan officer filter:', beforeLength, '->', data.length);
        }
        
        // Filter by group (only if specific group selected)
        if (filters.group && filters.group !== '') {
            console.log('Filtering by group:', filters.group);
            const beforeLength = data.length;
            data = data.filter(item => item.groupId === filters.group);
            console.log('After group filter:', beforeLength, '->', data.length);
        }
        
        // Apply date range filters
        if (filters.dateReleaseFrom) {
            const beforeLength = data.length;
            data = data.filter(item => {
                const releaseDate = new Date(item.dateGranted || item.dateRelease);
                if (isNaN(releaseDate.getTime())) return false;
                return releaseDate >= new Date(filters.dateReleaseFrom);
            });
            console.log('After release date from filter:', beforeLength, '->', data.length);
        }
        
        if (filters.dateReleaseTo) {
            const beforeLength = data.length;
            data = data.filter(item => {
                const releaseDate = new Date(item.dateGranted || item.dateRelease);
                if (isNaN(releaseDate.getTime())) return false;
                return releaseDate <= new Date(filters.dateReleaseTo);
            });
            console.log('After release date to filter:', beforeLength, '->', data.length);
        }
        
        if (filters.admissionDateFrom) {
            const beforeLength = data.length;
            data = data.filter(item => {
                const admissionDate = new Date(item.admissionDate || item.dateAdded);
                if (isNaN(admissionDate.getTime())) return false;
                return admissionDate >= new Date(filters.admissionDateFrom);
            });
            console.log('After admission date from filter:', beforeLength, '->', data.length);
        }
        
        if (filters.admissionDateTo) {
            const beforeLength = data.length;
            data = data.filter(item => {
                const admissionDate = new Date(item.admissionDate || item.dateAdded);
                if (isNaN(admissionDate.getTime())) return false;
                return admissionDate <= new Date(filters.admissionDateTo);
            });
            console.log('After admission date to filter:', beforeLength, '->', data.length);
        }
        
        console.log('=== FINAL RESULT ===');
        console.log('Final filtered data length:', data.length);
        console.log('======================');
        
        return data;
    };

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            loanOfficer: '',
            group: '',
            dateReleaseFrom: '',
            dateReleaseTo: '',
            admissionDateFrom: '',
            admissionDateTo: '',
            status: 'all'
        });
    };

    // Handle export
    const handleExport = async () => {
        const filteredData = getFilteredData();
        
        // Allow export even if filtered count is 0, but warn user
        if (filteredData.length === 0) {
            const shouldProceed = window.confirm('No data matches the selected filters. Do you want to export all available data instead?');
            if (!shouldProceed) {
                return;
            }
            // Export all data if user confirms
            const allData = getCurrentData();
            if (allData.length === 0) {
                toast.warning('No data available to export');
                return;
            }
            try {
                await exportLoansToExcel(
                    allData,
                    currentUser,
                    filters.month,
                    filters.year
                );
                onClose();
            } catch (error) {
                console.error('Export error:', error);
                toast.error('Export failed: ' + error.message);
            }
            return;
        }
        
        try {
            await exportLoansToExcel(
                filteredData,
                currentUser,
                filters.month,
                filters.year
            );
            onClose();
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed: ' + error.message);
        }
    };

    // Get months array
    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    // Get years array (current year ± 2)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => ({
        value: currentYear - 2 + i,
        label: (currentYear - 2 + i).toString()
    }));

    // Get available loan officers
    const getAvailableLoanOfficers = () => {
        if (!userList) return [{ value: '', label: 'All Loan Officers' }];
        
        const officers = userList
            .filter(user => user.role?.shortCode === 'loan_officer')
            .map(user => ({
                value: user._id,
                label: `${user.firstName} ${user.lastName}`
            }));
            
        return [
            { value: '', label: 'All Loan Officers' },
            ...officers
        ];
    };

    // Get available groups
    const getAvailableGroups = () => {
        if (!groupList) return [{ value: '', label: 'All Groups' }];
        
        const groups = groupList.map(group => ({
            value: group._id,
            label: group.name
        }));
        
        return [
            { value: '', label: 'All Groups' },
            ...groups
        ];
    };

    // Get status options based on data source
    const getStatusOptions = () => {
        const baseOptions = [
            { value: 'all', label: 'All Status' }
        ];
        
        switch (dataSource) {
            case 'application':
                return [...baseOptions, 
                    { value: 'pending', label: 'Pending' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' }
                ];
            case 'ldf':
                return [...baseOptions,
                    { value: 'granted', label: 'Granted' },
                    { value: 'active', label: 'Active' },
                    { value: 'completed', label: 'Completed' }
                ];
            default:
                return [...baseOptions,
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                ];
        }
    };

    const filteredCount = getFilteredData().length;
    const totalCount = getCurrentData().length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-50 to-blue-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Export to Excel
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Export {dataSource.toUpperCase()} data to Excel format
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Required Filters */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Time Period
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SelectField
                                label="Month"
                                options={months}
                                value={filters.month}
                                onChange={(value) => handleFilterChange('month', parseInt(value))}
                                placeholder="Select month"
                                required
                            />
                            <SelectField
                                label="Year"
                                options={years}
                                value={filters.year}
                                onChange={(value) => handleFilterChange('year', parseInt(value))}
                                placeholder="Select year"
                                required
                            />
                            <SelectField
                                label="Status"
                                options={getStatusOptions()}
                                value={filters.status}
                                onChange={(value) => handleFilterChange('status', value)}
                            />
                        </div>
                    </div>

                    {/* Optional Filters */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Additional Filters
                            <span className="text-sm font-normal text-gray-500 ml-2">(Optional)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <SelectField
                                label="Loan Officer"
                                options={getAvailableLoanOfficers()}
                                value={filters.loanOfficer}
                                onChange={(value) => handleFilterChange('loanOfficer', value)}
                                placeholder="All Loan Officers"
                            />
                            <SelectField
                                label="Group"
                                options={getAvailableGroups()}
                                value={filters.group}
                                onChange={(value) => handleFilterChange('group', value)}
                                placeholder="All Groups"
                            />
                        </div>
                        
                        {/* Date Range Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Release Date Range</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <DateField
                                        label="From"
                                        value={filters.dateReleaseFrom}
                                        onChange={(value) => handleFilterChange('dateReleaseFrom', value)}
                                        placeholder="Start date"
                                    />
                                    <DateField
                                        label="To"
                                        value={filters.dateReleaseTo}
                                        onChange={(value) => handleFilterChange('dateReleaseTo', value)}
                                        placeholder="End date"
                                    />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Admission Date Range</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <DateField
                                        label="From"
                                        value={filters.admissionDateFrom}
                                        onChange={(value) => handleFilterChange('admissionDateFrom', value)}
                                        placeholder="Start date"
                                    />
                                    <DateField
                                        label="To"
                                        value={filters.admissionDateTo}
                                        onChange={(value) => handleFilterChange('admissionDateTo', value)}
                                        placeholder="End date"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Summary */}
                    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {filteredCount.toLocaleString()} records ready for export
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {filteredCount < totalCount && `Filtered from ${totalCount.toLocaleString()} total records • `}
                                        {months.find(m => m.value === filters.month)?.label} {filters.year}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1.5 text-sm text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <ExportButton
                        onClick={handleExport}
                        isLoading={isExporting}
                        disabled={isExporting}
                        size="md"
                    />
                </div>
            </div>
        </div>
    );
};

export default ExcelExportModal;