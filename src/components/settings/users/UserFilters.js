// Import at the top of your file
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from "react-redux";
import { setFilteredData, setIsFiltering } from "@/redux/actions/userActions";
// Using Lucide React instead of HeroIcons
import { Search, XCircle, ChevronDown } from 'lucide-react';

const UserFilters = ({ userList, setUserListData }) => {
  const dispatch = useDispatch();
  const branchList = useSelector(state => state.branch.list);
  
  // Filter states
  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [expanded, setExpanded] = useState(false);
  
  // Extract unique roles and positions for dropdowns
  const uniqueRoles = userList ? [...new Set(userList.map(user => user.role))].filter(Boolean) : [];
  const uniquePositions = userList ? [...new Set(userList.map(user => user.position))].filter(Boolean) : [];
  const uniqueBranches = userList ? [...new Set(userList.map(user => user.designatedBranch))].filter(Boolean) : [];

  // Apply filters function
  const applyFilters = () => {
    if (!userList) return;
    
    let filteredUsers = [...userList];
    
    // Apply name filter
    if (nameFilter) {
      filteredUsers = filteredUsers.filter(user => 
        user.name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    
    // Apply email filter
    if (emailFilter) {
      filteredUsers = filteredUsers.filter(user => 
        user.email?.toLowerCase().includes(emailFilter.toLowerCase())
      );
    }
    
    // Apply position filter
    if (positionFilter) {
      filteredUsers = filteredUsers.filter(user => 
        user.position === positionFilter
      );
    }
    
    // Apply role filter
    if (roleFilter) {
      filteredUsers = filteredUsers.filter(user => 
        user.role === roleFilter
      );
    }
    
    // Apply branch filter
    if (branchFilter) {
      filteredUsers = filteredUsers.filter(user => 
        user.designatedBranch === branchFilter
      );
    }
    
    // Update filtered data in redux and component state
    dispatch(setFilteredData(filteredUsers));
    
    if (filteredUsers.length < userList.length) {
      dispatch(setIsFiltering(true));
    } else {
      dispatch(setIsFiltering(false));
    }
    
    setUserListData(filteredUsers);
  };

  // Reset all filters
  const resetFilters = () => {
    setNameFilter('');
    setEmailFilter('');
    setPositionFilter('');
    setRoleFilter('');
    setBranchFilter('');
    
    // Reset to unfiltered list
    if (userList) {
      setUserListData(userList);
      dispatch(setIsFiltering(false));
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
    if (userList) {
      applyFilters();
    }
  }, [nameFilter, emailFilter, positionFilter, roleFilter, branchFilter, userList]);

  // Calculate active filter count for the toggle button
  const activeFilterCount = [nameFilter, emailFilter, positionFilter, roleFilter, branchFilter].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
      {/* Filter Header - Always visible */}
      <div className="flex justify-between items-center p-4 border-b border-gray-100">
        <h3 className="text-lg font-medium text-gray-800">Filters</h3>
        <div className="flex items-center">
          {activeFilterCount > 0 && (
            <span className="text-sm bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 mr-3">
              {activeFilterCount} active
            </span>
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
      <div className={`transition-all duration-300 ${expanded ? 'max-h-screen' : 'max-h-0 md:max-h-screen'} overflow-hidden`}>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Name Filter */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Filter by name"
                className="block w-full pl-10 pr-8 py-2 sm:text-sm border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              {nameFilter && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button 
                    onClick={() => clearFilter(setNameFilter)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email Filter */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="Filter by email"
                className="block w-full pl-10 pr-8 py-2 sm:text-sm border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              {emailFilter && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button 
                    onClick={() => clearFilter(setEmailFilter)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Position Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <div className="relative">
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none"
              >
                <option value="">All Positions</option>
                {uniquePositions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none"
              >
                <option value="">All Roles</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
            <div className="relative">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md appearance-none"
              >
                <option value="">All Branches</option>
                {uniqueBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Reset Button Area */}
        <div className="px-4 py-3 bg-gray-50 text-right">
          <button
            onClick={resetFilters}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserFilters;