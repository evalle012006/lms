import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setDuplicateLoanList, setFilteredForecastedLoanList, setFilteredLoanList, setFilteredPendingLoanList, setFilteredTomorrowLoanList, setForecastedLoanList, setLoanList, setPendingLoanList, setTomorrowLoanList } from "@/redux/actions/loanActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClient, setClientList } from "@/redux/actions/clientActions";
import { formatPricePhp, getTotal, UppercaseFirstLetter } from "@/lib/utils";
import { getEndDate, getMonths, getYears } from "@/lib/date-utils";
import AddUpdateLoan from "@/components/transactions/loan-application/AddUpdateLoanDrawer";
import moment from 'moment';
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { setUserList } from "@/redux/actions/userActions";
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import Modal from "@/lib/ui/Modal";
import ClientDetailPage from "@/components/clients/ClientDetailPage";
import ReactToPrint from 'node_modules/react-to-print/lib/index';
import { PrinterIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline';
import { useRef } from "react";
import LDFListPage from "@/components/transactions/loan-application/LDFList";
import RadioButton from "@/lib/ui/radio-button";
import { getApiBaseUrl } from "@/lib/constants";
import ForeCastApplication from "@/components/transactions/loan-application/ForecastApplications";
import { useExcelExport } from '@/hooks/useExcelExport';
import ExcelExportModal from "@/components/modals/ExcelExportModal";
import LAFModal from "@/components/transactions/loan-application/LAFModal";
import { useRouter } from "next/router";
import DisbursementPhotoModal from '@/components/transactions/loan-application/DisbursementPhotoModal';
import LDFApprovalDetailsModal from "@/components/transactions/loan-application/LDFApprovalDetailsModal";

const LoanApplicationPage = () => {
    const router = useRouter();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const dispatch = useDispatch();
    const currentBranch = useSelector(state => state.branch.data);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.loan.list);
    const pendingList = useSelector(state => state.loan.pendingList);
    const tomorrowList = useSelector(state => state.loan.tomorrowList);
    const forecastedList = useSelector(state => state.loan.forecastedList);
    const filteredList = useSelector(state => state.loan.filteredList);
    const filteredPendingList = useSelector(state => state.loan.filteredPendingList);
    const filteredTomorrowList = useSelector(state => state.loan.filteredTomorrowList);
    const filteredForcastedList = useSelector(state => state.loan.filteredForecastedList);
    const duplicateList = useSelector(state => state.loan.duplicateLoanList);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state?.client.list);
    const [data, setData] = useState(list);
    const [pendingData, setPendingData] = useState(pendingList);
    const [tomorrowData, setTomorrowData] = useState(tomorrowList);
    const [forecastedData, setForecastedData] = useState(forecastedList);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isPendingFiltering, setIsPendingFiltering] = useState(false);
    const [isTomorrowFiltering, setIsTomorrowFiltering] = useState(false);
    const [isForecastedFiltering, setIsForecastedFiltering] = useState(false);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [loan, setLoan] = useState();
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showWaningDialog, setShowWarningDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    const [historyList, setHistoryList] = useState([]);
    const [selectedTab, setSelectedTab] = useTabs([
        'ldf',
        'tomorrow',
        'application',
        'history',
        'duplicate',
        'guarantor-review',
        'forecast'
    ]);

    const [noOfLDFLoans, setNoOfLDFLoans] = useState(0);
    const [totalLDFAmountRelease, setTotalLDFAmountRelease] = useState(0);
    const [noOfPendingLoans, setNoOfPendingLoans] = useState(0);
    const [totalAmountRelease, setTotalAmountRelease] = useState(0);
    const [noOfTomorrowLoans, setNoOfTomorrowLoans] = useState(0);
    const [totalTomorrowAmountRelease, setTotalTomorrowAmountRelease] = useState(0);

    const [selectedFilterBranch, setSelectedFilterBranch] = useState();
    const [selectedFilterUser, setSelectedFilterUser] = useState();
    const [selectedFilterGroup, setSelectedFilterGroup] = useState();
    const [occurence, setOccurence] = useState('daily');

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState();

    const [ldfFilter, setLdfFilter] = useState('all');
    const [ldfOccurenceFilter, setLdfOccurenceFilter] = useState('all');

    const months = getMonths();
    const years = getYears();

    const [selectedMonth, setSelectedMonth] = useState(moment().month() + 1);
    const [selectedYear, setSelectedYear] = useState(moment().year());
    const [selectedBranch, setSelectedBranch] = useState();

    const [isLoanFetching, setLoanFetching] = useState(false);
    const [isBranchFetching, setBranchFetching] = useState(false);

    const [selectedFilterLoanCycle, setSelectedFilterLoanCycle] = useState('all');
    const loanCycleFilterList = [
        { label: 'All', value: 'all' },
        { label: 'New Member', value: 'new_member' },
        { label: 'Reloaner', value: 'reloaner' }
    ]

    const [showExportModal, setShowExportModal] = useState(false);
    const { exportLoansToExcel, isExporting } = useExcelExport();

    const [showLAFModal, setShowLAFModal] = useState(false);
    const [selectedLoanForLAF, setSelectedLoanForLAF] = useState(null);

    const [guarantorReviewList, setGuarantorReviewList] = useState([]);

    const [showDisbursementModal, setShowDisbursementModal] = useState(false);
    const [pendingLdfLoans, setPendingLdfLoans]             = useState([]);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedApprovalLoan, setSelectedApprovalLoan] = useState(null);

    const handleViewApprovalDetails = (row) => {
        setSelectedApprovalLoan(row.original);
        setShowApprovalModal(true);
    };

    const handleShowLAF = (row) => {
        setSelectedLoanForLAF(row.original);
        setShowLAFModal(true);
    };

    const handleCloseLAF = () => {
        setShowLAFModal(false);
        setSelectedLoanForLAF(null);
    };

    const handleBranchFilter = (selected) => {
        setSelectedBranch(selected.value);
    }

    const handleMonthFilter = (selected) => {
        setSelectedMonth(selected.value);
    }

    const handleYearFilter = (selected) => {
        setSelectedYear(selected.value);
    }

    const ndsFormRef = useRef();

    const handleSelectTab = (selected) => {
        setLoading(true);
        setShowAddDrawer(false);
        setIsFiltering(false);
        setSelectedFilterBranch();
        setSelectedFilterUser(null);
        setSelectedFilterGroup(null);

        setTimeout(() => {
            setSelectedTab(selected);
            setLoading(false);
        }, 500);
    }

    const handleLoanCycleChange = (selected) => {
        setSelectedFilterLoanCycle(selected.value);
        if (selectedTab == 'ldf') {
            handleFilter('loanCycle', selected.value, list);
        }
    }

    const handleBranchChange = (selected) => {
        setSelectedFilterBranch(selected.value);
        getListUser(selected.code);
        if (selectedTab == 'ldf') {
            handleFilter('branch', selected.value, list);
        } else if (selectedTab == 'application') {
            handleFilter('branch', selected.value, pendingList);
        } else if (selectedTab == 'tomorrow') {
            handleFilter('branch', selected.value, tomorrowList);
        } else if (selectedTab == 'forecast')  {
            handleFilter('branch', selected.value, forecastedList);
        }
    }

    const handleUserChange = (selected) => {
        setSelectedFilterUser(selected.value);
        getListGroup(selected.value, selected.transactionType);
        setOccurence(selected.transactionType);
        if (selectedTab == 'ldf') {
            handleFilter('user', selected.value, list);
        } else if (selectedTab == 'application') {
            handleFilter('user', selected.value, pendingList);
        } else if (selectedTab == 'tomorrow') {
            handleFilter('user', selected.value, tomorrowList);
        } else if (selectedTab == 'forecast') {
            handleFilter('user', selected.value, forecastedList);
        }
    }

    const handleGroupChange = (selected) => {
        setSelectedFilterGroup(selected.value);
        if (selectedTab == 'ldf') {
            handleFilter('group', selected.value, list);
        } else if (selectedTab == 'application') {
            handleFilter('group', selected.value, pendingList);
        } else if (selectedTab == 'tomorrow') {
            handleFilter('group', selected.value, tomorrowList);
        } else if (selectedTab == 'forecast') {
            handleFilter('group', selected.value, forecastedList);
        }
    }

    const handleFilter = (field, value, dataArr) => {
        if (value || field == 'tomorrow') {
          let searchResult = [];
          if (field === 'branch') {
            searchResult = dataArr.filter(b => b.branchId === value);
          } else if (field === 'user') {
            searchResult = dataArr.filter(b => b.loId === value);
          } else if (field === 'group') {
            searchResult = dataArr.filter(b => b.groupId === value);
          } else if (field === 'loanCycle') {
            if (value == 'new_member') {
                searchResult = dataArr.filter(b => b.loanCycle === 1);
            } else if (value == 'reloaner') {
                searchResult = dataArr.filter(b => b.loanCycle > 1);
            } else {
                searchResult = dataArr;
            }
          }

          if (selectedTab == 'ldf') {
            dispatch(setFilteredLoanList(searchResult));
            setIsFiltering(true);
          } else if (selectedTab == 'application') {
            dispatch(setFilteredPendingLoanList(searchResult));
            setIsPendingFiltering(true);
          } else if (selectedTab == 'tomorrow') {
            dispatch(setFilteredTomorrowLoanList(searchResult));
            setIsTomorrowFiltering(true);
          } else if (selectedTab == 'forecast') {
            dispatch(setFilteredForecastedLoanList(searchResult));
            setIsForecastedFiltering(true);
          }
        } else {
          if (selectedTab == 'ldf') {
            setData(list);
            setIsFiltering(false);
          } else if (selectedTab == 'application') {
            setPendingData(pendingList);
            setIsPendingFiltering(false);
          } else if (selectedTab == 'tomorrow') {
            setTomorrowData(tomorrowList);
            setIsTomorrowFiltering(false);
          } else if (selectedTab == 'forecast') {
            setForecastedData(forecastedList);
            setIsForecastedFiltering(false);
          }
        }
    }

    const exportLoanApplications = async () => {
        try {
            // Get the current data based on selected tab and filtering state
            let dataToExport = [];
            
            switch (selectedTab) {
                case 'ldf':
                    dataToExport = isFiltering ? filteredList : list;
                    break;
                case 'application':
                    dataToExport = isPendingFiltering ? filteredPendingList : pendingList;
                    break;
                case 'tomorrow':
                    dataToExport = isTomorrowFiltering ? filteredTomorrowList : tomorrowList;
                    break;
                case 'forecast':
                    dataToExport = isForecastedFiltering ? filteredForcastedList : forecastedList;
                    break;
                case 'history':
                    dataToExport = historyList.length > 0 ? historyList : [];
                    break;
                default:
                    dataToExport = list;
            }

            // Filter data based on selected month and year if needed
            const filteredByDate = dataToExport.filter(loan => {
                if (!loan.dateGranted && !loan.dateAdded) return true; // Include if no date info
                
                const loanDate = new Date(loan.dateGranted || loan.dateAdded);
                const loanMonth = loanDate.getMonth() + 1;
                const loanYear = loanDate.getFullYear();
                
                return loanMonth === selectedMonth && loanYear === selectedYear;
            });

            if (filteredByDate.length === 0) {
                toast.warning(`No loan data available for ${selectedMonth}/${selectedYear}`);
                return;
            }

            // Export using our client-side hook
            await exportLoansToExcel(
                filteredByDate,
                currentUser,
                selectedMonth,
                selectedYear
            );

        } catch (error) {
            console.error('Error exporting loan applications:', error);
            toast.error('Error exporting loan applications: ' + error.message);
        }
    };

    const ExportButton = ({ onClick, isLoading = false, disabled = false, className = "" }) => (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`
                inline-flex items-center gap-2 
                bg-emerald-600 hover:bg-emerald-700 
                disabled:bg-gray-400 disabled:cursor-not-allowed
                text-white font-medium rounded-lg px-4 py-2 text-sm
                transition-all duration-200 ease-in-out
                shadow-sm hover:shadow-md
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                ${className}
            `}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Excel...</span>
                </>
            ) : (
                <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export to Excel</span>
                </>
            )}
        </button>
    );

    const ExportButtonWrapper = () => (
        <ExportButton 
            onClick={exportLoanApplications}
            isLoading={isExporting}
            disabled={isExporting}
        />
    );

    const getListBranch = async () => {
        if(!isBranchFetching) {
            setBranchFetching(true);
            (async () => {
                let url = getApiBaseUrl() + 'branches/list';
                if (currentUser?.role?.rep === 1) {
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let branches = [];
                        response.branches && response.branches.map(branch => {
                            branches.push(
                                {
                                    ...branch,
                                    value: branch._id,
                                    label: UppercaseFirstLetter(branch.name)
                                }
                            );
                        });
                        dispatch(setBranchList(branches));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else if (currentUser?.role?.rep === 2) {
                    url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let branches = [];
                        response.branches && response.branches.map(branch => {
                            branches.push(
                                {
                                    ...branch,
                                    value: branch._id,
                                    label: UppercaseFirstLetter(branch.name)
                                }
                            );
                        });
                        dispatch(setBranchList(branches));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else if (currentUser?.role?.rep == 3 || currentUser?.role?.rep == 4) {
                    url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let branches = [];
                        response.branches && response.branches.map(branch => {
                            branches.push(
                                {
                                    ...branch,
                                    value: branch._id,
                                    label: UppercaseFirstLetter(branch.name)
                                }
                            );
                        });
                        dispatch(setBranchList(branches));
                        dispatch(setBranch(branches.length > 0 ? branches[0] : null));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }
            })().finally(() => {
                setBranchFetching(false);
            })
        }
    }

    const getListUser = async (branchCode) => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode: branchCode });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u?.firstName} ${u?.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    }
                );
            });
            userList.sort((a, b) => { return a.loNo - b.loNo; });

            if (currentUser?.role?.rep === 4) {
                const name = `${currentUser?.firstName} ${currentUser?.lastName}`;
                userList = [];
                userList.push({
                    ...currentUser,
                    name: name,
                    label: name,
                    value: currentUser._id
                });
            }

            if (currentUser?.role?.rep === 4) {
                setSelectedFilterUser(currentUser._id);
            }

            if (currentUser?.role?.rep == 3) {
                dispatch(setUserList(userList));
            } else {
                dispatch(setUserList(userList));
            }
        } else {
            toast.error('Error retrieving user list.');
        }
    }

    const getListGroup = async (selectedUser, selectedOccurence) => {
        const url = getApiBaseUrl() + 'groups/list-by-group-occurence?' + new URLSearchParams({ loId: selectedUser, occurence: selectedOccurence });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });

            dispatch(setGroupList(groups));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListLoan = async () => {
        if(!isLoanFetching) {
            setLoanFetching(true);
            (async () => {
                if(!currentDate) {
                    return;
                }

                let url = getApiBaseUrl() + 'transactions/loans/list';
                if (currentUser.root !== true && currentUser?.role?.rep === 4) { 
                    url = url + '?' + new URLSearchParams({ status: 'pending', branchId: currentUser.designatedBranchId, loId: currentUser._id, mode: currentUser.transactionType, currentDate: currentDate });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let loanList = [];
                        await response.loans && response.loans.map(loan => {
                            let allowApproved = false;
                            let hasActiveLoan = false;

                            if (loan.groupStatus.length > 0) {
                                const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                                if (transactionStatus.length > 0) {
                                    allowApproved = true;
                                }
                            } else if (loan.pendings.length > 0) {
                                allowApproved = false;
                                hasActiveLoan = true;
                            } else {
                                allowApproved = true;
                            }

                            loanList.push({
                                ...loan,
                                loanOfficerName: `${loan.loanOfficer?.lastName}, ${loan.loanOfficer?.firstName}`,
                                groupName: loan.group.name,
                                principalLoanStr: formatPricePhp(loan.principalLoan),
                                mcbuStr: formatPricePhp(loan.mcbu),
                                activeLoanStr: formatPricePhp(loan.activeLoan),
                                loanBalanceStr: formatPricePhp(loan.loanBalance),
                                loanRelease: loan.amountRelease,
                                loanReleaseStr: formatPricePhp(loan.amountRelease),
                                profile: loan?.client?.profile || '',
                                fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                                allowApproved: allowApproved,
                                selected: false,
                                hasActiveLoan: hasActiveLoan,
                                ciName: UppercaseFirstLetter(loan?.ciName ? loan?.ciName : loan.client?.ciName),
                                guarantorDuplicate: loan.guarantorDuplicate || false,
                                coMakerPending: loan.coMakerPending || false,
                                coMakerPendingName: loan.coMakerPendingName || null,
                            });
                        });
                        loanList.sort((a, b) => {
                            if (a.pnNumber < b.pnNumber) {
                                return -1;
                            }

                            if (b.pnNumber < b.pnNumber) {
                                return 1;
                            }

                            return 0;
                        } );

                        dispatch(setLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrBefore(moment(currentDate)))));
                        dispatch(setPendingLoanList(loanList.filter(l => l.ldfApproved)));
                        dispatch(setTomorrowLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSame(moment(currentDate).add(1, 'days')))));
                        dispatch(setDuplicateLoanList(loanList.filter(l => l?.client?.duplicate)));
                        dispatch(setForecastedLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrAfter(moment(currentDate).add(2, 'days')))));
                        setGuarantorReviewList(loanList.filter(l => l?.guarantorDuplicate === true));

                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else if (currentUser.root !== true && currentUser?.role?.rep === 3) {
                    url = url + '?' + new URLSearchParams({ status: 'pending', branchId: currentUser.designatedBranchId, currentDate: currentDate });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let loanList = [];
                        await response.loans && response.loans.map(loan => {
                            let allowApproved = false;
                            let hasActiveLoan = false;
                            let hasTdaLoan = false;
                            let transactionClosed = false;
                            if (loan.groupStatus.length > 0 && loan.groupStatus[0].hasOwnProperty('groupStatusArr')) {
                                const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                                if (transactionStatus.length > 0) {
                                    allowApproved = true;
                                } else if (loan.loanCycle == 1) {
                                    allowApproved = true;
                                } else {
                                    transactionClosed = true;
                                }

                                const staging = process.env.NEXT_PUBLIC_STAGING ? process.env.NEXT_PUBLIC_STAGING : false;
                                if (staging) {
                                    allowApproved = true;
                                }
                            } else if (loan.pendings.length > 0) {
                                allowApproved = false;
                                
                                const loanPendingStatus = loan.pendings[0].status;
                                if (loanPendingStatus == 'active') {
                                    hasActiveLoan = true;
                                } else if (loanPendingStatus == 'completed') {
                                    hasTdaLoan = true;
                                }
                            } else {
                                allowApproved = true;
                            }

                            loanList.push({
                                ...loan,
                                loanOfficerName: `${loan.loanOfficer?.lastName}, ${loan.loanOfficer?.firstName}`,
                                groupName: loan.group.name,
                                principalLoanStr: formatPricePhp(loan.principalLoan),
                                mcbuStr: formatPricePhp(loan.mcbu),
                                activeLoanStr: formatPricePhp(loan.activeLoan),
                                loanBalanceStr: formatPricePhp(loan.loanBalance),
                                loanRelease: loan.amountRelease,
                                loanReleaseStr: formatPricePhp(loan.amountRelease),
                                fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                                profile: loan?.client?.profile || '',
                                allowApproved: allowApproved,
                                selected: false,
                                hasActiveLoan: hasActiveLoan,
                                hasTdaLoan: hasTdaLoan,
                                ciName: UppercaseFirstLetter(loan?.ciName ? loan?.ciName : loan.client?.ciName),
                                transactionClosed: transactionClosed,
                                guarantorDuplicate: loan.guarantorDuplicate || false,
                                coMakerPending: loan.coMakerPending || false,
                                coMakerPendingName: loan.coMakerPendingName || null,
                            });
                        });
                        loanList.sort((a, b) => {
                            if (a.pnNumber < b.pnNumber) {
                                return -1;
                            }

                            if (b.pnNumber < b.pnNumber) {
                                return 1;
                            }

                            return 0;
                        } );
                        
                        dispatch(setLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrBefore(moment(currentDate)))));
                        dispatch(setPendingLoanList(loanList.filter(l => l.ldfApproved)));
                        dispatch(setTomorrowLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSame(moment(currentDate).add(1, 'days')))));
                        dispatch(setDuplicateLoanList(loanList.filter(l => l?.client?.duplicate)));
                        dispatch(setForecastedLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrAfter(moment(currentDate).add(2, 'days')))));
                        setGuarantorReviewList(loanList.filter(l => l?.guarantorDuplicate === true));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else if (currentUser?.role?.rep === 2) {
                    url = url + '?' + new URLSearchParams({ status: 'pending', currentUserId: currentUser._id, currentDate: currentDate });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let loanList = [];
                        await response.loans && response.loans.map(loan => {
                            let allowApproved = false;
                            let hasActiveLoan = false;
                            let transactionClosed = false;
                            
                            if (loan.groupStatus.length > 0 && loan.groupStatus[0].hasOwnProperty('groupStatusArr')) {
                                const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                                if (transactionStatus.length > 0) {
                                    allowApproved = true;
                                } else if (loan.loanCycle == 1) {
                                    allowApproved = true;
                                } else {
                                    transactionClosed = true;
                                }
                            } else {
                                allowApproved = true;
                            }

                            loanList.push({
                                ...loan,
                                branchName: `${loan.branch[0].code} - ${loan.branch[0].name}`,
                                loanOfficerName: `${loan.loanOfficer?.lastName}, ${loan.loanOfficer?.firstName}`,
                                groupName: loan.group.name,
                                principalLoanStr: formatPricePhp(loan.principalLoan),
                                mcbuStr: formatPricePhp(loan.mcbu),
                                activeLoanStr: formatPricePhp(loan.activeLoan),
                                loanBalanceStr: formatPricePhp(loan.loanBalance),
                                loanRelease: loan.amountRelease,
                                loanReleaseStr: formatPricePhp(loan.amountRelease),
                                fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                                profile: loan?.client?.profile || '',
                                allowApproved: allowApproved,
                                selected: false,
                                hasActiveLoan: hasActiveLoan,
                                ciName: UppercaseFirstLetter(loan?.ciName ? loan?.ciName : loan.client?.ciName),
                                transactionClosed: transactionClosed,
                                guarantorDuplicate: loan.guarantorDuplicate || false,
                                coMakerPending: loan.coMakerPending || false,
                                coMakerPendingName: loan.coMakerPendingName || null,
                            });
                        });
                        loanList.sort((a, b) => {
                            if (a.pnNumber < b.pnNumber) {
                                return -1;
                            }

                            if (b.pnNumber < b.pnNumber) {
                                return 1;
                            }

                            return 0;
                        } );
                        
                        dispatch(setLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrBefore(moment(currentDate)))));
                        dispatch(setPendingLoanList(loanList.filter(l => l.ldfApproved)));
                        dispatch(setTomorrowLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSame(moment(currentDate).add(1, 'days')))));
                        dispatch(setDuplicateLoanList(loanList.filter(l => l?.client?.duplicate)));
                        dispatch(setForecastedLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrAfter(moment(currentDate).add(2, 'days')))));
                        setGuarantorReviewList(loanList.filter(l => l?.guarantorDuplicate === true));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else {
                    url = url + '?' + new URLSearchParams({ status: 'pending', currentDate: currentDate });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        let loanList = [];
                        await response.loans && response.loans.map(loan => {
                            let allowApproved = false;
                            let hasActiveLoan = false;
                            let transactionClosed = false;
                            
                            if (loan.groupStatus.length > 0 && loan.groupStatus[0].hasOwnProperty('groupStatusArr')) {
                                const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                                if (transactionStatus.length > 0) {
                                    allowApproved = true;
                                } else if (loan.loanCycle == 1) {
                                    allowApproved = true;
                                } else {
                                    transactionClosed = true;
                                }
                            } else {
                                allowApproved = true;
                            }
                            
                            loanList.push({
                                ...loan,
                                branchName: `${loan.branch[0].code} - ${loan.branch[0].name}`,
                                loanOfficerName: `${loan.loanOfficer?.lastName}, ${loan.loanOfficer?.firstName}`,
                                groupName: loan.group.name,
                                principalLoanStr: formatPricePhp(loan.principalLoan),
                                mcbuStr: formatPricePhp(loan.mcbu),
                                activeLoanStr: formatPricePhp(loan.activeLoan),
                                loanBalanceStr: formatPricePhp(loan.loanBalance),
                                loanRelease: loan.amountRelease,
                                loanReleaseStr: formatPricePhp(loan.amountRelease),
                                fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                                profile: loan?.client?.profile || '',
                                allowApproved: allowApproved,
                                selected: false,
                                hasActiveLoan: hasActiveLoan,
                                ciName: UppercaseFirstLetter(loan?.ciName ? loan?.ciName : loan.client?.ciName),
                                transactionClosed: transactionClosed,
                                guarantorDuplicate: loan.guarantorDuplicate || false,
                                coMakerPending: loan.coMakerPending || false,
                                coMakerPendingName: loan.coMakerPendingName || null,
                            });
                        });
                        loanList.sort((a, b) => {
                            if (a.pnNumber < b.pnNumber) {
                                return -1;
                            }

                            if (b.pnNumber < b.pnNumber) {
                                return 1;
                            }

                            return 0;
                        } );
                        dispatch(setLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrBefore(moment(currentDate)))));
                        dispatch(setPendingLoanList(loanList.filter(l => l.ldfApproved)));
                        dispatch(setTomorrowLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSame(moment(currentDate).add(1, 'days')))));
                        dispatch(setDuplicateLoanList(loanList.filter(l => l?.client?.duplicate)));
                        dispatch(setForecastedLoanList(loanList.filter(loan => moment(loan.dateOfRelease).isSameOrAfter(moment(currentDate).add(2, 'days')))));
                        setGuarantorReviewList(loanList.filter(l => l?.guarantorDuplicate === true));
                        setLoading(false);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }
            })().finally(() => {
                setLoanFetching(false);
            });
        }
    }

    const getHistoyListLoan = async () => {
        setLoading(true);;
        let url = getApiBaseUrl() + 'transactions/loans/list-history';
        const fMonth = (typeof selectedMonth === 'number' && selectedMonth < 10) ? '0' + selectedMonth : selectedMonth;
        if (currentUser.root !== true && currentUser?.role?.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, mode: occurence, month: fMonth, year: selectedYear + "" });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        selected: false,
                        ciName: UppercaseFirstLetter(loan?.ciName ? loan?.ciName : loan.client?.ciName)
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.root !== true && currentUser?.role?.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, month: fMonth, year: selectedYear + "" });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                        profile: loan?.client?.profile || '',
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser?.role?.rep == 2) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id, month: fMonth, year: selectedYear + "" });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                        profile: loan?.client?.profile || '',
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }   
        } else {
            url = url + '?' + new URLSearchParams({ month: fMonth, year: selectedYear + "" });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan?.client?.lastName}, ${loan?.client?.firstName} ${loan?.client?.middleName ? loan?.client?.middleName : ''}`),
                        profile: loan?.client?.profile || '',
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }   
        }
    }

    const updateClientStatus = async (data, updatedValue, rejectReason) => {
        setLoading(true);
        const group = data.group;
        const lo = data.loanOfficer;

        let loanData = {...data};
        delete loanData.group;
        delete loanData?.client;
        delete loanData.branch;
        delete loanData.principalLoanStr;
        delete loanData.activeLoanStr;
        delete loanData.loanBalanceStr;
        delete loanData.mcbuStr;

        loanData.insertedBy = currentUser._id;
        loanData.currentDate = currentDate;
        if (loanData.status === 'pending' && updatedValue === 'active') {
            loanData.dateGranted = currentDate;
            loanData.status = updatedValue;
            loanData.startDate = currentDate;
            loanData.endDate = getEndDate(loanData.dateGranted, group.occurence === lo.transactionType ? 60 : 24 );
            loanData.mispayment = 0;

            delete loanData.selected;

            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/loans/reject', loanData)
            
            if (response.success) {
                setLoading(false);
                toast.success('Loan successfully updated.');
                // window.location.reload();
                setTimeout(() => {
                    getListLoan();
                    // window.location.reload();
                }, 1000);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else {
            loanData.status = updatedValue;
            loanData.rejectReason = rejectReason;
            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/loans/reject', loanData)
            if (response.success) {
                setLoading(false);
                toast.success('Loan successfully updated.');
                setTimeout(() => {
                    getListLoan();
                    // window.location.reload();
                }, 1000);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Group",
            accessor: 'groupName',
        },
        {
            Header: "Slot No.",
            accessor: 'slotNo'
        },
        {
            Header: "Client Name",
            accessor: 'fullName',
            Cell: AvatarCell,
            imgAccessor: "profile"
        },
        {
            Header: "Loan Cycle",
            accessor: 'loanCycle'
        },
        {
            Header: "Admission Date",
            accessor: 'admissionDate'
        },
        {
            Header: "MCBU",
            accessor: 'mcbuStr',
            filter: 'includes'
        },
        {
            Header: "Principal Loan",
            accessor: 'principalLoanStr'
        },
        {
            Header: "Target Loan Collection",
            accessor: 'activeLoanStr'
        },
        {
            Header: "Loan Release",
            accessor: 'loanReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "PN Number",
            accessor: 'pnNumber'
        },
        {
            Header: "Date of Release",
            accessor: 'dateOfRelease'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill,
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    const handleMultiSelect = (mode, selectAll, rows, currentPageIndex) => {
        const pageSize = 30; // Make sure this matches your table's pageSize
        const startIndex = currentPageIndex * pageSize;
        const endIndex = startIndex + pageSize;
        
        const updateList = (sourceList, setAction) => {
            if (mode === 'all') {
                const tempList = sourceList.map((loan, index) => {
                    let temp = { ...loan };

                    // Only update items on the current page
                    if (index >= startIndex && index < Math.min(endIndex, sourceList.length)) {
                        // Set selected property to the selectAll value (true or false)
                        temp.selected = selectAll;
                    }

                    return temp;
                });
                setAction(tempList);
                return tempList;
            } else if (mode === 'row') {
                // For single row selection
                const absoluteIndex = startIndex + rows.index;
                console.log(sourceList, startIndex, rows.index)
                const tempList = sourceList.map((loan, index) => {
                    let temp = { ...loan };
                    
                    if (index === absoluteIndex) {
                        // Toggle the selected state for the clicked row
                        temp.selected = !temp.selected;
                    }
                    
                    return temp;
                });
                setAction(tempList);
                return tempList;
            }
        };

        // Function to sync selections from filtered list to main list
        const syncSelectionsToMainList = (updatedFilteredList, mainList, setMainListAction) => {
            const updatedMainList = mainList.map(mainItem => {
                // Find corresponding item in filtered list by ID
                const filteredItem = updatedFilteredList.find(filteredItem => filteredItem._id === mainItem._id);
                if (filteredItem) {
                    return { ...mainItem, selected: filteredItem.selected };
                }
                return mainItem;
            });
            setMainListAction(updatedMainList);
        };

        // Handle different tabs with filtering consideration
        if (selectedTab === 'ldf') {
            if (isFiltering) {
                // Update filtered list and sync selections to main list
                const updatedFilteredList = updateList(filteredList, (tempList) => dispatch(setFilteredLoanList(tempList)));
                syncSelectionsToMainList(updatedFilteredList, list, (tempList) => dispatch(setLoanList(tempList)));
            } else {
                // Update main list only
                updateList(list, (tempList) => dispatch(setLoanList(tempList)));
            }
        } 
        else if (selectedTab === 'application') {
            if (isPendingFiltering) {
                // Update filtered pending list and sync selections to main pending list
                const updatedFilteredList = updateList(filteredPendingList, (tempList) => dispatch(setFilteredPendingLoanList(tempList)));
                syncSelectionsToMainList(updatedFilteredList, pendingList, (tempList) => dispatch(setPendingLoanList(tempList)));
            } else {
                // Update main pending list only
                updateList(pendingList, (tempList) => dispatch(setPendingLoanList(tempList)));
            }
        } 
        else if (selectedTab === 'tomorrow') {
            if (isTomorrowFiltering) {
                // Update filtered tomorrow list and sync selections to main tomorrow list
                const updatedFilteredList = updateList(filteredTomorrowList, (tempList) => dispatch(setFilteredTomorrowLoanList(tempList)));
                syncSelectionsToMainList(updatedFilteredList, tomorrowList, (tempList) => dispatch(setTomorrowLoanList(tempList)));
            } else {
                // Update main tomorrow list only
                updateList(tomorrowList, (tempList) => dispatch(setTomorrowLoanList(tempList)));
            }
        }
        else if (selectedTab === 'forecast') {
            if (isForecastedFiltering) {
                // Update filtered forecasted list and sync selections to main forecasted list
                const updatedFilteredList = updateList(filteredForcastedList, (tempList) => dispatch(setFilteredForecastedLoanList(tempList)));
                syncSelectionsToMainList(updatedFilteredList, forecastedList, (tempList) => dispatch(setForecastedLoanList(tempList)));
            } else {
                // Update main forecasted list only
                updateList(forecastedList, (tempList) => dispatch(setForecastedLoanList(tempList)));
            }
        }
        else if (selectedTab === 'duplicate') {
            // Duplicate list doesn't seem to have filtering in your current implementation
            // But if it does, you can add the same pattern here
            updateList(duplicateList, (tempList) => dispatch(setDuplicateLoanList(tempList)));
        }
    };

    const validate = (loanList, origin) => {
        let errorMsg = new Set();
        loanList.map(loan => {
            const clientData = loan?.client;
            const clientName = `${clientData?.firstName} ${clientData?.lastName}`;
            const groupName = loan.group.name;

            if (clientData?.firstName == null || clientData?.lastName == null) {
                errorMsg.add(`Invalid name: ${clientName} in group ${groupName}, please update it in Client page.`);
            }

            if (!loan.allowApproved) {
                errorMsg.add(`${clientName} in group ${groupName} please re-open the LO transaction.`);
            }

            if (loan.hasActiveLoan) {
                errorMsg.add(`${clientName} in group ${groupName} still has active loan. Please transact it first`);
            }

            if (loan.hasTdaLoan) {
                errorMsg.add(`${clientName} in group ${groupName} still has completed loan. Please transact it first`);
            }

            if (loan.pnNumber == null || !loan.pnNumber) {
                errorMsg.add(`${clientName} in group ${groupName} don't have PN Number.`);
            }

            if (clientData?.duplicate && selectedTab !== 'duplicate') {
                errorMsg.add(`${clientName} in group ${groupName} has been marked as duplicate client. Please contact your RM for approval of this client loan.`);
            }

            if (loan.guarantorDuplicate) {
                errorMsg.add(`${clientName} in group ${groupName} has a flagged guarantor duplicate. Admin review required before LDF approval.`);
            }

            if (loan.coMakerPending) {
                errorMsg.add(`${clientName} in group ${groupName} has no co-maker assigned yet. Edit the loan to assign a co-maker before approving.`);
            }

            if (!loan.client?.biometricCredentialId) {
                errorMsg.add(`${clientName} in group ${groupName} has no biometric registered. Please register client biometric before LDF approval.`);
            }

            if (!loan.ciName || !loan.ciName.trim()) {
                errorMsg.add(`${clientName} in group ${groupName} has no CI name recorded. Please complete CI investigation before LDF approval.`);
            }
        });

        return Array.from(errorMsg);
    }

    const handleMultiApprove = async (origin, unapprove) => {
        let selectedLoanList;
        let validation = [];
        if (origin == 'ldf') {
            if (selectedTab == 'duplicate') {
                selectedLoanList = duplicateList && duplicateList.filter(loan => loan.selected === true);
            } else {
                selectedLoanList = list && list.filter(loan => loan.selected === true);
            }
            
            validation = validate(selectedLoanList);

            if (validation.length > 0) {
                selectedLoanList = [];
            }

            // if (origin == 'ldf' && validation.length === 0 && selectedLoanList.length > 0) {
            //     setPendingLdfLoans(selectedLoanList);
            //     setShowDisbursementModal(true);
            //     return;   // stop here — modal's onConfirm will continue the approval
            // }
        } else if (origin == 'application') {
            selectedLoanList = pendingList && pendingList.filter(loan => loan.selected === true);

            validation = validate(selectedLoanList);

            if (validation.length > 0) {
                selectedLoanList = [];
            }

            // Open disbursement modal before final approval
            if (validation.length === 0 && selectedLoanList.length > 0) {
                setPendingLdfLoans(selectedLoanList);
                setShowDisbursementModal(true);
                return;
            }
        } else if (origin == 'duplicate') {
            selectedLoanList = duplicateList && duplicateList.filter(loan => loan.selected === true);
            validation = validate(selectedLoanList, origin);

            if (validation.length > 0) {
                selectedLoanList = [];
            }
        }

        if (validation.length > 0) {
            let errorMsg;
            validation.map(msg => {
                errorMsg = errorMsg ? <span>{errorMsg} <br/><br/> {msg}</span> : <span>{msg}</span>
            });
            toast.error(errorMsg, { autoClose: 5000 });
        } else if (selectedLoanList.length > 0) {
            const coMakerList = [];
            let errorMsg = '';
            selectedLoanList = selectedLoanList.map(loan => {
                let temp = {...loan};

                const client = loan?.client;
                const group = loan.group;
                const lo = loan.loanOfficer;

                if (!client?.firstName || !client?.lastName || client?.firstName == 'null' || client?.lastName == 'null') {
                    errorMsg += `First and/or Last Name of slot no ${loan.slotNo} from group ${group.name} is missing!`;
                }
                if ((!client.fullName && (client.fullName && !client.fullName.length === 0))) {
                    errorMsg += `There are missing info for slot no ${loan.slotNo} from group ${group.name}!`;
                }
                if (!client.profile || !client.profile.trim()) {
                    errorMsg += `Slot no ${loan.slotNo} from group ${group.name} don't have photo uploaded!`;
                }

                delete temp.group;
                delete temp.client;
                delete temp.branch;
                delete temp.principalLoanStr;
                delete temp.activeLoanStr;
                delete temp.loanBalanceStr;
                delete temp.mcbuStr;
                delete temp.selected;

                if (origin == 'ldf') {
                    temp.ldfApproved = !unapprove;
                    temp.ldfApprovedDate = unapprove ? '' : currentDate;
                    temp.origin = 'ldf';

                    if (origin == 'duplicate') {
                        temp.duplicate = false;
                    }
                } else {
                    temp.groupLeader = client.groupLeader ? client.groupLeader : false;
                    temp.status = 'active';
                    temp.preApproved = true;
                    temp.preApprovedDate = currentDate;
                    temp.mispayment = 0;
                    
                    temp.currentDate = currentDate;

                    if (temp.coMaker) {
                        coMakerList.push({ coMaker: temp.coMaker, slotNo: temp.slotNo });
                    }
                    temp.origin = 'application';
                }

                return temp;
            });

            // let pendingCoMaker = [];
            // const coMakerStatus = checkCoMakerLoanStatus(coMakerList);
            // if (coMakerStatus.length > 0) {
            //     pendingCoMaker = coMakerStatus.filter(cm => cm.status !== 'active' );
            // }

            // if (pendingCoMaker.length > 0 ) {
            //     let msg = 'Selected slot number co-maker have no approved loan: ';
            //     pendingCoMaker.map((p, i) => {
            //         if (i !== pendingCoMaker.length - 1) {
            //             msg += p.slotNo + ', ';
            //         } else {
            //             msg += p.slotNo;
            //         }
            //     });

            //     toast.error(msg);
            // } else {
                if (errorMsg.length > 0) {
                    errorMsg += "\n\nPlease update each missing info by clicking the row.";
                    toast.error(errorMsg, { autoClose: 10000 });
                } else {
                    const params = { loanData: selectedLoanList, origin: origin, user: currentUser };
                    const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/loans/approve-by-batch', params);

                    if (response.success) {
                        setLoading(false);
                        if (response.withError) {
                            let errors = '';
                            if (selectedLoanList.length > response.errorMsg.length) {
                                // errors = '<span>Some selected loan list have errors:<br/><br/></span>'; 
                            }
                            response.errorMsg.map((err, index) => {
                                /*
                                if (response.errorMsg.length - 1 == index) {
                                   
                                } else {
                                    errors += `<span>${ err }<br/><br/></span>`
                                }
                                    */

                                errors +=  err + '\n';
                            });

                            toast.error(errors);
                            setTimeout(() => {
                                getListLoan();
                                window.location.reload();
                            }, 1000);
                        } else {
                            if (origin == 'ldf') {
                                toast.success('Selected loans successfully updated');
                            } else {
                                toast.success('Selected loans successfully approved.');
                            }
    
                            setTimeout(() => {
                                getListLoan();
                                window.location.reload();
                            }, 1000);
                        }
                    }
                }
            // }
        } else {
            toast.error('No loan selected!');
        }
    }

    const handleLdfApprovalConfirm = async (disbursementPhotoKey, approverId) => {
        setShowDisbursementModal(false);

        // Attach disbursement photo + approver to each loan before sending
        const loansWithPhoto = pendingLdfLoans.map(loan => ({
            ...loan,
            disbursementPhotoKey,
            disbursementPhotoAt: new Date().toISOString(),
            ldfApprovedBy: approverId,
        }));

        const params = { loanData: loansWithPhoto, origin: 'ldf', user: currentUser };
        const response = await fetchWrapper.post(
            getApiBaseUrl() + 'transactions/loans/approve-by-batch', params
        );

        if (response.success) {
            if (response.withError) {
                let errors = '';
                response.errorMsg.forEach(err => { errors += err + '\n'; });
                toast.error(errors);
            } else {
                toast.success('Selected loans successfully updated');
            }
            setTimeout(() => { getListLoan(); window.location.reload(); }, 1000);
        }

        setPendingLdfLoans([]);
    };

    const [actionButtons, setActionButtons] = useState();

    const handleEditAction = (row) => {
        router.push(`/transactions/loan-applications/edit/${row.original._id}`);
    }

    // const handleEditAction = (row) => {
    //     setMode("edit");
    //     setLoan(row.original);
    //     const updatedClient = {
    //         ...row.original.client,
    //         label: `${row.original.client.lastName}, ${row.original.client.firstName} ${row.original.client.middleName || ''}`,
    //         value: row.original.client._id
    //     };
    //     const updatedClientList = [...clientList, updatedClient];
    //     dispatch(setClientList(updatedClientList));
    //     setOccurence(row.original.occurence);
    //     handleShowAddDrawer();
    // }

    const handleDeleteAction = (row) => {
        setLoan(row.original);
        setShowDeleteDialog(true);
    }

    const handleApprove = (row) => {
        if (row.original.allowApproved) {
            updateClientStatus(row.original, 'active');
            // checkCoMakerLoanStatus([{ coMaker: row.original.coMaker, slotNo: row.original.slotNo }]).then(statusList => {
            //     statusList.map(status => {
            //         if (status.status === 'active') {
            //             updateClientStatus(row.original, 'active');
            //         } else {
            //             toast.error('Co Maker latest loan is not yet approved.');
            //         }
            //     });
            // });
        } else {
            toast.error("Group transaction is already closed for the day.");
        }
    }

    const handleReject = () => {
        // if (row.original.allowApproved) {
        //     updateClientStatus(row.original, 'reject');
        // } else {
        //     toast.error("Group transaction is already closed for the day.");
        // }
        if (!rejectReason) {
            toast.error("Reject reason is required!");
        } else if (loan) {
            updateClientStatus(loan, 'reject', rejectReason);
            setShowRejectModal(false);
            setRejectReason('');
        }
    }

    const handleShowNDSAction = (row) => {
        setLoan(row.original);
        window.open(`/transactions/loan-applications/${row.original._id}`, '_blank');
    }

    const checkCoMakerLoanStatus = async (coMakerList) => {
        const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/loans/get-comaker-loan-status', coMakerList);
        let statusList = [];
        if (response.success) {
            statusList = response.data;
        }

        return statusList;
    }

    const [rowActionButtons, setRowActionButtons] = useState([]);

    const handleDelete = () => {
        if (loan) {
            setLoading(true);
            const loanData = {...loan, deleted: true, deletedBy: currentUser._id, dateDeleted: moment(currentDate).format('YYYY-MM-DD')};
            fetchWrapper.postCors(getApiBaseUrl() + 'transactions/loans/delete', loanData)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Loan successfully deleted.');
                        setLoading(false);
                        getListLoan();
                        getListGroup();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const handleShowClientInfoModal = (row) => {
        const selected = row;
        const selectedClient = {...selected.client, profile: selected.client.profile ? selected.client.profile : ''};
        dispatch(setClient(selectedClient));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
    }
    
    const handleShowWarningModal = (row) => {
        if (!row.original.transactionClosed) {
            setLoan(row.original);
            setShowRejectModal(true);
        } else {
            toast.error("Group transaction is already closed for the day.");
        }
    }

    const handleLoTypeChange = (value) => {
        setLdfFilter(value);

        let dataList = list;
        if (ldfOccurenceFilter !== 'all') {
            dataList = data;
        }
        
        switch(value) {
            case 'all':
                if (ldfOccurenceFilter == 'daily') {
                    dataList = list.filter(loan => loan.occurence == 'daily' );
                } else if (ldfOccurenceFilter == 'weekly') {
                    dataList = list.filter(loan => loan.occurence == 'weekly' );
                }
                setData(dataList);
                break;
            case 'main':
                if (ldfOccurenceFilter == 'daily') {
                    dataList = list.filter(loan => loan.occurence == 'daily' );
                } else if (ldfOccurenceFilter == 'weekly') {
                    dataList = list.filter(loan => loan.occurence == 'weekly' );
                }
                const mainData = dataList.filter(loan => loan.loanOfficer.loNo < 11 );
                setData(mainData);
                break;
            case 'ext':
                if (ldfOccurenceFilter == 'daily') {
                    dataList = list.filter(loan => loan.occurence == 'daily' );
                } else if (ldfOccurenceFilter == 'weekly') {
                    dataList = list.filter(loan => loan.occurence == 'weekly' );
                }
                const extData = dataList.filter(loan => loan.loanOfficer.loNo > 10 ); 
                setData(extData);
                break;
            default: break;
        }
    }

    const handleLoOccurenceChange = (value) => {
        setLdfOccurenceFilter(value);

        let dataList = list;
        if (ldfFilter !== 'all') {
            dataList = data;
        }

        switch(value) {
            case 'all':
                if (ldfFilter == 'main') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo < 11 );
                } else if (ldfFilter == 'ext') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo > 10 );
                }
                setData(dataList);
                break;
            case 'daily':
                if (ldfFilter == 'main') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo < 11 );
                } else if (ldfFilter == 'ext') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo > 10 );
                }
                const dailyData = dataList.filter(loan => loan.occurence == 'daily' ); 
                setData(dailyData);
                break;
            case 'weekly':
                if (ldfFilter == 'main') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo < 11 );
                } else if (ldfFilter == 'ext') {
                    dataList = list.filter(loan => loan.loanOfficer.loNo > 10 );
                }
                const weeklyData = dataList.filter(loan => loan.occurence == 'weekly' ); 
                setData(weeklyData);
                break;
            default: break;
        }
    }

    const fetchData = async () => {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListBranch(), getListLoan()]);
            resolve(response);
        });

        if (promise) {
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;
        mounted && fetchData();

        if (currentUser?.role?.rep == 3 || currentUser?.role?.rep == 4) {
            mounted && getHistoyListLoan();
        }

        return () => {
            mounted = false;
        };
    }, [currentDate, currentUser]);

    useEffect(() => {
        if (isFiltering) {
            setData(filteredList);
        } else {
            setData(list);
        }
    }, [isFiltering, filteredList, list]);

    useEffect(() => {
        if (isPendingFiltering) {
            setPendingData(filteredPendingList);
        } else {
            setPendingData(pendingList);
        }
    }, [isPendingFiltering, filteredPendingList, pendingList]);

    useEffect(() => {
        if (isTomorrowFiltering) {
            setTomorrowData(filteredTomorrowList);
        } else {
            setTomorrowData(tomorrowList);
        }
    }, [isTomorrowFiltering, filteredTomorrowList, tomorrowList]);

    useEffect(() => {
        if (isForecastedFiltering) {
            setForecastedData(filteredForcastedList);
        } else {
            setForecastedData(forecastedList);
        }
    }, [isForecastedFiltering, filteredForcastedList, forecastedList]);

    useEffect(() => {
        if (groupList) {
            let cols = [
                {
                    Header: "Group",
                    accessor: 'groupName',
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Client Name",
                    accessor: 'fullName',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Loan Cycle",
                    accessor: 'loanCycle'
                },
                {
                    Header: "Admission Date",
                    accessor: 'admissionDate'
                },
                {
                    Header: "MCBU",
                    accessor: 'mcbuStr',
                    filter: 'includes'
                },
                {
                    Header: "Principal Loan",
                    accessor: 'principalLoanStr'
                },
                {
                    Header: "Target Loan Collection",
                    accessor: 'activeLoanStr'
                },
                {
                    Header: "Loan Release",
                    accessor: 'loanReleaseStr'
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                {
                    Header: "PN Number",
                    accessor: 'pnNumber'
                },
                {
                    Header: "Date of Release",
                    accessor: 'dateOfRelease'
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill,
                },
            ];

            if (currentUser?.role?.rep === 3) {
                cols.unshift(
                    {
                        Header: "Loan Officer",
                        accessor: 'loanOfficerName'
                    }
                );
            } else if (currentUser?.role?.rep === 2 || currentUser?.role?.rep === 1 ) {
                cols.unshift(
                    {
                        Header: "Loan Officer",
                        accessor: 'loanOfficerName'
                    }
                );
                cols.unshift(
                    {
                        Header: "Branch",
                        accessor: 'branchName'
                    }
                )
            }

            let rowActionBtn = [];

            if (currentUser?.role?.rep === 3) {
                if (!isWeekend && !isHoliday) {
                    rowActionBtn = [
                        // { label: 'Approve', action: handleApprove},
                        { label: 'Edit Loan', action: handleEditAction},
                        { label: 'Reject', action: handleShowWarningModal},
                        // { label: 'Delete Loan', action: handleDeleteAction},
                        { label: 'View Disclosure', action: handleShowNDSAction},
                        { label: 'View LAF', action: handleShowLAF},
                        { label: 'View Approval Details', action: handleViewApprovalDetails },
                    ];
                } else {
                    rowActionBtn = [
                        { label: 'Edit Loan', action: handleEditAction},
                        { label: 'View Disclosure', action: handleShowNDSAction},
                        { label: 'View LAF', action: handleShowLAF},
                        { label: 'View Approval Details', action: handleViewApprovalDetails },
                    ];
                }
            } else if (currentUser?.role?.rep === 4) {
                rowActionBtn = [
                    { label: 'Edit Loan', action: handleEditAction},
                    // { label: 'Delete Loan', action: handleDeleteAction}
                    { label: 'View Disclosure', action: handleShowNDSAction},
                    { label: 'View LAF', action: handleShowLAF},
                    { label: 'View Approval Details', action: handleViewApprovalDetails },
                ];
            }

            setColumns(cols);
            setRowActionButtons(rowActionBtn);
        }
    }, [groupList]);

    useEffect(() => {
        if (currentUser?.role?.rep === 3 || currentUser?.role?.rep === 4) {
            setSelectedFilterBranch(currentUser.designatedBranch);
            getListUser(currentUser.designatedBranch);
        }

        if (currentUser?.role?.rep === 4) {
            setOccurence(currentUser.transactionType);
            getListGroup(currentUser._id, currentUser.transactionType);
        }
    }, [currentUser, branchList]);

    useEffect(() => {
        setNoOfLDFLoans(data.length);
        setTotalLDFAmountRelease(getTotal(data, 'principalLoan'));
    }, [data]);

    useEffect(() => {
        setNoOfPendingLoans(pendingData.length);
        setTotalAmountRelease(getTotal(pendingData, 'principalLoan'));
    }, [pendingData]);

    useEffect(() => {
        setNoOfTomorrowLoans(tomorrowData.length);
        setTotalTomorrowAmountRelease(getTotal(tomorrowData, 'principalLoan'));
    }, [tomorrowData]);

    useEffect(() => {
        setNoOfTomorrowLoans(forecastedData.length);
        setTotalTomorrowAmountRelease(getTotal(forecastedData, 'principalLoan'));
    }, [forecastedData]);

    useEffect(() => {
        let actBtns = [];
        if (currentUser?.role?.rep < 4 && selectedTab !== 'forecast') {
            actBtns = [
                <ButtonOutline label="LDF Approved" type="button" className="p-2 mr-3" onClick={() => handleMultiApprove('ldf')} />,
                <ButtonOutline label="LDF Unapproved" type="button" className="p-2 mr-3 !border-red-600 !text-red-500 !bg-red-100" onClick={() => handleMultiApprove('ldf', true)} />
            ];

            if (currentUser?.role?.rep > 2)  {
                actBtns.push(
                    <ButtonSolid
                        label="Add Loan"
                        type="button"
                        className="p-2 mr-3"
                        onClick={() => router.push('/transactions/loan-applications/add')}
                        icon={[<PlusIcon className="w-5 h-5" />, 'left']}
                    />
                );
            }

            if ((selectedTab == 'application' || selectedTab == 'tomorrow') && !isWeekend && !isHoliday && currentDate && !currentBranch.lockTransaction) {
                actBtns.splice(0, 2);
                if (selectedTab == 'application') {
                    actBtns.unshift(
                        <ButtonOutline label="Approved Selected Loans" type="button" className="p-2 mr-3" onClick={() => handleMultiApprove('application')} />,
                    );
                }
            }

            if (selectedTab == 'duplicate' && !isWeekend && !isHoliday && currentDate && !currentBranch.lockTransaction) {
                actBtns.push(<ButtonOutline label="Approved Selected Duplicate Loans" type="button" className="p-2 mr-3" onClick={() => handleMultiApprove('duplicate')} />);
            }
        }
        
        setActionButtons(actBtns);
    }, [selectedTab, list, pendingList, duplicateList]);

    useEffect(() => {
        if (selectedTab === 'history') {
            getHistoyListLoan();
        }
    }, [selectedTab, selectedMonth, selectedYear]);

    return (
        <Layout actionButtons={(selectedTab !== 'history') && actionButtons}>
            <div className="pb-4">
                { (loading || isLoanFetching || isBranchFetching) ?
                    (
                        // <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        // </div>
                    ) : (
                        <React.Fragment>
                            <nav className="flex pl-10 bg-white border-b border-gray-300">
                                <TabSelector
                                    isActive={selectedTab === "ldf"}
                                    onClick={() => handleSelectTab("ldf")}>
                                    LDF Pending Applications
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "tomorrow"}
                                    onClick={() => handleSelectTab("tomorrow")}>
                                    Tomorrow Applications
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "forecast"}
                                    onClick={() => handleSelectTab("forecast")}>
                                    Forecasted Applications
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "application"}
                                    onClick={() => handleSelectTab("application")}>
                                    LDF Approved Applications
                                </TabSelector>
                                {currentUser?.role?.rep < 2 && (
                                    <TabSelector
                                        isActive={selectedTab === "duplicate"}
                                        onClick={() => handleSelectTab("duplicate")}>
                                        Duplicate Clients Applications
                                        {duplicateList?.length > 0 && (
                                            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-600">
                                                {duplicateList.length}
                                            </span>
                                        )}
                                    </TabSelector>
                                )}
                                {currentUser?.role?.rep <= 3 && (
                                    <TabSelector
                                        isActive={selectedTab === "guarantor-review"}
                                        onClick={() => handleSelectTab("guarantor-review")}>
                                        Guarantor Review
                                        {guarantorReviewList?.length > 0 && (
                                            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">
                                                {guarantorReviewList.length}
                                            </span>
                                        )}
                                    </TabSelector>
                                )}
                                <TabSelector
                                    isActive={selectedTab === "history"}
                                    onClick={() => handleSelectTab("history")}>
                                    History
                                </TabSelector>
                            </nav>
                            <div>
                                <TabPanel hidden={selectedTab !== "ldf"}>
                                    <div className="flex flex-row justify-between w-full bg-white p-4">
                                        <div className="flex flex-row">
                                            {currentUser?.role?.rep < 3 && (
                                                <div className='flex flex-col ml-4'>
                                                    <span className='text-zinc-400 mb-1'>Branch:</span>
                                                    <Select 
                                                        options={branchList}
                                                        value={branchList && branchList.find(branch => { return branch.value === selectedFilterBranch } )}
                                                        styles={borderStyles}
                                                        components={{ DropdownIndicator }}
                                                        onChange={handleBranchChange}
                                                        isSearchable={true}
                                                        closeMenuOnSelect={true}
                                                        placeholder={'Branch Filter'}/>
                                                </div>
                                            )}
                                            {currentUser?.role?.rep <= 3 && (
                                                <div className='flex flex-col ml-4'>
                                                    <span className='text-zinc-400 mb-1'>Loan Officer:</span>
                                                    <Select 
                                                        options={userList}
                                                        value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                                        styles={borderStyles}
                                                        components={{ DropdownIndicator }}
                                                        onChange={handleUserChange}
                                                        isSearchable={true}
                                                        closeMenuOnSelect={true}
                                                        placeholder={'LO Filter'}/>
                                                </div>
                                            )}
                                            <div className='flex flex-col ml-4 mr-4'>
                                                <span className='text-zinc-400 mb-1'>Group:</span>
                                                <Select 
                                                    options={groupList}
                                                    value={groupList && groupList.find(group => { return group.value === selectedFilterGroup } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleGroupChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Group Filter'}/>
                                            </div>
                                            <div className='flex flex-col ml-4 mr-4'>
                                                <span className='text-zinc-400 mb-1'>Loan Type:</span>
                                                <Select 
                                                    options={loanCycleFilterList}
                                                    value={loanCycleFilterList && loanCycleFilterList.find(loanCycle => { return loanCycle.value === selectedFilterLoanCycle } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleLoanCycleChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Loan Type Filter'}/>
                                            </div>
                                            {currentUser?.role?.rep < 4 && (
                                                <div className="flex flex-col">
                                                    <div className="flex flex-row border border-zinc-200 rounded-lg pl-4 pb-2">
                                                        <RadioButton id={"radio_main"} name="radio-lo-type" label={"All"} checked={ldfFilter === 'all'} value="all" onChange={handleLoTypeChange} />
                                                        <RadioButton id={"radio_mother"} name="radio-lo-type" label={"Main"} checked={ldfFilter === 'main'} value="main" onChange={handleLoTypeChange} />
                                                        <RadioButton id={"radio_ext"} name="radio-lo-type" label={"Ext"} checked={ldfFilter === 'ext'} value="ext" onChange={handleLoTypeChange} />
                                                    </div>
                                                    <div className="mt-2 flex flex-row border border-zinc-200 rounded-lg pl-4 pb-2">
                                                        <RadioButton id={"radio_occurence_main"} name="radio-occurence" label={"All"} checked={ldfOccurenceFilter === 'all'} value="all" onChange={handleLoOccurenceChange} />
                                                        <RadioButton id={"radio_occurence_daily"} name="radio-occurence" label={"Daily"} checked={ldfOccurenceFilter === 'daily'} value="daily" onChange={handleLoOccurenceChange} />
                                                        <RadioButton id={"radio_occurence_weekly"} name="radio-occurence" label={"Weekly"} checked={ldfOccurenceFilter === 'weekly'} value="weekly" onChange={handleLoOccurenceChange} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {currentUser?.role?.rep === 3 && (
                                            <div className='flex justify-end ml-4 h-10 my-auto'>
                                                <ReactToPrint
                                                    trigger={() => <ButtonSolid label="Print LDF" icon={[<PrinterIcon className="w-5 h-5" />, 'left']} width='!w-28'/> }
                                                    content={() => ndsFormRef.current }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Co-maker Pending / Guarantor Review filter pills ───────────── */}
                                    {(() => {
                                        const baseList = isFiltering ? filteredList : list;
                                        const coMakerPendingCount   = baseList.filter(l => l.coMakerPending).length;
                                        const guarantorDuplicateCount = baseList.filter(l => l.guarantorDuplicate).length;
                                        if (coMakerPendingCount === 0 && guarantorDuplicateCount === 0) return null;
                                        return (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
                                                <span className="text-xs text-gray-500 font-medium mr-1">Quick filter:</span>

                                                {coMakerPendingCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch(setFilteredLoanList(list.filter(l => l.coMakerPending)));
                                                            setIsFiltering(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                                                            bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
                                                    >
                                                        ⚠ Co-maker Pending
                                                        <span className="bg-amber-500 text-white rounded-full min-w-[16px] h-4 px-1
                                                            flex items-center justify-center text-[10px] font-bold">
                                                            {coMakerPendingCount}
                                                        </span>
                                                    </button>
                                                )}

                                                {guarantorDuplicateCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch(setFilteredLoanList(list.filter(l => l.guarantorDuplicate)));
                                                            setIsFiltering(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                                                            bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 transition-colors"
                                                    >
                                                        🔴 Guarantor Review
                                                        <span className="bg-red-500 text-white rounded-full min-w-[16px] h-4 px-1
                                                            flex items-center justify-center text-[10px] font-bold">
                                                            {guarantorDuplicateCount}
                                                        </span>
                                                    </button>
                                                )}

                                                {isFiltering && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch(setFilteredLoanList([]));
                                                            setIsFiltering(false);
                                                        }}
                                                        className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
                                                    >
                                                        ✕ Clear filter
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="mb-6">
                                        <TableComponent 
                                            columns={columns} 
                                            data={data} 
                                            pageSize={30} 
                                            hasActionButtons={currentUser?.role?.rep > 2 ? true : false} 
                                            rowActionButtons={rowActionButtons} 
                                            showFilters={false} 
                                            multiSelect={currentUser?.role?.rep === 3 ? true : false} 
                                            multiSelectActionFn={handleMultiSelect} 
                                            rowClick={handleShowClientInfoModal}
                                        />
                                        <LDFListPage ref={ndsFormRef} data={data} />
                                    </div>
                                    <footer className="pl-64 text-md font-bold text-center fixed inset-x-0 bottom-0 text-red-400">
                                        <div className="flex flex-row justify-center bg-white px-4 py-2 shadow-inner border-t-4 border-zinc-200">
                                            <div className="flex flex-row">
                                                <span className="pr-6">No. of Pending Loans: </span>
                                                <span className="pr-6">{ noOfLDFLoans }</span>
                                            </div>
                                            <div className="flex flex-row">
                                                <span className="pr-6">Total Amount Release: </span>
                                                <span className="pr-6">{ formatPricePhp(totalLDFAmountRelease) }</span>
                                            </div>
                                        </div>
                                    </footer>
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "tomorrow"}>
                                    <div className="flex flex-row bg-white p-4">
                                        {currentUser?.role?.rep < 3 && (
                                            <div className='flex flex-col ml-4'>
                                                <span className='text-zinc-400 mb-1'>Branch:</span>
                                                <Select 
                                                    options={branchList}
                                                    value={branchList && branchList.find(branch => { return branch.value === selectedFilterBranch } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleBranchChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'}/>
                                            </div>
                                        )}
                                        {currentUser?.role?.rep <= 3 && (
                                            <div className='flex flex-col ml-4'>
                                                <span className='text-zinc-400 mb-1'>Loan Officer:</span>
                                                <Select 
                                                    options={userList}
                                                    value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleUserChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'LO Filter'}/>
                                            </div>
                                        )}
                                        <div className='flex flex-col ml-4'>
                                            <span className='text-zinc-400 mb-1'>Group:</span>
                                            <Select 
                                                options={groupList}
                                                value={groupList && groupList.find(group => { return group.value === selectedFilterGroup } )}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={handleGroupChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Group Filter'}/>
                                        </div>
                                    </div>
                                    <TableComponent 
                                        columns={columns} 
                                        data={tomorrowData} 
                                        pageSize={50} 
                                        hasActionButtons={currentUser?.role?.rep > 2 ? true : false} 
                                        rowActionButtons={rowActionButtons} 
                                        showFilters={false} 
                                        multiSelect={currentUser?.role?.rep === 3 ? true : false} 
                                        multiSelectActionFn={handleMultiSelect} 
                                        rowClick={handleShowClientInfoModal}
                                    />
                                    <footer className="pl-64 text-md font-bold text-center fixed inset-x-0 bottom-0 text-red-400">
                                        <div className="flex flex-row justify-center bg-white px-4 py-2 shadow-inner border-t-4 border-zinc-200">
                                            <div className="flex flex-row">
                                                <span className="pr-6">No. of Tomorrow Loans: </span>
                                                <span className="pr-6">{ noOfTomorrowLoans }</span>
                                            </div>
                                            <div className="flex flex-row">
                                                <span className="pr-6">Total Amount Release: </span>
                                                <span className="pr-6">{ formatPricePhp(totalTomorrowAmountRelease) }</span>
                                            </div>
                                        </div>
                                    </footer>
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "application"}>
                                    <div className="flex flex-row bg-white p-4">
                                        {currentUser?.role?.rep < 3 && (
                                            <div className='flex flex-col ml-4'>
                                                <span className='text-zinc-400 mb-1'>Branch:</span>
                                                <Select 
                                                    options={branchList}
                                                    value={branchList && branchList.find(branch => { return branch.value === selectedFilterBranch } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleBranchChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'}/>
                                            </div>
                                        )}
                                        {currentUser?.role?.rep <= 3 && (
                                            <div className='flex flex-col ml-4'>
                                                <span className='text-zinc-400 mb-1'>Loan Officer:</span>
                                                <Select 
                                                    options={userList}
                                                    value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleUserChange}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'LO Filter'}/>
                                            </div>
                                        )}
                                        <div className='flex flex-col ml-4'>
                                            <span className='text-zinc-400 mb-1'>Group:</span>
                                            <Select 
                                                options={groupList}
                                                value={groupList && groupList.find(group => { return group.value === selectedFilterGroup } )}
                                                styles={borderStyles}
                                                components={{ DropdownIndicator }}
                                                onChange={handleGroupChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Group Filter'}/>
                                        </div>
                                    </div>
                                    <TableComponent 
                                        columns={columns} 
                                        data={pendingData} 
                                        pageSize={50} 
                                        hasActionButtons={currentUser?.role?.rep > 2 ? true : false} 
                                        rowActionButtons={rowActionButtons} 
                                        showFilters={false} 
                                        multiSelect={currentUser?.role?.rep === 3 ? true : false} 
                                        multiSelectActionFn={handleMultiSelect} 
                                        rowClick={handleShowClientInfoModal}
                                    />
                                    <footer className="pl-64 text-md font-bold text-center fixed inset-x-0 bottom-0 text-red-400">
                                        <div className="flex flex-row justify-center bg-white px-4 py-2 shadow-inner border-t-4 border-zinc-200">
                                            <div className="flex flex-row">
                                                <span className="pr-6">No. of Pending Loans: </span>
                                                <span className="pr-6">{ noOfPendingLoans }</span>
                                            </div>
                                            <div className="flex flex-row">
                                                <span className="pr-6">Total Amount Release: </span>
                                                <span className="pr-6">{ formatPricePhp(totalAmountRelease) }</span>
                                            </div>
                                        </div>
                                    </footer>
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "forecast"}>
                                    <ForeCastApplication data={forecastedData} handleShowClientInfoModal={handleShowClientInfoModal} rowActionButtons={rowActionButtons} currentUser={currentUser} setShowAddDrawer={setShowAddDrawer} />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'duplicate'}>
                                    <TableComponent columns={columns} data={duplicateList} hasActionButtons={false} showFilters={false} multiSelect={true} multiSelectActionFn={handleMultiSelect}  pageSize={500} />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'history'}>
                                    <div className="flex flex-row bg-white p-4 justify-between">
                                        <div className="flex flex-row justify-start">
                                            <div className="ml-4 flex">
                                                <Select 
                                                    options={months}
                                                    value={selectedMonth && months.find(m => {
                                                        return parseInt(m.value) === parseInt(selectedMonth)
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleMonthFilter}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Month Filter'}/>
                                            </div>
                                            <div className="ml-4 flex">
                                                <Select 
                                                    options={years}
                                                    value={selectedYear && years.find(y => {
                                                        return y.value === selectedYear
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleYearFilter}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Year Filter'}/>
                                            </div>
                                            {currentUser?.role?.rep < 3 && (
                                                <div className='flex flex-col ml-4'>
                                                    <Select 
                                                        options={branchList}
                                                        value={branchList && branchList.find(branch => { return branch.value === selectedBranch } )}
                                                        styles={borderStyles}
                                                        components={{ DropdownIndicator }}
                                                        onChange={handleBranchFilter}
                                                        isSearchable={true}
                                                        closeMenuOnSelect={true}
                                                        placeholder={'Branch Filter'}/>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-row justify-end">
                                            <ExportButtonWrapper />
                                        </div>
                                    </div>
                                    <TableComponent columns={columns} data={historyList} hasActionButtons={false} showFilters={false} pageSize={500} />
                                </TabPanel>
                                {currentUser?.role?.rep <= 3 && (
                                    <TabPanel hidden={selectedTab !== "guarantor-review"}>
                                        <div className="p-4">
                                            {guarantorReviewList.length === 0 ? (
                                                <div className="text-center py-12 text-gray-400 text-sm">
                                                    No loans pending guarantor review
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {guarantorReviewList.map(loan => (
                                                        <div key={loan._id}
                                                            className="bg-white border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-semibold text-gray-900">
                                                                    {loan.fullName}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-0.5">
                                                                    {loan.groupName} · Slot {loan.slotNo} · {loan.pnNumber || 'No PN'}
                                                                </p>
                                                                <p className="text-xs text-amber-600 mt-1">
                                                                    Guarantor: {loan.guarantorFirstName} {loan.guarantorLastName}
                                                                </p>
                                                            </div>
                                                            <div className="flex-shrink-0">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                    loan.status === 'active'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-yellow-100 text-yellow-700'
                                                                }`}>
                                                                    {loan.status}
                                                                </span>
                                                            </div>
                                                            {/* Rep ≤ 2: full review, Rep 3: read-only view */}
                                                            {currentUser?.role?.rep <= 3 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => router.push(`/transactions/loan-applications/edit/${loan._id}`)}
                                                                    className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${
                                                                        currentUser?.role?.rep <= 2
                                                                            ? 'bg-red-600 hover:bg-red-700'
                                                                            : 'bg-gray-500 hover:bg-gray-600'
                                                                    }`}
                                                                >
                                                                    {currentUser?.role?.rep <= 2 ? 'Review' : 'View'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabPanel>
                                )}
                            </div>
                        </React.Fragment>
                    )
                } 
            </div>
            {occurence && <AddUpdateLoan mode={mode} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} type={occurence} />}
            <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="70rem">
                <ClientDetailPage />
            </Modal>
            <Dialog show={showRejectModal}>
                <h2>Reject Loan</h2>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <textarea rows="4" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                    className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                border-gray-300 focus:ring-blue-500 focus:border-main" 
                                    placeholder="Enter reject reason..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                    <div className='flex flex-row'>
                        <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowRejectModal(false)} />
                        <ButtonSolid label="Continue" type="button" className="p-2 mr-3" onClick={handleReject} />
                    </div>
                </div>
            </Dialog>
            <Dialog show={showDeleteDialog}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <p className="text-2xl font-normal text-dark-color">Are you sure you want to delete?</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                    <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowDeleteDialog(false)} />
                    <ButtonSolid label="Yes, delete" type="button" className="p-2" onClick={handleDelete} />
                </div>
            </Dialog>
            {/* Excel Export Modal */}
            <ExcelExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                dataSource={selectedTab}
                historyData={historyList}
            />
            <LAFModal 
                isOpen={showLAFModal}
                onClose={handleCloseLAF}
                loanData={selectedLoanForLAF}
            />
            <DisbursementPhotoModal
                show={showDisbursementModal}
                loans={pendingLdfLoans}
                onConfirm={handleLdfApprovalConfirm}
                onCancel={() => {
                    setShowDisbursementModal(false);
                    setPendingLdfLoans([]);
                }}
            />
            <LDFApprovalDetailsModal
                show={showApprovalModal}
                loan={selectedApprovalLoan}
                onClose={() => {
                    setShowApprovalModal(false);
                    setSelectedApprovalLoan(null);
                }}
            />
        </Layout>
    );
}

export default LoanApplicationPage;