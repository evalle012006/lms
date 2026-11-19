import { useState, useEffect, useRef } from 'react';
import { Search, XCircle, ChevronDown } from 'lucide-react';

const SEARCH_DEBOUNCE_MS = 400;
const EMPTY_FILTERS = { search: '', role: '', position: '', branch: '' };

// Filters are applied by the server (per page), so this only collects values and
// reports them through onChange. Option lists come from the parent because the
// full user list is no longer loaded.
const UserFilters = ({ filters, onChange, roleOptions = [], positionOptions = [], branchOptions = [] }) => {
  const [searchText, setSearchText] = useState(filters.search || '');
  const [expanded, setExpanded] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounce typing so each keystroke doesn't trigger a request
  useEffect(() => {
    if (searchText === filtersRef.current.search) return;
    const t = setTimeout(() => onChange({ ...filtersRef.current, search: searchText }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (key, value) => onChange({ ...filters, [key]: value });

  const resetFilters = () => {
    setSearchText('');
    onChange({ ...EMPTY_FILTERS });
  };

  const activeFilterCount = [searchText, filters.role, filters.position, filters.branch].filter(Boolean).length;

  const selectClass =
    'block w-full pl-3 pr-10 py-2 text-sm border border-gray-200 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm rounded-md appearance-none';

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
            onClick={() => setExpanded(!expanded)}
            className="lg:hidden flex items-center text-gray-500 hover:text-gray-700"
          >
            <span className="mr-1 text-sm">{expanded ? 'Hide' : 'Show'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'transform rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Body - Responsive */}
      <div className={`transition-all duration-300 ${expanded ? 'max-h-screen' : 'max-h-0 lg:max-h-screen'} overflow-hidden`}>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Name / Email Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name or Email</label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by name or email"
                className="block w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              {searchText && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button onClick={() => setSearchText('')} className="text-gray-400 hover:text-gray-500">
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
              <select value={filters.position} onChange={(e) => setFilter('position', e.target.value)} className={selectClass}>
                <option value="">All Positions</option>
                {positionOptions.map((position) => (
                  <option key={position} value={position}>{position}</option>
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
              <select value={filters.role} onChange={(e) => setFilter('role', e.target.value)} className={selectClass}>
                <option value="">All Roles</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
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
              <select value={filters.branch} onChange={(e) => setFilter('branch', e.target.value)} className={selectClass}>
                <option value="">All Branches</option>
                {branchOptions.map((branch) => (
                  <option key={branch.value} value={branch.value}>{branch.label}</option>
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
