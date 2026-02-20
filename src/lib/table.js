/* eslint-disable key-spacing */
/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
import React, { useState, useCallback, useMemo } from 'react';
import { useTable, useFilters, useGlobalFilter, useSortBy, usePagination } from 'react-table';
import { 
  ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon,
  PencilIcon, TrashIcon, CheckIcon, XMarkIcon, 
  LockClosedIcon, LockOpenIcon, XCircleIcon, ArrowPathIcon, 
  KeyIcon, DocumentIcon, ArrowUturnLeftIcon, ArrowsRightLeftIcon
} from '@heroicons/react/24/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import CheckBox from './ui/checkbox';
import ActionDropDown from './ui/action-dropdown';
import Avatar from './avatar';
import { useEffect } from 'react';

// Helper functions to check transfer status
const isRecentlyCreated = (insertedDate) => {
  const now = new Date();
  const createdDate = new Date(insertedDate);
  const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
  return hoursDiff <= 24; // Consider new if created within last 24 hours
};

const isRecentlyModified = (insertedDate, modifiedDate) => {
  if (!modifiedDate) return false;
  
  const now = new Date();
  const createdDate = new Date(insertedDate);
  const lastModifiedDate = new Date(modifiedDate);
  
  // Check if modifiedDate is actually newer than insertedDate (was actually modified)
  const wasActuallyModified = lastModifiedDate > createdDate;
  
  if (!wasActuallyModified) return false;
  
  // Check if modification was within last 24 hours
  const hoursSinceModified = (now - lastModifiedDate) / (1000 * 60 * 60);
  return hoursSinceModified <= 24;
};

const getTransferIndicatorType = (insertedDate, modifiedDate, modifiedById) => {
  if (modifiedDate && modifiedDate !== insertedDate && modifiedById) {
    return 'modified';
  }

  return 'new';
};

// This is a custom filter UI for selecting
// a unique option from a list
export function SelectColumnFilter({
  column: { filterValue, setFilter, preFilteredRows, id, render },
}) {
  // Calculate the options for filtering
  // using the preFilteredRows
  const options = React.useMemo(() => {
    const options = new Set();
    preFilteredRows.forEach((row) => {
      options.add(row.values[id]);
    });

    return [...options.values()];
  }, [id, preFilteredRows]);

  // Render a multi-select box
  return (
    <label className="flex gap-x-2 items-baseline">
      <select
        className="filter-select"
        name={id}
        id={id}
        value={filterValue}
        onChange={(e) => {
          setFilter(e.target.value || undefined);
        }}
      >
        <option value="">{render("Header")}</option>
        {/* <option value="">All</option> */}
        {options.map((option, i) => (
          <option key={i} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusPill({ value }) {
  if (value && value !== '-') {
    const status = value ? value.toLowerCase() : "unknown";

    return (
      <span
        className={classNames(
          "status-pill",
          status.startsWith("active") || status.startsWith("open") ? "status-pill-active" : null,
          status.startsWith("pending") ? "status-pill-pending" : null,
          status.startsWith("inactive") ? "status-pill-inactive" : null,
          status.startsWith("reject") || status.startsWith("close") || status.startsWith("closed") || status.startsWith("offset") ? "status-pill-rejected" : null,
          status.startsWith("approved") ? "status-pill-approved" : null
        )}
      >
        {status}
      </span>
    );
  }
}

export function AvatarCell({ value, column, row }) {
  const url = row.original[column.imgAccessor];
  const errorMessage = row.original.errorMsg ? row.original.errorMsg : '';
  const email = row.original[column.emailAccessor];

  return (
    <div className="flex items-center">
      {errorMessage && ( 
        <ExclamationCircleIcon className="cursor-pointer h-5 mr-1 text-red-500" title={errorMessage} /> 
      )}
      <div className="image-container mr-3">
        <Avatar 
          name={value} 
          src={url}
          size={28}
          className="flex-shrink-0"
        />
      </div>
      <div className="name-container min-w-0 flex-1">
        <div className="text-sm text-gray-900 font-medium truncate">{value}</div>
        {email && (
          <div className="text-sm text-gray-500 truncate">{email}</div>
        )}
      </div>
    </div>
  );
}

export function SelectCell({ value, column, row }) {
  const options = column.Options;
  const valueIdAccessor = column.valueIdAccessor;
  const valueId = valueIdAccessor && row.original[valueIdAccessor];
  const [defaultValue, setDefaultValue] = useState(valueId ? valueId : value);
  const callback = column.selectOnChange;

  const handleChange = (val) => {
    setDefaultValue(val);
    const originalValue = row.original;
    callback && callback(originalValue, val);
  };

  return (
    <SelectDropdown
      name="select"
      value={defaultValue}
      options={options}
      onChange={handleChange}
      className="w-full"
      isSearchable={false}
      table={true}
    />
  );
}

export function InputCell({ value, column, row }) {
  const inputType = column.inputType ? column.inputType : text;
  const [defaultValue, setDefaultValue] = useState(value);
  const onBlur = column.onBlur;
  const index = row.index;
  const disabledColumn = column.disabledColumn && row.original[column.disabledColumn];

  const handleOnBlur = (e) => {
    const type = inputType === 'number' ? 'amount' : 'remarks';
    onBlur && onBlur(e, index, type);
  }

  return (
    <input 
      type={inputType}
      name="input"
      defaultValue={defaultValue}
      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-main focus:border-main block w-10/12 p-2.5"
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => handleOnBlur(e)}
      disabled={disabledColumn <= 0 ? true : false}
    />
  )
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function SortIcon({ className }) {
  return (
    <svg
      className={className}
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 320 512"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M41 288h238c21.4 0 32.1 25.9 17 41L177 448c-9.4 9.4-24.6 9.4-33.9 0L24 329c-15.1-15.1-4.4-41 17-41zm255-105L177 64c-9.4-9.4-24.6-9.4-33.9 0L24 183c-15.1 15.1-4.4 41 17 41h238c21.4 0 32.1-25.9 17-41z"></path>
    </svg>
  );
}

export function SortUpIcon({ className }) {
  return (
    <svg
      className={className}
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 320 512"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M279 224H41c-21.4 0-32.1-25.9-17-41L143 64c9.4-9.4 24.6-9.4 33.9 0l119 119c15.2 15.1 4.5 41-16.9 41z"></path>
    </svg>
  );
}

export function SortDownIcon({ className }) {
  return (
    <svg
      className={className}
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 320 512"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M41 288h238c21.4 0 32.1 25.9 17 41L177 448c-9.4 9.4-24.6 9.4-33.9 0L24 329c-15.1-15.1-4.4-41 17-41z"></path>
    </svg>
  );
}

export function Button({ children, className, ...rest }) {
  return (
    <button
      type="button"
      className={classNames(
        "relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PageButton({ children, className, ...rest }) {
  return (
    <button
      type="button"
      className={classNames(
        "relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

const ActionButton = ({ row, rowActionButtons, currentUser, dropDownActionOrigin, isWeekend, isHoliday }) => {
  const status = row.original.hasOwnProperty('status') ? row.original.status : '';
  const page = row.original.hasOwnProperty('page') ? row.original.page : '';
  const data = row.original;

  // Fund Transfer specific logic
  const isFundTransfer = dropDownActionOrigin === 'fund-transfer';

  // Fund Transfer action visibility logic - UPDATED: Ignore branch for rep=2
  const getFundTransferActionVisibility = (actionLabel) => {
    if (!isFundTransfer || !currentUser) return true; // Default to show for non-fund-transfer

    // Add safety checks for data properties
    if (!data || typeof data !== 'object') {
      console.log(`Action ${actionLabel}: No data available, showing button`);
      return true; // Show buttons if data is not available yet
    }

    // Branch logic only applies to rep=3 and rep=4, NOT rep=2 (area_admin)
    let userBranchId = null;
    let isGiverBranch = false;
    let isReceiverBranch = false;
    
    if (currentUser.role?.rep === 3 || currentUser.role?.rep === 4) {
      // Handle designatedBranchId for branch-specific roles
      userBranchId = currentUser.designatedBranchId;
      if (!userBranchId && currentUser.designatedBranch) {
        try {
          // Parse the designatedBranch array string
          const branchArray = JSON.parse(currentUser.designatedBranch);
          userBranchId = branchArray[0]; // Take the first branch
        } catch (e) {
          console.warn('Could not parse designatedBranch:', currentUser.designatedBranch);
        }
      }
      isGiverBranch = userBranchId === data.giverBranchId;
      isReceiverBranch = userBranchId === data.receiverBranchId;
    }

    const isCreator = data.insertedById === currentUser._id;
    const isAreaAdmin = currentUser.role?.shortCode === 'area_admin'; // rep=2
    const isBranchManager = currentUser.role?.rep === 3; // Branch managers with rep = 3
    const isFinance = currentUser.role?.shortCode === 'finance';
    const isRegionalManager = currentUser.role?.shortCode === 'regional_manager';
    const isDeputyDirector = currentUser.role?.shortCode === 'deputy_director';
    const isFTAdmin = currentUser?.email === 'ftadmin@ambercashph.com';

    // Add safety checks for status and approval statuses
    const transferStatus = data.status || 'pending';
    const giverApprovalStatus = data.giverApprovalStatus || 'pending';
    const receiverApprovalStatus = data.receiverApprovalStatus || 'pending';

    switch (actionLabel) {
      case 'Edit Transfer':
        // Check if user is FT Admin
        const isFTAdminEdit = isFTAdmin;
        
        // Base condition: Only the creator (area_admin with rep=2), finance, or regional_manager can edit when transfer is pending
        const baseCanEdit = (transferStatus === 'pending') && ((isCreator && isAreaAdmin) || isFinance || isRegionalManager || isDeputyDirector);
        
        // Additional restriction: Don't allow edit if any branch has already approved
        // Once any approval is given, the transfer should not be editable
        const hasAnyApproval = (giverApprovalStatus === 'approved') || (receiverApprovalStatus === 'approved');
        
        // FT Admin can edit regardless of status or approval
        const canEdit = isFTAdminEdit || (baseCanEdit && !hasAnyApproval);
        
        return canEdit;

      case 'Approve Transfer':
        // Check if weekend or holiday first - these affect ALL users
        if (isWeekend || isHoliday) {
          return false;
        }

        const canApprove = (transferStatus === 'pending') && (
          // Branch managers (rep=3) can approve if they're from involved branch
          (isBranchManager && (isGiverBranch || isReceiverBranch) && 
           ((isGiverBranch && giverApprovalStatus === 'pending') || 
            (isReceiverBranch && receiverApprovalStatus === 'pending'))) ||
          // Rep=4 can also approve if they're from involved branch
          (currentUser.role?.rep === 4 && (isGiverBranch || isReceiverBranch) && 
           ((isGiverBranch && giverApprovalStatus === 'pending') || 
            (isReceiverBranch && receiverApprovalStatus === 'pending'))) ||
          // Finance can approve if both branches have approved (final approval)
          (isFinance && giverApprovalStatus === 'approved' && receiverApprovalStatus === 'approved')
        );
        
        return canApprove;

      case 'Reject Transfer':
        // Check if weekend or holiday first - these affect ALL users
        if (isWeekend || isHoliday) {
          return false;
        }

        const canReject = (transferStatus === 'pending') && (
          // Branch managers (rep=3) can reject if they're from involved branch
          (isBranchManager && (isGiverBranch || isReceiverBranch)) || 
          // Rep=4 can also reject if they're from involved branch
          (currentUser.role?.rep === 4 && (isGiverBranch || isReceiverBranch)) ||
          // Finance can reject any time when status is pending
          isFinance
        );
        
        return canReject;

      case 'Delete Transfer':
        // Only creator (area_admin with rep=2) OR giver branch (rep=3/4) can delete if no approvals yet
        const canDelete = (transferStatus === 'pending') && 
          (giverApprovalStatus === 'pending' && receiverApprovalStatus === 'pending') && // No approvals yet
          ((isCreator && (isAreaAdmin || isFinance || isRegionalManager || isDeputyDirector)));
        
        return canDelete;

      default:
        return true; // Default to show for other actions
    }
  };

  // Safety check function to ensure action is callable
  const safeCallAction = (item, row) => {
    if (item && typeof item.action === 'function') {
      item.action(row);
    } else {
      console.warn('Action is not a function:', item);
    }
  };

  // Use normal business logic for action button visibility
  const showAllFundTransferButtons = false;

  return (
    <React.Fragment>
      <div className="flex flex-row justify-center">
        {rowActionButtons && rowActionButtons.map((item, index) => {
          // Check visibility for fund transfer actions
          if (isFundTransfer && !showAllFundTransferButtons && !getFundTransferActionVisibility(item.label)) {
            return null; // Don't render if not visible
          }

          return (
            <React.Fragment key={index}>
              {/* Fund Transfer Actions */}
              {item.label === 'Edit Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded" onClick={() => safeCallAction(item, row)} title="Edit Transfer">
                  <PencilIcon className="h-5 text-blue-600" />
                </div>
              )}
              {item.label === 'Approve Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded" onClick={() => safeCallAction(item, row)} title="Approve Transfer">
                  <CheckIcon className="h-5 text-green-600" />
                </div>
              )}
              {item.label === 'Reject Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded" onClick={() => safeCallAction(item, row)} title="Reject Transfer">
                  <XMarkIcon className="h-5 text-red-600" />
                </div>
              )}
              {item.label === 'Delete Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded" onClick={() => safeCallAction(item, row)} title="Delete Transfer">
                  <TrashIcon className="h-5 text-gray-600" />
                </div>
              )}

              {/* Original Actions */}
              {item.label === 'Approve' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Approve">
                  <CheckIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Reject' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reject">
                  <XMarkIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Edit Loan' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Edit">
                  <PencilIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Delete Loan' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Delete">
                  <TrashIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'View Disclosure' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="View Disclosure">
                  <DocumentIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'View LAF') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="View Loan Application Form">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    className="cursor-pointer h-5 text-indigo-600"
                  >
                    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zm9.586 4.594a.75.75 0 00-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.116-.062l3-3.75z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {(item.label === 'Edit') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Edit">
                  <PencilIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Delete') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Delete">
                  <TrashIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Open' && page === 'loan-officer-summary' && status === 'close') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Open Transaction">
                  <LockClosedIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Close' && page === 'loan-officer-summary' && status === 'open') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Close Transaction">
                  <LockOpenIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Reloan') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reloan">
                  <ArrowPathIcon className="cursor-pointer h-5" />
                </div>
              )}
              {(item.label === 'Close Account') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Close Account">
                  <XCircleIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Reset Password' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reset Password">
                  <KeyIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Update' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <ArrowPathIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Revert' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <ArrowUturnLeftIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Transfer' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <ArrowsRightLeftIcon className="cursor-pointer h-5" />
                </div>
              )}
              {item.label === 'Unmark as Duplicate' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="cursor-pointer h-5">
                    <rect x="6" y="6" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <rect x="3" y="3" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              )}
              {item.label === 'Lock' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Lock">
                  { row.original?.lockTransaction ? <LockClosedIcon className="cursor-pointer h-5" /> : <LockOpenIcon className="cursor-pointer h-5" />}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </React.Fragment>
  );
};

const TableComponent = React.memo(({
  columns = [],
  data = [],
  showPagination = true,
  showFilters = true,
  columnSorting = true,
  showSearch = false,
  title = "",
  hasActionButtons = true,
  rowActionButtons = [],
  rowClick = null,
  noPadding = false,
  border = false,
  multiSelect = false,
  multiSelectActionFn = null,
  pageSize: initialPageSize = 30,
  dropDownActions = [],
  actionDropDownDataOptions = {},
  dropDownActionOrigin,
  currentUser = null,
  isWeekend = false,
  isHoliday = false,
  showTotals = false, // New prop for showing totals
}) => {
  // Add state for current page
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAll, setSelectAll] = useState(false);
  
  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: { 
        pageIndex: currentPageIndex, 
        pageSize: initialPageSize 
      },
      // Remove manualPagination to let react-table handle the pagination
      autoResetPage: false, // Prevent page reset on data changes
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state,
    preGlobalFilteredRows,
    setGlobalFilter,
  } = tableInstance;

  const generateEmptyRows = (columnCount) => {
    return (
      <>
        <tr>
          <td 
            colSpan={columnCount + (multiSelect ? 1 : 0) + ((hasActionButtons || dropDownActions.length > 0) ? 1 : 0)} 
            className="px-4 py-6 text-center"
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <ExclamationCircleIcon className="h-8 w-8 text-gray-400" />
              <span className="text-gray-500 text-lg font-medium">No data collections</span>
            </div>
          </td>
        </tr>
      </>
    )
  };

  // Generate totals row
  const generateTotalsRow = () => {
    if (!showTotals || data.length === 0) return null;

    return (
      <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-red-600">
        {multiSelect && (
          <td className="px-4 py-3 w-10"></td>
        )}
        {columns.map((column, index) => {
          const { totalType, totalValue } = column;
          
          let content = '';
          if (totalType === 'sum' && totalValue) {
            content = totalValue;
          } else if (totalType === 'none' || !totalType) {
            content = '';
          }

          // For the first column, always show "TOTAL"
          if (index === 0) {
            content = 'TOTAL';
          }

          return (
            <td 
              key={`total-${index}`}
              className={`px-4 py-3 ${column.width || 'w-auto'} ${index === 0 ? 'text-left' : 'text-right'}`}
            >
              {content}
            </td>
          );
        })}
        {(hasActionButtons || dropDownActions.length > 0) && (
          <td className="px-4 py-3 w-24"></td>
        )}
      </tr>
    );
  };

  // And update the TableComponent's select all handler:
const handleSelectAll = useCallback(() => {
  const newSelectAll = !selectAll;
  setSelectAll(newSelectAll);
  
  if (multiSelectActionFn) {
      multiSelectActionFn('all', newSelectAll, null, currentPageIndex);
  }
}, [selectAll, currentPageIndex, multiSelectActionFn]);

// Also update the individual row selection handler:
const handleSelectRow = useCallback((row, index) => {
  if (multiSelectActionFn) {
      const rowWithIndex = {
          ...row,
          index: index
      };
      multiSelectActionFn('row', null, rowWithIndex, currentPageIndex);
  }
}, [multiSelectActionFn, currentPageIndex]);

  // Calculate if any items on current page are selected
  const updateSelectAllState = useCallback(() => {
    if (page && page.length > 0) {
      const currentPageSelected = page.every(row => row.original.selected);
      setSelectAll(currentPageSelected);
    }
  }, [page]);

  // Update select all state when page changes
  useEffect(() => {
    updateSelectAllState();
  }, [currentPageIndex, data, updateSelectAllState]);

  // Enhanced pagination handlers with state updates
  const handleGotoPage = useCallback((pageIndex) => {
    setCurrentPageIndex(pageIndex);
    gotoPage(pageIndex);
    setSelectAll(false); // Reset select all when changing pages
  }, [gotoPage]);

  const handleNextPage = useCallback(() => {
    const nextPageIndex = currentPageIndex + 1;
    setCurrentPageIndex(nextPageIndex);
    nextPage();
    setSelectAll(false); // Reset select all when changing pages
  }, [nextPage, currentPageIndex]);

  const handlePreviousPage = useCallback(() => {
    const prevPageIndex = currentPageIndex - 1;
    setCurrentPageIndex(prevPageIndex);
    previousPage();
    setSelectAll(false); // Reset select all when changing pages
  }, [previousPage, currentPageIndex]);

  const handleSetPageSize = useCallback((size) => {
    setPageSize(size);
    setCurrentPageIndex(0);
    setSelectAll(false); // Reset select all when changing page size
  }, [setPageSize]);

  // Calculate pagination details
  const startIndex = currentPageIndex * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, data.length);
  
  const renderHeaderGroups = () => {
    return headerGroups.map((headerGroup, groupIndex) => {
      const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
      return (
        <tr key={`header-group-${groupIndex}`} {...headerGroupProps}>
          {multiSelect && (
            <th key="header-checkbox" className="px-4 py-3 w-10">
              <CheckBox
                name="selectAll"
                value={selectAll}
                onChange={handleSelectAll}
                size="md"
                disabled={page.every(row => row.original.withError || row.original.status !== 'pending')}
              />
            </th>
          )}
          {headerGroup.headers.map((column, columnIndex) => {
            const { key, ...columnProps } = column.getHeaderProps(column.getSortByToggleProps());
            return (
              <th
                key={`header-${columnIndex}`}
                scope="col"
                className={`px-4 py-3 ${column.width || 'w-auto'}`}
                {...columnProps}
              >
                <div className="flex items-center">
                  {column.render('Header')}
                  <span>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? ' 🔽'
                        : ' 🔼'
                      : ''}
                  </span>
                </div>
              </th>
            );
          })}
          {(hasActionButtons || dropDownActions.length > 0) && (
            <th key="header-actions" scope="col" className="px-4 py-3 w-24">
              Actions
            </th>
          )}
        </tr>
      );
    });
  };

  return (
    <div className="relative w-full shadow-md rounded-lg overflow-hidden">
      {title && <h2 className="text-xl font-semibold p-4">{title}</h2>}
      
      <div className={`${noPadding ? 'p-1' : 'p-4'} w-full`}>
        <div className="overflow-x-auto min-h-[200px]">
          <table {...getTableProps()} className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              {renderHeaderGroups()}
            </thead>
            <tbody {...getTableBodyProps()}>
              {page.length > 0 ? (
                page.map((row, i) => {
                  prepareRow(row);
                  const {
                    root,
                    delinquent,
                    totalData,
                    selected,
                    disable,
                    status,
                    isDraft,
                    page: pageName,
                    ldfApproved,
                    withError: error,
                    insertedDate,
                    modifiedDate,
                    modifiedById
                  } = row.original;

                  const checkBoxDisable = disable || error;
                  
                  // Check transfer indicator type for fund transfers
                  const isFundTransfer = dropDownActionOrigin === 'fund-transfer';
                  const indicatorType = isFundTransfer && status === 'pending' 
                    ? getTransferIndicatorType(insertedDate, modifiedDate, modifiedById) 
                    : null;

                  // Enhanced row class logic with transfer indicators
                  let rowClass = 'bg-white border-b hover:bg-gray-50';
                  
                  if (delinquent === 'Yes' || error) {
                    rowClass = 'bg-red-100 border-b hover:bg-red-200';
                  } else if (status === 'open') {
                    rowClass = 'bg-blue-100 border-b hover:bg-blue-200';
                  } else if (ldfApproved) {
                    rowClass = 'bg-green-100 border-b hover:bg-green-200';
                  } else if (indicatorType === 'modified') {
                    // Recently modified fund transfer styling
                    rowClass = 'bg-orange-50 border-b border-l-4 border-l-orange-500 hover:bg-orange-100';
                  } else if (indicatorType === 'new') {
                    // Recently created fund transfer styling
                    rowClass = 'bg-green-50 border-b border-l-4 border-l-green-500 hover:bg-green-100';
                  }

                  const { key, ...rowProps } = row.getRowProps();
                  return (
                    <tr
                      key={`row-${i}`}
                      {...rowProps}
                      className={rowClass}
                      style={isDraft ? { backgroundColor: "#F9DFB3" } : {}}
                    >
                      {multiSelect && (
                        <td className="px-4 py-3 w-10">
                          <CheckBox
                            name={`select-${i}`}
                            value={row.original.selected}
                            onChange={() => handleSelectRow(row.original, i)}
                            size="md"
                            disabled={checkBoxDisable}
                          />
                        </td>
                      )}
                      {row.cells.map((cell, index) => (
                        <td 
                          {...cell.getCellProps()}
                          key={`row-data-${index}`}
                          className={`px-4 py-3 ${totalData ? 'font-bold text-red-500' : ''} ${rowClick ? 'cursor-pointer' : ''} ${cell.column.width || 'w-auto'}`}
                          onClick={() => rowClick && rowClick(row.original)}
                        >
                          <div className="flex items-center space-x-2">
                            {cell.render('Cell')}
                            {/* Add badges for recent transfers in the first column (usually transaction code) */}
                            {indicatorType && index === 0 && (
                              <>
                                {indicatorType === 'new' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    New
                                  </span>
                                )}
                                {indicatorType === 'modified' && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                    </svg>
                                    Updated
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      ))}
                      {(hasActionButtons || dropDownActions.length > 0) && (
                        <td className="px-4 py-3 w-24">
                          <div className="flex items-center justify-center space-x-2">
                            {hasActionButtons && !root && !row.original.system && (
                              <ActionButton 
                                row={row} 
                                rowActionButtons={rowActionButtons}
                                currentUser={currentUser}
                                dropDownActionOrigin={dropDownActionOrigin}
                                isWeekend={isWeekend}
                                isHoliday={isHoliday}
                              />
                            )}
                            {dropDownActions.length > 0 && (
                              <ActionDropDown
                                key={i}
                                data={row.original}
                                options={dropDownActions}
                                dataOptions={actionDropDownDataOptions}
                                origin={dropDownActionOrigin}
                              />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                generateEmptyRows(columns.length)
              )}
              {/* Add totals row at the end of tbody */}
              {generateTotalsRow()}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {showPagination && data.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 mt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 mr-4">
                Page <span className="font-medium">{currentPageIndex + 1}</span> of{' '}
                <span className="font-medium">{pageOptions.length}</span>
              </span>
              <button
                onClick={() => handleGotoPage(0)}
                disabled={!canPreviousPage}
                className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronDoubleLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handlePreviousPage}
                disabled={!canPreviousPage}
                className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextPage}
                disabled={!canNextPage}
                className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleGotoPage(pageCount - 1)}
                disabled={!canNextPage}
                className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronDoubleRightIcon className="w-5 h-5" />
              </button>
              <select
                value={state.pageSize}
                onChange={e => handleSetPageSize(Number(e.target.value))}
                className="block w-20 px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default TableComponent;