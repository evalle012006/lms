/* eslint-disable key-spacing */
/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-key */
import React from "react";
import {
  useTable,
  useFilters,
  useGlobalFilter,
  useAsyncDebounce,
  useSortBy,
  usePagination,
} from "react-table";
import Avatar from "./avatar";
import { FileExists } from "./utils";
import { useState } from "react";
import SelectDropdown from "./ui/select";
import { 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon, 
  LockClosedIcon, 
  LockOpenIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

// Define a default UI for filtering
function GlobalFilter({
  preGlobalFilteredRows,
  globalFilter,
  setGlobalFilter,
}) {
  const count = preGlobalFilteredRows.length;
  const [value, setValue] = React.useState(globalFilter);
  const onChange = useAsyncDebounce((value) => {
    setGlobalFilter(value || undefined);
  }, 200);

  return (
    <label className="flex gap-x-2 items-baseline">
      <span className="text-gray-700">Search: </span>
      <input
        type="text"
        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
        value={value || ""}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={`${count} records...`}
      />
    </label>
  );
}

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
  const status = value ? value.toLowerCase() : "unknown";

  return (
    <span
      className={classNames(
        "status-pill",
        status.startsWith("active") || status.startsWith("open") ? "status-pill-active" : null,
        status.startsWith("pending") ? "status-pill-pending" : null,
        status.startsWith("inactive") ? "status-pill-inactive" : null,
        status.startsWith("rejected") || status.startsWith("close") || status.startsWith("offset") ? "status-pill-rejected" : null
      )}
    >
      {status}
    </span>
  );
}

export function AvatarCell({ value, column, row }) {
  const url = row.original[column.imgAccessor];

  return (
    <div className="flex items-center">
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

// const ActionButton = ({ row, rowActionButtons }) => {
//   const [showMenu, setShowMenu] = useState(false);

//   const handleClick = () => {
//     setShowMenu(!showMenu);
//   };

//   return (
//     <React.Fragment>
//       <div
//         className="relative inline-block text-left cursor-pointer"
//         onClick={handleClick}
//       >
//         <svg
//           xmlns="http://www.w3.org/2000/svg"
//           className="h-6 w-6"
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//           strokeWidth={2}
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
//           />
//         </svg>
//         <div
//           className={`dropdown-menu-container border border-solid border-gray-13 origin-top-right absolute right-0 mt-2 w-56 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none ${
//             showMenu ? "block" : "hidden"
//           }`}
//           role="menu"
//           aria-orientation="vertical"
//           aria-labelledby="menu-button"
//           tabIndex="-1"
//         >
//           <div className="flex flex-col w-56" role="none">
//             {rowActionButtons &&
//               rowActionButtons.map((item, index) => {
//                 return (
//                   <a
//                     key={index}
//                     href="#"
//                     className="dropdown-menu-item"
//                     role="menuitem"
//                     tabIndex="-1"
//                     id={`'menu-item-'${index}`}
//                     onClick={() => {
//                       item.action(row);
//                       setShowMenu(false);
//                     }}
//                   >
//                     {item.label}
//                   </a>
//                 );
//               })}
//           </div>
//         </div>
//       </div>
//     </React.Fragment>
//   );
// };

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
                        <div className="px-1" onClick={() => item.action(row)} title="Approve">
                          <CheckIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {item.label === 'Reject' && (
                        <div className="px-1" onClick={() => item.action(row)} title="Reject">
                          <XMarkIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Edit Loan' && status !== 'active') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Edit">
                          <PencilIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Delete Loan' && status !== 'active') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Delete">
                          <TrashIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Edit') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Edit">
                          <PencilIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Delete') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Delete">
                          <TrashIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Close' && status === 'open') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Close Transaction">
                          <LockOpenIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Open' && status === 'close') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Open Transaction">
                          <LockClosedIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Reloan') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Open Transaction">
                          <ArrowPathIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                      {(item.label === 'Close Account') && (
                        <div className="px-1" onClick={() => item.action(row)} title="Open Transaction">
                          <XCircleIcon className="cursor-pointer h-5" />
                        </div>
                      )}
                    </React.Fragment>
                );
              })}
      </div>
    </React.Fragment>
  );
};

