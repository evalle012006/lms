import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from 'react-select';
import { ChevronDown } from 'lucide-react';
import { setTransferList } from '@/redux/actions/transferActions';

const TransferFilters = ({ transferList, setTransferListData }) => {
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);

  // Filter states
  const [nameFilter, setNameFilter] = useState('');
  const [sourceBranchFilter, setSourceBranchFilter] = useState('');
  const [sourceLoFilter, setSourceLoFilter] = useState('');
  const [sourceGroupFilter, setSourceGroupFilter] = useState('');
  const [targetBranchFilter, setTargetBranchFilter] = useState('');
  const [targetLoFilter, setTargetLoFilter] = useState('');
  const [targetGroupFilter, setTargetGroupFilter] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState('');

  // Generate unique options from transferList
  const getUniqueOptions = (accessor) => {
    if (!transferList) return [];
    const uniqueValues = [...new Set(transferList.map(item => item[accessor]).filter(Boolean))];
    return uniqueValues.map(value => ({ value, label: value }));
  };

  // Filter options
  const nameOptions = getUniqueOptions('fullName');
  const sourceBranchOptions = getUniqueOptions('sourceBranchName');
  const sourceLoOptions = getUniqueOptions('sourceUserName');
  const sourceGroupOptions = getUniqueOptions('sourceGroupName');
  const targetBranchOptions = getUniqueOptions('targetBranchName');
  const targetLoOptions = getUniqueOptions('targetUserName');
  const targetGroupOptions = getUniqueOptions('targetGroupName');
  const transferStatusOptions = getUniqueOptions('transferStatus');

  // Apply filters
  const applyFilters = () => {
    if (!transferList) return;

    let filteredTransfers = [...transferList];

    // Apply name filter
    if (nameFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.fullName === nameFilter
      );
    }

    // Apply source branch filter
    if (sourceBranchFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.sourceBranchName === sourceBranchFilter
      );
    }

    // Apply source LO filter
    if (sourceLoFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.sourceUserName === sourceLoFilter
      );
    }

    // Apply source group filter
    if (sourceGroupFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.sourceGroupName === sourceGroupFilter
      );
    }

    // Apply target branch filter
    if (targetBranchFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.targetBranchName === targetBranchFilter
      );
    }

    // Apply target LO filter
    if (targetLoFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.targetUserName === targetLoFilter
      );
    }

    // Apply target group filter
    if (targetGroupFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.targetGroupName === targetGroupFilter
      );
    }

    // Apply transfer status filter
    if (transferStatusFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.transferStatus === transferStatusFilter
      );
    }

    // Update the displayed data
    setTransferListData(filteredTransfers);
  };

  // Reset all filters
  const resetFilters = () => {
    setNameFilter('');
    setSourceBranchFilter('');
    setSourceLoFilter('');
    setSourceGroupFilter('');
    setTargetBranchFilter('');
    setTargetLoFilter('');
    setTargetGroupFilter('');
    setTransferStatusFilter('');

    // Reset to unfiltered list
    if (transferList) {
      setTransferListData(transferList);
    }
  };

  // Quick clear for individual filters
  const clearFilter = (filterSetter) => {
    filterSetter('');
  };

  // Toggle expanded state for mobile view
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Apply filters whenever any filter changes
  useEffect(() => {
    if (transferList) {
      applyFilters();
    }
  }, [
    nameFilter,
    sourceBranchFilter,
    sourceLoFilter,
    sourceGroupFilter,
    targetBranchFilter,
    targetLoFilter,
    targetGroupFilter,
    transferStatusFilter,
    transferList
  ]);

  // Calculate active filter count for the toggle button
  const activeFilterCount = [
    nameFilter,
    sourceBranchFilter,
    sourceLoFilter,
    sourceGroupFilter,
    targetBranchFilter,
    targetLoFilter,
    targetGroupFilter,
    transferStatusFilter
  ].filter(Boolean).length;

  // Custom select styles
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
      '&:hover': {
        borderColor: '#3b82f6'
      }
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
      color: state.isSelected ? 'white' : '#1f2937',
      '&:active': {
        backgroundColor: '#3b82f6'
      }
    })
  };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6 mx-4 overflow-hidden">
      {/* Filter Header - Always visible */}
      <div className="flex justify-between items-center p-4 border-b border-gray-100">
        <h3 className="text-lg font-medium text-gray-800">Filters</h3>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <>
              <span className="text-sm bg-blue-50 text-blue-600 rounded-full px-3 py-1">
                {activeFilterCount} active
              </span>
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            </>
          )}
          <button
            onClick={toggleExpanded}
            className="md:hidden flex items-center text-gray-500 hover:text-gray-700"
          >
            <span className="mr-1 text-sm">{expanded ? 'Hide' : 'Show'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'transform rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Body - Responsive */}
      <div className={`transition-all duration-300 ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 md:max-h-[2000px] md:opacity-100'} overflow-hidden`}>
        <div className="p-4">
          {/* All filters with flex-wrap - will automatically wrap to multiple rows based on width */}
          <div className="flex flex-wrap gap-4">
            {/* Name */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <Select
                options={nameOptions}
                value={nameOptions.find(opt => opt.value === nameFilter) || null}
                onChange={(selected) => setNameFilter(selected?.value || '')}
                isClearable
                placeholder="All Names"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Source Branch */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Branch
              </label>
              <Select
                options={sourceBranchOptions}
                value={sourceBranchOptions.find(opt => opt.value === sourceBranchFilter) || null}
                onChange={(selected) => setSourceBranchFilter(selected?.value || '')}
                isClearable
                placeholder="All Branches"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Source LO */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source LO
              </label>
              <Select
                options={sourceLoOptions}
                value={sourceLoOptions.find(opt => opt.value === sourceLoFilter) || null}
                onChange={(selected) => setSourceLoFilter(selected?.value || '')}
                isClearable
                placeholder="All Loan Officers"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Source Group */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Group
              </label>
              <Select
                options={sourceGroupOptions}
                value={sourceGroupOptions.find(opt => opt.value === sourceGroupFilter) || null}
                onChange={(selected) => setSourceGroupFilter(selected?.value || '')}
                isClearable
                placeholder="All Groups"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Target Branch */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Branch
              </label>
              <Select
                options={targetBranchOptions}
                value={targetBranchOptions.find(opt => opt.value === targetBranchFilter) || null}
                onChange={(selected) => setTargetBranchFilter(selected?.value || '')}
                isClearable
                placeholder="All Branches"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Target LO */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target LO
              </label>
              <Select
                options={targetLoOptions}
                value={targetLoOptions.find(opt => opt.value === targetLoFilter) || null}
                onChange={(selected) => setTargetLoFilter(selected?.value || '')}
                isClearable
                placeholder="All Loan Officers"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Target Group */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Group
              </label>
              <Select
                options={targetGroupOptions}
                value={targetGroupOptions.find(opt => opt.value === targetGroupFilter) || null}
                onChange={(selected) => setTargetGroupFilter(selected?.value || '')}
                isClearable
                placeholder="All Groups"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Transfer Status */}
            <div className="w-52">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Status
              </label>
              <Select
                options={transferStatusOptions}
                value={transferStatusOptions.find(opt => opt.value === transferStatusFilter) || null}
                onChange={(selected) => setTransferStatusFilter(selected?.value || '')}
                isClearable
                placeholder="All Statuses"
                styles={selectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferFilters;