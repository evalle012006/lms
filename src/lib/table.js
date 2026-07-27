/* eslint-disable key-spacing */
/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
import React, { useState, useCallback, useMemo } from 'react';
import { useTable, useFilters, useGlobalFilter, useSortBy, usePagination } from 'react-table';
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Key,
  Lock,
  LockOpen,
  Pencil,
  QrCode,
  RefreshCw,
  Trash2,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import CheckBox from './ui/checkbox';
import ActionDropDown from './ui/action-dropdown';
import Avatar from './avatar';
import { useEffect } from 'react';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { SignedUrlContext, useSignedUrlMap } from '@/lib/SignedUrlContext';
import SelectDropdown from './ui/select';

// Helper functions to check transfer status
const isRecentlyCreated = (insertedDate) => {
  const now = new Date();
  const createdDate = new Date(insertedDate);
  const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
  return hoursDiff <= 24;
};

const isRecentlyModified = (insertedDate, modifiedDate) => {
  if (!modifiedDate) return false;
  const now = new Date();
  const createdDate = new Date(insertedDate);
  const lastModifiedDate = new Date(modifiedDate);
  const wasActuallyModified = lastModifiedDate > createdDate;
  if (!wasActuallyModified) return false;
  const hoursSinceModified = (now - lastModifiedDate) / (1000 * 60 * 60);
  return hoursSinceModified <= 24;
};

const getTransferIndicatorType = (insertedDate, modifiedDate, modifiedById) => {
  if (modifiedDate && modifiedDate !== insertedDate && modifiedById) {
    return 'modified';
  }
  return 'new';
};

export function SelectColumnFilter({
  column: { filterValue, setFilter, preFilteredRows, id, render },
}) {
  const options = React.useMemo(() => {
    const options = new Set();
    preFilteredRows.forEach((row) => {
      options.add(row.values[id]);
    });
    return [...options.values()];
  }, [id, preFilteredRows]);

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
  const rawUrl = row.original[column.imgAccessor];
  const errorMessage = row.original.errorMsg ? row.original.errorMsg : '';
  const email = row.original[column.emailAccessor];
  const urlMap = useSignedUrlMap();
  const signedUrl = rawUrl ? (urlMap[rawUrl] ?? null) : null;

  return (
    <div className="flex items-center">
      {errorMessage && (
        <AlertCircle className="cursor-pointer h-5 w-5 mr-1 text-red-500" title={errorMessage} />
      )}
      <div className="image-container mr-3">
        <Avatar
          name={value}
          src={signedUrl || undefined}
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
  };

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
  );
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function SortIcon({ className }) {
  return (
    <svg className={className} stroke="currentColor" fill="currentColor" strokeWidth="0"
      viewBox="0 0 320 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
      <path d="M41 288h238c21.4 0 32.1 25.9 17 41L177 448c-9.4 9.4-24.6 9.4-33.9 0L24 329c-15.1-15.1-4.4-41 17-41zm255-105L177 64c-9.4-9.4-24.6-9.4-33.9 0L24 183c-15.1 15.1-4.4 41 17 41h238c21.4 0 32.1-25.9 17-41z"></path>
    </svg>
  );
}

export function SortUpIcon({ className }) {
  return (
    <svg className={className} stroke="currentColor" fill="currentColor" strokeWidth="0"
      viewBox="0 0 320 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
      <path d="M279 224H41c-21.4 0-32.1-25.9-17-41L143 64c9.4-9.4 24.6-9.4 33.9 0l119 119c15.2 15.1 4.5 41-16.9 41z"></path>
    </svg>
  );
}

