import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Select from 'react-select';

const BadDebtFilters = ({ onFilterChange, tabName }) => {
  const [branches, setBranches] = useState([]);
  const [loanOfficers, setLoanOfficers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [clients, setClients] = useState([]);
  
  const badDebtList = useSelector(state => state.badDebtCollection.list || []);
  const collectionList = useSelector(state => state.badDebtCollection.collectionList || []);
  const currentUser = useSelector(state => state.user.data);
  
  const [filters, setFilters] = useState({
    branchId: '',
    loId: '',
    groupId: '',
    clientId: ''
  });

  useEffect(() => {
    // Extract filter options from the appropriate list based on tab
    const dataList = tabName === 'list' ? badDebtList : collectionList;
    if (!dataList || dataList.length === 0) return;

    // Filter out the totals row
    const filteredList = dataList.filter(item => !item.totalData);
    
    extractFilterOptions(filteredList);
  }, [badDebtList, collectionList, tabName]);

  const extractFilterOptions = (data) => {
    // Extract unique branches
    const uniqueBranches = new Map();
    const uniqueLoanOfficers = new Map();
    const uniqueGroups = new Map();
    const uniqueClients = new Map();

    data.forEach(item => {
      // Extract branch
      if (item.branchName && item.branchName !== '-' && item.branchId) {
        uniqueBranches.set(item.branchId, {
          value: item.branchId,
          label: item.branchName
        });
      }

      // Extract loan officer
      if (item.loName && item.loName !== '-' && item.loId) {
        uniqueLoanOfficers.set(item.loId, {
          value: item.loId,
          label: item.loName
        });
      }

      // Extract group
      if (item.groupName && item.groupName !== '-' && item.groupId) {
        uniqueGroups.set(item.groupId, {
          value: item.groupId,
          label: item.groupName
        });
      }

      // Extract client
      if (item.fullName && item.fullName !== '-' && item.clientId) {
        uniqueClients.set(item.clientId, {
          value: item.clientId,
          label: item.fullName
        });
      }
    });

    // Convert Maps to arrays and add "All" option
    const branchOptions = Array.from(uniqueBranches.values());
    const loOptions = Array.from(uniqueLoanOfficers.values());
    const groupOptions = Array.from(uniqueGroups.values());
    const clientOptions = Array.from(uniqueClients.values());

    setBranches([{ value: '', label: 'All Branches' }, ...branchOptions]);
    setLoanOfficers([{ value: '', label: 'All Loan Officers' }, ...loOptions]);
    setGroups([{ value: '', label: 'All Groups' }, ...groupOptions]);
    setClients([{ value: '', label: 'All Clients' }, ...clientOptions]);
  };

  const handleBranchChange = (selectedOption) => {
    const branchId = selectedOption ? selectedOption.value : '';
    
    // Filter loan officers based on selected branch
    if (branchId) {
      const filteredLOs = getCurrentList().filter(item => 
        item.branchId === branchId && item.loId && item.loName !== '-'
      );
      
      const uniqueLOs = new Map();
      filteredLOs.forEach(item => {
        uniqueLOs.set(item.loId, {
          value: item.loId,
          label: item.loName
        });
      });
      
      setLoanOfficers([
        { value: '', label: 'All Loan Officers' },
        ...Array.from(uniqueLOs.values())
      ]);
    }
    
    setFilters({
      ...filters,
      branchId,
      loId: '',
      groupId: '',
      clientId: ''
    });
    
    onFilterChange({
      branchId,
      loId: '',
      groupId: '',
      clientId: ''
    }, tabName);
  };

  const handleLoanOfficerChange = (selectedOption) => {
    const loId = selectedOption ? selectedOption.value : '';
    
    // Filter groups based on selected loan officer
    if (loId) {
      const filteredGroups = getCurrentList().filter(item => 
        item.loId === loId && item.groupId && item.groupName !== '-'
      );
      
      const uniqueGroups = new Map();
      filteredGroups.forEach(item => {
        uniqueGroups.set(item.groupId, {
          value: item.groupId,
          label: item.groupName
        });
      });
      
      setGroups([
        { value: '', label: 'All Groups' },
        ...Array.from(uniqueGroups.values())
      ]);
    }
    
    setFilters({
      ...filters,
      loId,
      groupId: '',
      clientId: ''
    });
    
    onFilterChange({
      ...filters,
      loId,
      groupId: '',
      clientId: ''
    }, tabName);
  };

  const handleGroupChange = (selectedOption) => {
    const groupId = selectedOption ? selectedOption.value : '';
    
    // Filter clients based on selected group
    if (groupId) {
      const filteredClients = getCurrentList().filter(item => 
        item.groupId === groupId && item.clientId && item.fullName !== '-'
      );
      
      const uniqueClients = new Map();
      filteredClients.forEach(item => {
        uniqueClients.set(item.clientId, {
          value: item.clientId,
          label: item.fullName
        });
      });
      
      setClients([
        { value: '', label: 'All Clients' },
        ...Array.from(uniqueClients.values())
      ]);
    }
    
    setFilters({
      ...filters,
      groupId,
      clientId: ''
    });
    
    onFilterChange({
      ...filters,
      groupId,
      clientId: ''
    }, tabName);
  };

  const handleClientChange = (selectedOption) => {
    const clientId = selectedOption ? selectedOption.value : '';
    
    setFilters({
      ...filters,
      clientId
    });
    
    onFilterChange({
      ...filters,
      clientId
    }, tabName);
  };

  // Helper function to get current list based on tab
  const getCurrentList = () => {
    return tabName === 'list' 
      ? badDebtList.filter(item => !item.totalData)
      : collectionList.filter(item => !item.totalData);
  };

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-md shadow-sm">
      <div className="font-medium text-lg mb-3">Filters</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <Select
            className="basic-single"
            classNamePrefix="select"
            isDisabled={currentUser.role.rep === 3 || currentUser.role.rep === 4}
            value={branches.find(b => b.value === filters.branchId)}
            onChange={handleBranchChange}
            options={branches}
            placeholder="Select Branch"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loan Officer</label>
          <Select
            className="basic-single"
            classNamePrefix="select"
            isDisabled={currentUser.role.rep === 4}
            value={loanOfficers.find(lo => lo.value === filters.loId)}
            onChange={handleLoanOfficerChange}
            options={loanOfficers}
            placeholder="Select Loan Officer"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
          <Select
            className="basic-single"
            classNamePrefix="select"
            value={groups.find(g => g.value === filters.groupId)}
            onChange={handleGroupChange}
            options={groups}
            placeholder="Select Group"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <Select
            className="basic-single"
            classNamePrefix="select"
            value={clients.find(c => c.value === filters.clientId)}
            onChange={handleClientChange}
            options={clients}
            placeholder="Select Client"
          />
        </div>
      </div>
    </div>
  );
};

export default BadDebtFilters;