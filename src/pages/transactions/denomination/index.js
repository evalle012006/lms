import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { toast } from 'react-toastify';
import moment from 'moment';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { Calendar, RefreshCw, Save, ChevronLeft, ChevronUp, Check, X, Users, XCircle } from 'lucide-react';
import Select from 'react-select';

// Format price helper
const formatPrice = (value) => {
    if (!value && value !== 0) return '₱0.00';
    return '₱' + parseFloat(value).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
};

export default function DenominationPage() {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const branchList = useSelector(state => state.branch.list);
    const dispatch = useDispatch();
    const router = useRouter();
    
    const [loading, setLoading] = useState(true);
    const [denominationData, setDenominationData] = useState([]);
    const [initialData, setInitialData] = useState([]);
    const [dateFilter, setDateFilter] = useState(currentDate || moment().format('YYYY-MM-DD'));
    const [filter, setFilter] = useState('branch');
    const [canEdit, setCanEdit] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Navigation states
    const [viewingNestedContent, setViewingNestedContent] = useState(false);
    const [parentEntityName, setParentEntityName] = useState('');
    
    // Entity selection states
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [selectedLO, setSelectedLO] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    
    // Entity lists
    const [loList, setLoList] = useState([]);
    const [groupList, setGroupList] = useState([]);
    
    // NEW: Navigation filter states - for nested navigation
    const [navBranchList, setNavBranchList] = useState([]);
    const [navLoList, setNavLoList] = useState([]);
    const [selectedNavBranch, setSelectedNavBranch] = useState(null);
    const [selectedNavLO, setSelectedNavLO] = useState(null);
    
    // Rejection modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingItem, setRejectingItem] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Client modal states
    const [showClientModal, setShowClientModal] = useState(false);
    const [clientModalLoading, setClientModalLoading] = useState(false);
    const [clientData, setClientData] = useState([]);
    const [selectedGroupForClients, setSelectedGroupForClients] = useState(null);
    
    // Separate state for morning and afternoon remittances
    const [morningRemittanceChanges, setMorningRemittanceChanges] = useState({});
    const [afternoonRemittanceChanges, setAfternoonRemittanceChanges] = useState({});
    
    // NEW: Remarks state
    const [remarksChanges, setRemarksChanges] = useState({});
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedItemHistory, setSelectedItemHistory] = useState(null);
    
    // NEW: Remarks modal states
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [remarksModalItem, setRemarksModalItem] = useState(null);
    const [remarksModalValue, setRemarksModalValue] = useState('');

    const handleViewHistory = (item) => {
        setSelectedItemHistory(item);
        setShowHistoryModal(true);
    };
    
    // NEW: Handle remarks modal
    const handleOpenRemarksModal = (item) => {
        setRemarksModalItem(item);
        setRemarksModalValue(item.remarks || '');
        setShowRemarksModal(true);
    };
    
    const handleSaveRemarks = () => {
        if (remarksModalItem) {
            setRemarksChanges(prev => ({
                ...prev,
                [remarksModalItem.entityId]: remarksModalValue
            }));
        }
        setShowRemarksModal(false);
        setRemarksModalItem(null);
        setRemarksModalValue('');
    };
    
    const handleCloseRemarksModal = () => {
        setShowRemarksModal(false);
        setRemarksModalItem(null);
        setRemarksModalValue('');
    };

    // Get effective filter from router or state
    const effectiveFilter = router.query.filter || filter;

    // Helper function to determine if back button should be shown
    const shouldShowBackButton = () => {
        // Show back button when we have nested navigation via router.query
        if (router.query.id || router.query.filter) {
            // Don't show back for users at their base level
            if (currentUser?.role) {
                // Cashier without designated branch at branch level
                if (currentUser.role.shortCode === 'cashier' && 
                    currentUser.designatedBranchId == null && 
                    effectiveFilter === 'branch' &&
                    !router.query.id) {
                    return false;
                }
                
                // Branch manager (rep 3) at LO level - don't show Back to Branches
                // They are assigned to a specific branch, so they can't navigate to other branches
                if (currentUser.role.rep === 3 && effectiveFilter === 'lo') {
                    return false;
                }
                
                // For LO level, only show "Back to Branches" for admin users (rep <= 2)
                if (effectiveFilter === 'lo' && currentUser.role.rep > 2) {
                    return false;
                }
                
                // Loan officer (rep 4) at group level without navigation
                if (currentUser.role.rep === 4 && 
                    effectiveFilter === 'group' && 
                    !router.query.id) {
                    return false;
                }
                
                // Branch manager (rep 3) at group level - show back to LO button
                if (currentUser.role.rep === 3 && effectiveFilter === 'group') {
                    return true;
                }
            }
            
            return true;
        }
        
        return false;
    };
    
    // Initialize from router query
    useEffect(() => {
        if (router.query.date) {
            setDateFilter(router.query.date);
        } else {
            setDateFilter(currentDate);
        }
        
        if (router.query.filter) {
            setFilter(router.query.filter);
        } else if (!router.query.id) {
            if (currentUser?.role) {
                if (currentUser.role.rep <= 2) {
                    setFilter('branch');
                } else if (currentUser.role.rep === 3) {
                    setFilter('lo');
                } else if (currentUser.role.rep === 4) {
                    setFilter('group');
                } else if (currentUser.role.shortCode === 'cashier' && 
                         currentUser.designatedBranchId == null) {
                    setFilter('branch');
                }
            }
        }
        
        const hasNestedContent = !!router.query.id;
        setViewingNestedContent(hasNestedContent);
    }, [router.query.date, router.query.filter, router.query.id, router.query.parentId, currentUser?.role, currentDate]);
    
    // Fetch branch list if empty (for cashiers)
    useEffect(() => {
        const fetchBranches = async () => {
            if (branchList.length === 0 && currentUser?.role) {
                try {
                    const url = getApiBaseUrl() + 'branches/list';
                    const response = await fetchWrapper.get(url);
                    
                    if (response.success && response.branches) {
                        dispatch({ type: 'SET_BRANCH_LIST', payload: response.branches });
                    }
                } catch (error) {
                    console.error('Error fetching branches:', error);
                }
            }
        };
        
        fetchBranches();
    }, [branchList.length, currentUser, dispatch]);

    // NEW: Fetch navigation branch list when viewing LOs
    useEffect(() => {
        const fetchNavBranches = async () => {
            if (effectiveFilter === 'lo' && currentUser?.role?.rep <= 2) {
                try {
                    const url = getApiBaseUrl() + 'branches/list';
                    const response = await fetchWrapper.get(url);
                    
                    if (response.success && response.branches) {
                        const branches = response.branches.map(b => ({
                            value: b._id,
                            label: b.code ? `${b.code} - ${b.name}` : b.name
                        })).sort((a, b) => a.label.localeCompare(b.label));
                        setNavBranchList(branches);
                        
                        // Set selected branch if we have one in the URL
                        if (router.query.id) {
                            const currentBranch = branches.find(b => b.value === router.query.id);
                            if (currentBranch) {
                                setSelectedNavBranch(currentBranch);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching navigation branches:', error);
                }
            }
        };
        
        fetchNavBranches();
    }, [effectiveFilter, currentUser?.role?.rep, router.query.id]);

    // NEW: Fetch navigation LO list when viewing groups
    useEffect(() => {
        const fetchNavLOs = async () => {
            if (effectiveFilter === 'group') {
                const branchId = router.query.parentId || currentUser?.designatedBranchId;
                
                if (!branchId) return;
                
                try {
                    // Get the branch code first
                    let branchCode = null;
                    if (branchList.length > 0) {
                        const branch = branchList.find(b => b._id === branchId);
                        branchCode = branch?.code;
                    }
                    
                    if (!branchCode) {
                        // Fetch branch details if we don't have it in list
                        const branchResponse = await fetchWrapper.get(
                            getApiBaseUrl() + `branches?_id=${branchId}`
                        );
                        if (branchResponse.success && branchResponse.branch) {
                            branchCode = branchResponse.branch.code;
                        }
                    }
                    
                    if (!branchCode) return;
                    
                    const params = new URLSearchParams({
                        branchCode: branchCode
                    });
                    
                    const response = await fetchWrapper.get(
                        getApiBaseUrl() + 'users/list?' + params.toString()
                    );
                    
                    if (response.success) {
                        const los = response.users
                            .filter(u => u.role.rep === 4)
                            .map(u => ({
                                value: u._id,
                                label: `${u.loNo || ''} - ${u.firstName} ${u.lastName}`.trim(),
                                loNo: u.loNo || 0
                            }))
                            .sort((a, b) => a.loNo - b.loNo);
                        setNavLoList(los);
                        
                        // Set selected LO if we have one in the URL
                        if (router.query.id) {
                            const currentLO = los.find(lo => lo.value === router.query.id);
                            if (currentLO) {
                                setSelectedNavLO(currentLO);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching navigation LO list:', error);
                }
            }
        };
        
        fetchNavLOs();
    }, [effectiveFilter, router.query.parentId, router.query.id, currentUser?.designatedBranchId, branchList]);
    
    // Determine filter level based on user role
    useEffect(() => {
        if (currentUser?.role) {
            const hasEditPermission = (currentUser.role.rep === 1 || currentUser.role.shortCode === 'cashier') && currentDate === dateFilter;
            setCanEdit(hasEditPermission);
            
            if (currentUser.role.rep <= 2 || (currentUser.role.shortCode === 'cashier' && !currentUser.designatedBranchId)) {
                setFilter('branch');
            } else if (currentUser.role.rep === 3) {
                setFilter('lo');
                fetchLOList();
            } else if (currentUser.role.rep === 4) {
                setFilter('group');
                fetchGroupList();
            }
        }
    }, [currentUser?.role, currentDate, dateFilter]);
    
    // Sync selectedLO with router query when at group level (for branch managers)
    useEffect(() => {
        if (currentUser?.role?.rep === 3 && router.query.filter === 'group' && router.query.id && loList.length > 0) {
            const currentLO = loList.find(lo => lo.value === router.query.id);
            if (currentLO && (!selectedLO || selectedLO.value !== currentLO.value)) {
                setSelectedLO(currentLO);
            }
        }
    }, [router.query.filter, router.query.id, loList, currentUser?.role?.rep]);
    
    // Fetch LO list for branch managers
    const fetchLOList = async () => {
        try {
            const params = new URLSearchParams({
                branchCode: currentUser.designatedBranch
            });
            
            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'users/list?' + params.toString()
            );
            
            if (response.success) {
                const los = response.users
                    .filter(u => u.role.rep === 4)
                    .map(u => ({
                        value: u._id,
                        label: `LO${u.loNo || ''} - ${u.firstName} ${u.lastName}`.trim(),
                        loNo: u.loNo || 0
                    }))
                    .sort((a, b) => a.loNo - b.loNo);
                setLoList(los);
                
                // If we're at group level with a router.query.id, set the selected LO
                if (router.query.filter === 'group' && router.query.id) {
                    const currentLO = los.find(lo => lo.value === router.query.id);
                    if (currentLO) {
                        setSelectedLO(currentLO);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching LO list:', error);
            toast.error('Error loading loan officers');
        }
    };
    
    // Fetch group list for loan officers
    const fetchGroupList = async () => {
        try {
            const params = new URLSearchParams({
                loId: currentUser._id,
                mode: 'all'
            });
            
            const response = await fetchWrapper.get(
                getApiBaseUrl() + 'groups/list?' + params.toString()
            );
            
            if (response.success) {
                const groups = response.groups
                    .map(g => ({
                        value: g._id,
                        label: g.name
                    }))
                    .sort((a, b) => {
                        const groupNoA = response.groups.find(g => g._id === a.value)?.groupNo || 0;
                        const groupNoB = response.groups.find(g => g._id === b.value)?.groupNo || 0;
                        return groupNoA - groupNoB;
                    });
                setGroupList(groups);
            }
        } catch (error) {
            console.error('Error fetching group list:', error);
            toast.error('Error loading groups');
        }
    };
    
    // Fetch client data for a specific group
    const fetchClientData = async (groupId, groupName) => {
        setClientModalLoading(true);
        setShowClientModal(true);
        setSelectedGroupForClients({ id: groupId, name: groupName });
        
        try {
            const params = new URLSearchParams({
                dateAdded: dateFilter,
                currentDate: dateFilter,
                filter: 'client',
                groupId: groupId,
                _name: 'get_cash_collections_page_data'
            });
            
            const protocol = window.location.protocol;
            const host = window.location.host;
            const apiUrl = `${protocol}//${host}/api/v2/data/get_cash_collections_page_data?${params.toString()}`;
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.data) {
                const filteredData = response.data.filter(client => 
                    client._id !== '_total' && 
                    client.name !== '_total' &&
                    client.code !== '_total' &&
                    !(client.activeBorrowers == 0 && client.activeClients == 0 && client.totalLoanBalance == 0) &&
                    !(client.totalLoanBalance == 0 && (client.actualLoanCollection == null || client.actualLoanCollection == 0)) &&
                    !(client.actualLoanCollection != null && client.actualLoanCollection != 0)
                );
                
                setClientData(filteredData);
            } else {
                toast.error('No client data found');
                setClientData([]);
            }
        } catch (error) {
            console.error('Error fetching client data:', error);
            toast.error('Error loading client data');
            setClientData([]);
        } finally {
            setClientModalLoading(false);
        }
    };
    
    // Close client modal
    const handleCloseClientModal = () => {
        setShowClientModal(false);
        setClientData([]);
        setSelectedGroupForClients(null);
    };
    
    // Fetch initial data from cash collections API
    const fetchInitialData = async () => {
        const currentEffectiveFilter = router.query.filter || filter;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                date: dateFilter,
                filter: currentEffectiveFilter,
                userId: currentUser._id
            });
            
            if (router.query.id && router.query.filter) {
                if (router.query.filter === 'lo') {
                    // At LO level - viewing LOs for a branch
                    params.append('branchId', router.query.id);
                } else if (router.query.filter === 'group') {
                    // At GROUP level - viewing groups for an LO
                    params.append('loId', router.query.id);
                    // Don't add branchId - loId is more specific
                }
            } else {
                if (currentEffectiveFilter === 'branch') {
                    if (selectedBranch) {
                        params.append('branchId', selectedBranch.value);
                    } else if (currentUser?.designatedBranchId && currentUser.designatedBranchId !== '') {
                        params.append('branchId', currentUser.designatedBranchId);
                    }
                } else if (currentEffectiveFilter === 'lo') {
                    if (currentUser.designatedBranchId) {
                        params.append('branchId', currentUser.designatedBranchId);
                    }
                    if (selectedLO) {
                        params.append('loId', selectedLO.value);
                    }
                } else if (currentEffectiveFilter === 'group') {
                    if (currentUser._id) {
                        params.append('loId', currentUser._id);
                    }
                    if (selectedGroup) {
                        params.append('groupId', selectedGroup.value);
                    }
                }
            }
            
            const url = getApiBaseUrl() + 'transactions/denomination/get-initial-data?' + params.toString();
            console.log('Fetching initial data:', url);
            
            const response = await fetchWrapper.get(url);
            if (response.success) {
                setInitialData(response.data || []);
                
                if (response.parentName) {
                    setParentEntityName(response.parentName);
                }
                
                await fetchDenominationData();
            } else {
                console.error('API returned error:', response.message);
                toast.error(response.message || 'Error loading initial data');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error(`Error loading data: ${error.message || error}`);
            setLoading(false);
        }
    };
    
    // Fetch existing denomination data
    const fetchDenominationData = async () => {
        try {
            const params = new URLSearchParams({
                date: dateFilter
            });
            
            const currentEffectiveFilter = router.query.filter || filter;
            
            let shouldAddBranchFilter = false;
            let shouldAddLoFilter = false;
            let shouldAddGroupFilter = false;
            let branchIdToUse = null;
            let loIdToUse = null;
            let groupIdToUse = null;
            
            if (router.query.id && router.query.filter) {
                if (router.query.filter === 'lo') {
                    // At LO level viewing groups for a branch - filter by branch
                    branchIdToUse = router.query.id;
                    shouldAddBranchFilter = true;
                } else if (router.query.filter === 'group') {
                    // At GROUP level viewing groups for an LO - filter by LO only (no need for branch)
                    loIdToUse = router.query.id;
                    shouldAddLoFilter = true;
                    // Don't add branch filter - LO filter is more specific
                }
            } 
            else {
                if (currentUser.role.rep === 3 && currentUser.designatedBranchId) {
                    branchIdToUse = currentUser.designatedBranchId;
                    shouldAddBranchFilter = true;
                }
                
                else if (currentUser.role.shortCode === 'cashier' && currentUser.designatedBranchId) {
                    branchIdToUse = currentUser.designatedBranchId;
                    shouldAddBranchFilter = true;
                }
                
                else if (currentUser.role.rep === 4 && currentUser._id) {
                    loIdToUse = currentUser._id;
                    shouldAddLoFilter = true;
                }
                
                if (!shouldAddBranchFilter && selectedBranch?.value) {
                    branchIdToUse = selectedBranch.value;
                    shouldAddBranchFilter = true;
                }
                
                if (!shouldAddLoFilter && selectedLO?.value) {
                    loIdToUse = selectedLO.value;
                    shouldAddLoFilter = true;
                }
                
                if (!shouldAddGroupFilter && selectedGroup?.value) {
                    groupIdToUse = selectedGroup.value;
                    shouldAddGroupFilter = true;
                }
            }
            
            // Only add the most specific filter needed
            // Priority: groupId > loId > branchId
            if (shouldAddGroupFilter && groupIdToUse) {
                params.append('groupId', groupIdToUse);
            } else if (shouldAddLoFilter && loIdToUse) {
                params.append('loId', loIdToUse);
            } else if (shouldAddBranchFilter && branchIdToUse) {
                params.append('branchId', branchIdToUse);
            }
            
            const url = getApiBaseUrl() + 'transactions/denomination/get-denomination?' + params.toString();
            console.log('Fetching denomination data:', url);
            
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                console.log('Denomination data fetched:', response.data?.length, 'records');
                setDenominationData(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching denomination data:', error);
        } finally {
            setLoading(false);
        }
    };
    
    // Merge initial data with saved denomination data
    const getMergedData = () => {
        return initialData
            .filter(item => item.entityId !== '_total')
            .map(item => {
                const savedData = denominationData.find(d => 
                    (d.branch_id === item.entityId || d.lo_id === item.entityId || d.group_id === item.entityId)
                );

                // Calculate aggregated morning remittances for branch/LO level
                let totalMorningRemittance = 0;
                let totalAfternoonRemittance = 0;
                if (effectiveFilter !== 'group') {
                    const matchingRecords = denominationData.filter(d => {
                        return d.lo_id === item.entityId || d.branch_id === item.entityId
                    });

                    matchingRecords.forEach(record => {
                        totalMorningRemittance += parseFloat(record.morning_remittance) || 0;
                        totalAfternoonRemittance += parseFloat(record.afternoon_remittance) || 0;
                    });
                }
                
                // Determine current remittance values
                const currentMorningRemittance = totalMorningRemittance != 0 
                    ? totalMorningRemittance 
                    : morningRemittanceChanges[item.entityId] !== undefined 
                    ? parseFloat(morningRemittanceChanges[item.entityId]) || 0
                    : savedData?.morning_remittance || 0;

                const currentAfternoonRemittance = totalAfternoonRemittance != 0
                    ? totalAfternoonRemittance
                    : afternoonRemittanceChanges[item.entityId] !== undefined
                    ? parseFloat(afternoonRemittanceChanges[item.entityId]) || 0
                    : savedData?.afternoon_remittance || 0;
                
                const wasApproved = savedData?.approval_date && savedData?.status === 'draft';
                const collectionChanged = wasApproved && 
                    savedData?.total_net_collection !== item.totalNetCollection;

                const bccVsRemittances = calculateBccVsRemittances(
                    item.totalNetCollection,
                    currentMorningRemittance,
                    currentAfternoonRemittance
                );

                const noSitDown = savedData?.no_sit_down !== undefined && savedData?.no_sit_down !== null 
                    ? savedData.no_sit_down 
                    : (item.noSitDown || 0);
                    
                const amountSitDown = savedData?.amount_sit_down !== undefined && savedData?.amount_sit_down !== null
                    ? savedData.amount_sit_down 
                    : (item.amountSitDown || 0);
                
                return {
                    ...item,
                    noSitDown: noSitDown,     
                    amountSitDown: amountSitDown, 
                    savedMorningRemittance: savedData?.morning_remittance || 0,
                    savedAfternoonRemittance: savedData?.afternoon_remittance || 0,
                    currentMorningRemittance: currentMorningRemittance,
                    currentAfternoonRemittance: currentAfternoonRemittance,
                    status: savedData?.status || 'draft',
                    _id: savedData?._id,
                    wasApproved: wasApproved,
                    collectionChanged: collectionChanged,
                    approval_date: savedData?.approval_date,
                    history: savedData?.history || [],
                    bccVsRemittances: bccVsRemittances,
                    // NEW: Include remarks
                    remarks: remarksChanges[item.entityId] !== undefined 
                        ? remarksChanges[item.entityId] 
                        : (savedData?.remarks || ''),
                    savedRemarks: savedData?.remarks || ''
                };
            });
    };

    
    // Handle morning remittance change
    const handleMorningRemittanceChange = (entityId, value) => {
        let cleanedValue = value.replace(/[^0-9.-]/g, '');
        
        setMorningRemittanceChanges(prev => ({
            ...prev,
            [entityId]: cleanedValue
        }));
    };

    // Handle afternoon remittance change
    const handleAfternoonRemittanceChange = (entityId, value) => {
        let cleanedValue = value.replace(/[^0-9.-]/g, '');
        
        setAfternoonRemittanceChanges(prev => ({
            ...prev,
            [entityId]: cleanedValue
        }));
    };

    // NEW: Handle remarks change
    const handleRemarksChange = (entityId, value) => {
        setRemarksChanges(prev => ({
            ...prev,
            [entityId]: value
        }));
    };

    // Handle morning remittance validation on blur
    const handleMorningRemittanceBlur = (entityId) => {
        const item = initialData.find(i => i.entityId === entityId);
        if (!item) return;
        
        // Get the raw string value first
        const rawValue = morningRemittanceChanges[entityId];
        
        // If the value is empty or just being typed, don't validate yet
        if (rawValue === undefined || rawValue === '' || rawValue === '-') {
            return;
        }
        
        const currentValue = parseFloat(rawValue) || 0;
        const afternoonValue = parseFloat(afternoonRemittanceChanges[entityId]) || 0;
        
        const totalRemittance = currentValue + afternoonValue;
        const expectedTotal = item.totalNetCollection || 0;
        
        // Only validate and auto-adjust if the value seems complete
        // (not just a single digit being typed)
        const isCompleteValue = rawValue.length > 0 && !rawValue.endsWith('.');
        
        if (!isCompleteValue) {
            return; // Don't validate while still typing
        }
        
        // If totalNetCollection is negative, allow negative remittances
        if (item.totalNetCollection < 0) {
            // Only show warning, don't auto-adjust
            if (totalRemittance !== expectedTotal) {
                toast.warning(`Total remittances should equal net collection of ${formatPrice(expectedTotal)}`);
            }
        } else {
            // For positive/zero collections, don't allow negative remittances
            if (currentValue < 0) {
                toast.warning('Morning remittance cannot be negative when net collection is positive');
                setMorningRemittanceChanges(prev => ({
                    ...prev,
                    [entityId]: 0
                }));
            } else if (totalRemittance > expectedTotal) {
                // Only prevent exceeding, don't force exact match
                toast.warning(`Total remittances (${formatPrice(totalRemittance)}) cannot exceed net collection (${formatPrice(expectedTotal)})`);
            }
        }
    };

    // Handle afternoon remittance validation on blur
    const handleAfternoonRemittanceBlur = (item, currentBccVsRemittances) => {
        if (!item) return;
        const entityId = item.entityId;

        // Get the raw string value first
        const rawValue = afternoonRemittanceChanges[entityId];
        
        // If the value is empty or just being typed, don't validate yet
        if (rawValue === undefined || rawValue === '' || rawValue === '-') {
            return;
        }

        const morningValue = parseFloat(morningRemittanceChanges[entityId]) || 0;
        const currentValue = parseFloat(rawValue) || 0;
        
        const totalRemittance = morningValue + currentValue;
        const expectedTotal = item.totalNetCollection || 0;

        console.log('BCC vs Remittances on Afternoon Blur:', currentBccVsRemittances);
        
        // Only validate and auto-adjust if the value seems complete
        const isCompleteValue = rawValue.length > 0 && !rawValue.endsWith('.');
        
        if (!isCompleteValue) {
            return; // Don't validate while still typing
        }
        
        // If totalNetCollection is negative, allow negative remittances
        if (item.totalNetCollection < 0) {
            // Only show warning, don't auto-adjust
            if (totalRemittance !== expectedTotal) {
                toast.warning(`Total remittances should equal net collection of ${formatPrice(expectedTotal)}`);
            }
        } else {
            // For positive/zero collections, don't allow negative remittances
            // it should allow less than zero if bccVsRemittances is negative
            // also it should allow the cashier to adjust the afternoon remittance if bccVsRemittances is not zero even it's approved
            if (currentValue < 0) {
                toast.warning('Afternoon remittance cannot be negative when net collection is positive');
                setAfternoonRemittanceChanges(prev => ({
                    ...prev,
                    [entityId]: 0
                }));
            } else if (totalRemittance > expectedTotal) {
                // Only prevent exceeding, don't force exact match
                toast.warning(`Total remittances (${formatPrice(totalRemittance)}) cannot exceed net collection (${formatPrice(expectedTotal)})`);
            }
        }
    };
    
    // Calculate BCC vs Remittances (morning + afternoon)
    const calculateBccVsRemittances = (totalNetCollection, morningRemittance, afternoonRemittance) => {
        const netCollection = parseFloat(totalNetCollection) || 0;
        const morning = parseFloat(morningRemittance) || 0;
        const afternoon = parseFloat(afternoonRemittance) || 0;
        
        return netCollection - (morning + afternoon);
    };
    
    // Handle date change
    const handleDateChange = (e) => {
        setDateFilter(e.target.value);
    };
    
    // Handle row click for navigation
    const handleRowClick = (item) => {
        const currentEffectiveFilter = router.query.filter || filter;
        
        let nextFilter = '';
        let updatedQuery = {
            date: dateFilter
        };
        
        if (currentEffectiveFilter === 'branch') {
            nextFilter = 'lo';
            updatedQuery.id = item.entityId;
            updatedQuery.filter = nextFilter;
        } else if (currentEffectiveFilter === 'lo') {
            nextFilter = 'group';
            updatedQuery.id = item.entityId;
            updatedQuery.filter = nextFilter;
            
            if (router.query.id) {
                updatedQuery.parentId = router.query.id;
            } else if (currentUser.designatedBranchId) {
                updatedQuery.parentId = currentUser.designatedBranchId;
            }
        } else if (currentEffectiveFilter === 'group') {
            return;
        }
        
        router.push({
            pathname: router.pathname,
            query: updatedQuery
        }, undefined, { shallow: true });
        
        setViewingNestedContent(true);
    };
    
    // NEW: Handle back navigation - improved version similar to ModernBranchCashCollections
    const handleBackNavigation = () => {
        // From group level, go back to LO level
        if (effectiveFilter === 'group') {
            // For branch managers (rep 3), go back to their LO list without id param
            if (currentUser?.role?.rep === 3) {
                router.push({
                    pathname: router.pathname,
                    query: { 
                        date: dateFilter
                    }
                }, undefined, { shallow: true });
                setSelectedLO(null);
                return;
            }
            
            // For other users with parentId, navigate back to LO level
            if (router.query.parentId) {
                router.push({
                    pathname: router.pathname,
                    query: { 
                        date: dateFilter, 
                        filter: 'lo',
                        id: router.query.parentId,
                    }
                }, undefined, { shallow: true });
                setSelectedNavLO(null);
                return;
            }
        }
        
        // From LO level, go back to branch level (only for admin users)
        if (effectiveFilter === 'lo' && router.query.id) {
            // Check if user is admin/CEO level
            if (currentUser?.role?.rep <= 2) {
                router.push({
                    pathname: router.pathname,
                    query: { 
                        date: dateFilter, 
                        filter: 'branch'
                    }
                }, undefined, { shallow: true });
                setSelectedNavBranch(null);
            } else {
                // For branch managers, just clear the navigation
                router.push({
                    pathname: router.pathname,
                    query: { 
                        date: dateFilter
                    }
                }, undefined, { shallow: true });
            }
            return;
        }
        
        // Default: go to base view
        router.push({
            pathname: router.pathname,
            query: { 
                date: dateFilter
            }
        }, undefined, { shallow: true });
    };

    // NEW: Handle navigation branch filter change
    const handleNavBranchChange = (selected) => {
        setSelectedNavBranch(selected);
        setSelectedNavLO(null); // Reset LO selection
        
        if (selected) {
            router.push({
                pathname: router.pathname,
                query: { 
                    date: dateFilter, 
                    filter: 'lo',
                    id: selected.value,
                }
            }, undefined, { shallow: true });
        }
    };

    // NEW: Handle navigation LO filter change
    const handleNavLOChange = (selected) => {
        setSelectedNavLO(selected);
        
        if (selected) {
            const parentId = router.query.parentId || currentUser?.designatedBranchId;
            router.push({
                pathname: router.pathname,
                query: { 
                    date: dateFilter, 
                    filter: 'group',
                    id: selected.value,
                    parentId: parentId,
                }
            }, undefined, { shallow: true });
        }
    };
    
    // Handle refresh
    const handleRefresh = () => {
        fetchInitialData();
    };

    // UPDATED: Check if item has changes in morning, afternoon remittance, or remarks
    const isItemDirty = (item) => {
        const hasMorningChange = morningRemittanceChanges.hasOwnProperty(item.entityId) &&
            parseFloat(morningRemittanceChanges[item.entityId]) !== parseFloat(item.savedMorningRemittance || 0);
        
        const hasAfternoonChange = afternoonRemittanceChanges.hasOwnProperty(item.entityId) &&
            parseFloat(afternoonRemittanceChanges[item.entityId]) !== parseFloat(item.savedAfternoonRemittance || 0);
        
        const hasRemarksChange = remarksChanges.hasOwnProperty(item.entityId) &&
            remarksChanges[item.entityId] !== item.savedRemarks;
        
        return hasMorningChange || hasAfternoonChange || hasRemarksChange;
    };

    // NEW: Check if item is a Venus correction (over-remittance that needs fixing)
    const isVenusCorrection = (item) => {
        return item.status === 'approved' && 
            item.bccVsRemittances < 0 && 
            (item.savedAfternoonRemittance === 0 || item.savedAfternoonRemittance === null);
    };

    // Get count of dirty items
    const getDirtyItemsCount = () => {
        const mergedData = getMergedData();
        return mergedData.filter(item => {
            if (item.totalNetCollection < 0) {
                return isItemDirty(item);
            }
            
            if (!item.hasCollection) return false;
            
            const currentMorning = item.currentMorningRemittance || 0;
            const currentAfternoon = item.currentAfternoonRemittance || 0;
            
            if (currentMorning <= 0 && currentAfternoon <= 0) return false;
            
            return isItemDirty(item);
        }).length;
    };
    
    // UPDATED: Submit handler to include remarks
    const handleSubmit = async () => {
        if (!canEdit && currentUser.role.rep !== 1) {
            toast.error('You do not have permission to submit');
            return;
        }
        
        setLoading(true);
        try {
            const mergedData = getMergedData();
            
            const itemsToSave = mergedData
                .filter(item => {
                    const isDirty = isItemDirty(item);
                    if (!isDirty) return false;
                    
                    if (item.totalNetCollection < 0) {
                        return true;
                    }
                    
                    if (!item.hasCollection) return false;
                    
                    const currentMorning = item.currentMorningRemittance || 0;
                    const currentAfternoon = item.currentAfternoonRemittance || 0;
                    
                    if (currentMorning <= 0 && currentAfternoon <= 0) return false;
                    
                    return true;
                })
                .map(item => ({
                    entityId: item.entityId,
                    entityName: item.entityName,
                    entityType: item.entityType,
                    activeClients: item.activeClients,
                    totalNetCollection: item.totalNetCollection,
                    morningRemittance: item.currentMorningRemittance || 0,
                    afternoonRemittance: item.currentAfternoonRemittance || 0,
                    amountSitDown: item.amountSitDown || 0,
                    noSitDown: item.noSitDown || 0,
                    remarks: item.remarks || '',
                    // NEW: Flag for Venus correction (over-remittance fix)
                    isCorrection: isVenusCorrection(item) && morningRemittanceChanges.hasOwnProperty(item.entityId),
                    previousMorningRemittance: item.savedMorningRemittance || 0
                }));
            
            if (itemsToSave.length === 0) {
                toast.warning('No changes to submit. Please modify remittance amounts before submitting.');
                setLoading(false);
                return;
            }
            
            const groupsWithCollection = mergedData.filter(item => 
                item.entityType === 'group' && 
                item.hasCollection && 
                item.totalNetCollection > 0
            );
            
            const missingRemittances = [];
            
            for (const item of groupsWithCollection) {
                const currentMorning = morningRemittanceChanges[item.entityId] !== undefined 
                    ? morningRemittanceChanges[item.entityId] 
                    : (item.savedMorningRemittance || 0);
                
                const currentAfternoon = afternoonRemittanceChanges[item.entityId] !== undefined
                    ? afternoonRemittanceChanges[item.entityId]
                    : (item.savedAfternoonRemittance || 0);
                
                if ((currentMorning === 0 || currentMorning === '') && 
                    (currentAfternoon === 0 || currentAfternoon === '')) {
                    missingRemittances.push({
                        entityName: item.entityName,
                        totalNetCollection: item.totalNetCollection
                    });
                }
            }
            
            if (missingRemittances.length > 0 && currentUser.role.rep !== 1) {
                toast.error('Cannot submit: All groups with collections must have remittances entered', {
                    autoClose: 8000
                });
                
                const groupsToShow = missingRemittances.slice(0, 3);
                groupsToShow.forEach(group => {
                    toast.warning(
                        `${group.entityName}: Has collection of ${formatPrice(group.totalNetCollection)} but no remittance entered`,
                        { autoClose: 6000 }
                    );
                });
                
                if (missingRemittances.length > 3) {
                    toast.info(`... and ${missingRemittances.length - 3} more groups with missing remittances`);
                }
                
                setLoading(false);
                return;
            }
            
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/denomination/batch-save',
                {
                    items: itemsToSave,
                    date: dateFilter,
                    isSubmission: true,
                    isAdminAdjustment: currentUser.role.rep === 1  // NEW: Flag for admin adjustments
                }
            );
            
            if (response.success) {
                const results = response.results || {};
                const success = results.success || [];
                const reopened = results.reopened || [];
                const failed = results.failed || [];
                if (failed.length > 0 && (success.length > 0 || reopened.length > 0)) {
                    let warningMessage = `Some records failed to save:`;
                    failed.forEach(failure => {
                        warningMessage += `\n- ${failure.entityName}: ${failure.error}`;
                    });
                    toast.warning(warningMessage, { autoClose: 8000 });
                } else if (failed.length > 0 && (success.length === 0 || reopened.length === 0)) {
                    let errorMessage = `All records failed to save:`;
                    failed.forEach(failure => {
                        errorMessage += `\n- ${failure.entityName}: ${failure.error}`;
                    });
                    toast.error(errorMessage, { autoClose: 8000 });
                }

                if (success.length > 0 || reopened.length > 0) {
                    const actionType = currentUser.role.rep === 1 ? 'Admin adjustment' : 'Denomination record(s)';
                    toast.success(response.message || `${itemsToSave.length} ${actionType} submitted successfully`);
                    setMorningRemittanceChanges({});
                    setAfternoonRemittanceChanges({});
                    setRemarksChanges({});  // NEW: Clear remarks changes
                    await fetchInitialData();
                }
            } else {
                if (response.validationError && response.missingRemittances) {
                    toast.error(response.message, { autoClose: 8000 });
                    
                    const groupsToShow = response.missingRemittances.slice(0, 3);
                    groupsToShow.forEach(group => {
                        toast.warning(
                            `${group.name}: Has collection of ${formatPrice(group.collection)} but no remittance entered`,
                            { autoClose: 6000 }
                        );
                    });
                    
                    if (response.missingRemittances.length > 3) {
                        toast.info(`... and ${response.missingRemittances.length - 3} more groups with missing remittances`);
                    }
                } else {
                    const { results, summary } = response;
                    
                    if (summary) {
                        if (summary.successful > 0 || summary.reopened > 0) {
                            toast.success(`${summary.successful + summary.reopened} records saved successfully`);
                        }
                        
                        if (summary.failed > 0) {
                            toast.error(`${summary.failed} records failed to save`);
                            
                            if (results.failed && results.failed.length > 0) {
                                results.failed.slice(0, 3).forEach(failure => {
                                    toast.error(`${failure.entityName}: ${failure.error}`, {
                                        autoClose: 5000
                                    });
                                });
                                
                                if (results.failed.length > 3) {
                                    toast.info(`... and ${results.failed.length - 3} more errors`);
                                }
                            }
                        }
                        
                        if (summary.reopened > 0 && results.reopened) {
                            results.reopened.forEach(reopened => {
                                toast.info(`${reopened.entityName}: ${reopened.message}`, {
                                    autoClose: 5000
                                });
                            });
                        }
                    } else {
                        toast.error(response.message || 'Error saving denomination data');
                    }
                    
                    if (summary && (summary.successful > 0 || summary.reopened > 0)) {
                        setMorningRemittanceChanges({});
                        setAfternoonRemittanceChanges({});
                        setRemarksChanges({});  // NEW: Clear remarks changes
                        await fetchInitialData();
                    }
                }
            }
        } catch (error) {
            console.error('Error submitting:', error);
            toast.error(`Error submitting data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    // Handle approve action
    const handleApprove = async (item) => {
        if (!item._id) {
            toast.error('No saved data to approve');
            return;
        }
        
        setLoading(true);
        try {
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/denomination/approve',
                {
                    denominationId: item._id,
                    approvedBy: currentUser._id,
                    date: dateFilter,
                    userRole: currentUser.role.rep,
                }
            );
            
            if (response.success) {
                toast.success('Denomination data approved successfully');
                await fetchInitialData();
            } else {
                toast.error(response.message || 'Error approving data');
            }
        } catch (error) {
            console.error('Error approving:', error);
            toast.error('Error approving data');
        } finally {
            setLoading(false);
        }
    };
    
    // Handle reject action - opens modal
    const handleRejectClick = (item) => {
        if (!item._id) {
            toast.error('No saved data to reject');
            return;
        }
        setRejectingItem(item);
        setRejectionReason('');
        setShowRejectModal(true);
    };
    
    // Handle reject submit from modal
    const handleRejectSubmit = async () => {
        if (!rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        
        setLoading(true);
        setShowRejectModal(false);
        
        try {
            const response = await fetchWrapper.put(
                getApiBaseUrl() + 'transactions/denomination/approve',
                {
                    id: rejectingItem._id,
                    rejectedBy: currentUser._id,
                    rejectionReason: rejectionReason.trim(),
                    date: dateFilter,
                    userRole: currentUser.role.rep,
                }
            );
            
            if (response.success) {
                toast.success('Denomination data rejected');
                await fetchInitialData();
            } else {
                toast.error(response.message || 'Error rejecting data');
            }
        } catch (error) {
            console.error('Error rejecting:', error);
            toast.error('Error rejecting data');
        } finally {
            setLoading(false);
            setRejectingItem(null);
            setRejectionReason('');
        }
    };
    
    // Handle cancel reject modal
    const handleCancelReject = () => {
        setShowRejectModal(false);
        setRejectingItem(null);
        setRejectionReason('');
    };
    
    // Load data when dependencies change
    useEffect(() => {
        const currentEffectiveFilter = router.query.filter || filter;
        
        if (!currentUser || !currentUser.role) {
            setLoading(false);
            return;
        }
        
        let canFetch = false;
        
        if (router.query.id && router.query.filter) {
            canFetch = true;
        } else {
            if (currentUser.role.rep <= 2) {
                if (currentEffectiveFilter === 'branch') {
                    canFetch = true;
                }
            } else if (currentUser.role.rep === 3) {
                if (currentUser.role.shortCode === 'cashier' && 
                    (!currentUser.designatedBranchId || currentUser.designatedBranchId === '')) {
                    if (currentEffectiveFilter === 'branch') {
                        canFetch = true;
                    }
                } else if (currentUser.designatedBranchId && currentEffectiveFilter === 'lo') {
                    canFetch = true;
                }
            } else if (currentUser.role.rep === 4) {
                canFetch = true;
            }
        }
        
        if (canFetch) {
            const timeoutId = setTimeout(() => {
                fetchInitialData();
                setIsInitialized(true);
            }, 300);
            
            return () => clearTimeout(timeoutId);
        } else {
            setLoading(false);
        }
        
    }, [dateFilter, selectedBranch, selectedLO, selectedGroup, filter, currentUser?.role, currentUser?.designatedBranchId, currentUser?._id, router.query.id, router.query.filter]);
    
    const mergedData = getMergedData();

    const showStatusColumn = effectiveFilter === 'group';
    const showActionsColumn = effectiveFilter === 'group';
    const userCanApproveReject = (currentUser.role.rep === 3 || currentUser.role.rep === 4) && 
                                currentUser.role.shortCode !== 'cashier';

    // UPDATED: Admin edit permissions - allow editing regardless of BCC balance, date, or status
    const canAdminEdit = (item) => {
        // Only for role.rep = 1 (admin/CEO level)
        if (currentUser.role.rep !== 1) return false;
        
        // Only at group level
        if (effectiveFilter !== 'group') return false;
        
        // Admin can edit regardless of date, status, BCC balance, or existing values
        return true;
    };

    // UPDATED: Check if morning remittance should show input
    const shouldShowMorningRemittanceInput = (item) => {
        // Admin can always edit at group level
        if (canAdminEdit(item)) {
            return true;
        }
        
        // Original cashier logic
        if (currentUser.role.shortCode !== 'cashier') return false;
        if (effectiveFilter !== 'group') return false;
        if (dateFilter !== currentDate) return false;
        
        // Allow editing if rejected
        if (item.status === 'rejected') return true;
        
        // Check if user is currently editing this field (has unsaved changes)
        const isCurrentlyEditing = morningRemittanceChanges.hasOwnProperty(item.entityId);
        
        // NEW: Venus scenario - Allow editing morning remittance if:
        // - BCC vs Remittances is negative (over-remitted)
        // - No afternoon remittance has been entered yet
        // - Status is approved (needs correction)
        if (item.status === 'approved') {
            const currentMorning = morningRemittanceChanges[item.entityId] !== undefined 
                ? parseFloat(morningRemittanceChanges[item.entityId]) || 0
                : item.savedMorningRemittance || 0;
            const currentAfternoon = afternoonRemittanceChanges[item.entityId] !== undefined
                ? parseFloat(afternoonRemittanceChanges[item.entityId]) || 0
                : item.savedAfternoonRemittance || 0;
            const bccVsRemittances = calculateBccVsRemittances(item.totalNetCollection, currentMorning, currentAfternoon);
            
            // If BCC is negative and no afternoon remittance, allow morning correction
            if (bccVsRemittances < 0 && currentAfternoon === 0) {
                return true;
            }
            
            if (bccVsRemittances === 0 && !isCurrentlyEditing) return false;
        }
        
        // Show input if collection is negative or if BCC needs balancing
        if (item.totalNetCollection < 0) {
            return item.status === 'draft' || item.status === 'pending' || item.status === 'approved';
        }
        
        // Don't show if there's no collection
        if (!item.hasCollection) return false;
        
        // Show if: no saved morning remittance yet OR user is currently editing
        return (item.savedMorningRemittance === 0 || item.savedMorningRemittance === null || isCurrentlyEditing) && 
            (item.status === 'draft' || item.status === 'pending' || item.bccVsRemittances > 0);
    };

    // UPDATED: Check if morning remittance input should be disabled
    const isMorningRemittanceDisabled = (item) => {
        // Admin is never disabled when they can edit
        if (canAdminEdit(item)) return false;
        
        // Don't disable if status is rejected (allow editing)
        if (item.status === 'rejected') return false;
        
        // NEW: Venus scenario - Don't disable if BCC is negative and no afternoon remittance
        if (item.status === 'approved') {
            const currentMorning = morningRemittanceChanges[item.entityId] !== undefined 
                ? parseFloat(morningRemittanceChanges[item.entityId]) || 0
                : item.savedMorningRemittance || 0;
            const currentAfternoon = afternoonRemittanceChanges[item.entityId] !== undefined
                ? parseFloat(afternoonRemittanceChanges[item.entityId]) || 0
                : item.savedAfternoonRemittance || 0;
            const bccVsRemittances = calculateBccVsRemittances(item.totalNetCollection, currentMorning, currentAfternoon);
            
            // If BCC is negative and no afternoon remittance, allow morning correction
            if (bccVsRemittances < 0 && currentAfternoon === 0) {
                return false;
            }
        }
        
        // Disable if there's already saved morning remittance data
        return item.savedMorningRemittance && item.savedMorningRemittance !== 0;
    };

    // UPDATED: Check if afternoon remittance should show input
    const shouldShowAfternoonRemittanceInput = (item) => {
        // Admin can always edit at group level
        if (canAdminEdit(item)) {
            return true;
        }
        
        // Original cashier logic
        if (currentUser.role.shortCode !== 'cashier') return false;
        if (effectiveFilter !== 'group') return false;
        if (dateFilter !== currentDate) return false;
        
        // Check if user is currently editing this field
        const isCurrentlyEditingAfternoon = afternoonRemittanceChanges.hasOwnProperty(item.entityId);
        
        // Don't allow if morning was saved but rejected and afternoon is 0
        if (item.savedMorningRemittance > 0 && item.savedAfternoonRemittance === 0 && item.status === 'rejected') {
            return false;
        }

        // Allow if both are saved and rejected
        if (item.savedMorningRemittance > 0 && item.savedAfternoonRemittance > 0 && item.status === 'rejected') {
            return true;
        }

        // UPDATED: Allow editing if there's saved morning remittance AND 
        // (status is approved with unbalanced BCC OR currently editing OR status is pending/draft with unbalanced BCC)
        return item.savedMorningRemittance > 0 && (
            (item.status === 'approved' && (item.bccVsRemittances !== 0 || isCurrentlyEditingAfternoon)) ||
            ((item.status === 'pending' || item.status === 'draft') && item.bccVsRemittances !== 0)
        );
    };

    // UPDATED: Check if afternoon remittance input should be disabled
    const isAfternoonRemittanceDisabled = (item) => {
        // Admin is never disabled when they can edit
        if (canAdminEdit(item)) return false;
        
        // Don't allow if morning was saved but rejected and afternoon is 0
        if (item.savedMorningRemittance > 0 && item.savedAfternoonRemittance === 0 && item.status === 'rejected') {
            return true;
        }

        // Allow if both are saved and rejected
        if (item.savedMorningRemittance > 0 && item.savedAfternoonRemittance > 0 && item.status === 'rejected') {
            return false;
        }

        return false;
    };
    
    const getFilterLabel = () => {
        if (effectiveFilter === 'branch') return 'Branch';
        if (effectiveFilter === 'lo') return 'Loan Officer';
        if (effectiveFilter === 'group') return 'Group';
        return '';
    };

    // Get back button text
    const getBackButtonText = () => {
        if (effectiveFilter === 'group') {
            return 'Back to Loan Officers';
        } else if (effectiveFilter === 'lo') {
            return 'Back to Branches';
        }
        return 'Back';
    };
    
    // UPDATED: Clear all changes including remarks
    useEffect(() => {
        setMorningRemittanceChanges({});
        setAfternoonRemittanceChanges({});
        setRemarksChanges({});  // NEW: Clear remarks
    }, [dateFilter, selectedBranch, selectedLO, selectedGroup]);

    const calculateGrandTotal = (data) => {
        const dataWithoutTotal = data.filter(item => item.entityId !== '_total');
        
        return {
            activeClients: dataWithoutTotal.reduce((sum, item) => sum + (item.activeClients || 0), 0),
            totalNetCollection: dataWithoutTotal.reduce((sum, item) => sum + (item.totalNetCollection || 0), 0),
            morningRemittance: dataWithoutTotal.reduce((sum, item) => sum + (item.currentMorningRemittance || 0), 0),
            noSitDown: dataWithoutTotal.reduce((sum, item) => sum + (item.noSitDown || 0), 0),
            amountSitDown: dataWithoutTotal.reduce((sum, item) => sum + (item.amountSitDown || 0), 0),
            afternoonRemittance: dataWithoutTotal.reduce((sum, item) => sum + (item.currentAfternoonRemittance || 0), 0),
        };
    };
    
    return (
        <Layout header={false} noPad={true}>
            <div className="flex flex-col h-full bg-gray-50">
                {/* Header Section */}
                <div className="bg-white shadow px-4 py-6 sm:px-6">
                    <h1 className="text-2xl font-semibold text-gray-900">Denomination Page</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {moment(dateFilter).format('dddd, MMMM DD, YYYY')}
                    </p>
                    
                    {/* NEW: Back Navigation - similar to ModernBranchCashCollections */}
                    {shouldShowBackButton() && (
                        <div className="mt-3 flex items-center">
                            <button
                                onClick={handleBackNavigation}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-900 flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                                <ChevronUp size={16} />
                                {getBackButtonText()}
                            </button>
                            
                            {parentEntityName && (
                                <span className="ml-3 text-sm text-gray-700">
                                    Viewing: <span className="font-medium">{parentEntityName}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Filters Section */}
                <div className="flex flex-wrap items-center justify-between p-3 sm:p-4 bg-white border-b border-gray-200 gap-3 sm:gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Date Filter */}
                        <div className="relative">
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={handleDateChange}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={loading}
                            />
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        </div>
                        
                        {/* Original Branch filter for admin users at branch level */}
                        {!router.query.id && effectiveFilter === 'branch' && currentUser.role.rep <= 2 && (
                            <div className="w-64">
                                <Select
                                    value={selectedBranch}
                                    onChange={(selected) => {
                                        setSelectedBranch(selected);
                                    }}
                                    options={branchList.map(b => ({
                                        value: b._id,
                                        label: b.name
                                    }))}
                                    placeholder="Filter by Branch (Optional)"
                                    isClearable
                                    isDisabled={loading}
                                    className="text-sm"
                                />
                            </div>
                        )}
                        
                        {/* NEW: Navigation Branch filter when viewing LOs */}
                        {effectiveFilter === 'lo' && currentUser.role.rep <= 2 && navBranchList.length > 0 && (
                            <div className="w-72">
                                <Select
                                    value={selectedNavBranch}
                                    onChange={handleNavBranchChange}
                                    options={navBranchList}
                                    placeholder="Select Branch to view LOs"
                                    isClearable={false}
                                    isDisabled={loading}
                                    className="text-sm"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderColor: '#6366f1',
                                            borderWidth: '2px',
                                            '&:hover': {
                                                borderColor: '#4f46e5'
                                            }
                                        })
                                    }}
                                />
                            </div>
                        )}
                        
                        {/* NEW: Navigation LO filter when viewing groups - for admin users only */}
                        {effectiveFilter === 'group' && currentUser.role.rep <= 2 && navLoList.length > 0 && (
                            <div className="w-72">
                                <Select
                                    value={selectedNavLO}
                                    onChange={handleNavLOChange}
                                    options={navLoList}
                                    placeholder="Select LO to view Groups"
                                    isClearable={false}
                                    isDisabled={loading}
                                    className="text-sm"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderColor: '#10b981',
                                            borderWidth: '2px',
                                            '&:hover': {
                                                borderColor: '#059669'
                                            }
                                        })
                                    }}
                                />
                            </div>
                        )}
                        
                        {/* LO filter for branch managers - only show when viewing groups */}
                        {effectiveFilter === 'group' && currentUser.role.rep === 3 && (
                            <div className="w-64">
                                <Select
                                    value={selectedLO}
                                    onChange={(selected) => {
                                        setSelectedLO(selected);
                                        // When LO is selected, update URL to show that LO's groups
                                        if (selected) {
                                            router.push({
                                                pathname: router.pathname,
                                                query: { 
                                                    date: dateFilter, 
                                                    filter: 'group',
                                                    id: selected.value,
                                                    parentId: currentUser.designatedBranchId,
                                                }
                                            }, undefined, { shallow: true });
                                        }
                                    }}
                                    options={loList}
                                    placeholder="Select Loan Officer"
                                    isClearable={false}
                                    isDisabled={loading}
                                    className="text-sm"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderColor: '#10b981',
                                            borderWidth: '2px',
                                            '&:hover': {
                                                borderColor: '#059669'
                                            }
                                        })
                                    }}
                                />
                            </div>
                        )}
                        
                        {/* Original Group filter for loan officers */}
                        {!router.query.id && effectiveFilter === 'group' && currentUser.role.rep === 4 && (
                            <div className="w-64">
                                <Select
                                    value={selectedGroup}
                                    onChange={setSelectedGroup}
                                    options={groupList}
                                    placeholder="Filter by Group (Optional)"
                                    isClearable
                                    isDisabled={loading}
                                    className="text-sm"
                                />
                            </div>
                        )}
                        
                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                            title="Refresh data"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    
                    {/* Submit Button */}
                    {((canEdit && router.query?.filter === "group") || (currentUser.role.rep === 1 && effectiveFilter === 'group')) && (
                        <div className="flex-shrink-0 flex items-center gap-3">
                            {getDirtyItemsCount() > 0 && (
                                <span className="text-sm text-gray-600">
                                    {getDirtyItemsCount()} unsaved change{getDirtyItemsCount() > 1 ? 's' : ''}
                                </span>
                            )}
                            <ButtonSolid
                                label={
                                    <div className="flex items-center gap-2">
                                        <Save size={18} />
                                        <span>
                                            {currentUser.role.rep === 1 ? 'Save Admin Adjustment' : 'Submit'} 
                                            {getDirtyItemsCount() > 0 ? ` (${getDirtyItemsCount()})` : ''}
                                        </span>
                                    </div>
                                }
                                onClick={handleSubmit}
                                disabled={loading || getDirtyItemsCount() === 0}
                                className="px-6 py-2 whitespace-nowrap"
                            />
                        </div>
                    )}
                </div>

                {/* Admin Balance Adjustment Info */}
                {currentUser.role.rep === 1 && effectiveFilter === 'group' && (
                    <div className="mx-4 mt-4 p-4 bg-purple-50 border-l-4 border-purple-500 rounded">
                        <div className="flex items-start">
                            <svg className="h-5 w-5 text-purple-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-purple-800">
                                    Admin Balance Adjustment Mode
                                </h3>
                                <p className="text-sm text-purple-700 mt-1">
                                    As admin, you can edit all denomination fields (morning remittance, afternoon remittance, and remarks) 
                                    for any group, regardless of date, status, or BCC balance. 
                                    Fields marked with ⚖️ indicate admin edit capability.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {canEdit && mergedData.some(item => item.status === 'rejected') && (
                    <div className="mx-4 mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
                        <div className="flex items-start">
                            <XCircle className="text-red-600 mr-3 mt-0.5" size={20} />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-red-800">
                                    Action Required: Rejected Denominations
                                </h3>
                                <p className="text-sm text-red-700 mt-1">
                                    Some denominations were rejected. Please review the rejection reasons,
                                    update the remittance amounts, and resubmit.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* NEW: Over-remittance correction banner - compact version */}
                {(canEdit && effectiveFilter == 'group' && currentUser.role.rep > 1) && mergedData.some(item => 
                    item.status === 'approved' && 
                    item.bccVsRemittances < 0 && 
                    (item.savedAfternoonRemittance === 0 || item.savedAfternoonRemittance === null)
                ) && (
                    <div className="mx-4 mt-4 px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
                        <svg className="h-5 w-5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-orange-800">
                            <strong>Over-remittance detected:</strong> Update morning (🔧) or add afternoon remittance to correct. Status will reset to pending.
                        </span>
                    </div>
                )}
                
                {/* Table Section */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Spinner />
                        </div>
                    ) : !currentUser || !currentUser.role ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center py-8 text-gray-500">
                                Please log in to view this page
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white shadow overflow-hidden sm:rounded-lg m-4">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {getFilterLabel()} Name
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Active Clients
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Total Net Collection
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Morning Remittances
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                No. of Sit Down
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount of Sit Down
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Afternoon Remittances
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                BCC vs Remittances
                                            </th>
                                            {/* NEW: Remarks column */}
                                            {showStatusColumn && (
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                                                    Remarks
                                                </th>
                                            )}
                                            {showStatusColumn && (
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                            )}
                                            {showActionsColumn && (
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {mergedData.length === 0 ? (
                                            <tr>
                                                <td colSpan={showStatusColumn && showActionsColumn ? "11" : showStatusColumn || showActionsColumn ? "10" : "8"} className="px-6 py-12 text-center">
                                                    <div className="text-gray-500">
                                                        <p className="text-lg font-medium">No data available</p>
                                                        <p className="text-sm mt-1">
                                                            {effectiveFilter === 'lo' && !router.query.id 
                                                                ? 'Please select a branch to view loan officers'
                                                                : effectiveFilter === 'group' && !router.query.id
                                                                ? 'Please select a loan officer to view groups'
                                                                : 'No data found for the selected date'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                                {mergedData.map((item, index) => {
                                                    const isClickable = effectiveFilter !== 'group';
                                                    
                                                    const showClientButton = effectiveFilter === 'group' && 
                                                        item.amountSitDown > 0 && 
                                                        item.activeClients > 0 && 
                                                        item.totalNetCollection > 0;
                                                    
                                                    const canApproveRejectThisRow = userCanApproveReject && 
                                                        effectiveFilter === 'group' &&
                                                        item._id &&
                                                        (item.status === 'pending' || item.status === 'initial');
                                                    
                                                    let rowBgClass = 'bg-blue-100';
                                                    if (effectiveFilter !== 'group') {
                                                        if (item.status === 'approved' || item.activeClients === 0) {
                                                            rowBgClass = '';
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <tr 
                                                            key={index} 
                                                            onClick={isClickable ? () => handleRowClick(item) : undefined}
                                                            className={`transition-colors ${rowBgClass} ${
                                                                isClickable ? 'hover:bg-gray-50 cursor-pointer' : ''
                                                            } ${
                                                                (effectiveFilter == 'group' && isItemDirty(item)) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                                            } ${
                                                                (effectiveFilter == 'group' && item.status === 'rejected') ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                                                            }`}
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                                                <div className="flex items-center gap-2">
                                                                    {(effectiveFilter == 'group' && isItemDirty(item)) && (
                                                                        <span 
                                                                            className="flex h-2 w-2 relative"
                                                                            title="Unsaved changes"
                                                                        >
                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                                        </span>
                                                                    )}
                                                                    <span>{item.entityName}</span>
                                                                    {item.wasApproved && item.collectionChanged && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                                            Reopened
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {item.activeClients || 0}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                                                {formatPrice(item.totalNetCollection || 0)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {shouldShowMorningRemittanceInput(item) ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        {/* Check if this is a Venus correction scenario */}
                                                                        {(() => {
                                                                            const isVenusCorrection = item.status === 'approved' && 
                                                                                item.bccVsRemittances < 0 && 
                                                                                (item.savedAfternoonRemittance === 0 || item.savedAfternoonRemittance === null);
                                                                            
                                                                            return (
                                                                                <>
                                                                                    <input
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        value={item.currentMorningRemittance === '' ? '' : item.currentMorningRemittance}
                                                                                        onFocus={(e) => {
                                                                                            if (e.target.value === '0' || e.target.value === 0) {
                                                                                                e.target.value = '';
                                                                                            }
                                                                                        }}
                                                                                        onChange={(e) => handleMorningRemittanceChange(item.entityId, e.target.value)}
                                                                                        onBlur={() => handleMorningRemittanceBlur(item.entityId)}
                                                                                        disabled={isMorningRemittanceDisabled(item)}
                                                                                        className={`w-36 px-3 py-1.5 border rounded-md text-right ${
                                                                                            canAdminEdit(item)
                                                                                                ? 'border-2 border-purple-400 bg-purple-50 focus:ring-purple-500 focus:border-purple-600'
                                                                                                : isVenusCorrection
                                                                                                ? 'border-2 border-orange-400 bg-orange-50 focus:ring-orange-500 focus:border-orange-600'
                                                                                                : isMorningRemittanceDisabled(item) 
                                                                                                ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed' 
                                                                                                : item.status === 'rejected'
                                                                                                ? 'border-red-300 bg-red-50 focus:ring-indigo-500 focus:border-indigo-500'
                                                                                                : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                                                                        }`}
                                                                                        placeholder={canAdminEdit(item) ? "Admin Edit" : isVenusCorrection ? "Correct" : ""}
                                                                                    />
                                                                                    {canAdminEdit(item) && (
                                                                                        <span className="text-xs text-purple-600" title="Admin balance adjustment">⚖️</span>
                                                                                    )}
                                                                                    {isVenusCorrection && !canAdminEdit(item) && (
                                                                                        <span className="text-xs text-orange-600" title="Correction needed - Over-remitted">🔧</span>
                                                                                    )}
                                                                                    {isMorningRemittanceDisabled(item) && !canAdminEdit(item) && !isVenusCorrection && (
                                                                                        <span className="text-xs text-green-600" title="Already saved">🔒</span>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <span className="font-medium">{formatPrice(item.currentMorningRemittance)}</span>
                                                                        {item.status === 'approved' && (
                                                                            <span className="text-xs text-green-600">✓</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                {item.noSitDown ? Number(item.noSitDown).toFixed(0) : '0'}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                {formatPrice(item.amountSitDown || 0)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                                                {shouldShowAfternoonRemittanceInput(item) ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <input
                                                                            type="text"
                                                                            inputMode="decimal"
                                                                            value={item.currentAfternoonRemittance === '' ? '' : item.currentAfternoonRemittance}
                                                                            onFocus={(e) => {
                                                                                if (e.target.value === '0' || e.target.value === 0) {
                                                                                    e.target.value = '';
                                                                                }
                                                                            }}
                                                                            onChange={(e) => handleAfternoonRemittanceChange(item.entityId, e.target.value)}
                                                                            onBlur={() => handleAfternoonRemittanceBlur(item, item.bccVsRemittances)}
                                                                            disabled={isAfternoonRemittanceDisabled(item)}
                                                                            className={`w-36 px-3 py-1.5 border rounded-md text-right ${
                                                                                canAdminEdit(item)
                                                                                    ? 'border-2 border-purple-400 bg-purple-50 focus:ring-purple-500 focus:border-purple-600'
                                                                                    : isAfternoonRemittanceDisabled(item)
                                                                                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                                                                    : item.status === 'rejected'
                                                                                    ? 'border-red-300 bg-red-50 focus:ring-green-500 focus:border-green-500'
                                                                                    : 'border-green-300 bg-green-50 focus:ring-green-500 focus:border-green-500'
                                                                            }`}
                                                                            placeholder={canAdminEdit(item) ? "Admin Edit" : ""}
                                                                        />
                                                                        {canAdminEdit(item) && (
                                                                            <span className="text-xs text-purple-600" title="Admin balance adjustment">⚖️</span>
                                                                        )}
                                                                        {isAfternoonRemittanceDisabled(item) && !canAdminEdit(item) && (
                                                                            <span className="text-xs text-green-600" title="Already saved">🔒</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-medium">{formatPrice(item.currentAfternoonRemittance)}</span>
                                                                )}
                                                            </td>
                                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                                                                item.bccVsRemittances < 0 ? 'text-red-600' : 
                                                                item.bccVsRemittances > 0 ? 'text-orange-600' : 
                                                                'text-green-600'
                                                            }`}>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {formatPrice(item.bccVsRemittances)}
                                                                    {item.bccVsRemittances > 0 && item.hasCollection && (
                                                                        <span className="text-xs" title="Needs remittance adjustment">⚠️</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {/* NEW: Remarks cell - click to open modal */}
                                                            {showStatusColumn && (
                                                                <td className="px-6 py-4 text-sm min-w-[200px]">
                                                                    {(canEdit && effectiveFilter === 'group') || canAdminEdit(item) ? (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleOpenRemarksModal(item);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 border rounded-md transition-colors ${
                                                                                remarksChanges.hasOwnProperty(item.entityId) && remarksChanges[item.entityId] !== item.savedRemarks
                                                                                    ? 'bg-yellow-50 border-yellow-400 hover:bg-yellow-100 ring-2 ring-yellow-300'
                                                                                    : item.remarks 
                                                                                    ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' 
                                                                                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                                                                            } ${
                                                                                canAdminEdit(item) 
                                                                                    ? 'border-2 border-purple-400 bg-purple-50 hover:bg-purple-100' 
                                                                                    : ''
                                                                            }`}
                                                                            title={item.remarks ? item.remarks : "Click to add remarks"}
                                                                        >
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className={`truncate max-w-[140px] ${item.remarks ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                                                                                    {item.remarks || 'Add remarks...'}
                                                                                </span>
                                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                                    {remarksChanges.hasOwnProperty(item.entityId) && remarksChanges[item.entityId] !== item.savedRemarks && (
                                                                                        <span className="flex h-2 w-2 relative" title="Unsaved changes">
                                                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                                                                                        </span>
                                                                                    )}
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                                    </svg>
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-gray-700" title={item.remarks || ''}>
                                                                            {item.remarks ? (
                                                                                <span className="truncate block max-w-[180px]">{item.remarks}</span>
                                                                            ) : '-'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {showStatusColumn && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center uppercase">
                                                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                                                                        item.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                        item.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                                    }`}>
                                                                        {item.status || 'draft'}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            {showActionsColumn && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        {item.history && item.history.length > 1 && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleViewHistory(item);
                                                                                }}
                                                                                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                                                                                title="View history"
                                                                            >
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </button>
                                                                        )}

                                                                        {(showClientButton && currentDate === dateFilter) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    fetchClientData(item.entityId, item.entityName);
                                                                                }}
                                                                                className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors"
                                                                                title="View clients with sit down"
                                                                            >
                                                                                <Users size={24} />
                                                                            </button>
                                                                        )}
                                                                        
                                                                        {(canApproveRejectThisRow && currentDate === dateFilter) && (
                                                                            <>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleApprove(item);
                                                                                    }}
                                                                                    className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-md transition-colors"
                                                                                    title="Approve"
                                                                                    disabled={loading}
                                                                                >
                                                                                    <Check size={24} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleRejectClick(item);
                                                                                    }}
                                                                                    className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors"
                                                                                    title="Reject"
                                                                                    disabled={loading}
                                                                                >
                                                                                    <X size={24} />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        
                                                                        {!showClientButton && !canApproveRejectThisRow && (!item.history || item.history.length <= 1) && (
                                                                            <span className="text-gray-400 text-xs">-</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                                
                                                {/* Grand Total Row */}
                                                {(() => {
                                                    const grandTotal = calculateGrandTotal(mergedData);
                                                    const grandTotalBccVsRemittances = calculateBccVsRemittances(
                                                        grandTotal.totalNetCollection,
                                                        grandTotal.morningRemittance,
                                                        grandTotal.afternoonRemittance
                                                    );
                                                    
                                                    return (
                                                        <tr className="bg-red-50 border-t-4 border-red-600">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 uppercase sticky left-0 bg-red-50">
                                                                GRAND TOTAL
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {grandTotal.activeClients}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotal.totalNetCollection)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotal.morningRemittance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {Number(grandTotal.noSitDown).toFixed(0)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotal.amountSitDown)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotal.afternoonRemittance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotalBccVsRemittances)}
                                                            </td>
                                                            {showStatusColumn && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                                    <span className="text-red-700">-</span>
                                                                </td>
                                                            )}
                                                            {showStatusColumn && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                                    <span className="text-red-700">-</span>
                                                                </td>
                                                            )}
                                                            {showActionsColumn && (
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                                    <span className="text-red-700">-</span>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Reject Denomination</h3>
                        </div>
                        
                        <div className="px-6 py-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Please provide a reason for rejecting this denomination entry:
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter rejection reason..."
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                autoFocus
                            />
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={handleCancelReject}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectSubmit}
                                disabled={!rejectionReason.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Client Modal */}
            {showClientModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Clients with Sit Down</h3>
                                {selectedGroupForClients && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        Group: <span className="font-medium">{selectedGroupForClients.name}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleCloseClientModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                                title="Close"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto px-6 py-4">
                            {clientModalLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Spinner />
                                </div>
                            ) : clientData.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Users size={48} className="mx-auto mb-4 text-gray-400" />
                                    <p className="text-lg font-medium">No clients found</p>
                                    <p className="text-sm mt-1">No client data available for this group</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {clientData.map((client, index) => {
                                        const displayCode = client.code ? parseInt(client.code, 10).toString() : 'N/A';
                                        
                                        return (
                                            <div 
                                                key={client._id || index} 
                                                className={`flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 ${client.totalNetCollection > 0 ? 'bg-green-50 hover:bg-green-100 border-green-300' : 'bg-red-50 hover:bg-red-100 border-red-300'}  rounded-lg transition-colors`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 ${client.totalNetCollection > 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'} rounded-full flex items-center justify-center font-semibold text-sm`}>
                                                        {displayCode}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{client.name || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-600">Net Collection</p>
                                                    <p className={`text-lg font-semibold text-gray-900 ${client.totalNetCollection > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                        {formatPrice(client.targetLoanCollection || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                            <p className="text-sm text-gray-600">
                                Total Clients: <span className="font-medium">{clientData.length}</span>
                            </p>
                            <button
                                onClick={handleCloseClientModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && selectedItemHistory && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Denomination History</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Group: <span className="font-medium">{selectedItemHistory.entityName}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                                title="Close"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto px-6 py-4">
                            {selectedItemHistory.history && selectedItemHistory.history.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedItemHistory.history
                                        .slice()
                                        .reverse()
                                        .map((entry, index) => {
                                            const isReopened = entry.action === 'reopened_due_to_collection_change';
                                            const isApproved = entry.action === 'approved';
                                            const isRejected = entry.action === 'rejected';
                                            const isSave = entry.action === 'saved';
                                            const isAdminAdjustment = entry.action === 'admin_adjustment';
                                            
                                            let bgColor = 'bg-gray-50 border-gray-200';
                                            let badgeColor = 'bg-gray-100 text-gray-800';
                                            
                                            if (isReopened) {
                                                bgColor = 'bg-orange-50 border-orange-200';
                                                badgeColor = 'bg-orange-100 text-orange-800';
                                            } else if (isApproved) {
                                                bgColor = 'bg-green-50 border-green-200';
                                                badgeColor = 'bg-green-100 text-green-800';
                                            } else if (isRejected) {
                                                bgColor = 'bg-red-50 border-red-200';
                                                badgeColor = 'bg-red-100 text-red-800';
                                            } else if (isSave) {
                                                bgColor = 'bg-blue-50 border-blue-200';
                                                badgeColor = 'bg-blue-100 text-blue-800';
                                            } else if (isAdminAdjustment) {
                                                bgColor = 'bg-purple-50 border-purple-200';
                                                badgeColor = 'bg-purple-100 text-purple-800';
                                            }
                                            
                                            return (
                                                <div 
                                                    key={index} 
                                                    className={`p-4 rounded-lg border ${bgColor}`}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
                                                                {isReopened ? 'Reopened' : 
                                                                isApproved ? 'Approved' :
                                                                isRejected ? 'Rejected' :
                                                                isSave ? 'Saved' :
                                                                isAdminAdjustment ? 'Admin Adjustment' :
                                                                entry.action}
                                                            </span>
                                                            {entry.previous_status && (
                                                                <span className="text-xs text-gray-600">
                                                                    from <span className="font-medium uppercase">{entry.previous_status}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {moment(entry.date_time || entry.approval_date_time || entry.rejection_date_time).format('MMM DD, YYYY hh:mm A')}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-600 mb-2">
                                                        By: <span className="font-medium">
                                                            {entry.approval_user_name || entry.rejection_user_name || entry.user_name}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* NEW: Display remarks and rejection reason */}
                                                    {(entry.reason || entry.rejection_reason || entry.remarks) && (
                                                        <div className="text-sm text-gray-700 mb-3">
                                                            {(entry.reason || entry.rejection_reason) && (
                                                                <div className="italic bg-white bg-opacity-50 p-2 rounded mb-2">
                                                                    <span className="font-semibold">Reason:</span> "{entry.reason || entry.rejection_reason}"
                                                                </div>
                                                            )}
                                                            {entry.remarks && (
                                                                <div className="bg-white bg-opacity-50 p-2 rounded">
                                                                    <span className="font-semibold">Remarks:</span> {entry.remarks}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-gray-600">Active Clients:</span>
                                                            <span className="ml-2 font-medium">{entry.active_clients || 0}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Sit Down:</span>
                                                            <span className="ml-2 font-medium">
                                                                {entry.amount_sit_down ? Number(entry.amount_sit_down).toFixed(0) : '0'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Net Collection:</span>
                                                            <span className="ml-2 font-medium">
                                                                {formatPrice(
                                                                    entry.total_net_collection || 
                                                                    entry.new_total_net_collection || 
                                                                    entry.previous_total_net_collection || 0
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Morning Remittance:</span>
                                                            <span className="ml-2 font-medium">
                                                                {formatPrice(
                                                                    entry.morning_remittance || 
                                                                    entry.previous_morning_remittance || 0
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-600">Afternoon Remittance:</span>
                                                            <span className="ml-2 font-medium">
                                                                {formatPrice(
                                                                    entry.afternoon_remittance || 
                                                                    entry.previous_afternoon_remittance || 0
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <span className="text-gray-600">BCC vs Remittances:</span>
                                                            <span className={`ml-2 font-semibold ${
                                                                (entry.bcc_vs_remittances || entry.previous_bcc_vs_remittances || 0) < 0 
                                                                    ? 'text-red-600' 
                                                                    : (entry.bcc_vs_remittances || entry.previous_bcc_vs_remittances || 0) > 0
                                                                    ? 'text-orange-600'
                                                                    : 'text-green-600'
                                                            }`}>
                                                                {formatPrice(entry.bcc_vs_remittances || entry.previous_bcc_vs_remittances || 0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {isReopened && entry.previous_total_net_collection && (
                                                        <div className="mt-3 pt-3 border-t border-gray-300">
                                                            <div className="text-xs text-gray-600 font-semibold mb-2">Previous Values (Before Reopening):</div>
                                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                                <div>
                                                                    <span className="text-gray-500">Previous Collection:</span>
                                                                    <span className="ml-2 font-medium">{formatPrice(entry.previous_total_net_collection)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Previous Morning:</span>
                                                                    <span className="ml-2 font-medium">{formatPrice(entry.previous_morning_remittance)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Previous Afternoon:</span>
                                                                    <span className="ml-2 font-medium">{formatPrice(entry.previous_afternoon_remittance)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg font-medium">No history available</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Remarks Modal */}
            {showRemarksModal && remarksModalItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Edit Remarks</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Group: <span className="font-medium">{remarksModalItem.entityName}</span>
                            </p>
                        </div>
                        
                        <div className="px-6 py-4">
                            <div className="mb-4">
                                <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <span className="text-gray-600 text-xs">Net Collection:</span>
                                        <div className="font-medium">{formatPrice(remarksModalItem.totalNetCollection)}</div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 text-xs">BCC vs Remittances:</span>
                                        <div className={`font-semibold ${
                                            remarksModalItem.bccVsRemittances < 0 ? 'text-red-600' : 
                                            remarksModalItem.bccVsRemittances > 0 ? 'text-orange-600' : 
                                            'text-green-600'
                                        }`}>
                                            {formatPrice(remarksModalItem.bccVsRemittances)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 text-xs">Morning:</span>
                                        <div className="font-medium">{formatPrice(remarksModalItem.currentMorningRemittance)}</div>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 text-xs">Afternoon:</span>
                                        <div className="font-medium">{formatPrice(remarksModalItem.currentAfternoonRemittance)}</div>
                                    </div>
                                </div>
                                
                                {/* Dynamic helper message based on BCC status */}
                                {remarksModalItem.bccVsRemittances !== 0 && (
                                    <div className={`mt-3 p-2 rounded text-xs ${
                                        remarksModalItem.bccVsRemittances < 0 
                                            ? 'bg-red-50 text-red-700 border border-red-200' 
                                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                                    }`}>
                                        {remarksModalItem.bccVsRemittances < 0 ? (
                                            <>
                                                <strong>Over-remitted:</strong> You can correct the morning remittance amount or add an afternoon remittance adjustment.
                                            </>
                                        ) : (
                                            <>
                                                <strong>Under-remitted:</strong> Please add an afternoon remittance to balance the collection.
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            <label htmlFor="remarks-textarea" className="block text-sm font-medium text-gray-700 mb-2">
                                Remarks / Notes
                            </label>
                            <textarea
                                id="remarks-textarea"
                                value={remarksModalValue}
                                onChange={(e) => setRemarksModalValue(e.target.value)}
                                placeholder="Enter any remarks or notes about this denomination entry..."
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm"
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                Note any discrepancies, adjustments, or important information.
                            </p>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-lg">
                            <button
                                onClick={handleCloseRemarksModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRemarks}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                            >
                                Save Remarks
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}