export function SortDownIcon({ className }) {
  return (
    <svg className={className} stroke="currentColor" fill="currentColor" strokeWidth="0"
      viewBox="0 0 320 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
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

  const isFundTransfer = dropDownActionOrigin === 'fund-transfer';

  const getFundTransferActionVisibility = (actionLabel) => {
    if (!isFundTransfer || !currentUser) return true;
    if (!data || typeof data !== 'object') return true;

    let userBranchId = null;
    let isGiverBranch = false;
    let isReceiverBranch = false;

    if (currentUser.role?.rep === 3 || currentUser.role?.rep === 4) {
      userBranchId = currentUser.designatedBranchId;
      if (!userBranchId && currentUser.designatedBranch) {
        try {
          const branchArray = JSON.parse(currentUser.designatedBranch);
          userBranchId = branchArray[0];
        } catch (e) {
          console.warn('Could not parse designatedBranch:', currentUser.designatedBranch);
        }
      }
      isGiverBranch = userBranchId === data.giverBranchId;
      isReceiverBranch = userBranchId === data.receiverBranchId;
    }

    const isCreator = data.insertedById === currentUser._id;
    const isAreaAdmin = currentUser.role?.shortCode === 'area_admin';
    const isBranchManager = currentUser.role?.rep === 3;
    const isFinance = currentUser.role?.shortCode === 'finance';
    const isRegionalManager = currentUser.role?.shortCode === 'regional_manager';
    const isDeputyDirector = currentUser.role?.shortCode === 'deputy_director';

    const transferStatus = data.status || 'pending';
    const giverApprovalStatus = data.giverApprovalStatus || 'pending';
    const receiverApprovalStatus = data.receiverApprovalStatus || 'pending';

    switch (actionLabel) {
      case 'Edit Transfer': {
        if ((isWeekend || isHoliday) && !isFinance) return false;
        const baseCanEdit = (transferStatus === 'pending') && ((isCreator && isAreaAdmin) || isFinance || isRegionalManager || isDeputyDirector);
        const hasAnyApproval = (giverApprovalStatus === 'approved') || (receiverApprovalStatus === 'approved');
        return isFinance || (baseCanEdit && !hasAnyApproval);
      }
      case 'Approve Transfer': {
        const canApprove = (transferStatus === 'pending') && (
          (isBranchManager && (isGiverBranch || isReceiverBranch) &&
           ((isGiverBranch && giverApprovalStatus === 'pending') ||
            (isReceiverBranch && receiverApprovalStatus === 'pending'))) ||
          (currentUser.role?.rep === 4 && (isGiverBranch || isReceiverBranch) &&
           ((isGiverBranch && giverApprovalStatus === 'pending') ||
            (isReceiverBranch && receiverApprovalStatus === 'pending'))) ||
          (isFinance && giverApprovalStatus === 'approved' && receiverApprovalStatus === 'approved')
        );
        return canApprove;
      }
      case 'Reject Transfer': {
        const canReject = (transferStatus === 'pending') && (
          (isBranchManager && (isGiverBranch || isReceiverBranch)) ||
          (currentUser.role?.rep === 4 && (isGiverBranch || isReceiverBranch)) ||
          isFinance
        );
        return canReject;
      }
      case 'Delete Transfer': {
        const canDelete = (transferStatus === 'pending') &&
          (giverApprovalStatus === 'pending' && receiverApprovalStatus === 'pending') &&
          ((isCreator && (isAreaAdmin || isFinance || isRegionalManager || isDeputyDirector)));
        return canDelete;
      }
      default:
        return true;
    }
  };

  const safeCallAction = (item, row) => {
    if (item && typeof item.action === 'function') {
      item.action(row);
    } else {
      console.warn('Action is not a function:', item);
    }
  };

  // Shared icon class — lucide icons need explicit w + h
  const ic = 'cursor-pointer h-5 w-5';

  return (
    <React.Fragment>
      <div className="flex flex-row justify-center">
        {rowActionButtons && rowActionButtons.map((item, index) => {
          if (isFundTransfer && !getFundTransferActionVisibility(item.label)) {
            return null;
          }

          return (
            <React.Fragment key={index}>
              {/* ── Fund Transfer Actions ────────────────────────── */}
              {item.label === 'Edit Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded"
                  onClick={() => safeCallAction(item, row)} title="Edit Transfer">
                  <Pencil className={`${ic} text-blue-600`} />
                </div>
              )}
              {item.label === 'Approve Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded"
                  onClick={() => safeCallAction(item, row)} title="Approve Transfer">
                  <Check className={`${ic} text-green-600`} />
                </div>
              )}
              {item.label === 'Reject Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded"
                  onClick={() => safeCallAction(item, row)} title="Reject Transfer">
                  <X className={`${ic} text-red-600`} />
                </div>
              )}
              {item.label === 'Delete Transfer' && (
                <div className="px-2 cursor-pointer hover:bg-gray-100 rounded"
                  onClick={() => safeCallAction(item, row)} title="Delete Transfer">
                  <Trash2 className={`${ic} text-gray-600`} />
                </div>
              )}

              {/* ── Original Actions ─────────────────────────────── */}
              {item.label === 'Approve' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Approve">
                  <Check className={ic} />
                </div>
              )}
              {item.label === 'Reject' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reject">
                  <X className={ic} />
                </div>
              )}
              {(item.label === 'Edit Loan' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Edit">
                  <Pencil className={ic} />
                </div>
              )}
              {(item.label === 'Delete Loan' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Delete">
                  <Trash2 className={ic} />
                </div>
              )}
              {(item.label === 'View Disclosure' && status !== 'active') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="View Disclosure">
                  <FileText className={ic} />
                </div>
              )}
              {item.label === 'View LAF' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="View Loan Application Form">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                    className={`${ic} text-indigo-600`}>
                    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zm9.586 4.594a.75.75 0 00-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.116-.062l3-3.75z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {(item.label === 'View Approval Details' && row.original.ldfApproved) && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="View Approval Details">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                    className={`${ic} text-green-600`}>
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              {item.label === 'Edit' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Edit">
                  <Pencil className={ic} />
                </div>
              )}
              {item.label === 'Delete' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Delete">
                  <Trash2 className={ic} />
                </div>
              )}
              {(item.label === 'Open' && page === 'loan-officer-summary' && status === 'close') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Open Transaction">
                  <Lock className={ic} />
                </div>
              )}
              {(item.label === 'Close' && page === 'loan-officer-summary' && status === 'open') && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Close Transaction">
                  <LockOpen className={ic} />
                </div>
              )}
              {item.label === 'Reloan' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reloan">
                  <RefreshCw className={ic} />
                </div>
              )}
              {item.label === 'Close Account' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Close Account">
                  <XCircle className={ic} />
                </div>
              )}
              {item.label === 'Reset Password' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Reset Password">
                  <Key className={ic} />
                </div>
              )}
              {item.label === 'Update' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <RefreshCw className={ic} />
                </div>
              )}
              {item.label === 'Revert' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <Undo2 className={ic} />
                </div>
              )}
              {item.label === 'Transfer' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <ArrowLeftRight className={ic} />
                </div>
              )}
              {item.label === 'Unmark as Duplicate' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title={item.title}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={ic}>
                    <rect x="6" y="6" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <rect x="3" y="3" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"/>
                    <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              )}
              {item.label === 'Lock' && (
                <div className="px-2" onClick={() => safeCallAction(item, row)} title="Lock">
                  {row.original?.lockTransaction
                    ? <Lock className={ic} />
                    : <LockOpen className={ic} />}
                </div>
              )}
              {item.label === 'Generate QR' && (
                // FIX: hide QR button when group is full (no available slots)
                // !row.original.availableSlots?.length ? (
                //   <span className="px-2 text-xs text-gray-400" title="Group is full">
                //     —
                //   </span>
                // ) : (
                  <div className="px-2" onClick={() => safeCallAction(item, row)} title="Manage QR Code">
                    <QrCode className={`${ic} text-indigo-600`} />
                  </div>
                // )
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
  showTotals = false,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectAll, setSelectAll] = useState(false);

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: {
        pageIndex: currentPageIndex,
        pageSize: initialPageSize,
      },
      autoResetPage: false,
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  const profileKeys = useMemo(() => {
    const imgAccessors = columns
      .filter((c) => c.imgAccessor)
      .map((c) => c.imgAccessor);
    if (imgAccessors.length === 0) return [];
    const keys = [];
    data.forEach((row) => {
      imgAccessors.forEach((accessor) => {
        if (row[accessor]) keys.push(row[accessor]);
      });
    });
    return keys;
  }, [data, columns]);

  const { urlMap } = useBulkSignedUrls(profileKeys);

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

  const generateEmptyRows = (columnCount) => (
    <tr>
      <td
        colSpan={columnCount + (multiSelect ? 1 : 0) + ((hasActionButtons || dropDownActions.length > 0) ? 1 : 0)}
        className="px-4 py-6 text-center"
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <AlertCircle className="h-8 w-8 text-gray-400" />
          <span className="text-gray-500 text-lg font-medium">No data collections</span>
        </div>
      </td>
    </tr>
  );

  const generateTotalsRow = () => {
    if (!showTotals || data.length === 0) return null;
    return (
      <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-red-600">
        {multiSelect && <td className="px-4 py-3 w-10"></td>}
        {columns.map((column, index) => {
          const { totalType, totalValue } = column;
          let content = '';
          if (totalType === 'sum' && totalValue) content = totalValue;
          if (index === 0) content = 'TOTAL';
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

  const handleSelectAll = useCallback(() => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (multiSelectActionFn) {
      multiSelectActionFn('all', newSelectAll, null, currentPageIndex);
    }
  }, [selectAll, currentPageIndex, multiSelectActionFn]);

  const handleSelectRow = useCallback((row, index) => {
    if (multiSelectActionFn) {
      multiSelectActionFn('row', null, { ...row, index }, currentPageIndex);
    }
  }, [multiSelectActionFn, currentPageIndex]);

  const updateSelectAllState = useCallback(() => {
    if (page && page.length > 0) {
      setSelectAll(page.every(row => row.original.selected));
    }
  }, [page]);

  useEffect(() => {
    updateSelectAllState();
  }, [currentPageIndex, data, updateSelectAllState]);

  const handleGotoPage = useCallback((pageIndex) => {
    setCurrentPageIndex(pageIndex);
    gotoPage(pageIndex);
    setSelectAll(false);
  }, [gotoPage]);

  const handleNextPage = useCallback(() => {
    setCurrentPageIndex(currentPageIndex + 1);
    nextPage();
    setSelectAll(false);
  }, [nextPage, currentPageIndex]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPageIndex(currentPageIndex - 1);
    previousPage();
    setSelectAll(false);
  }, [previousPage, currentPageIndex]);

  const handleSetPageSize = useCallback((size) => {
    setPageSize(size);
    setCurrentPageIndex(0);
    setSelectAll(false);
  }, [setPageSize]);

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
                    {column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}
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
    <SignedUrlContext.Provider value={urlMap}>
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
                      root, delinquent, totalData, selected, disable, status,
                      isDraft, page: pageName, ldfApproved,
                      withError: error, insertedDate, modifiedDate, modifiedById,
                    } = row.original;

                    const checkBoxDisable = disable || error;
                    const isFundTransfer = dropDownActionOrigin === 'fund-transfer';
                    const indicatorType = isFundTransfer && status === 'pending'
                      ? getTransferIndicatorType(insertedDate, modifiedDate, modifiedById)
                      : null;

                    let rowClass = 'bg-white border-b hover:bg-gray-50';
                    if (delinquent === 'Yes' || error) {
                      rowClass = 'bg-red-100 border-b hover:bg-red-200';
                    } else if (status === 'open') {
                      rowClass = 'bg-blue-100 border-b hover:bg-blue-200';
                    } else if (ldfApproved) {
                      rowClass = 'bg-green-100 border-b hover:bg-green-200';
                    } else if (indicatorType === 'modified') {
                      rowClass = 'bg-orange-50 border-b border-l-4 border-l-orange-500 hover:bg-orange-100';
                    } else if (indicatorType === 'new') {
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
                {generateTotalsRow()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {showPagination && data.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 mt-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700 mr-4">
                  Page <span className="font-medium">{currentPageIndex + 1}</span> of{' '}
                  <span className="font-medium">{pageOptions.length}</span>
                </span>
                <button onClick={() => handleGotoPage(0)} disabled={!canPreviousPage}
                  className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  <ChevronsLeft className="w-5 h-5" />
                </button>
                <button onClick={handlePreviousPage} disabled={!canPreviousPage}
                  className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={handleNextPage} disabled={!canNextPage}
                  className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={() => handleGotoPage(pageCount - 1)} disabled={!canNextPage}
                  className="p-1 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                  <ChevronsRight className="w-5 h-5" />
                </button>
                <select
                  value={state.pageSize}
                  onChange={e => handleSetPageSize(Number(e.target.value))}
                  className="block w-20 px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {[10, 20, 30, 40, 50].map(pageSize => (
                    <option key={pageSize} value={pageSize}>{pageSize}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </SignedUrlContext.Provider>
  );
});

export default TableComponent;