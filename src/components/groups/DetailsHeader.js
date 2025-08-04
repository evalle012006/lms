import Breadcrumbs from "@/components/Breadcrumbs";
import { useDispatch, useSelector } from 'react-redux';
import { shouldIncludeViewMode, UppercaseFirstLetter } from "@/lib/utils";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { useEffect, useRef, useState } from "react";
import moment from 'moment'
import DatePicker from "@/lib/ui/DatePicker";
import { useRouter } from 'next/router';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import { setGroupList } from "@/redux/actions/groupActions";
import { toast } from "react-toastify";

const DetailsHeader = ({ page, handleSaveUpdate, data, setData, showSaveButton, dateFilter, setDateFilter, handleDateFilter, revertMode = false,
                            groupFilter, handleGroupFilter, groupTransactionStatus, allowMcbuWithdrawal, allowOffsetTransaction, hasDraft, changeRemarks,
                            handleShowWarningDialog, loading, allowMcbuInterest }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const groupList = useSelector(state => state.group.list);
    const group = useSelector(state => state.group.data);
    const [showCalendar, setShowCalendar] = useState(false);
    const branchList = useSelector(state => state.branch.list);
    const [branchName, setBranchName] = useState();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [fetchingGroups, setFetchingGroups] = useState(false);
    
    const statusClass = {
        'available': "text-green-700 bg-green-100",
        'full': "text-red-400 bg-red-100",
        'open': "text-green-700 bg-green-100",
        'close': "text-red-400 bg-red-100"
    }

    const legends = [
        {label: 'Active', bg: ''},
        {label: 'Pending', bg: 'bg-yellow-100'},
        {label: 'Completed', bg: 'bg-green-100'},
        {label: 'For Tomorrow', bg: 'bg-lime-100'}
    ];

    // Function to fetch groups for the loan officer
    const fetchGroupsForLoanOfficer = async (loId) => {
        if (fetchingGroups || !loId) return;
        
        setFetchingGroups(true);
        try {
            const url = `${getApiBaseUrl()}groups/list?`;
            const params = new URLSearchParams({
                loId: loId,
                mode: 'all' // Get all groups including closed ones
            });

            const response = await fetchWrapper.get(url + params.toString());
            
            if (response.success && response.groups) {
                // Format groups for the dropdown
                const formattedGroups = response.groups.map(g => ({
                    ...g,
                    value: g._id,
                    label: g.name
                }));
                
                dispatch(setGroupList(formattedGroups));
                console.log(`Fetched ${formattedGroups.length} groups for loan officer ${loId}`);
            } else {
                console.warn('Failed to fetch groups:', response.message || 'Unknown error');
                toast.error('Failed to load groups for filter');
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
            toast.error('Error loading groups for filter');
        } finally {
            setFetchingGroups(false);
        }
    };

    // Effect to fetch groups when groupList is empty and we have a loan officer ID
    useEffect(() => {
        if (page === 'transaction' && groupList.length === 0 && group?.loanOfficerId) {
            console.log('Fetching groups for loan officer:', group.loanOfficerId);
            fetchGroupsForLoanOfficer(group.loanOfficerId);
        }
    }, [page, groupList.length, group?.loanOfficerId]);

    // Handle group filter change with backward compatibility
    const handleGroupFilterChange = (selectedGroup) => {
        // Check if we came from ModernBranchCashCollections
        const isFromModernBranch = router.query.fromModernBranchCashCollections === 'true';
        
        if (isFromModernBranch && selectedGroup && selectedGroup._id !== group?._id) {
            // NEW BEHAVIOR: Preserve all URL parameters when coming from ModernBranchCashCollections
            const newQuery = {
                ...router.query, // Preserve all existing query parameters
                uuid: selectedGroup._id, // Update the UUID to the new group
            };

            // Get the current pathname and replace the UUID
            let newPathname = router.asPath.split('?')[0]; // Get pathname without query string
            newPathname = newPathname.replace(/\/[^\/]+$/, `/${selectedGroup._id}`); // Replace the last segment (UUID)
            
            router.push({
                pathname: newPathname,
                query: newQuery
            });
        } else {
            // ORIGINAL BEHAVIOR: Use the original handler for backward compatibility
            console.log('Original mode - using existing handler');
            if (handleGroupFilter) {
                handleGroupFilter(selectedGroup);
            }
        }
    };

    const handleRemarkFilter = (selected) => {
        if (data.length > 0) {
            const temp = data.filter(d => d.remarks === selected.value)
            setData(temp);
        }
    }

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const setSelectedDate = (e) => {
        setDateFilter(e);
        setShowCalendar(false);
    };

    const handleBack = () => {
        if (page == 'transaction') {
            // Check if we came from ModernBranchCashCollections
            if (router.query.fromModernBranchCashCollections === 'true') {
            // Build the query to navigate back to ModernBranchCashCollections
            const backQuery = {};
            
            // Add viewMode if it was provided and user role allows it
            if (router.query.sourceViewMode && shouldIncludeViewMode(currentUser)) {
                backQuery.viewMode = router.query.sourceViewMode;
            }
            
            // Add hierarchical navigation parameters
            if (router.query.sourceId) {
                backQuery.id = router.query.sourceId;
            }
            
            if (router.query.sourceFilter) {
                backQuery.filter = router.query.sourceFilter;
            }
            
            if (router.query.sourceParentId) {
                backQuery.parentId = router.query.sourceParentId;
            }
            
            if (router.query.sourceGrandParentId) {
                backQuery.grandParentId = router.query.sourceGrandParentId;
            }
            
            // Navigate back to ModernBranchCashCollections with the preserved state
            router.push({
                pathname: '/transactions/cash-collection',
                query: backQuery
            });
            
            // If there was a date filter, restore it in localStorage
            if (router.query.sourceDateFilter) {
                localStorage.setItem('cashCollectionDateFilter', router.query.sourceDateFilter);
            }
            
            return;
            }
            
            // Original back navigation logic for other cases
            if (currentUser.role.rep == 4) {
            router.push(`/transactions/${currentUser.transactionType}-cash-collection`);
            } else {
            router.push(`/transactions/${group.occurence}-cash-collection/group/${group.loanOfficerId}`);
            }
        } else {
            // For non-transaction pages, use the default back behavior
            router.back();
        }
        };

    useEffect(() => {
        if (group) {
            const currentBranch = branchList.find(branch => branch?._id == group.branchId);
            if (currentBranch) {
                setBranchName(currentBranch.name);
            }
        }
    }, [group, branchList]);

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            <div className="flex flex-row justify-between w-11/12">
                <Breadcrumbs />
            </div>
            {group && (
                <div className="py-2 proxima-regular">
                    <div className="flex flex-row alternate-gothic text-2xl">
                        <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                        <span>{group.name}</span>
                    </div>
                    <div className="flex justify-between w-11/12">
                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                            <div className="space-x-2 flex items-center">
                                <span className="text-gray-400 text-sm">Branch Name:</span>
                                <span className="text-sm">{branchName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day:</span >
                                <span className="text-sm">{UppercaseFirstLetter(group.day)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day No.:</span >
                                <span className="text-sm">{group.dayNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Time:</span >
                                <span className="text-sm">{group.time}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Group No.:</span >
                                <span className="text-sm">{group.groupNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Loan Officer:</span >
                                <span className="text-sm">{group.loanOfficerName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">No. of Clients:</span >
                                <span className="text-sm">{group.noOfClients}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Status:</span >
                                <span className={`text-sm status-pill ${statusClass[group.status]}`}>{UppercaseFirstLetter(group.status)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Group Transaction Status:</span >
                                <span className={`text-sm status-pill ${statusClass[groupTransactionStatus]}`}>{UppercaseFirstLetter(groupTransactionStatus)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {page === 'transaction' && (
                <div className="flex justify-between w-10/12 z-50">
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                        <span className="text-gray-400 text-sm mt-1">Filters:</span >
                        <div className="ml-4 flex w-40">
                            <Select 
                                options={groupList}
                                value={groupList.find(g => g._id === group?._id) || (groupFilter && groupList.find(g => g._id === groupFilter))}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleGroupFilterChange}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                menuPortalTarget={document.body}
                                placeholder={fetchingGroups ? 'Loading...' : 'Group Filter'}
                                isLoading={fetchingGroups}
                                isDisabled={fetchingGroups}
                            />
                        </div>
                        <div className="ml-24 flex w-64">
                            <div className="relative w-full" onClick={openCalendar}>
                                <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                            </div>
                        </div>
                    </div>

                    {((showSaveButton || allowMcbuWithdrawal || allowOffsetTransaction || allowMcbuInterest) && groupTransactionStatus != 'close') && (
                        <div className={`flex items-center`}>
                            {((hasDraft && !revertMode) || hasDraft || (hasDraft && !changeRemarks) || !allowMcbuInterest || !allowMcbuWithdrawal) && (
                                <div className="w-40 mr-4">
                                    <ButtonOutline label="Save Draft" type="button" className="p-2 mr-3" onClick={() => handleSaveUpdate(true)} disabled={loading} />
                                </div>
                            )}
                            <div className="w-40">
                                <ButtonSolid label="Submit Collection" onClick={() => handleSaveUpdate(false)} disabled={loading} />
                            </div>
                        </div>
                    )}

                    {( (!showSaveButton && groupTransactionStatus != 'close' && !isHoliday && !isWeekend && currentUser.role.rep == 3 && !allowMcbuInterest && !allowMcbuWithdrawal) && (
                        <div className="w-40 ml-4">
                            <ButtonSolid label="Revert" onClick={(e) => handleShowWarningDialog(e)} disabled={loading} />
                        </div>
                    ) )}
                </div>
            )}
        </div>
    );
}

export default DetailsHeader;