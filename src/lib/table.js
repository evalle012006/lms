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
          status.startsWith("reject") || status.startsWith("close") || status.startsWith("closed") || status.startsWith("offset") ? "status-pill-rejected" : null
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

  return (
    <div className="flex items-center">
      {errorMessage && ( <ExclamationCircleIcon className="cursor-pointer h-5 mr-1" title={errorMessage} /> )}
      <div className="image-container">
        {url ? (
          <img
            className="image"
            src={url}
            alt=""
          />
        ) : (
          <Avatar name={value} size="28" />
        )}
      </div>
      <div className="name-container">
        <div className="text-sm text-gray-500">{value}</div>
        <div className="text-sm text-gray-500">
          {row.original[column.emailAccessor]}
        </div>
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

const ActionButton = ({ row, rowActionButtons }) => {
  const status = row.original.hasOwnProperty('status') ? row.original.status : '';
  const page = row.original.hasOwnProperty('page') ? row.original.page : '';
  return (
    <React.Fragment>
      <div className="flex flex-row justify-center">
            {rowActionButtons && rowActionButtons.map((item, index) => {
                return (
                    <React.Fragment key={index}>
                      {item.label === 'Approve' && (
                        <div className="px-2" onClick={() => item.action(row)} title="Approve">
                          <CheckIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Reject' && (
                        <div className="px-2" onClick={() => item.action(row)} title="Reject">
                          <XMarkIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Edit Loan' && status !== 'active') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Edit">
                          <PencilIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Delete Loan' && status !== 'active') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Delete">
                          <TrashIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'View Disclosure' && status !== 'active') && (
                        <div className="px-2" onClick={() => item.action(row)} title="View Disclosure">
                          <DocumentIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Edit') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Edit">
                          <PencilIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Delete') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Delete">
                          <TrashIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Open' && page === 'loan-officer-summary' && status === 'close') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Open Transaction">
                          <LockClosedIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Close' && page === 'loan-officer-summary' && status === 'open') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Close Transaction">
                          <LockOpenIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Reloan') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Reloan">
                          <ArrowPathIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Close Account') && (
                        <div className="px-2" onClick={() => item.action(row)} title="Close Account">
                          <XCircleIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Reset Password' && (
                        <div className="px-2" onClick={() => item.action(row)} title="Reset Password">
                          <KeyIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Update' && (
                        <div className="px-2" onClick={() => item.action(row)} title={item.title}>
                          <ArrowPathIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Revert' && (
                        <div className="px-2" onClick={() => item.action(row)} title={item.title}>
                          <ArrowUturnLeftIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Transfer' && (
                        <div className="px-2" onClick={() => item.action(row)} title={item.title}>
                          <ArrowsRightLeftIcon className="cursor-pointer h-5" />
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
  actionDropDownDataOptions = [],
  dropDownActionOrigin
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
        {/* {Array(5).fill(null).map((_, index) => (
          <tr key={`empty-row-${index}`} className="bg-white border-b">
            {multiSelect && (
              <td key={`empty-checkbox-${index}`} className="px-4 py-3 w-10">
                <CheckBox
                  name={`select-empty-${index}`}
                  value={false}
                  onChange={() => {}}
                  size="md"
                  disabled={true}
                />
              </td>
            )}
            {Array(columnCount).fill(null).map((_, colIndex) => (
              <td key={`empty-col-${index}-${colIndex}`} className="px-4 py-3">
                <div className="h-4 bg-gray-100 rounded"></div>
              </td>
            ))}
            {(hasActionButtons || dropDownActions.length > 0) && (
              <td key={`empty-actions-${index}`} className="px-4 py-3 w-24">
                <div className="h-4 bg-gray-100 rounded"></div>
              </td>
            )}
          </tr>
        ))} */}
      </>
    )
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
        <div className="overflow-x-auto">
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
                    withError: error
                  } = row.original;

                  const checkBoxDisable = disable || error;
                  let rowClass = 'bg-white border-b hover:bg-gray-50';
                  if (delinquent === 'Yes' || error) {
                    rowClass = 'bg-red-100 border-b hover:bg-red-200';
                  } else if (status === 'open') {
                    rowClass = 'bg-blue-100 border-b hover:bg-blue-200';
                  } else if (ldfApproved) {
                    rowClass = 'bg-green-100 border-b hover:bg-green-200';
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
                          {cell.render('Cell')}
                        </td>
                      ))}
                      {(hasActionButtons || dropDownActions.length > 0) && (
                        <td className="px-4 py-3 w-24">
                          <div className="flex items-center space-x-2">
                            {hasActionButtons && !root && !row.original.system && (
                              <ActionButton row={row} rowActionButtons={rowActionButtons} />
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