const GenerateButtons = (pageSize) => {
  let count = 1;
  let comp = [];
  while (count <= pageSize) {
    comp.push(count);
    count++;
  }
  return comp;
};

const TableComponent = ({
  columns,
  data,
  showPagination = true,
  showPaginationBottom = false,
  showFilters = true,
  columnSorting = true,
  showSearch = false,
  title = "",
  hasActionButtons = true,
  rowActionButtons = [],
  rowClick = null,
  noPadding = false,
  border = false
}) => {
  // Use the state and functions returned from useTable to build your UI
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page, // Instead of using 'rows', we'll use page,
    // which has only the rows for the active page

    // The rest of these things are super handy, too ;)
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    rows,
    state,
    preGlobalFilteredRows,
    setGlobalFilter,
  } = useTable(
    {
      columns,
      data,
      showPagination,
      showPaginationBottom,
    },
    useFilters, // useFilters!
    useGlobalFilter,
    useSortBy,
    usePagination // new
  );

  // Render the UI for your table
  return (
    <div className={`relative w-full ${border && 'border rounded border-gray-400 overflow-hidden'}`}>
      <div className="relative">
        {showSearch && (
          <GlobalFilter
            preGlobalFilteredRows={preGlobalFilteredRows}
            globalFilter={state.globalFilter}
            setGlobalFilter={setGlobalFilter}
          />
        )}

        {showFilters && (
          <div className="flex flex-row flex-wrap filter-container items-center w-full">
            <span className="text-gray-12">Filters: </span>
            {headerGroups.map((headerGroup) =>
              headerGroup.headers.map((column) =>
                column.Filter && (
                  <div className="filter sm:mt-0 mb-2" key={column.id}>
                    {column.render("Filter")}
                  </div>
                )
              )
            )}
          </div>
        )}
      </div>
      {/* table */}
      <div className={`${noPadding ? 'p-1' : 'p-6 mt-4'} w-full`}>
        <div className="-my-2 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block w-auto min-w-full lg:px-4">
            <div
              style={{ width: "100%" }}
              className="table-div overflow-hidden"
            >
              {title && <div className="table-title">{title}</div>}
              <table
                {...getTableProps()}
                className="table-component divide-y-custom divide-gray-21"
              >
                <thead className="table-head table-row-group">
                  {headerGroups.map((headerGroup, index) => (
                    <tr key={index} {...headerGroup.getHeaderGroupProps()}>
                      {headerGroup.headers.map((column) => (
                        // Add the sorting props to control sorting. For this example
                        // we can add them into the header props
                        <th
                          scope="col"
                          className="column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider m-1"
                          {...column.getHeaderProps(
                            column.getSortByToggleProps()
                          )}
                        >
                          <div className="flex items-center justify-between">
                            {column.render("Header")}
                            {/* Add a sort direction indicator */}
                            {columnSorting && (
                              <span>
                                {column.isSorted ? (
                                  column.isSortedDesc ? (
                                    <SortDownIcon className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <SortUpIcon className="w-4 h-4 text-gray-400" />
                                  )
                                ) : (
                                  <SortIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      {hasActionButtons && (
                        <th
                          scope="col"
                          className="column py-0 pr-0 pl-4 tracking-wider m-1"
                        >Actions</th>
                      )}
                    </tr>
                  ))}
                </thead>
                <tbody
                  {...getTableBodyProps()}
                  className="bg-white divide-y-custom divide-gray-21 text-gray-500"
                >
                    {page.length === 0 ? (
                        <>
                            <tr className='text-center'>
                                <td colSpan={headerGroups[0].headers.length} className="pt-5">
                                    NO DATA FOUND
                                </td>
                            </tr>
                        </>
                    ) : (
                        <>
                            {page.map((row, i) => {
                                prepareRow(row);
                                const root = row.original.root ? row.original.root : false;
                                const delinquent = row.original.delinquent;
                                const totalData = row.original.hasOwnProperty('totalData') ? row.original.totalData : false;
                                return (
                                <tr {...row.getRowProps()} className={`hover:bg-slate-200 ${delinquent === 'Yes' && 'bg-red-100'} even:bg-gray-100`}>
                                    {row.cells.map((cell) => {
                                    return (
                                        <td
                                          {...cell.getCellProps()}
                                          className={`px-4 py-3 whitespace-nowrap-custom ${rowClick && 'cursor-pointer'} ${totalData && 'font-bold'}`}
                                          role="cell"
                                          onClick={() => rowClick && rowClick(row.original)}
                                        >
                                          {cell.column.Cell.name === "defaultRenderer" ? (
                                              <div className="text-sm text-gray-500">
                                              {cell.render("Cell")}
                                              </div>
                                          ) : (
                                              cell.render("Cell")
                                          )}
                                        </td>
                                    );
                                    })}
                                    {/* ACTION BUTTON */}
                                    {(hasActionButtons && !root && !row.original.system) && (
                                    <td
                                        className="py-4-custom whitespace-nowrap-custom"
                                        role="cell"
                                    >
                                        <ActionButton
                                          row={row}
                                          rowActionButtons={rowActionButtons}
                                        />
                                    </td>
                                    )}
                                </tr>
                                );
                            })}
                        </>
                    )}
                </tbody>
              </table>
              {/* Pagination */}
              {(showPagination && rows.length > 0) && (
                <div className="mt-4 py-3 flex items-center justify-between">
                  {/* <span>
                                            | Go to page:{' '}
                                            <input
                                            type="number"
                                            defaultValue={pageIndex + 1}
                                            onChange={e => {
                                                const page = e.target.value ? Number(e.target.value) - 1 : 0
                                                gotoPage(page)
                                            }}
                                            style={{ width: '100px' }}
                                            />
                                        </span>{' '} */}

                  <div style={{ marginRight: 20, marginLeft: 20 }}>
                    <span className="text-gray-10">
                      {state.pageIndex + 1}-{state.pageSize} of {rows.length}{" "}
                      items
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => gotoPage(0)}
                      disabled={!canPreviousPage}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 ${
                          !canPreviousPage ? "text-gray-10" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                        />
                      </svg>
                    </button>{" "}
                    <div
                      className="flex items-center justify-between"
                      style={{ marginRight: 20, marginLeft: 20 }}
                    >
                      <button
                        onClick={() => previousPage()}
                        disabled={!canPreviousPage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 ${
                            !canPreviousPage ? "text-gray-10" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>{" "}
                      <span className="text-slate-300">
                        <strong>
                          {GenerateButtons(pageCount).map((value, index) => (
                            <button key={index}
                              onClick={(e) => {
                                // console.log(e.target.value);
                                const page = value ? Number(value) - 1 : 0;
                                gotoPage(page);
                              }}
                              className={`py-1 px-2 font-medium ${
                                state.pageIndex + 1 === value
                                  ? "bg-main m-3 rounded-md text-white"
                                  : "text-gray-10"
                              } `}
                            >
                              {value}
                            </button>
                          ))}
                        </strong>{" "}
                      </span>
                      <button
                        onClick={() => nextPage()}
                        disabled={!canNextPage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 ${
                            !canNextPage ? "text-gray-10" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>{" "}
                    </div>
                    <button
                      onClick={() => gotoPage(pageCount - 1)}
                      disabled={!canNextPage}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 ${
                          !canNextPage ? "text-gray-10" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 5l7 7-7 7M5 5l7 7-7 7"
                        />
                      </svg>
                    </button>{" "}
                  </div>

                  <div style={{ marginRight: 20, marginLeft: 20 }}>
                    <span className="text-gray-10">View</span>
                    <select
                      className="text-gray-10 border-none"
                      value={state.pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                      }}
                    >
                      {[5, 10, 15, 20, 25].map((pageSize, index) => (
                        <option key={index} value={pageSize}>
                          {pageSize}
                        </option>
                      ))}
                    </select>{" "}
                    <span className="text-gray-10">Items per Page</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TableComponent;
