import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Select from 'react-select';
import { FunnelIcon, XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline';
import moment from 'moment';

const BadDebtFilters = ({ onFilterChange, tabName }) => {
  const currentUser = useSelector(state => state.user.data);
  const badDebtList = useSelector(state => state.badDebtCollection.originalList);
  const collectionList = useSelector(state => state.badDebtCollection.originalCollectionList);

  const [filters, setFilters] = useState({
    branchId: '',
    loId: '',
    groupId: '',
    clientId: '',
    dateFrom: moment().format('YYYY-MM-DD'), // Default to today
    dateTo: moment().format('YYYY-MM-DD'),   // Default to today
    showAll: false
  });

  const [branches, setBranches] = useState([]);
  const [loanOfficers, setLoanOfficers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [clients, setClients] = useState([]);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Custom select styles
  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? '#3B82F6' : '#E5E7EB',
      boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
      '&:hover': {
        borderColor: '#3B82F6'
      }
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? '#3B82F6' 
        : state.isFocused 
        ? '#EFF6FF' 
        : 'white',
      color: state.isSelected ? 'white' : '#1F2937',
      '&:hover': {
        backgroundColor: state.isSelected ? '#3B82F6' : '#EFF6FF'
      }
    })
  };

  // Extract unique values for filters
  useEffect(() => {
    const currentList = tabName === 'list' ? badDebtList : collectionList;
    
    if (currentList && currentList.length > 0) {
      // Extract unique branches
      const uniqueBranches = [...new Map(
        currentList
          .filter(item => item.branchId && item.branchName)
          .map(item => [item.branchId, { value: item.branchId, label: item.branchName }])
      ).values()];
      setBranches(uniqueBranches);

      // Extract unique loan officers
      const uniqueLOs = [...new Map(
        currentList
          .filter(item => item.loId && item.loName)
          .map(item => [item.loId, { value: item.loId, label: item.loName }])
      ).values()];
      setLoanOfficers(uniqueLOs);

      // Extract unique groups
      const uniqueGroups = [...new Map(
        currentList
          .filter(item => item.groupId && item.groupName)
          .map(item => [item.groupId, { value: item.groupId, label: item.groupName }])
      ).values()];
      setGroups(uniqueGroups);

      // Extract unique clients
      const uniqueClients = [...new Map(
        currentList
          .filter(item => item.clientId && item.fullName)
          .map(item => [item.clientId, { value: item.clientId, label: item.fullName }])
      ).values()];
      setClients(uniqueClients);
    }
  }, [badDebtList, collectionList, tabName]);

  // Check if any filters are active
  useEffect(() => {
    const isActive = filters.branchId || filters.loId || filters.groupId || filters.clientId || 
      (tabName === 'collection' && (filters.showAll || 
        filters.dateFrom !== moment().format('YYYY-MM-DD') || 
        filters.dateTo !== moment().format('YYYY-MM-DD')));
    setHasActiveFilters(isActive);
  }, [filters, tabName]);

  const handleBranchChange = (selectedOption) => {
    const branchId = selectedOption ? selectedOption.value : '';
    
    const newFilters = {
      ...filters,
      branchId,
      loId: '', // Reset dependent filters
      groupId: '',
      clientId: ''
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleLoanOfficerChange = (selectedOption) => {
    const loId = selectedOption ? selectedOption.value : '';
    
    const newFilters = {
      ...filters,
      loId,
      groupId: '', // Reset dependent filters
      clientId: ''
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleGroupChange = (selectedOption) => {
    const groupId = selectedOption ? selectedOption.value : '';
    
    const newFilters = {
      ...filters,
      groupId,
      clientId: '' // Reset dependent filter
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleClientChange = (selectedOption) => {
    const clientId = selectedOption ? selectedOption.value : '';
    
    const newFilters = {
      ...filters,
      clientId
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleDateFromChange = (e) => {
    const newFilters = {
      ...filters,
      dateFrom: e.target.value,
      showAll: false
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleDateToChange = (e) => {
    const newFilters = {
      ...filters,
      dateTo: e.target.value,
      showAll: false
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleShowAllChange = (e) => {
    const newFilters = {
      ...filters,
      showAll: e.target.checked
    };
    
    setFilters(newFilters);
    onFilterChange(newFilters, tabName);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      branchId: '',
      loId: '',
      groupId: '',
      clientId: '',
      dateFrom: moment().format('YYYY-MM-DD'),
      dateTo: moment().format('YYYY-MM-DD'),
      showAll: false
    };
    
    setFilters(clearedFilters);
    onFilterChange(clearedFilters, tabName);
  };

  // Filter options based on current selections
  const getFilteredLoanOfficers = () => {
    if (!filters.branchId) return loanOfficers;
    
    const currentList = tabName === 'list' ? badDebtList : collectionList;
    return [...new Map(
      currentList
        .filter(item => item.branchId === filters.branchId && item.loId && item.loName)
        .map(item => [item.loId, { value: item.loId, label: item.loName }])
    ).values()];
  };

  const getFilteredGroups = () => {
    const currentList = tabName === 'list' ? badDebtList : collectionList;
    let filtered = currentList;

    if (filters.branchId) {
      filtered = filtered.filter(item => item.branchId === filters.branchId);
    }
    if (filters.loId) {
      filtered = filtered.filter(item => item.loId === filters.loId);
    }

    return [...new Map(
      filtered
        .filter(item => item.groupId && item.groupName)
        .map(item => [item.groupId, { value: item.groupId, label: item.groupName }])
    ).values()];
  };

  const getFilteredClients = () => {
    const currentList = tabName === 'list' ? badDebtList : collectionList;
    let filtered = currentList;

    if (filters.branchId) {
      filtered = filtered.filter(item => item.branchId === filters.branchId);
    }
    if (filters.loId) {
      filtered = filtered.filter(item => item.loId === filters.loId);
    }
    if (filters.groupId) {
      filtered = filtered.filter(item => item.groupId === filters.groupId);
    }

    return [...new Map(
      filtered
        .filter(item => item.clientId && item.fullName)
        .map(item => [item.clientId, { value: item.clientId, label: item.fullName }])
    ).values()];
  };

  return (
    <div className="mb-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Filter Records</h3>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                Active
              </span>
            )}
          </div>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Date Filter for Collection History - Compact version */}
        {tabName === 'collection' && (
          <div className="mb-4 p-4 bg-white rounded-lg border border-blue-100">
            <div className="flex items-center justify-between gap-4">
              {/* Date Filter Section */}
              <div className="flex items-center space-x-2 flex-1">
                <CalendarIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">Date Filter</span>
                
                <div className="flex items-center space-x-2 ml-4">
                  <label className="text-sm text-gray-600 whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={handleDateFromChange}
                    disabled={filters.showAll}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  
                  <label className="text-sm text-gray-600 whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={handleDateToChange}
                    disabled={filters.showAll}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              
              {/* Show All Checkbox */}
              <div className="flex items-center">
                <label className="flex items-center space-x-2 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={filters.showAll}
                    onChange={handleShowAllChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show All History</span>
                </label>
              </div>
            </div>
            
            {/* Date range info text */}
            <div className="mt-2 ml-7">
              {!filters.showAll && (
                <p className="text-xs text-gray-600">
                  Showing collections from {moment(filters.dateFrom).format('MMM DD, YYYY')} to {moment(filters.dateTo).format('MMM DD, YYYY')}
                </p>
              )}
              {filters.showAll && (
                <p className="text-xs text-orange-600 font-medium">
                  Showing all historical collections
                </p>
              )}
            </div>
          </div>
        )}

        {/* Other Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Branch Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Branch
              {currentUser.role.rep === 3 && (
                <span className="ml-1 text-xs text-gray-500">(Auto-selected)</span>
              )}
            </label>
            <Select
              className="basic-single"
              classNamePrefix="select"
              isDisabled={currentUser.role.rep === 3 || currentUser.role.rep === 4}
              value={branches.find(b => b.value === filters.branchId) || null}
              onChange={handleBranchChange}
              options={branches}
              placeholder="All Branches"
              isClearable
              styles={customSelectStyles}
            />
          </div>
          
          {/* Loan Officer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Loan Officer
              {currentUser.role.rep === 4 && (
                <span className="ml-1 text-xs text-gray-500">(Auto-selected)</span>
              )}
            </label>
            <Select
              className="basic-single"
              classNamePrefix="select"
              isDisabled={currentUser.role.rep === 4}
              value={getFilteredLoanOfficers().find(lo => lo.value === filters.loId) || null}
              onChange={handleLoanOfficerChange}
              options={getFilteredLoanOfficers()}
              placeholder="All Loan Officers"
              isClearable
              styles={customSelectStyles}
            />
          </div>
          
          {/* Group Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Group
            </label>
            <Select
              className="basic-single"
              classNamePrefix="select"
              value={getFilteredGroups().find(g => g.value === filters.groupId) || null}
              onChange={handleGroupChange}
              options={getFilteredGroups()}
              placeholder="All Groups"
              isClearable
              styles={customSelectStyles}
            />
          </div>
          
          {/* Client Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Client
            </label>
            <Select
              className="basic-single"
              classNamePrefix="select"
              value={getFilteredClients().find(c => c.value === filters.clientId) || null}
              onChange={handleClientChange}
              options={getFilteredClients()}
              placeholder="All Clients"
              isClearable
              styles={customSelectStyles}
            />
          </div>
        </div>

        {/* Filter Info */}
        {hasActiveFilters && tabName !== 'collection' && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-gray-600">
              Showing filtered results based on your selection
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BadDebtFilters;