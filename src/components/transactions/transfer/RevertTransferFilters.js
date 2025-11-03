import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { ChevronDown } from 'lucide-react';

const RevertTransferFilters = ({ revertTransferList, setRevertTransferListData }) => {
  const [expanded, setExpanded] = useState(false);

  // Filter state
  const [nameFilter, setNameFilter] = useState('');

  // Generate unique name options from revertTransferList
  const getNameOptions = () => {
    if (!revertTransferList) return [];
    
    // Since fullName is already processed in the parent component,
    // we can directly extract it
    const uniqueNames = [...new Set(
      revertTransferList
        .map(item => item.fullName)
        .filter(Boolean)
    )];
    
    return uniqueNames.map(name => ({ value: name, label: name }));
  };

  const nameOptions = getNameOptions();

  // Apply filters
  const applyFilters = () => {
    if (!revertTransferList) return;

    let filteredTransfers = [...revertTransferList];

    // Apply name filter
    if (nameFilter) {
      filteredTransfers = filteredTransfers.filter(transfer =>
        transfer.fullName === nameFilter
      );
    }

    // Update the displayed data
    setRevertTransferListData(filteredTransfers);
  };

  // Reset all filters
  const resetFilters = () => {
    setNameFilter('');

    // Reset to unfiltered list
    if (revertTransferList) {
      setRevertTransferListData(revertTransferList);
    }
  };

  // Toggle expanded state for mobile view
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Apply filters whenever any filter changes
  useEffect(() => {
    if (revertTransferList) {
      applyFilters();
    }
  }, [nameFilter, revertTransferList]);

  // Calculate active filter count for the toggle button
  const activeFilterCount = [nameFilter].filter(Boolean).length;

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
    <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
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
          {/* Single filter with flex layout */}
          <div className="flex flex-wrap gap-4">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevertTransferFilters;