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
import { Calendar, RefreshCw, Save, ChevronLeft, Check, X, Users, XCircle } from 'lucide-react';
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
    
    // Rejection modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingItem, setRejectingItem] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Client modal states
    const [showClientModal, setShowClientModal] = useState(false);
    const [clientModalLoading, setClientModalLoading] = useState(false);
    const [clientData, setClientData] = useState([]);
    const [selectedGroupForClients, setSelectedGroupForClients] = useState(null);
    
    const [remittanceChanges, setRemittanceChanges] = useState({});
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedItemHistory, setSelectedItemHistory] = useState(null);

    const handleViewHistory = (item) => {
        setSelectedItemHistory(item);
        setShowHistoryModal(true);
    };

    // Helper function to determine if back button should be shown
    const shouldShowBackButton = () => {
        // If not viewing nested content, no back button needed
        if (!viewingNestedContent) {
                console.log("shouldShowBackButton: Not viewing nested content - no back button");
            return false;
        }
        
        // Check user role and current filter state
        if (currentUser?.role && !router.query?.parentId) {
            // Loan Officer (rep = 4): initial view is groups, no back button at group level
            if (currentUser.role.rep === 4 && filter === 'group') {
                console.log("shouldShowBackButton: LO at group level - no back button");
                return false;
            }
            
            // Branch Manager (rep = 3): initial view is loan officers, no back button to branches
            if (currentUser.role.rep === 3 && filter === 'lo') {
                console.log("shouldShowBackButton: Branch Manager at LO level - no back button");
                return false;
            }
            
            // Cashier without designated branch: initial view is branches, no back button at branch level
            if (currentUser.role.shortCode === 'cashier' && 
                currentUser.designatedBranchId == null && 
                filter === 'branch') {
                console.log("shouldShowBackButton: Cashier without branch at branch level - no back button");
                return false;
            }
        }
        
        // For all other cases when viewing nested content, show back button
        return true;
    };
    
    // Initialize from router query
    useEffect(() => {
        if (router.query.date) {
            setDateFilter(router.query.date);
        }
        
        if (router.query.filter) {
            console.log('Setting filter from router query:', router.query.filter);
            setFilter(router.query.filter);
        } else if (!router.query.id) {
            // Determine initial filter based on user role
            if (currentUser?.role) {
                // Admin/Super Admin (rep <= 2): start at branch level
                if (currentUser.role.rep <= 2) {
                    console.log('Resetting to branch filter for admin role');
                    setFilter('branch');
                }
                // Branch Manager (rep = 3): start at loan officer level
                else if (currentUser.role.rep === 3) {
                    console.log('Resetting to lo filter for branch manager');
                    setFilter('lo');
                }
                // Loan Officer (rep = 4): start at group level
                else if (currentUser.role.rep === 4) {
                    console.log('Resetting to group filter for loan officer');
                    setFilter('group');
                }
                // Cashier without designated branch: start at branch level
                else if (currentUser.role.shortCode === 'cashier' && 
                         currentUser.designatedBranchId == null) {
                    console.log('Cashier without designated branch - setting to branch filter');
                    setFilter('branch');
                }
            }
        }
        
        const hasNestedContent = !!router.query.id;
        setViewingNestedContent(hasNestedContent);
        
        console.log('Router initialization:', {
            date: router.query.date,
            filter: router.query.filter,
            id: router.query.id,
            parentId: router.query.parentId,
            viewingNested: hasNestedContent,
            currentFilter: filter,
            userRole: currentUser?.role,
            shouldShowBack: shouldShowBackButton()
        });
    }, [router.query.date, router.query.filter, router.query.id, router.query.parentId, currentUser?.role]);
    
    // Fetch branch list if empty (for cashiers)
    useEffect(() => {
        const fetchBranches = async () => {
            if (branchList.length === 0 && currentUser?.role) {
                console.log('BranchList is empty, fetching...');
                try {
                    const url = getApiBaseUrl() + 'branches/list';
                    const response = await fetchWrapper.get(url);
                    
                    if (response.success && response.branches) {
                        console.log('Fetched branches:', response.branches.length);
                        dispatch({ type: 'SET_BRANCH_LIST', payload: response.branches });
                    } else {
                        console.error('Failed to fetch branches:', response);
                    }
                } catch (error) {
                    console.error('Error fetching branches:', error);
                }
            }
        };
        
        fetchBranches();
    }, [branchList.length, currentUser, dispatch]);
    
    // Determine filter level based on user role
    useEffect(() => {
        if (currentUser?.role) {
            console.log('=== ROLE SETUP ===');
            console.log('User role:', currentUser.role.shortCode, 'rep:', currentUser.role.rep);
            
            const hasEditPermission = currentUser.role.shortCode === 'cashier' && currentDate === dateFilter;
            setCanEdit(hasEditPermission);
            
            if (currentUser.role.rep <= 2) {
                setFilter('branch');
            } else if (currentUser.role.rep === 3) {
                setFilter('lo');
                console.log('✓ Branch Manager detected, fetching LO list');
                fetchLOList();
            } else if (currentUser.role.rep === 4) {
                setFilter('group');
                console.log('✓ Loan Officer detected, fetching group list');
                fetchGroupList();
            }
        }
    }, [currentUser?.role, currentDate, dateFilter]);
    
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
                        label: `${u.firstName} ${u.lastName}`
                    }))
                    .sort((a, b) => {
                        const loNoA = response.users.find(u => u._id === a.value)?.loNo || 0;
                        const loNoB = response.users.find(u => u._id === b.value)?.loNo || 0;
                        return loNoA - loNoB;
                    });
                setLoList(los);
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
            
            console.log('Fetching client data from:', apiUrl);
            
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.data) {
                // Filter out the _total row and any rows with _id === '_total'
                const filteredData = response.data.filter(client => 
                    // 1. Exclude the '_total' row
                    client._id !== '_total' && 
                    client.name !== '_total' &&
                    client.code !== '_total' &&
                    
                    // 2. Keep clients UNLESS they meet the first set of 'zero' conditions
                    !(client.activeBorrowers == 0 && client.activeClients == 0 && client.totalLoanBalance == 0) &&
                    
                    // 3. Keep clients UNLESS they meet the second set of 'zero'/'null' conditions
                    !(client.totalLoanBalance == 0 && (client.actualLoanCollection == null || client.actualLoanCollection == 0)) &&
                    
                    // 4. Exclude has actualLoanCollection
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
        const effectiveFilter = router.query.filter || filter;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                date: dateFilter,
                filter: effectiveFilter
            });
            
            if (router.query.id && router.query.filter) {
                if (router.query.filter === 'lo') {
                    params.append('branchId', router.query.id);
                } else if (router.query.filter === 'group') {
                    params.append('loId', router.query.id);
                    
                    if (router.query.parentId) {
                        params.append('branchId', router.query.parentId);
                    }
                }
            } else {
                if (effectiveFilter === 'branch') {
                    if (selectedBranch) {
                        params.append('branchId', selectedBranch.value);
                    } else {
                        console.log('Loading all branches (no branch filter)');
                    }
                } else if (effectiveFilter === 'lo') {
                    if (currentUser.designatedBranchId) {
                        params.append('branchId', currentUser.designatedBranchId);
                    }
                    if (selectedLO) {
                        params.append('loId', selectedLO.value);
                    }
                } else if (effectiveFilter === 'group') {
                    if (currentUser._id) {
                        params.append('loId', currentUser._id);
                    }
                    if (selectedGroup) {
                        params.append('groupId', selectedGroup.value);
                    }
                }
            }
            
            const url = getApiBaseUrl() + 'transactions/denomination/get-initial-data?' + params.toString();
            
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
            
            // Pass filters based on user role and current view
            const effectiveFilter = router.query.filter || filter;
            
            // Determine which filters to apply (avoid duplicates)
            let shouldAddBranchFilter = false;
            let shouldAddLoFilter = false;
            let shouldAddGroupFilter = false;
            let branchIdToUse = null;
            let loIdToUse = null;
            let groupIdToUse = null;
            
            // Priority 1: Nested navigation filters (highest priority)
            if (router.query.id && router.query.filter) {
                if (router.query.filter === 'lo') {
                    // Viewing a specific branch's LOs
                    branchIdToUse = router.query.id;
                    shouldAddBranchFilter = true;
                } else if (router.query.filter === 'group') {
                    // Viewing a specific LO's groups
                    loIdToUse = router.query.id;
                    shouldAddLoFilter = true;
                    
                    // Also pass branch context if available
                    if (router.query.parentId) {
                        branchIdToUse = router.query.parentId;
                        shouldAddBranchFilter = true;
                    }
                }
            } 
            // Priority 2: User role-based filters (if not in nested view)
            else {
                // For Branch Manager (rep 3) - always pass their designated branch
                if (currentUser.role.rep === 3 && currentUser.designatedBranchId) {
                    branchIdToUse = currentUser.designatedBranchId;
                    shouldAddBranchFilter = true;
                }
                
                // For Cashier with designated branch - always pass their designated branch
                else if (currentUser.role.shortCode === 'cashier' && currentUser.designatedBranchId) {
                    branchIdToUse = currentUser.designatedBranchId;
                    shouldAddBranchFilter = true;
                }
                
                // For Loan Officer (rep 4) - pass their user ID as loId
                else if (currentUser.role.rep === 4 && currentUser._id) {
                    loIdToUse = currentUser._id;
                    shouldAddLoFilter = true;
                }
                
                // Priority 3: Selected dropdown filters (lowest priority, only if no role filter)
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
            
            // Add parameters only once
            if (shouldAddBranchFilter && branchIdToUse) {
                params.append('branchId', branchIdToUse);
            }
            if (shouldAddLoFilter && loIdToUse) {
                params.append('loId', loIdToUse);
            }
            if (shouldAddGroupFilter && groupIdToUse) {
                params.append('groupId', groupIdToUse);
            }
            
            const url = getApiBaseUrl() + 'transactions/denomination/get-denomination?' + params.toString();
            
            const response = await fetchWrapper.get(url);
            
            if (response.success) {
                setDenominationData(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching denomination data:', error);
        } finally {
            console.log('Fetch complete, setting loading to false');
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

                let totalRemittance = 0;
                if (effectiveFilter !== 'group') {
                    const matchingRecords = denominationData.filter(d => {
                        return d.lo_id === item.entityId;
                    });
                    matchingRecords.forEach(record => {
                        const value = parseFloat(record.total_remittance) || 0;
                        totalRemittance += value;
                    });
                }
                
                const currentRemittance = totalRemittance != 0 
                    ? totalRemittance 
                    : remittanceChanges[item.entityId] !== undefined 
                    ? remittanceChanges[item.entityId]
                    : savedData?.total_remittance || 0;
                
                // Check if collection changed after approval
                const wasApproved = savedData?.approval_date && savedData?.status === 'draft';
                const collectionChanged = wasApproved && 
                    savedData?.total_net_collection !== item.totalNetCollection;
                
                return {
                    ...item,
                    savedRemittance: savedData?.total_remittance || 0,
                    currentRemittance: currentRemittance,
                    status: savedData?.status || 'draft',
                    _id: savedData?._id,
                    wasApproved: wasApproved,
                    collectionChanged: collectionChanged,
                    approval_date: savedData?.approval_date,
                    history: savedData?.history || []
                };
            });
    };

    
    // Handle remittance change - allow typing without validation
    const handleRemittanceChange = (entityId, value) => {
        const numValue = value === '' ? '' : parseFloat(value) || 0;
        
        setRemittanceChanges(prev => ({
            ...prev,
            [entityId]: numValue
        }));
    };

    // Handle validation on blur
    const handleRemittanceBlur = (entityId) => {
        const item = initialData.find(i => i.entityId === entityId);
        if (!item) return;
        
        const savedItem = denominationData.find(d => 
            (d.branch_id === entityId || d.lo_id === entityId || d.group_id === entityId)
        );
        
        const minValue = item.totalNetCollection || 0;
        const currentValue = parseFloat(remittanceChanges[entityId]) || 0;
        
        // Calculate what the new BCC vs Remittances would be
        const newBccVsRemittances = (item.totalNetCollection || 0) - currentValue;
        
        if (currentValue < minValue) {
            toast.warning(`Remittance cannot be less than ${formatPrice(minValue)}`);
            // Reset to minimum value
            setRemittanceChanges(prev => ({
                ...prev,
                [entityId]: minValue
            }));
        } else if (newBccVsRemittances < 0) {
            toast.warning(`Remittance cannot exceed net collection of ${formatPrice(item.totalNetCollection)}`);
            // Reset to net collection (perfect match)
            setRemittanceChanges(prev => ({
                ...prev,
                [entityId]: item.totalNetCollection
            }));
        } else if (newBccVsRemittances > 0) {
            toast.warning(`Remittance cannot be less than net collection of ${formatPrice(item.totalNetCollection)}`);
            // Reset to net collection (perfect match)
            setRemittanceChanges(prev => ({
                ...prev,
                [entityId]: item.totalNetCollection
            }));
        }
    };
    
    // Calculate BCC vs Remittances
    const calculateBccVsRemittances = (totalNetCollection, totalRemittance) => {
        return (totalNetCollection || 0) - (totalRemittance || 0);
    };
    
    // Handle date change
    const handleDateChange = (e) => {
        setDateFilter(e.target.value);
    };
    
    // Handle row click for navigation
    const handleRowClick = (item) => {
        const effectiveFilter = router.query.filter || filter;
        
        let nextFilter = '';
        let updatedQuery = {
            date: dateFilter
        };
        
        if (effectiveFilter === 'branch') {
            nextFilter = 'lo';
            updatedQuery.id = item.entityId;
            updatedQuery.filter = nextFilter;
        } else if (effectiveFilter === 'lo') {
            nextFilter = 'group';
            updatedQuery.id = item.entityId;
            updatedQuery.filter = nextFilter;
            
            if (router.query.id) {
                updatedQuery.parentId = router.query.id;
            } else if (currentUser.designatedBranchId) {
                updatedQuery.parentId = currentUser.designatedBranchId;
            }
        } else if (effectiveFilter === 'group') {
            console.log('Groups are the deepest level, no navigation');
            return;
        }
        
        router.push({
            pathname: router.pathname,
            query: updatedQuery
        }, undefined, { shallow: true });
        
        setViewingNestedContent(true);
    };
    
    // Handle back navigation
    const handleBackNavigation = () => {
        // Don't allow back navigation if shouldShowBackButton returns false
        if (!shouldShowBackButton()) {
            return;
        }

        if (filter === 'group' && router.query.parentId) {
            // Going back from groups to loan officers
            router.push({
                pathname: router.pathname,
                query: { 
                    date: dateFilter, 
                    filter: 'lo',
                    id: router.query.parentId,
                    // parentId: selectedBranch?.id // will need to check if there will be branch list after the lo list
                }
            }, undefined, { shallow: true }); 
        } else if (filter === 'lo' && router.query.parentId) {
            // Going back from loan officers to branches
            // Only allow this if user is not a Branch Manager (rep = 3)
            if (currentUser?.role?.rep !== 3) {
                router.push({
                    pathname: router.pathname,
                    query: { 
                        date: dateFilter, 
                        filter: 'branch'
                    }
                }, undefined, { shallow: true }); 
            }
        }
    };
    
    // Handle refresh
    const handleRefresh = () => {
        fetchInitialData();
    };

    const isItemDirty = (item) => {
        if (!remittanceChanges.hasOwnProperty(item.entityId)) return false;
        
        const currentRemittance = remittanceChanges[item.entityId];
        const savedRemittance = item.savedRemittance || 0;
        
        return currentRemittance !== savedRemittance;
    };

    const getDirtyItemsCount = () => {
        const mergedData = getMergedData();
        return mergedData.filter(item => {
            // ✅ NEW: Allow items with zero or negative collections
            if (item.totalNetCollection < 0) {
                return isItemDirty(item);
            }
            
            // For positive collections, keep existing validation
            if (!item.hasCollection) return false;
            const currentRemittance = item.currentRemittance || 0;
            if (currentRemittance <= 0) return false;
            return isItemDirty(item);
        }).length;
    };
    
    const handleSubmit = async () => {
        if (!canEdit) {
            toast.error('You do not have permission to submit');
            return;
        }
        
        setLoading(true);
        try {
            const mergedData = getMergedData();
            
            // Only submit items that were actually changed (dirty)
            const itemsToSave = mergedData
                .filter(item => {
                    // Check if dirty and value changed
                    const isDirty = remittanceChanges.hasOwnProperty(item.entityId);
                    if (!isDirty) return false;
                    
                    const savedRemittance = item.savedRemittance || 0;
                    const currentRemittance = item.currentRemittance || 0;
                    if (currentRemittance === savedRemittance) return false;
                    
                    // ✅ NEW: Allow items with negative collections
                    if (item.totalNetCollection < 0) {
                        return true;
                    }
                    
                    // For positive collections, keep existing validation
                    if (!item.hasCollection) return false;
                    if (currentRemittance <= 0) return false;
                    
                    return true;
                })
                .map(item => ({
                    entityId: item.entityId,
                    entityName: item.entityName,
                    entityType: item.entityType,
                    activeClients: item.activeClients,
                    totalNetCollection: item.totalNetCollection,
                    totalRemittance: item.currentRemittance || 0,
                    amountSitDown: item.amountSitDown || 0
                }));
            
            if (itemsToSave.length === 0) {
                toast.warning('No changes to submit. Please modify remittance amounts before submitting.');
                setLoading(false);
                return;
            }
            
            // ==========================================
            // NEW: VALIDATION FOR SUBMISSION
            // Check if all groups with totalNetCollection > 0 have remittances
            // ==========================================
            const groupsWithCollection = mergedData.filter(item => 
                item.entityType === 'group' && 
                item.hasCollection && 
                item.totalNetCollection > 0
            );
            
            const missingRemittances = [];
            
            for (const item of groupsWithCollection) {
                const currentRemittance = remittanceChanges[item.entityId] !== undefined 
                    ? remittanceChanges[item.entityId] 
                    : (item.savedRemittance || 0);
                
                if (currentRemittance === 0 || currentRemittance === '') {
                    missingRemittances.push({
                        entityName: item.entityName,
                        totalNetCollection: item.totalNetCollection
                    });
                }
            }
            
            // If there are groups with collection but no remittance, show error
            if (missingRemittances.length > 0) {
                console.error('❌ Cannot submit: Missing remittances for groups with collections');
                console.error('Groups missing remittances:', missingRemittances);
                
                // Show detailed error messages
                toast.error('Cannot submit: All groups with collections must have remittances entered', {
                    autoClose: 8000
                });
                
                // Show first 3 groups with issues
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
            
            // ==========================================
            // MODIFIED: Add isSubmission flag to API call
            // ==========================================
            const response = await fetchWrapper.post(
                getApiBaseUrl() + 'transactions/denomination/batch-save',
                {
                    items: itemsToSave,
                    date: dateFilter,
                    isSubmission: true  // <-- NEW: Flag to indicate this is a submission
                }
            );
            
            if (response.success) {
                toast.success(response.message || `${itemsToSave.length} denomination record(s) submitted successfully`);
                setRemittanceChanges({});
                await fetchInitialData();
            } else {
                // ==========================================
                // NEW: Handle validation errors from API
                // ==========================================
                if (response.validationError && response.missingRemittances) {
                    toast.error(response.message, { autoClose: 8000 });
                    
                    // Show specific groups with issues
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
                        setRemittanceChanges({});
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
        const effectiveFilter = router.query.filter || filter;
        
        if (!currentUser || !currentUser.role) {
            console.log('No user, skipping fetch');
            setLoading(false);
            return;
        }
        
        let canFetch = false;
        
        if (router.query.id && router.query.filter) {
            console.log('Nested navigation detected, can fetch');
            canFetch = true;
        } else {
            if (currentUser.role.rep <= 2) {
                if (effectiveFilter === 'branch') {
                    canFetch = true;
                }
            } else if (currentUser.role.rep === 3) {
                if (currentUser.designatedBranchId && effectiveFilter === 'lo') {
                    canFetch = true;
                } else {
                    console.log('Waiting for designatedBranchId or filter setup...');
                }
            } else if (currentUser.role.rep === 4) {
                if (currentUser._id && effectiveFilter === 'group') {
                    canFetch = true;
                } else {
                    console.log('Waiting for user _id or filter setup...');
                }
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

    const effectiveFilter = router.query.filter || filter;

    // Show status column only when viewing groups
    const showStatusColumn = effectiveFilter === 'group';

    // Show actions column when viewing groups
    const showActionsColumn = effectiveFilter === 'group';

    // ==========================================
    // MODIFIED: Explicitly exclude cashiers from approving/rejecting
    // Even though cashiers now have rep=3, they should NOT be able to approve/reject
    // ==========================================
    const userCanApproveReject = (currentUser.role.rep === 3 || currentUser.role.rep === 4) && 
                                currentUser.role.shortCode !== 'cashier';

    const shouldShowRemittanceInput = (item) => {
        // Only cashiers can edit remittances
        if (currentUser.role.shortCode !== 'cashier') return false;
        
        // Only at group level
        if (effectiveFilter !== 'group') return false;
        
        // Date filter check
        if (dateFilter !== currentDate) return false;
        
        // Calculate current BCC vs Remittances
        const currentRemittance = remittanceChanges[item.entityId] !== undefined 
            ? remittanceChanges[item.entityId]
            : item.savedRemittance || 0;
        const bccVsRemittances = calculateBccVsRemittances(item.totalNetCollection, currentRemittance);

        // If approved and balanced, never show input
        if (item.status === 'approved' && bccVsRemittances === 0) return false;
        
        // NEW LOGIC:
        // 1. If totalNetCollection is negative, always allow input
        if (item.totalNetCollection < 0) {
            return item.status === 'draft' || item.status === 'pending' || item.status === 'approved';
        }
        
        // 2. If totalNetCollection is positive, only allow input if there's a collection
        //    (this maintains the restriction for positive collections)
        if (!item.hasCollection) return false;
        
        // Show input if:
        // 1. Status is draft or pending (normal flow)
        // 2. OR if there's a positive BCC difference (needs adjustment)
        return item.status === 'draft' || item.status === 'pending' || bccVsRemittances > 0;
    };
    
    const getFilterLabel = () => {
        if (filter === 'branch') return 'Branch';
        if (filter === 'lo') return 'Loan Officer';
        if (filter === 'group') return 'Group';
        return '';
    };
    
    useEffect(() => {
        setRemittanceChanges({});
    }, [dateFilter, selectedBranch, selectedLO, selectedGroup]);

    const calculateGrandTotal = (data) => {
        // Filter out the _total row if it exists in the data
        const dataWithoutTotal = data.filter(item => item.entityId !== '_total');
        
        return {
            activeClients: dataWithoutTotal.reduce((sum, item) => sum + (item.activeClients || 0), 0),
            totalNetCollection: dataWithoutTotal.reduce((sum, item) => sum + (item.totalNetCollection || 0), 0),
            totalRemittance: dataWithoutTotal.reduce((sum, item) => sum + (item.currentRemittance || 0), 0),
            amountSitDown: dataWithoutTotal.reduce((sum, item) => sum + (item.amountSitDown || 0), 0),
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
                    
                    {/* {shouldShowBackButton() && (
                        <div className="mt-2 flex items-center">
                            <button
                                onClick={handleBackNavigation}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-900 flex items-center"
                            >
                                <ChevronLeft size={16} className="mr-1" />
                                Back to {router.query.parentId ? 'Loan Officers' : 'Branches'}
                            </button>
                            
                            {parentEntityName && (
                                <span className="ml-2 text-sm text-gray-700">
                                    Viewing: <span className="font-medium">{parentEntityName}</span>
                                </span>
                            )}
                        </div>
                    )} */}
                </div>
                
                {/* Filters Section */}
                <div className="flex items-center justify-between p-3 sm:p-4 bg-white border-b border-gray-200 gap-4">
                    <div className="flex items-center gap-4 flex-1">
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
                        
                        {!router.query.id && filter === 'branch' && currentUser.role.rep <= 2 && (
                            <div className="w-64">
                                <Select
                                    value={selectedBranch}
                                    onChange={(selected) => {
                                        console.log('Branch filter selected:', selected);
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
                        
                        {!router.query.id && filter === 'lo' && currentUser.role.rep === 3 && (
                            <div className="w-64">
                                <Select
                                    value={selectedLO}
                                    onChange={setSelectedLO}
                                    options={loList}
                                    placeholder="Filter by LO (Optional)"
                                    isClearable
                                    isDisabled={loading}
                                    className="text-sm"
                                />
                            </div>
                        )}
                        
                        {!router.query.id && filter === 'group' && currentUser.role.rep === 4 && (
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
                    {(canEdit && router.query?.filter === "group") && (
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
                                        <span>Submit {getDirtyItemsCount() > 0 ? `(${getDirtyItemsCount()})` : ''}</span>
                                    </div>
                                }
                                onClick={handleSubmit}
                                disabled={loading || getDirtyItemsCount() === 0}
                                className="px-6 py-2 whitespace-nowrap"
                            />
                        </div>
                    )}
                </div>

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
                                                Total Remittances
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount of Sit Down
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                BCC vs Remittances
                                            </th>
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
                                                <td colSpan={showStatusColumn && showActionsColumn ? "8" : showStatusColumn || showActionsColumn ? "7" : "6"} className="px-6 py-12 text-center">
                                                    <div className="text-gray-500">
                                                        <p className="text-lg font-medium">No data available</p>
                                                        <p className="text-sm mt-1">
                                                            No data found for the selected date
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            <>
                                                {mergedData.map((item, index) => {
                                                    const currentRemittance = item.currentRemittance || 0;
                                                    const bccVsRemittances = calculateBccVsRemittances(
                                                        item.totalNetCollection,
                                                        currentRemittance
                                                    );
                                                    
                                                    const isClickable = effectiveFilter !== 'group';
                                                    
                                                    // Check if we should show the client button for this row
                                                    const showClientButton = effectiveFilter === 'group' && 
                                                        item.amountSitDown > 0 && 
                                                        item.activeClients > 0 && 
                                                        item.totalNetCollection > 0;
                                                    
                                                    // Check if we should show approve/reject buttons for this row
                                                    const canApproveRejectThisRow = userCanApproveReject && 
                                                        effectiveFilter === 'group' &&
                                                        item._id &&
                                                        (item.status === 'pending' || item.status === 'initial');
                                                    
                                                    return (
                                                        <tr 
                                                            key={index} 
                                                            onClick={isClickable ? () => handleRowClick(item) : undefined}
                                                            className={`transition-colors ${
                                                                isClickable ? 'hover:bg-gray-50 cursor-pointer' : ''
                                                            } ${
                                                                isItemDirty(item) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                                            } ${
                                                                item.status === 'rejected' ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                                                            }`}
                                                        >
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                                                <div className="flex items-center gap-2">
                                                                    {isItemDirty(item) && (
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
                                                                {shouldShowRemittanceInput(item) ? (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <input
                                                                            type="number"
                                                                            value={currentRemittance === '' ? '' : currentRemittance}
                                                                            onChange={(e) => handleRemittanceChange(item.entityId, e.target.value)}
                                                                            onBlur={() => handleRemittanceBlur(item.entityId)}
                                                                            min={item.savedRemittance || 0}
                                                                            step="0.01"
                                                                            className="w-36 px-3 py-1.5 border border-gray-300 rounded-md text-right focus:ring-indigo-500 focus:border-indigo-500"
                                                                        />
                                                                        {item.wasApproved && item.collectionChanged && (
                                                                            <span className="text-xs text-orange-600 italic" title="Collection updated after approval">
                                                                                Updated
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <span className="font-medium">{formatPrice(currentRemittance)}</span>
                                                                        {item.status === 'approved' && (
                                                                            <span className="text-xs text-green-600">✓</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                                {item.amountSitDown ? Number(item.amountSitDown).toFixed(0) : '0'}
                                                            </td>
                                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                                                                bccVsRemittances < 0 ? 'text-red-600' : 
                                                                bccVsRemittances > 0 ? 'text-orange-600' : 
                                                                'text-green-600'
                                                            }`}>
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {formatPrice(bccVsRemittances)}
                                                                    {bccVsRemittances > 0 && item.hasCollection && (
                                                                        <span className="text-xs" title="Needs remittance adjustment">⚠️</span>
                                                                    )}
                                                                </div>
                                                            </td>
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
                                                                        {/* History button - ONLY show if there's MORE THAN ONE history entry */}
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
                                                                        
                                                                        {/* Show dash only if there are NO buttons visible */}
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
                                                        grandTotal.totalRemittance
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
                                                                {formatPrice(grandTotal.totalRemittance)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {Number(grandTotal.amountSitDown).toFixed(0)}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-700 text-right">
                                                                {formatPrice(grandTotalBccVsRemittances)}
                                                            </td>
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
                        {/* Modal Header */}
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
                        
                        {/* Modal Body */}
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
                                        // Remove leading zeros from code
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
                                                        {formatPrice(client.totalNetCollection || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        {/* Modal Footer */}
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
                        {/* Modal Header */}
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
                        
                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            {selectedItemHistory.history && selectedItemHistory.history.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedItemHistory.history
                                        .slice()
                                        .reverse() // Show most recent first
                                        .map((entry, index) => {
                                            // Determine the styling based on action
                                            const isReopened = entry.action === 'reopened_due_to_collection_change';
                                            const isApproved = entry.action === 'approved';
                                            const isRejected = entry.action === 'rejected';
                                            const isSave = entry.action === 'saved';
                                            
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
                                                    
                                                    {(entry.reason || entry.rejection_reason) && (
                                                        <div className="text-sm text-gray-700 mb-3 italic bg-white bg-opacity-50 p-2 rounded">
                                                            "{entry.reason || entry.rejection_reason}"
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
                                                            <span className="text-gray-600">Remittance:</span>
                                                            <span className="ml-2 font-medium">
                                                                {formatPrice(
                                                                    entry.total_remittance || 
                                                                    entry.previous_total_remittance || 0
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
                                                    
                                                    {/* Show previous values for reopened entries */}
                                                    {isReopened && entry.previous_total_net_collection && (
                                                        <div className="mt-3 pt-3 border-t border-gray-300">
                                                            <div className="text-xs text-gray-600 font-semibold mb-2">Previous Values (Before Reopening):</div>
                                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                                <div>
                                                                    <span className="text-gray-500">Previous Collection:</span>
                                                                    <span className="ml-2 font-medium">{formatPrice(entry.previous_total_net_collection)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Previous Remittance:</span>
                                                                    <span className="ml-2 font-medium">{formatPrice(entry.previous_total_remittance)}</span>
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
                        
                        {/* Modal Footer */}
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
        </Layout>
    );
}