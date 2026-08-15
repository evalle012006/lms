import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Calendar, Download, RefreshCw, Eye, EyeOff, Info, ArrowUpDown, Lock, Unlock, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import moment from 'moment';
import { useRouter } from "next/router";
import { setCashCollectionBranch } from "@/redux/actions/cashCollectionActions";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import Layout from '@/components/Layout';
import { buildModernBranchCashCollectionsSourceQuery, getDefaultViewMode, shouldIncludeViewMode } from '@/lib/utils';
import InputNumber from "@/lib/ui/InputNumber";
import { setBranch } from "@/redux/actions/branchActions";
import CashCollectionsExcelExport from '@/components/transactions/CashCollectionsExcelExport';
import BranchClosingDocumentsModal from '@/components/transactions/BranchClosingDocumentsModal';

// Row background colors - Tailwind safelist (do not remove):
// bg-yellow-100 bg-blue-100 bg-orange-100

const ModernBranchCashCollections = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  
  const currentUser = useSelector(state => state.user.data);
  const currentBranch = useSelector(state => state.branch.data);
  const branchList = useSelector(state => state.branch.list);
  const branchCollectionData = useSelector(state => state.cashCollection.branch);
  const currentDate = useSelector(state => state.systemSettings.currentDate);
  const currentTime = useSelector(state => state.systemSettings.currentTime);
  const isHoliday = useSelector(state => state.systemSettings.holiday);
  const isWeekend = useSelector(state => state.systemSettings.weekend);
  
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => {
    // Check if there's a date in the URL parameters, otherwise use current date
    return router.query.date || currentDate || moment().format('YYYY-MM-DD');
  });
  const [viewMode, setViewMode] = useState(() => {
    // Set default based on user role
    if (currentUser && !shouldIncludeViewMode(currentUser)) {
      return getDefaultViewMode(currentUser); // default for restricted users
    }
    return router.query.viewMode || getDefaultViewMode(currentUser);
  });
  const [selectedBranchGroup, setSelectedBranchGroup] = useState('mine');
  const [selectedLoGroup, setSelectedLoGroup] = useState('all');
  const [numberOfLo, setNumberOfLo] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [data, setData] = useState([]);
  
  const [viewingNestedContent, setViewingNestedContent] = useState(!!router.query.id);
  const [parentEntityName, setParentEntityName] = useState('');
  const [currentFilter, setCurrentFilter] = useState('');
  const [currentLevel, setCurrentLevel] = useState(null);
  const [parentId, setParentId] = useState(router.query.parentId || null);
  const [parentViewMode, setParentViewMode] = useState(router.query.parentViewMode || null);

  const [cohData, setCohData] = useState();
  const [cohAmount, setCohAmount] = useState(0);

  const [branchFilterList, setBranchFilterList] = useState([]);
  const [loFilterList, setLoFilterList] = useState([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('');
  const [selectedLoFilter, setSelectedLoFilter] = useState('');

  const [repairLoading, setRepairLoading] = useState({});
  const [repairStatus, setRepairStatus] = useState({}); // Track repair status per group
  const [showRepairDialog, setShowRepairDialog] = useState(false);
  const [selectedRepairGroup, setSelectedRepairGroup] = useState(null);
  const [repairResult, setRepairResult] = useState(null);

  const [showClosingDocsModal, setShowClosingDocsModal] = useState(false);
  const [closingDocsBranch, setClosingDocsBranch] = useState(null);
  const [branchReadiness, setBranchReadiness] = useState({ loading: true, readyToUpload: false, readyToClose: false });
  const [readinessVersion, setReadinessVersion] = useState(0);
  const [bmBranchStatus, setBmBranchStatus] = useState(null);
  const [branchCheckLoading, setBranchCheckLoading] = useState({}); // { [branchId]: true }
  const [reopenWarning, setReopenWarning] = useState(null); // { row, isBranchLevel, branchId, docCount }
  const cohBreakdownStable = useMemo(() => cohData?.breakdown || [], [cohData?.breakdown]);
  /**
   * Check if a group has discrepancies that need repair
   */
  const checkGroupNeedsRepair = async (groupId) => {
      try {
          const response = await fetchWrapper.post(
              getApiBaseUrl() + 'transactions/cash-collections/verify',
              {
                  groupId: groupId,
                  dateAdded: dateFilter,
                  repair: false
              }
          );
          
          if (response.success) {
              return {
                  needsRepair: response.data.discrepancyCount > 0,
                  discrepancyCount: response.data.discrepancyCount,
                  discrepancies: response.data.discrepancies
              };
          }
          return { needsRepair: false, discrepancyCount: 0 };
      } catch (error) {
          console.error('Error checking repair status:', error);
          return { needsRepair: false, discrepancyCount: 0, error: error.message };
      }
  };

  /**
   * Handle repair button click - opens confirmation dialog
   */
  const handleRepairClick = async (row) => {
      setRepairLoading(prev => ({ ...prev, [row._id]: true }));
      
      try {
          // First check if repair is needed
          const checkResult = await checkGroupNeedsRepair(row._id);
          
          if (!checkResult.needsRepair) {
              toast.info('No discrepancies found. Transaction is already synced.');
              setRepairStatus(prev => ({ ...prev, [row._id]: 'ok' }));
              return;
          }
          
          // Show confirmation dialog with discrepancy details
          setSelectedRepairGroup({
              ...row,
              discrepancies: checkResult.discrepancies,
              discrepancyCount: checkResult.discrepancyCount
          });
          setShowRepairDialog(true);
          
      } catch (error) {
          toast.error('Failed to check repair status: ' + error.message);
      } finally {
          setRepairLoading(prev => ({ ...prev, [row._id]: false }));
      }
  };

  /**
   * Execute the repair
   */
  const executeRepair = async () => {
      if (!selectedRepairGroup) return;
      
      setRepairLoading(prev => ({ ...prev, [selectedRepairGroup._id]: true }));
      
      try {
          const response = await fetchWrapper.post(
              getApiBaseUrl() + 'transactions/cash-collections/verify',
              {
                  groupId: selectedRepairGroup._id,
                  dateAdded: dateFilter,
                  repair: true
              }
          );
          
          if (response.success) {
              const { repairResults } = response.data;
              
              if (repairResults && repairResults.repaired.length > 0) {
                  toast.success(`Successfully repaired ${repairResults.repaired.length} loan(s)`);
                  setRepairStatus(prev => ({ ...prev, [selectedRepairGroup._id]: 'repaired' }));
                  setRepairResult(repairResults);
                  
                  // Refresh data after repair
                  setTimeout(() => {
                      fetchCashCollectionsData(dateFilter);
                  }, 1500);
              } else if (repairResults && repairResults.failed.length > 0) {
                  toast.warning(`Repair completed with ${repairResults.failed.length} failure(s)`);
                  setRepairResult(repairResults);
              } else {
                  toast.info('No repairs were needed');
                  setRepairStatus(prev => ({ ...prev, [selectedRepairGroup._id]: 'ok' }));
              }
          } else {
              toast.error('Repair failed: ' + response.message);
          }
      } catch (error) {
          toast.error('Failed to repair: ' + error.message);
      } finally {
          setRepairLoading(prev => ({ ...prev, [selectedRepairGroup._id]: false }));
          setShowRepairDialog(false);
          setSelectedRepairGroup(null);
      }
  };

  /**
   * Cancel repair dialog
   */
  const cancelRepair = () => {
      setShowRepairDialog(false);
      setSelectedRepairGroup(null);
      setRepairResult(null);
  };

  // Helper function to determine row background color
  const getRowBgColor = (row) => {
    // Mapping object with complete class strings for Tailwind purge
    const bgColorMap = {
      draft: 'bg-orange-100',
      yellow: 'bg-yellow-100',
      blue: 'bg-blue-100',
      stale: 'bg-purple-100', 
      none: '',
    };

    // No coloring on weekends or holidays
    if (isWeekend || isHoliday) {
      // temporary disable colors on holiday/weekend
      // return bgColorMap.none;
    }

    // Draft rows at group level
    if (row.isDraft && currentFilter === 'group') {
      return bgColorMap.draft;
    }

    if (currentFilter === 'branch' && row.documentsStale) {
      return bgColorMap.stale;
    }

    // Role-based coloring logic
    if (currentUser.role.rep >= 3) {
      // For role.rep >= 3: blue when activeClients > 0 and groupStatus is not closed
      if (row.activeClients > 0 && row.groupStatus !== 'closed') {
        return bgColorMap.blue;
      }
    } else {
      // For role.rep < 3
      if (row.activeClients > 0) {
        if (row.groupStatus !== 'closed') {
          // groupStatus is not closed → blue
          return bgColorMap.blue;
        } else if (row.groupStatus === 'closed' && row.approvalStatus === 'open') {
          // groupStatus is closed and approvalStatus is open → yellow
          return bgColorMap.yellow;
        }
      }
    }

    return bgColorMap.none;
  };
  
  const fetchBranchListForFilter = async () => {
    try {
      const response = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
      if (response.success) {
        let branches = [];
        
        response.branches && response.branches.filter(branch => branch.code !== 'B000').forEach(branch => {
          // Apply role-based filtering
          let shouldInclude = true;
          
          if (currentUser.role.shortCode === 'deputy_director') {
            shouldInclude = branch.divisionId === currentUser.divisionId;
          } else if (currentUser.role.shortCode === 'regional_manager') {
            shouldInclude = branch.regionId === currentUser.regionId;
          } else if (currentUser.role.shortCode === 'area_admin') {
            shouldInclude = branch.areaId === currentUser.areaId;
          }
          
          if (shouldInclude) {
            branches.push({
              _id: branch._id,
              code: branch.code,
              name: branch.code ? `${branch.code} - ${branch.name}` : branch.name,
            });
          }
        });
        
        // Sort branches by code
        branches.sort((a, b) => {
          if (a.code && b.code) {
            return a.code.localeCompare(b.code);
          }
          return 0;
        });
        
        setBranchFilterList(branches);
      } else {
        toast.error('Error retrieving branches list.');
      }
    } catch (error) {
      console.error('Error fetching branch list:', error);
      toast.error('Error retrieving branches list.');
    }
  };

  const fetchLoListForFilter = async (branchId) => {
    try {
      if (!branchId) {
        console.error('Branch ID not found');
        return;
      }
      
      const url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId: branchId });
      const response = await fetchWrapper.get(url);
      
      if (response.success) {
        let userList = [];
        
        response.users && response.users.forEach(u => {
          const name = `${u.firstName} ${u.lastName}`;
          userList.push({
            _id: u._id,
            name: name,
            label: name,
            loNo: u.loNo,
          });
        });
        
        // Sort by loNo
        userList.sort((a, b) => { return a.loNo - b.loNo; });
        
        setLoFilterList(userList);
      } else {
        toast.error('Error retrieving loan officer list.');
      }
    } catch (error) {
      console.error('Error fetching LO list:', error);
      toast.error('Error retrieving loan officer list.');
    }
  };

  const handleBranchFilterChange = (e) => {
    const branchId = e.target.value;
    setSelectedBranchFilter(branchId);
    
    if (branchId) {
      const query = {
        id: branchId,
        branchId: branchId,
        filter: 'lo',
      };
      
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = viewMode;
      }
      
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }
  };

  const handleLoFilterChange = (e) => {
    const loId = e.target.value;
    setSelectedLoFilter(loId);
    
    if (loId) {
      const query = {
        id: loId,
        loId: loId,
        filter: 'group',
        parentId: router.query.parentId || router.query.branchId || router.query.id,
        branchId: router.query.parentId || router.query.branchId || router.query.id,
      };
      
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = viewMode;
      }
      
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }
  };

  const fetchBranchApprovalStatus = async (branchIds, date) => {
    try {
      const response = await fetchWrapper.post(getApiBaseUrl() + 'branches/get-approval-status', {
        branchIds: branchIds,
        dateFor: date
      });
      
      if (response.success) {
        return response.data; // Returns array of { branchId, status, userName }
      }
      return [];
    } catch (error) {
      console.error('Error fetching branch approval status:', error);
      return [];
    }
  };

  const getCurrentBranch = async () => {
    if (currentUser.role.rep >= 3 && currentDate) {
      try {
        const apiUrl = `${getApiBaseUrl()}branches?`;
        const params = { 
          _id: currentUser.designatedBranchId, 
          date: currentDate 
        };
        const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
        
        if (response.success) {
          dispatch(setBranch(response.branch));
          // Set COH data from the fetched branch
          if (response.branch?.cashOnHand?.length > 0) {
            setCohData(response.branch.cashOnHand[0]);
          } else {
            setCohData({ amount: 0 });
          }
        } else {
          toast.error('Error while loading branch data');
        }
      } catch (error) {
        console.error('Error fetching current branch:', error);
        toast.error('Error while loading branch data');
      }
    }
  };

  const cohValid = (() => {
    if (cohAmount === null || cohAmount === undefined || cohAmount === '') return false;
    const numeric = Number(String(cohAmount).replace(/,/g, ''));
    return !isNaN(numeric) && numeric >= 0;
  })();

  const handleCOHDataChange = async (value, breakdown = cohData?.breakdown ?? null) => {
    if (value && isNaN(parseFloat(value))) { toast.error('Please enter a valid number'); return; }
    const amount = value ? parseFloat(value) : 0;
    if (amount < 0) { toast.error('COH amount cannot be negative'); setCohAmount(0); return; }

    let updatedCohData = {...cohData};
    if (cohData && cohData.hasOwnProperty("_id")) {
        updatedCohData.amount = amount;
        updatedCohData.breakdown = breakdown;
        updatedCohData.modifiedBy = currentUser._id;
    } else {
        updatedCohData.branchId = currentUser.designatedBranchId;
        updatedCohData.amount = amount;
        updatedCohData.breakdown = breakdown;
        updatedCohData.insertedBy = currentUser._id;
        updatedCohData.dateAdded = currentDate;
    }

    try {
        const apiUrl = getApiBaseUrl() + 'branches/save-update-coh';
        const response = await fetchWrapper.post(apiUrl, updatedCohData);
        if (response.success) {
            toast.success('Cash on Hand data successfully saved.');
            setCohData(updatedCohData);
        } else {
            toast.error('Error saving Cash on Hand data.');
        }
    } catch (error) {
        console.error('Error saving COH data:', error);
        toast.error('Error saving Cash on Hand data.');
    }
  };

  // Action handlers for open/close transactions
  const performOpen = async (row) => {
    // Determine if we're operating on a branch or loan officer
    const isBranchLevel = currentFilter === 'branch';
    const isAdmin = currentUser.role.rep === 1;
    
    // For branch level, check if there are any transactions
    if (isBranchLevel && row.approvalStatus === 'open' && !isAdmin) {
      toast.info('Branch is already unlocked.');
      return;
    }

    // For Branch level, check if there are any LO transactions added
    // Allow admins to bypass this check
    if (isBranchLevel && row.groupStatus === null && !isAdmin) {
      toast.error('Cannot lock branch transactions when no Loan Officer transactions added for the day!');
      return;
    }
    
    // For LO level, check if there are active clients
    // Allow admins to bypass this check
    if (!isBranchLevel && row.activeClients === 0 && row.actualLoanCollection === 0 && !isAdmin) {
      toast.error('No transaction detected for this Loan Officer!');
      return;
    }
    
    // Allow admins to bypass the "allNew" check
    if (!isBranchLevel && row.hasOwnProperty("allNew") && !isAdmin) {
      toast.error("All transactions are current releases no need to change the group's status.");
      return;
    }

    setLoading(true);

    const dateFor = dateFilter !== currentDate ? dateFilter : currentDate;
    
    let data = { 
      mode: 'open', 
      currentDate: dateFor, 
      transactionType: row.transactionType,
      isAdmin: isAdmin // Add flag to identify admin override
    };

    // Add the appropriate ID based on the level
    if (isBranchLevel) {
      data.branchId = row._id;
      data.userId = currentUser._id;
      data.userName = `${currentUser.firstName} ${currentUser.lastName}`;
    } else {
      data.loId = row._id;
      // Include branchId for updating branch approval status when reopening LO
      data.branchId = router.query.branchId || router.query.id || currentUser.designatedBranchId;
      data.userId = currentUser._id;
      data.userName = `${currentUser.firstName} ${currentUser.lastName}`;
    }

    try {
      const response = await fetchWrapper.post(
        getApiBaseUrl() + 'transactions/cash-collections/update-group-transaction-status', 
        data
      );
      
      if (response.success) {
        const entityType = isBranchLevel ? 'Branch' : 'Loan Officer';
        toast.success(`${row.name} ${entityType.toLowerCase()} transactions are now unlocked!`);
        // Refresh the data
        await fetchCashCollectionsData(dateFilter);
        setReadinessVersion(v => v + 1);
      } else if (response.error && response.message) {
        toast.error(response.message);
      } else {
        toast.error(`Error unlocking ${isBranchLevel ? 'branch' : 'loan officer'} transactions.`);
      }
    } catch (error) {
      console.error('Error opening transactions:', error);
      toast.error(`Error unlocking ${isBranchLevel ? 'branch' : 'loan officer'} transactions.`);
    }

    setLoading(false);
  };

  const handleOpen = async (row) => {
    const isBranchLevel = currentFilter === 'branch';
    const isAdmin = currentUser.role.rep === 1;

    // Admins bypass the warning too — same pattern as every other
    // admin-override check already in this file. If you want admins to
    // still see the warning (arguably they should, since it's informational
    // not a permission gate), drop the `&& !isAdmin` below.
    if (!isAdmin) {
        const branchId = isBranchLevel
            ? row._id
            : (router.query.branchId || router.query.id || currentUser.designatedBranchId);
        const dateFor = dateFilter !== currentDate ? dateFilter : currentDate;

        const listUrl = getApiBaseUrl() + 'transactions/closing-documents/list?' +
            new URLSearchParams({ branchId, dateFor });
        const listResponse = await fetchWrapper.get(listUrl);

        const totalDocCount = Object.values(listResponse.documentsByType || {})
            .reduce((sum, arr) => sum + arr.length, 0);

        if (listResponse.success && totalDocCount > 0) {
            setReopenWarning({ row, isBranchLevel, branchId, docCount: totalDocCount });
            return; // wait for user confirmation via the modal
        }
    }

    // No existing documents — nothing to warn about, proceed directly.
    await performOpen(row);
  };

  const handleClose = async (row) => {
    if (currentFilter === 'branch' && branchCheckLoading[row._id]) return;
    // Determine if we're operating on a branch or loan officer
    const isBranchLevel = currentFilter === 'branch';  // FIXED: Changed from viewMode === 'branch'
    const isAdmin = currentUser.role.rep === 1;

    // For Branch level, check if there are any LO transactions added
    // Allow admins to bypass this check
    if (isBranchLevel && row.groupStatus === null && !isAdmin) {
      toast.error('Cannot lock branch transactions when no Loan Officer transactions added for the day!');
      return;
    }

    if (isBranchLevel) {
      if (!isAdmin) {
        // FIXED: checkUrl was referenced but never declared — a straight
        // ReferenceError that would throw the moment anyone clicked this
        // path, breaking branch-level close/review entirely. Restoring
        // the URL construction and the loading spinner state that were
        // both part of this block before.
        setBranchCheckLoading(prev => ({ ...prev, [row._id]: true }));

        const checkUrl = getApiBaseUrl() + 'transactions/closing-documents/branch-check?' +
          new URLSearchParams({ branchId: row._id, dateFor: dateFilter !== currentDate ? dateFilter : currentDate });
        const checkResponse = await fetchWrapper.get(checkUrl);

        setBranchCheckLoading(prev => ({ ...prev, [row._id]: false }));

        if (!checkResponse.success) {
          toast.error(checkResponse.message || 'Unable to verify branch closing readiness.');
          return;
        }
        if (!checkResponse.readyToUpload) {
          toast.error('Some Loan Officers still have open or pending transactions. All LO transactions must be closed first.');
          return;
        }
      }
      setClosingDocsBranch(row);
      setShowClosingDocsModal(true);
      return;
    }

    // For LO level, check if all LO transactions are already closed
    // Allow admins to bypass this check
    if (!isBranchLevel && row.groupStatus === 'closed' && !isAdmin) {
      toast.info('All transactions are already closed!')
      return;
    }
    
    // For LO level, check if there are active clients
    // Allow admins to bypass this check
    if (!isBranchLevel && row.activeClients === 0 && row.actualLoanCollection === 0 && !isAdmin) {
      toast.error('No transaction detected for this Loan Officer!');
      return;
    }
    
    // Allow admins to bypass the "allNew" check
    if (!isBranchLevel && row.hasOwnProperty("allNew") && !isAdmin) {
      toast.error("All transactions are current releases no need to change the group's status.");
      return;
    }

    setLoading(true);

    const dateFor = dateFilter !== currentDate ? dateFilter : currentDate;

    let data = { 
      mode: 'close', 
      currentDate: dateFor, 
      currentTime: currentTime, 
      transactionType: row.transactionType,
      isAdmin: isAdmin
    };

    // Add the appropriate ID based on the level
    if (isBranchLevel) {
      data.branchId = row._id;
      data.userId = currentUser._id;
      data.userName = `${currentUser.firstName} ${currentUser.lastName}`;
    } else {
      // For LO level, add loId AND branchId
      data.loId = row._id;
      data.branchId = router.query.branchId || router.query.id || currentUser.designatedBranchId;
      data.userId = currentUser._id;
      data.userName = `${currentUser.firstName} ${currentUser.lastName}`;
    }

    console.log('API request data:', data);

    try {
      const response = await fetchWrapper.post(
        getApiBaseUrl() + 'transactions/cash-collections/update-group-transaction-status', 
        data
      );
      
      if (response.success) {
        const entityType = isBranchLevel ? 'Branch' : 'Loan Officer';
        const actionText = isBranchLevel ? 'locked and approved' : 'closed';
        toast.success(`${row.name} ${entityType.toLowerCase()} transactions are now ${actionText}!`);
        // Refresh the data
        await fetchCashCollectionsData(dateFilter);
        setReadinessVersion(v => v + 1);
      } else if (response.error && response.message) {
        toast.error(response.message);
      } else {
        toast.error(`Error ${isBranchLevel ? 'locking' : 'closing'} ${isBranchLevel ? 'branch' : 'loan officer'} transactions.`);
      }
    } catch (error) {
      console.error('Error closing transactions:', error);
      toast.error(`Error ${isBranchLevel ? 'locking' : 'closing'} ${isBranchLevel ? 'branch' : 'loan officer'} transactions.`);
    }

    setLoading(false);
  };

  const buildApiParams = (baseParams) => {
    const params = new URLSearchParams();
    
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    
    return params;
  };

  const formatWithComparison = (current, previous, groupStatus = null) => {
    if (current === undefined || previous === undefined || current === '-' || previous === '-') {
      return current;
    }
    
    // If groupStatus is null, don't show comparison
    if (groupStatus === null) {
      return current;
    }
    
    let currentValue, previousValue, diff;
    
    if (typeof current === 'string' && current.includes('₱')) {
      currentValue = parseFloat(current.replace('₱', '').replace(/,/g, ''));
      previousValue = parseFloat(previous.replace('₱', '').replace(/,/g, ''));
    } else if (typeof current === 'string' && current.includes('/')) {
      return current;
    } else {
      currentValue = current;
      previousValue = previous;
    }
    
    if (isNaN(currentValue) || isNaN(previousValue)) {
      return current;
    }

    diff = currentValue - previousValue;
    if (diff === 0) return current;
    
    const isPositive = diff > 0;
    const sign = isPositive ? '+' : '-';
    
    let diffFormatted;
    if (typeof current === 'string' && current.includes('₱')) {
      diffFormatted = `₱${Math.abs(diff).toLocaleString()}`;
    } else {
      diffFormatted = Math.abs(diff);
    }
    
    const diffText = `${sign}${diffFormatted}`;
    const color = isPositive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
    
    return (
      <div className="whitespace-nowrap">
        <span>{current}</span>
        {' '}
        <span style={{ color, fontSize: '0.9em', fontWeight: '400' }}>
          ({diffText})
        </span>
      </div>
    );
  };

  const formatWithComparison2 = (current, diff, groupStatus = null, positive = false) => {
    if (current === undefined) {
      return current;
    }
    
    // If groupStatus is null, don't show comparison
    if (groupStatus === null) {
      return current;
    }

    if (diff === 0) {
      return current;
    }
    
    const sign = positive ? '-' : diff > 0 ? '+' : '';
    const isPositive = positive || diff >= 0;

    let diffFormatted;

    if (typeof current === 'string' && current.includes('₱')) {
      diffFormatted = `₱${Math.abs(diff).toLocaleString()}`;
    } else {
      diffFormatted = Math.abs(diff);
    }

    const diffText = diff ? `(${sign}${diffFormatted})` : '';
    const color = isPositive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
    
    return (
      <div className="whitespace-nowrap">
        <span>{current}</span>
        {' '}
        <span style={{ color, fontSize: '0.9em', fontWeight: '400' }}>
          {diffText}
        </span>
      </div>
    );
  };

  const getNextLevelFilter = (currentViewMode) => {
    switch (currentViewMode) {
      case 'division':
        return 'region';
      case 'region':
        return 'area';
      case 'area':
        return 'branch';
      default:
        return 'branch';
    }
  };

  const getIdParamName = (mode) => {
    switch (mode) {
      case 'division':
        return 'divisionId';
      case 'region':
        return 'regionId';
      case 'area':
        return 'areaId';
      case 'branch':
      default:
        return 'branchId';
    }
  };

  // Helper function for formatting Current Release Person
  const formatCurrentReleasePerson = (newValue, relValue) => {
    // Convert to numbers in case they come as strings
    const newNum = Number(newValue);
    const relNum = Number(relValue);
    
    // Check if both are valid numbers
    if (isNaN(newNum) || isNaN(relNum)) {
      return '-';
    }
    
    // If both are 0, return '-'
    if (newNum === 0 && relNum === 0) {
      return '-';
    }
    
    // Otherwise, return formatted string with spaces
    return `${newNum} / ${relNum}`;
  };

  const fetchCashCollectionsData = async (date) => {
    console.log('Fetching cash collections data for date:', date);
    setLoading(true);
    try {
      const formattedDate = date ? moment(date).format('YYYY-MM-DD') : currentDate;
      const currentSystemDate = currentDate || moment().format('YYYY-MM-DD');
      
      let baseParams = {
        dateAdded: formattedDate,
        currentDate: currentSystemDate,
        _name: 'get_cash_collections_page_data',
      };

      if ((currentUser.role.rep === 3 || currentFilter === 'lo') && selectedLoGroup !== 'all') {
        baseParams.loGroup = selectedLoGroup;
      }
      
      let filter = viewMode;
      
      // Handle nested content view based on router query
      if (router.query.id) {
        // Check if we're in loan officer (lo) or group view mode based on filter parameter
        if (router.query.filter === 'lo') {
          // Show loan officers for the selected branch
          baseParams.branchId = router.query.id; 
          filter = 'lo';
          // console.log('LO LEVEL: Showing loan officers in branch', router.query.id);
        } 
        else if (router.query.filter === 'group') {
          // Show groups for the selected loan officer
          baseParams.loId = router.query.id;
          baseParams.branchId = router.query.parentId; // Branch ID should be in parentId
          filter = 'group';
          // console.log('GROUP LEVEL: Showing groups for loan officer', router.query.id);
        }
        // Standard hierarchy navigation
        else if (viewMode === 'division') {
          if (router.query.grandParentId || router.asPath.includes('grandParentId')) {
            baseParams.areaId = router.query.id;
            filter = 'branch';
            // console.log('FOURTH LEVEL (Division view): Showing branches in area', router.query.id);
          } 
          else if (router.query.parentId) {
            baseParams.regionId = router.query.id;
            filter = 'area';
            // console.log('THIRD LEVEL (Division view): Showing areas in region', router.query.id);
          } else {
            baseParams.divisionId = router.query.id;
            filter = 'region';
            // console.log('SECOND LEVEL (Division view): Showing regions in division', router.query.id);
          }
        } else if (viewMode === 'region') {
          if (router.query.parentId || currentFilter === 'branch') {
            baseParams.areaId = router.query.id;
            filter = 'branch';
            // console.log('THIRD LEVEL (Region view): Showing branches in area', router.query.id);
          } else {
            baseParams.regionId = router.query.id;
            filter = 'area';
            // console.log('SECOND LEVEL (Region view): Showing areas in region', router.query.id);
          }
        } else if (viewMode === 'area') {
          baseParams.areaId = router.query.id;
          filter = 'branch';
          // console.log('SECOND LEVEL (Area view): Showing branches in area', router.query.id);
        } else {
          baseParams.branchId = router.query.id;
          filter = 'branch';
          // console.log('Branch view: Showing branch details for', router.query.id);
        }
      }
      
      // FIXED: Handle selectedBranchGroup filtering - only apply user-specific filtering when not in nested navigation
      if (selectedBranchGroup === 'mine' && !router.query.filter) {
        // When 'mine' is selected, filter according to the user's role and permissions
        // BUT only if we're not in nested navigation (router.query.id doesn't exist)
        
        if (currentUser.role.shortCode === 'deputy_director') {
          // Deputy Director - filter by division
          // Only apply user-specific filtering if not navigating into a specific entity
          if (!router.query.id) {
            baseParams.divisionId = currentUser.divisionId;
          }
          if (viewMode === 'branch') filter = 'branch';
          else if (viewMode === 'area') filter = 'area';
          else if (viewMode === 'region') filter = 'region';
          else if (viewMode === 'division') filter = 'division';
        } 
        else if (currentUser.role.shortCode === 'regional_manager') {
          // Regional Manager - filter by region
          // Only apply user-specific filtering if not navigating into a specific entity
          if (!router.query.id) {
            baseParams.regionId = currentUser.regionId;
          }
          if (viewMode === 'branch') filter = 'branch';
          else if (viewMode === 'area') filter = 'area';
          else if (viewMode === 'region') filter = 'region';
          else if (viewMode === 'division') {
            // Only override to region view if not in nested navigation
            if (!router.query.id) {
              filter = 'region';
              // console.log('Overriding to region view for Regional Manager');
            }
            // If in nested navigation, keep the filter that was set above
          }
        }
        // ADDED: Area Admin filtering logic
        else if (currentUser.role.shortCode === 'area_admin') {
          // Area Admin - filter by area
          // Only apply user-specific filtering if not navigating into a specific entity
          if (!router.query.id) {
            baseParams.areaId = currentUser.areaId;
          }
          filter = 'branch'; // Area admins see branches in their area
          // console.log('Area Admin filtering by areaId:', currentUser.areaId);
        }
      } 
      // UPDATED: When 'all' is selected, don't add any filtering IDs unless they're already set from router.query.id
      else if (selectedBranchGroup === 'all' && !router.query.filter) {
        // Remove user-specific IDs when 'all' is selected, but keep router-based IDs for navigation
        // Don't add divisionId or regionId based on user data
      }
      
      // If the filter parameter is explicitly set in the query, override our calculated filter
      if (router.query.filter) {
        filter = router.query.filter;
      }
      
      // Set the filter based on user role if not already overridden
      if (!router.query.filter) {
        if (currentUser.role.rep < 3) {
          baseParams.filter = filter;
        } else if (currentUser.role.rep === 3) {
          // Handle both branch managers and area managers with role.rep = 3
          if (currentUser.role.shortCode === 'area_manager' || currentUser.role.shortCode === 'area_admin') {
            baseParams.filter = 'branch'; // Area managers see branches in their area
          } else {
            baseParams.filter = 'lo'; // Branch managers see loan officers
          }
        } else {
          baseParams.filter = 'group'; // Group leaders see groups
        }
        filter = baseParams.filter;
      } else {
        baseParams.filter = filter;
      }
  
      setCurrentFilter(filter);
      setCurrentLevel(filter);
      
      // Build the API parameters based on the selected branch group
      const params = buildApiParams({
        ...baseParams,
        // Only include these parameters if we're viewing a specific entity from router.query.id
        // OR if we're in 'mine' mode and need to filter by user's assigned entities
        loId: (router.query.filter === 'group' || router.query.loId) ? router.query.loId || router.query.id : 
              (currentUser.role.rep === 4 ? currentUser._id : null),
        
        // UPDATED: For 'all' mode, only include IDs that were set from router.query.id (nested navigation)
        // For 'mine' mode with non-admin roles, include user's IDs when appropriate
        // IMPORTANT: Don't override IDs that were already set in baseParams during nested navigation
        branchId: baseParams.branchId || router.query.branchId || 
          (selectedBranchGroup === 'mine' && currentUser.role.rep !== 1 && !router.query.id ? currentUser.designatedBranchId : null),
        
        // UPDATED: Include areaId based on role and selection mode
        // Don't override if already set in baseParams during nested navigation
        areaId: baseParams.areaId || 
          (selectedBranchGroup === 'mine' && currentUser.role.rep !== 1 && !router.query.id ? currentUser.areaId : null),
        
        // UPDATED: For area admins, don't include division/region IDs when filtering by 'mine'
        // Don't override if already set in baseParams during nested navigation
        divisionId: baseParams.divisionId || 
          (selectedBranchGroup === 'mine' && 
           currentUser.role.rep !== 1 && 
           currentUser.role.shortCode !== 'area_admin' && 
           !router.query.id ? currentUser.divisionId : null),
        
        regionId: baseParams.regionId || 
          (selectedBranchGroup === 'mine' && 
           currentUser.role.rep !== 1 && 
           currentUser.role.shortCode !== 'area_admin' && 
           !router.query.id ? currentUser.regionId : null),
      });
      
      // console.log('API parameters:', params.toString());
      const response = await fetchWrapper.get(getApiBaseUrl() + 'data/get_cash_collections_page_data?' + params.toString());
      // console.log('API Response:', response);
      
      if (router.query.id && response && response.parentName) {
        setParentEntityName(response.parentName);
      } else {
        setParentEntityName('');
      }
  
      if (response && response.data) {
        const mapTotal = (name, loNo, acc, item) => ({
          csf: (acc.csf || 0) + (item.csf || 0),
          mcbu: (acc.mcbu || 0) + (item.mcbu || 0),
          name: name,
          transactionType: 'all',
          c_csf: (acc.c_csf || 0) + (item.c_csf || 0),
          csfIn: (acc.csfIn || 0) + (item.csfIn || 0),
          c_mcbu: (acc.c_mcbu || 0) + (item.c_mcbu || 0),
          excess: (acc.excess || 0) + (item.excess || 0),
          mispay: (acc.mispay || 0) + (item.mispay || 0),
          prev_csf: (acc.prev_csf || 0) + (item.prev_csf || 0),
          pastDueNo: (acc.pastDueNo || 0) + (item.pastDueNo || 0),
          prev_mcbu: (acc.prev_mcbu || 0) + (item.prev_mcbu || 0),
          cashOnHand: (acc.cashOnHand || 0) + (item.cashOnHand || 0),
          mcbuReturn: (acc.mcbuReturn || 0) + (item.mcbuReturn || 0),
          otherIncome: (acc.otherIncome || 0) + (item.otherIncome || 0),
          prev_excess: (acc.prev_excess || 0) + (item.prev_excess || 0),
          prev_mispay: (acc.prev_mispay || 0) + (item.prev_mispay || 0),
          csfReturnAmt: (acc.csfReturnAmt || 0) + (item.csfReturnAmt || 0),
          mcbuInterest: (acc.mcbuInterest || 0) + (item.mcbuInterest || 0),
          mcbuReturnNo: (acc.mcbuReturnNo || 0) + (item.mcbuReturnNo || 0),
          activeClients: (acc.activeClients || 0) + (item.activeClients || 0),
          csfCollection: (acc.csfCollection || 0) + (item.csfCollection || 0),
          csfWithdrawal: (acc.csfWithdrawal || 0) + (item.csfWithdrawal || 0),
          lrfCollection: (acc.lrfCollection || 0) + (item.lrfCollection || 0),
          pastDueAmount: (acc.pastDueAmount || 0) + (item.pastDueAmount || 0),
          c_csfReturnAmt: (acc.c_csfReturnAmt || 0) + (item.c_csfReturnAmt || 0),
          cbhbCollection: (acc.cbhbCollection || 0) + (item.cbhbCollection || 0),
          mcbuCollection: (acc.mcbuCollection || 0) + (item.mcbuCollection || 0),
          mcbuWithdrawal: (acc.mcbuWithdrawal || 0) + (item.mcbuWithdrawal || 0),
          prev_pastDueNo: (acc.prev_pastDueNo || 0) + (item.prev_pastDueNo || 0),
          activeBorrowers: (acc.activeBorrowers || 0) + (item.activeBorrowers || 0),
          c_activeClients: (acc.c_activeClients || 0) + (item.c_activeClients || 0),
          c_csfWithdrawal: (acc.c_csfWithdrawal || 0) + (item.c_csfWithdrawal || 0),
          otherCollection: (acc.otherCollection || 0) + (item.otherCollection || 0),
          prev_cashOnHand: (acc.prev_cashOnHand || 0) + (item.prev_cashOnHand || 0),
          prev_mcbuReturn: (acc.prev_mcbuReturn || 0) + (item.prev_mcbuReturn || 0),
          transferClients: (acc.transferClients || 0) + (item.transferClients || 0),
          totalLoanBalance: (acc.totalLoanBalance || 0) + (item.totalLoanBalance || 0),
          totalLoanRelease: (acc.totalLoanRelease || 0) + (item.totalLoanRelease || 0),
          c_activeBorrowers: (acc.c_activeBorrowers || 0) + (item.c_activeBorrowers || 0),
          fullPaymentAmount: (acc.fullPaymentAmount || 0) + (item.fullPaymentAmount || 0),
          fullPaymentPerson: (acc.fullPaymentPerson || 0) + (item.fullPaymentPerson || 0),
          prev_mcbuReturnNo: (acc.prev_mcbuReturnNo || 0) + (item.prev_mcbuReturnNo || 0),
          addHospitalization: (acc.addHospitalization || 0) + (item.addHospitalization || 0),
          c_totalLoanBalance: (acc.c_totalLoanBalance || 0) + (item.c_totalLoanBalance || 0),
          c_totalLoanRelease: (acc.c_totalLoanRelease || 0) + (item.c_totalLoanRelease || 0),
          prev_activeClients: (acc.prev_activeClients || 0) + (item.prev_activeClients || 0),
          prev_pastDueAmount: (acc.prev_pastDueAmount || 0) + (item.prev_pastDueAmount || 0),
          totalNetCollection: (acc.totalNetCollection || 0) + (item.totalNetCollection || 0),
          admissionCollection: (acc.admissionCollection || 0) + (item.admissionCollection || 0),
          loanCollectionDaily: (acc.loanCollectionDaily || 0) + (item.loanCollectionDaily || 0),
          prev_mcbuCollection: (acc.prev_mcbuCollection || 0) + (item.prev_mcbuCollection || 0),
          prev_mcbuWithdrawal: (acc.prev_mcbuWithdrawal || 0) + (item.prev_mcbuWithdrawal || 0),
          actualLoanCollection: (acc.actualLoanCollection || 0) + (item.actualLoanCollection || 0),
          currentReleaseAmount: (acc.currentReleaseAmount || 0) + (item.currentReleaseAmount || 0),
          loanCollectionWeekly: (acc.loanCollectionWeekly || 0) + (item.loanCollectionWeekly || 0),
          prev_activeBorrowers: (acc.prev_activeBorrowers || 0) + (item.prev_activeBorrowers || 0),
          prev_transferClients: (acc.prev_transferClients || 0) + (item.prev_transferClients || 0),
          targetLoanCollection: (acc.targetLoanCollection || 0) + (item.targetLoanCollection || 0),
          prev_totalLoanBalance: (acc.prev_totalLoanBalance || 0) + (item.prev_totalLoanBalance || 0),
          prev_totalLoanRelease: (acc.prev_totalLoanRelease || 0) + (item.prev_totalLoanRelease || 0),
          c_targetLoanCollection: (acc.c_targetLoanCollection || 0) + (item.c_targetLoanCollection || 0),
          otherPictureCollection: (acc.otherPictureCollection || 0) + (item.otherPictureCollection || 0),
          prev_fullPaymentAmount: (acc.prev_fullPaymentAmount || 0) + (item.prev_fullPaymentAmount || 0),
          prev_fullPaymentPerson: (acc.prev_fullPaymentPerson || 0) + (item.prev_fullPaymentPerson || 0),
          otherPassbookCollection: (acc.otherPassbookCollection || 0) + (item.otherPassbookCollection || 0),
          currentReleasePerson_New: (acc.currentReleasePerson_New || 0) + (item.currentReleasePerson_New || 0),
          currentReleasePerson_Rel: (acc.currentReleasePerson_Rel || 0) + (item.currentReleasePerson_Rel || 0),
          prev_loanCollectionDaily: (acc.prev_loanCollectionDaily || 0) + (item.prev_loanCollectionDaily || 0),
          prev_actualLoanCollection: (acc.prev_actualLoanCollection || 0) + (item.prev_actualLoanCollection || 0),
          prev_currentReleaseAmount: (acc.prev_currentReleaseAmount || 0) + (item.prev_currentReleaseAmount || 0),
          prev_loanCollectionWeekly: (acc.prev_loanCollectionWeekly || 0) + (item.prev_loanCollectionWeekly || 0),
          prev_currentReleasePerson_New: (acc.prev_currentReleasePerson_New || 0) + (item.prev_currentReleasePerson_New || 0),
          prev_currentReleasePerson_Rel: (acc.prev_currentReleasePerson_Rel || 0) + (item.prev_currentReleasePerson_Rel || 0),
          loNo,
          groupStatus: acc.groupStatus ?? item.groupStatus,
          hideLock: true,
        });

        // console.log(response.data.filter(item => item.transactionType === 'weekly'));

        const dailyTotal = response.data.filter(item => item.transactionType === 'daily').reduce((acc, item) => mapTotal('DAILY TOTAL', 99998, acc, item), {});
        const weeklyTotal = response.data.filter(item => item.transactionType === 'weekly').reduce((acc, item) => mapTotal('WEEKLY TOTAL', 99999, acc, item), {});
        
        // console.log(dailyTotal, weeklyTotal);

        const processedData = [... response.data, weeklyTotal, dailyTotal].filter(c => !!c.name).map(item => {
          const formattedName = filter === 'branch' && item.code ? 
            `${item.code} - ${item.name}` : 
            item.name;

          // Get current day name for weekly group filtering
          const currentDayName = moment(currentDate).format('dddd').toLowerCase();
          
          // Check if we should show target loan collection (for weekly groups only)
          const shouldShowTarget = () => {
            // If not viewing groups, always show target
            if (filter !== 'group') return true;
            // If not weekly occurrence, always show target
            if (item.occurence !== 'weekly') return true;
            // If no groupDay specified, always show target
            if (!item.groupDay) return true;
            // For weekly groups with groupDay, only show if it matches current day
            return item.groupDay.toLowerCase() === currentDayName;
          };
  
          const transformedItem = {
            ... item,
            _id: item._id,
            name: formattedName,
            code: item.code,
            loNo: item.loNo || null, // ADDED: Include loNo for sorting
            transactionType: item.transactionType || '-', // ADDED: Include transactionType for Occurrence column
            occurence: item.occurence || '-', // ADDED: Include occurrence
            groupDay: item.groupDay || null, // ADDED: Include groupDay
            groupStatus: item.groupStatus || null, // ADDED: Include groupStatus for row background colors
            isDraft: item.isDraft || false, // ADDED: Include isDraft for draft row background colors
            
            loanTargetStr: shouldShowTarget() && item.targetLoanCollection ? 
            `₱${Number(item.targetLoanCollection).toLocaleString()}` : '-',
            
            excessCurrent: item.excess ? `₱${Number(item.excess).toLocaleString()}` : '-',
            excessPrevious: item.prev_excess ? `₱${Number(item.prev_excess).toLocaleString()}` : '-',
            
            mcbu: item.mcbu ? `₱${Number(item.mcbu).toLocaleString()}` : '-',
            mcbuInterest: item.mcbuInterest > 0 ? `₱${Number(item.mcbuInterest).toLocaleString()}` : '-',
            mcbuPrevious: item.mcbu ? `₱${Number(item.prev_mcbu).toLocaleString()}` : '-',
            actualLoanCollectionCurrent: item.actualLoanCollection ? 
            `₱${Number(item.actualLoanCollection).toLocaleString()}` : '-',
            actualLoanCollectionPrevious: item.prev_actualLoanCollection ? 
            `₱${Number(item.prev_actualLoanCollection).toLocaleString()}` : '-',
            
            mcbuWithdrawalCurrent: item.mcbuWithdrawal ? 
            `₱${Number(item.mcbuWithdrawal).toLocaleString()}` : '-',
            mcbuWithdrawalPrevious: item.prev_mcbuWithdrawal ? 
            `₱${Number(item.prev_mcbuWithdrawal).toLocaleString()}` : '-',
            
            noMcbuReturnCurrent: item.mcbuReturnNo || 0,
            noMcbuReturnPrevious: item.prev_mcbuReturnNo || 0,
            
            mcbuReturnCurrent: item.mcbuReturn ? 
            `₱${Number(item.mcbuReturn).toLocaleString()}` : '-',
            mcbuReturnPrevious: item.prev_mcbuReturn ? 
            `₱${Number(item.prev_mcbuReturn).toLocaleString()}` : '-',

            csfReturnAmtStr: item.csfReturnAmt ? 
            `₱${Number(item.csfReturnAmt).toLocaleString()}` : '-',
            
            fullPaymentPersonCurrent: item.fullPaymentPerson || 0,
            fullPaymentPersonPrevious: item.prev_fullPaymentPerson || 0,
            
            fullPaymentAmountCurrent: item.fullPaymentAmount ? 
            `₱${Number(item.fullPaymentAmount).toLocaleString()}` : '-',
            fullPaymentAmountPrevious: item.prev_fullPaymentAmount ? 
            `₱${Number(item.prev_fullPaymentAmount).toLocaleString()}` : '-',
            
            mispayCurrent: item.mispay || '-',
            mispayPrevious: item.prev_mispay || '-',
            
            noPastDueCurrent: item.pastDueNo || 0,
            noPastDuePrevious: item.prev_pastDueNo || 0,
            
            activeClients: item.activeClients || 0,
            activeClientsPrevious: item.prev_activeClients || 0,
            activeBorrowers: item.activeBorrowers || 0,
            activeBorrowersPrevious: item.prev_activeBorrowers || 0,
            pendingClients: (item.activeClients || 0) - (item.activeBorrowers || 0),
            totalReleasesStr: item.totalLoanRelease ? 
            `₱${Number(item.totalLoanRelease).toLocaleString()}` : '-',
            totalReleasesPreviousStr: item.prev_totalLoanRelease ? 
            `₱${Number(item.prev_totalLoanRelease).toLocaleString()}` : '-',
            totalLoanBalanceStr: item.totalLoanBalance ? 
            `₱${Number(item.totalLoanBalance).toLocaleString()}` : '-',
            totalLoanBalancePreviousStr: item.prev_totalLoanBalance ? 
            `₱${Number(item.prev_totalLoanBalance).toLocaleString()}` : '-',
            totalNetCollectionStr: `₱${Number(item.totalNetCollection).toLocaleString()}`,
            
            // FIXED: Updated Current Release Person logic
            noCurrentReleaseStr: formatCurrentReleasePerson(item.currentReleasePerson_New, item.currentReleasePerson_Rel),
            currentReleaseAmountStr: item.currentReleaseAmount ? 
            `₱${Number(item.currentReleaseAmount).toLocaleString()}` : '-',

            csf: item.csf ? `₱${Number(item.csf).toLocaleString()}` : '-',
            csfPrevious: item.csf ? `₱${Number(item.prev_csf).toLocaleString()}` : '-',
            csfCollection: item.csfCollection ? `₱${Number(item.csfCollection).toLocaleString()}` : '-',
            admissionCollection: item.admissionCollection ? `₱${Number(item.admissionCollection).toLocaleString()}` : '-',
            lrfCollection: item.lrfCollection ? `₱${Number(item.lrfCollection).toLocaleString()}` : '-',
            cbhbCollection: item.cbhbCollection ? `₱${Number(item.cbhbCollection).toLocaleString()}` : '-',
            addHospitalization: item.addHospitalization ? `₱${Number(item.addHospitalization).toLocaleString()}` : '-',
            csfIn: item.csfIn ? `₱${Number(item.csfIn).toLocaleString()}` : '-',
            otherCollection: item.otherIncome ? `₱${Number(item.otherIncome).toLocaleString()}` : '-',
            csfWithdrawal: item.csfWithdrawal ? `₱${Number(item.csfWithdrawal).toLocaleString()}` : '-',
            cashOnHand: item.cashOnHand ? `₱${Number(item.cashOnHand).toLocaleString()}` : '-',

            status: item.status || 'open',
            totalData: item.row_num === null
          };
  
          transformedItem.pastDueAmount = item.pastDueAmount ? `₱${Number(item.pastDueAmount).toLocaleString()}` : '-',
          // FIXED: Updated noPersonRelease logic as well
          transformedItem.noPersonRelease = formatCurrentReleasePerson(item.currentReleasePerson_New, item.currentReleasePerson_Rel);
          transformedItem.mcbuCollection = item.mcbuCollection ? `₱${Number(item.mcbuCollection).toLocaleString()}` : '-',
          transformedItem.excess = transformedItem.excessCurrent;
          transformedItem.mcbuWithdrawal = transformedItem.mcbuWithdrawalCurrent;
          transformedItem.actualLoanCollection = transformedItem.actualLoanCollectionCurrent;
          transformedItem.mcbuReturn = transformedItem.mcbuReturnCurrent;
          transformedItem.noMcbuReturn = transformedItem.noMcbuReturnCurrent;
          transformedItem.fullPaymentPerson = transformedItem.fullPaymentPersonCurrent;
          transformedItem.fullPaymentAmount = transformedItem.fullPaymentAmountCurrent;

          transformedItem._value = item;
          
          return transformedItem;
        });

        // If viewing branches, fetch approval status
        if (filter === 'branch' && processedData.length > 0) {
          const branchIds = processedData.map(item => item._id).filter(id => id);
          const approvalStatus = await fetchBranchApprovalStatus(branchIds, formattedDate);
          
          // Merge approval status into processed data
          processedData.forEach(item => {
            const approval = approvalStatus.find(a => a.branchId === item._id);
            if (approval) {
              item.approvalStatus = approval.status; // 'open' or 'closed'
              item.approvedBy = approval.userName;
              // ADDED: carry stale flag through for row/button/badge logic
              item.documentsStale = approval.documentsStale || false;
              item.staleReason = approval.staleReason || null;
            }
          });
        }

        // console.log(processedData);
        
        // console.log('Processed data length:', processedData.length);
        // console.log('Current filter:', filter);
        
        // UPDATED: Set numberOfLo when currentUser.role.rep === 3 OR filter === 'lo'
        if (currentUser.role.rep === 3 || filter === 'lo') {
          // Count non-total rows to set numberOfLo
          const nonTotalRows = processedData.filter(item => !item.totalData);
          setNumberOfLo(nonTotalRows.length);
        }
        
        if (filter === 'branch') {
          dispatch(setCashCollectionBranch(processedData));
        } else {
          setData(processedData);
        }
        
        setLoading(false);
      } else {
        setLoading(false);
        toast.error('Error retrieving data.');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
      toast.error('Error retrieving data.');
    }
  };

  // CHANGED: was gated to BM's own view only (role.rep===3 && filter==='lo'),
  // so AM opening the same modal via the branch-level row never triggered
  // any COH fetch at all — cohData/cohAmount stayed at their unpopulated
  // defaults regardless of what was actually saved. Now keyed on the modal
  // actually opening for a specific branch, which correctly covers both
  // BM reviewing their own branch and AM reviewing any branch row they click.
  useEffect(() => {
      const fetchCohForModal = async () => {
          const apiUrl = `${getApiBaseUrl()}branches?`;
          const params = {
              _id: closingDocsBranch._id,
              date: dateFilter !== currentDate ? dateFilter : currentDate,
          };
          const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
          if (response.success) {
              if (response.branch?.cashOnHand?.length > 0) {
                  setCohData(response.branch.cashOnHand[0]);
                  setCohAmount(response.branch.cashOnHand[0].amount || 0);
              } else {
                  setCohData({ amount: 0, breakdown: [] });
                  setCohAmount(0);
              }
          } else {
              toast.error('Error loading Cash on Hand data.');
          }
      };

      if (showClosingDocsModal && closingDocsBranch?._id) {
          fetchCohForModal();
      }
  }, [showClosingDocsModal, closingDocsBranch]);

  // Update cohAmount when cohData changes
  useEffect(() => {
    if (cohData) {
      setCohAmount(cohData?.amount || 0);
    }
  }, [cohData]);

  useEffect(() => {
    if (shouldIncludeViewMode(currentUser)) {
      if (router.query.viewMode) {
        setViewMode(router.query.viewMode);
      }
    }
    
    if (router.query.date) {
      setDateFilter(router.query.date);
    } else if (currentDate && dateFilter !== currentDate) {
      setDateFilter(currentDate);
    }
    
    setViewingNestedContent(!!router.query.id);
    
    if (router.query.parentId) {
      setParentId(router.query.parentId);
    }
    
    if (router.query.parentViewMode) {
      setParentViewMode(router.query.parentViewMode);
    }
    
    if (router.query.filter) {
      setCurrentFilter(router.query.filter);
      setCurrentLevel(router.query.filter);
    }
    
    // Set selected filters based on router query
    if (router.query.branchId) {
      setSelectedBranchFilter(router.query.branchId);
    } else {
      setSelectedBranchFilter('');
    }
    
    if (router.query.loId) {
      setSelectedLoFilter(router.query.loId);
    } else {
      setSelectedLoFilter('');
    }
  }, [router.query.viewMode, router.query.id, router.query.parentId, router.query.parentViewMode, router.query.filter, router.query.date, router.query.branchId, router.query.loId, currentUser]);

  useEffect(() => {
    setLoading(true);
    const mounted = setTimeout(() => {
      try {
        fetchCashCollectionsData(dateFilter);
      } catch (error) {
        console.error("Error in fetch effect:", error);
        setLoading(false);
      }
    }, 1000);
    return () => clearTimeout(mounted);
  }, [dateFilter, selectedBranchGroup, selectedLoGroup, viewMode, router.query.id]);
  
  useEffect(() => {
    // Only fetch branch list for users with role.rep < 3
    if (currentFilter === 'lo' && currentUser.role.rep < 3) {
      fetchBranchListForFilter();
    }
  }, [currentFilter, currentUser.role.rep]);

  useEffect(() => {
    // Only fetch LO list for users with role.rep < 4
    if (currentFilter === 'group' && currentUser.role.rep < 4) {
      let branchId;
      
      if (currentUser.role.rep === 3) {
        // For branch managers (role.rep === 3), use their designated branch
        branchId = currentUser.designatedBranchId;
      } else {
        // For higher-level users (role.rep < 3), use router query params
        branchId = router.query.parentId || router.query.branchId;
      }
      
      if (branchId) {
        fetchLoListForFilter(branchId);
      }
    }
  }, [currentFilter, currentUser.role.rep, currentUser.designatedBranchId, router.query.id, router.query.parentId, router.query.branchId]);

  useEffect(() => {
    const shouldPreSave = () => {
      const isLoanOfficer = currentUser?.role?.rep === 4;
      const isBranchManager = currentUser?.role?.rep === 3;
      const isGroupView = currentFilter === 'group' || router.query.filter === 'group';
      const isLoFilter = currentFilter === 'lo' || router.query.filter === 'lo' || isBranchManager;
      
      // Must be one of these conditions
      if (!isGroupView && !isLoFilter && !isBranchManager) {
        return false;
      }

      // Must have required conditions
      if (isHoliday || isWeekend || !currentDate) {
        return false;
      }

      // Must have data loaded
      if (!data || data.length === 0) {
        return false;
      }

      // For group view, check if we have the router.query.id (loId)
      if (isGroupView && !router.query.id) {
        return false;
      }

      // Check for weekly transactions based on the view type
      let hasWeeklyTransactions;
      
      if (isGroupView || isLoanOfficer) {
        // For group view, check occurence property
        hasWeeklyTransactions = data.some(item => 
          !item.totalData && item.occurence === 'weekly'
        );
      } else {
        // For LO filter, check transactionType property
        hasWeeklyTransactions = data.some(item => 
          !item.totalData && item.transactionType === 'weekly'
        );
      }

      console.log('Pre-save check:', {
        currentFilter,
        routerFilter: router.query.filter,
        isGroupView,
        isBranchManager,
        isLoanOfficer,
        isLoFilter,
        isHoliday,
        isWeekend,
        currentDate,
        currentDayName: moment(currentDate).format('dddd').toLowerCase(),
        loId: router.query.id,
        dataLength: data.length,
        hasWeeklyTransactions,
        weeklyItems: isGroupView 
          ? data.filter(item => !item.totalData && item.occurence === 'weekly').map(item => ({
              _id: item._id,
              name: item.name,
              occurence: item.occurence
            }))
          : data.filter(item => !item.totalData && item.transactionType === 'weekly').map(item => ({
              _id: item._id,
              name: item.name,
              transactionType: item.transactionType
            }))
      });

      return hasWeeklyTransactions;
    };

    if (shouldPreSave()) {
      const preSaveCollections = async () => {
        const isLoanOfficer = currentUser?.role?.rep === 4;
        const isBranchManager = currentUser?.role?.rep === 3;
        const isGroupView = currentFilter === 'group' || router.query.filter === 'group' || isLoanOfficer;
        const isLoFilter = currentFilter === 'lo' || router.query.filter === 'lo' || isBranchManager;

        // For group view or LO (existing implementation - single loId)
        if (isGroupView || isLoanOfficer) {
          const requestData = {
            loId: router.query.id || currentUser._id,
            currentDate: currentDate,
            currentUser: currentUser._id,
            mode: 'single' // Indicate single LO processing
          };

          console.log('Triggering pre-save collections (group/LO filter view) with data:', requestData);

          try {
            const response = await fetchWrapper.post(
              getApiBaseUrl() + 'transactions/cash-collections/pre-save-collections', 
              requestData
            );
            console.log('Pre-save collections completed for weekly groups:', response);
          } catch (error) {
            console.error('Error in pre-save collections:', error);
          }
        } 
        // For branch manager viewing loan officers (batch processing)
        else if (isLoFilter) {
          // Filter loan officers with transactionType = 'weekly'
          const weeklyLoanOfficers = data.filter(item => 
            !item.totalData && item.transactionType === 'weekly'
          ).map(lo => ({
            loId: lo._id,
            loName: lo.name // Include name for logging purposes
          }));

          if (weeklyLoanOfficers.length === 0) {
            console.log('No weekly loan officers found for batch pre-save');
            return;
          }

          console.log('Triggering batch pre-save collections for weekly loan officers:', {
            count: weeklyLoanOfficers.length,
            loanOfficers: weeklyLoanOfficers
          });

          const requestData = {
            loanOfficers: weeklyLoanOfficers, // Send array of LO objects
            currentDate: currentDate,
            currentUser: currentUser._id,
            mode: 'batch' // Indicate batch processing
          };

          try {
            const response = await fetchWrapper.post(
              getApiBaseUrl() + 'transactions/cash-collections/pre-save-collections',
              requestData
            );
            console.log('Batch pre-save completed:', response);
            
            // Optionally show a toast notification
            if (response.success) {
              console.log(`Pre-save successful for ${response.successCount || weeklyLoanOfficers.length} loan officers`);
            }
          } catch (error) {
            console.error('Error in batch pre-save collections:', error);
            toast.error('Error pre-saving collections for weekly loan officers');
          }
        }
      };

      const timer = setTimeout(() => {
        preSaveCollections();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentFilter, router.query.filter, isHoliday, isWeekend, currentDate, router.query.id, data, currentUser]);

  useEffect(() => {
    const checkReadiness = async () => {
        // ADDED: skip the network call entirely if this tab isn't visible.
        // The focus listener (already in this file) triggers an immediate
        // refetch the moment the user comes back, so nothing is lost —
        // this only cuts wasted requests from tabs sitting in the background.
        if (document.hidden) return;

        if (currentUser.role.rep !== 3 || currentFilter !== 'lo' || !currentUser.designatedBranchId) return;
        setBranchReadiness(prev => ({ ...prev, loading: true }));

        const dateFor = dateFilter !== currentDate ? dateFilter : currentDate;
        const checkUrl = getApiBaseUrl() + 'transactions/closing-documents/branch-check?' +
            new URLSearchParams({ branchId: currentUser.designatedBranchId, dateFor });
        const checkResponse = await fetchWrapper.get(checkUrl);

        setBranchReadiness({
          loading: false,
          readyToUpload: checkResponse.success && checkResponse.readyToUpload,
          readyToClose: checkResponse.success && checkResponse.readyToClose,
        });

        if (checkResponse.success) {
          setBmBranchStatus(
              checkResponse.approvalStatus
                  ? {
                      status: checkResponse.approvalStatus,
                      documentsStale: checkResponse.documentsStale,
                      // ADDED — this is what the button should actually gate on
                      documentsNeedReupload: checkResponse.documentsNeedReupload,
                    }
                  : null
          );
        }
    };
    checkReadiness();
    const interval = setInterval(checkReadiness, 30000);
    return () => clearInterval(interval);
  }, [currentUser, currentFilter, dateFilter, currentDate, readinessVersion]);

  useEffect(() => {
    const handleFocus = () => setReadinessVersion(v => v + 1);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);
  
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    
    setViewingNestedContent(false);
    setParentEntityName('');
    setParentId(null);
    setParentViewMode(null);
    setCurrentFilter(null);
    
    // Build query object
    const query = {};
    
    // Only include viewMode in URL if user role allows it
    if (shouldIncludeViewMode(currentUser)) {
      query.viewMode = mode;
    }
    
    // Preserve date parameter if it exists and is different from current date
    if (router.query.date && router.query.date !== currentDate) {
      query.date = router.query.date;
    }
    
    router.push({
      pathname: router.pathname,
      query
    }, undefined, { shallow: true });
  };

  const handleBranchGroup = (value) => {
    setSelectedBranchGroup(value);
  };

  const handleLoGroup = (value) => {
    setSelectedLoGroup(value);
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    
    setDateFilter(selectedDate);
    
    // Update URL parameters to persist the date selection
    const currentQuery = { ...router.query };
    
    // Only add date to URL if it's different from current date
    if (selectedDate !== currentDate) {
      currentQuery.date = selectedDate;
    } else {
      // Remove date parameter if user selects current date
      delete currentQuery.date;
    }
    
    // Update URL with the new query parameters
    router.push({
      pathname: router.pathname,
      query: currentQuery
    }, undefined, { shallow: true });
  };
  
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };
  
  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns({
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    });
  };
  
  const handleRowClick = (selected) => {
    if (!selected?.totalData) {
      setSelectedBranchGroup('mine');
      
      // Determine current level based on router query, view mode, and user role
      const getCurrentLevel = () => {
        // If there's a filter in the router query, use that
        if (router.query.filter) {
          return router.query.filter;
        }
        
        // If currentFilter is already set (from fetchCashCollectionsData), use that
        if (currentFilter) {
          return currentFilter;
        }
        
        // Apply the same user role logic as in fetchCashCollectionsData
        if (currentUser.role.rep >= 3) {
          // For branch managers (role.rep = 3) and group leaders (role.rep = 4)
          if (currentUser.role.shortCode === 'area_admin') {
            return 'branch'; // Area admins see branches
          } else if (currentUser.role.rep === 3) {
            return 'lo'; // Branch managers see loan officers
          } else {
            return 'group'; // Group leaders see groups
          }
        }
        
        // For admin users (role.rep < 3), determine level based on view mode and navigation depth
        if (viewMode === 'branch') {
          return 'branch';
        } else if (viewMode === 'area') {
          if (router.query.grandParentId) {
            return 'branch';
          } else if (router.query.parentId) {
            return 'area';
          } else {
            return 'area';
          }
        } else if (viewMode === 'region') {
          if (router.query.grandParentId) {
            return 'branch';
          } else if (router.query.parentId) {
            return 'area';
          } else {
            return 'region';
          }
        } else if (viewMode === 'division') {
          if (router.query.grandParentId) {
            return 'area';
          } else if (router.query.parentId) {
            return 'region';
          } else {
            return 'division';
          }
        }
        
        return viewMode;
      };
      
      const currentLevel = getCurrentLevel();
      
      // Define navigation logic based on current level
      const getNextNavigation = (level) => {
        switch (level) {
          case 'division':
            return { filter: 'region', nextLevel: 'region' };
          case 'region':
            return { filter: 'area', nextLevel: 'area' };
          case 'area':
            return { filter: 'branch', nextLevel: 'branch' };
          case 'branch':
            return { filter: 'lo', nextLevel: 'lo' };
          case 'lo':
            return { filter: 'group', nextLevel: 'group' };
          case 'group':
            // UPDATED: Navigate to transaction page with source information
            const sourceInfo = buildModernBranchCashCollectionsSourceQuery(router, viewMode, currentFilter, selectedBranchGroup, dateFilter);
            const transactionPath = `/transactions/${selected.occurence}-cash-collection/client/${selected._id}`;
            
            router.push({
              pathname: transactionPath,
              query: sourceInfo
            });
            return null;
          default:
            return { filter: 'branch', nextLevel: 'branch' };
        }
      };
      
      const navigation = getNextNavigation(currentLevel);
      
      // If navigation is null (group level), we've already navigated to transaction page
      if (!navigation) {
        return;
      }
      
      // Build query based on navigation level
      let updatedQuery = {
        id: selected._id,
        filter: navigation.filter
      };
      
      // Only include viewMode if user role allows it
      if (shouldIncludeViewMode(currentUser)) {
        updatedQuery.viewMode = viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        updatedQuery.date = router.query.date;
      }
      
      // Handle specific parameter setting based on the next level
      switch (navigation.nextLevel) {
        case 'region':
          updatedQuery.divisionId = selected._id;
          break;
        case 'area':
          if (currentLevel === 'region') {
            updatedQuery.regionId = selected._id;
          } else if (currentLevel === 'division' && router.query.id) {
            updatedQuery.regionId = selected._id;
            updatedQuery.parentId = router.query.id; // division ID
          }
          break;
        case 'branch':
          if (currentLevel === 'area') {
            updatedQuery.areaId = selected._id;
          } else if (currentLevel === 'region' && router.query.id) {
            updatedQuery.areaId = selected._id;
            updatedQuery.parentId = router.query.id; // region ID
          } else if (currentLevel === 'division' && router.query.parentId) {
            updatedQuery.areaId = selected._id;
            updatedQuery.parentId = router.query.id; // region ID
            updatedQuery.grandParentId = router.query.parentId; // division ID
          }
          break;
        case 'lo':
          updatedQuery.branchId = selected._id;
          // Preserve parent hierarchy
          if (router.query.parentId) {
            updatedQuery.parentId = router.query.id;
          }
          if (router.query.grandParentId) {
            updatedQuery.grandParentId = router.query.parentId;
          }
          break;
        case 'group':
          updatedQuery.loId = selected._id;
          // Determine the branch ID to use as parentId
          let branchIdForGroup;
          
          if (currentUser.role.rep === 3) {
            if (currentUser.role.shortCode === 'area_admin') {
              // For area admins navigating from branch to LO to group
              branchIdForGroup = router.query.branchId || router.query.id;
            } else {
              // For branch managers, use their designated branch
              branchIdForGroup = currentUser.designatedBranchId;
            }
          } else {
            // For other roles, the current router.query.id at LO level IS the branch ID
            branchIdForGroup = router.query.branchId || router.query.id;
          }
          
          // ALWAYS set parentId to ensure it's available for the LO filter dropdown
          updatedQuery.parentId = branchIdForGroup;
          
          // Also set branchId explicitly for clarity
          updatedQuery.branchId = branchIdForGroup;
          break;
      }
      
      // Handle hierarchy preservation for nested navigation (mainly for admin users)
      if (currentUser.role.rep < 3) {
        if (viewMode === 'division') {
          if (router.query.grandParentId) {
            // Fourth level: area -> branch
            updatedQuery.parentId = router.query.id;
            updatedQuery.grandParentId = router.query.parentId;
          } else if (router.query.parentId) {
            // Third level: region -> area
            updatedQuery.parentId = router.query.id;
            updatedQuery.grandParentId = router.query.parentId;
          } else if (router.query.id) {
            // Second level: division -> region
            updatedQuery.parentId = router.query.id;
          }
        } else if (viewMode === 'region') {
          if (router.query.parentId) {
            // Third level: area -> branch
            updatedQuery.parentId = router.query.id;
            updatedQuery.grandParentId = router.query.parentId;
          } else if (router.query.id) {
            // Second level: region -> area
            updatedQuery.parentId = router.query.id;
          }
        } else if (viewMode === 'area') {
          if (router.query.id) {
            // Second level: area -> branch
            updatedQuery.parentId = router.query.id;
          }
        }
      }
      
      router.push({
        pathname: router.pathname,
        query: updatedQuery
      }, undefined, { shallow: true });
      
      setViewingNestedContent(true);
      setCurrentFilter(navigation.filter);
      setCurrentLevel(navigation.nextLevel);
    }
  };
  
  const handleBackNavigation = () => {
    // If we're in the group view, go back to the loan officer view
    if (router.query.filter === 'group') {
      const query = {
        id: router.query.parentId,
        filter: 'lo',
        branchId: router.query.parentId,
      };
      
      // Only include viewMode if user role allows it
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = router.query.viewMode || viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
      return;
    }
    
    // If we're in the loan officer view, go back to the branch list view
    if (router.query.filter === 'lo') {
      const query = {};
      
      // Only include viewMode if user role allows it
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = router.query.viewMode || viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
      return;
    }
  
    // Handle standard hierarchy navigation
    if (router.query.grandParentId) {
      const query = {
        id: router.query.grandParentId
      };
      
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = router.query.grandParentViewMode || viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    } else if (router.query.parentId) {
      const query = {
        id: router.query.parentId
      };
      
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = router.query.parentViewMode || viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    } else {
      const query = {};
      
      if (shouldIncludeViewMode(currentUser)) {
        query.viewMode = viewMode;
      }
      
      // Preserve date parameter if it exists and is different from current date
      if (router.query.date && router.query.date !== currentDate) {
        query.date = router.query.date;
      }
      
      router.push({
        pathname: router.pathname,
        query
      }, undefined, { shallow: true });
    }
  };

  const getSearchPlaceholder = () => {
    switch (currentFilter) {
      case 'area':
        return 'Search areas...';
      case 'region':
        return 'Search regions...';
      case 'division':
        return 'Search divisions...';
      case 'lo':
        return 'Search loan officers...';
      case 'group':
        return 'Search groups...';
      case 'branch':
      default:
        return 'Search branches...';
    }
  };

  const getEntityColumnLabel = () => {
    switch (currentFilter) {
      case 'area':
        return 'Area Name';
      case 'region':
        return 'Region Name';
      case 'division':
        return 'Division Name';
      case 'lo':
        return 'Loan Officer';
      case 'group':
        return 'Group Name';
      case 'branch':
      default:
        return 'Branch Name';
    }
  };

  const filteredData = useMemo(() => {
    const dataSource = currentFilter === 'branch' && branchCollectionData?.length > 0 
      ? branchCollectionData 
      : data;
    
    const normalRows = dataSource.filter(item => !item.totalData);
    
    if (!searchTerm) {
      return normalRows;
    }
    
    return normalRows.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [branchCollectionData, data, searchTerm, currentFilter, selectedLoGroup]);

  const grandTotalRow = useMemo(() => {
    const dataSource = currentFilter === 'branch' && branchCollectionData?.length > 0 
      ? branchCollectionData 
      : data;
    
    return dataSource.find(item => item.totalData === true);
  }, [branchCollectionData, data, currentFilter]);

  const sortedData = useMemo(() => {
    let dataToSort = filteredData;
    
    // UPDATED: Always sort by loNo ASC when filter is 'lo'
    if (currentFilter === 'lo') {
      dataToSort = [...filteredData].sort((a, b) => {
        const loNoA = parseInt(a.loNo) || 0;
        const loNoB = parseInt(b.loNo) || 0;
        return loNoA - loNoB;
      });
    }
    
    // Apply additional sorting if configured
    if (!sortConfig.key || !sortConfig.direction) {
      return dataToSort;
    }

    return [...dataToSort].sort((a, b) => {
      if (a[sortConfig.key] === b[sortConfig.key]) {
        return 0;
      }

      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (typeof valA === 'string' && valA.includes('(')) {
        valA = valA.split(' (')[0];
      }
      if (typeof valB === 'string' && valB.includes('(')) {
        valB = valB.split(' (')[0];
      }

      if (typeof valA === 'string' && valA.includes('₱')) {
        valA = parseFloat(valA.replace('₱', '').replace(/,/g, ''));
      }
      if (typeof valB === 'string' && valB.includes('₱')) {
        valB = parseFloat(valB.replace('₱', '').replace(/,/g, ''));
      }

      if (sortConfig.direction === 'ascending') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [filteredData, sortConfig, currentFilter]);

  const handleBmCloseBranchClick = () => {
    setClosingDocsBranch({ _id: currentUser.designatedBranchId, name: currentBranch?.name || 'Your Branch' });
    setShowClosingDocsModal(true);
  };

  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    transactionType: true, // ADDED: Include transactionType column for loan officers only
    loanTargetStr: true,
    excess: true, 
    actualLoanCollection: true,
    mcbuCollection: true,
    mcbu: true,
    mcbuInterest: true,
    noPersonRelease: true,
    currentReleaseAmountStr: true,
    mcbuWithdrawal: true,
    noMcbuReturn: true,
    mcbuReturn: true,
    fullPaymentPerson: true,
    fullPaymentAmount: true,
    mispay: true,
    noPastDue: true,
    pastDueAmount: true,
    activeClients: true,
    activeBorrowers: true,
    pendingClients: true,
    totalReleasesStr: true,
    totalLoanBalanceStr: true,
    csf: true,
    csfCollection: true,
    admissionCollection: true,
    lrfCollection: true,
    cbhbCollection: true,
    addHospitalization: true,
    otherCollection: true,
    csfWithdrawal: true,
    csfReturnAmtStr: false,
    transferClients: true,
    csfIn: true,
    cashOnHand: currentUser.role.rep <= 3,
    totalNetCollectionStr: true,
    actions: true, // ADDED: Actions column visibility
  });

  const columnDefs = useMemo(() => [
    { key: 'name', label: getEntityColumnLabel(), width: 'min-w-[180px] max-w-[240px] w-[180px]' },
    { key: 'transactionType', label: 'Occurrence', width: 'w-24' },
    { key: 'activeClients', label: 'Active Clients', width: 'w-28', hasComparison: true },
    { key: 'mcbu', label: 'MCBU', width: 'w-40',  hasComparison: true },
    { key: 'csf', label: 'CSF', width: 'w-40',  hasComparison: true },
    { key: 'totalReleasesStr', label: 'Total Loan Releases', width: 'w-40', hasComparison: true },
    { key: 'activeBorrowers', label: 'Active Borrowers', width: 'w-36', hasComparison: true },
    { key: 'totalLoanBalanceStr', label: 'Total Loan Balance', width: 'w-40', hasComparison: true },
    { key: 'noPersonRelease', label: 'Current Release Person', width: 'w-32', },
    { key: 'currentReleaseAmountStr', label: 'Current Release Amount', width: 'w-32', },
    { key: 'mcbuCollection', label: 'MCBU Collections', width: 'w-40', },
    { key: 'csfCollection', label: 'CSF Collections', width: 'w-40', },
    { key: 'loanTargetStr', label: 'Target Loan Collection', width: 'w-40' },
    { key: 'excess', label: 'Excess', width: 'w-40', },
    { key: 'actualLoanCollection', label: 'Actual Loan Collection', width: 'w-40', },
    { key: 'admissionCollection', label: 'Admission Fee', width: 'w-40', },
    { key: 'lrfCollection', label: 'LRF', width: 'w-40', },
    { key: 'cbhbCollection', label: 'C.B.H.B Collection', width: 'w-40', },
    { key: 'addHospitalization', label: 'Add. Hospitalization', width: 'w-40', },
    { key: 'csfIn', label: 'CSF In', width: 'w-40', },
    { key: 'otherCollection', label: 'Other Income', width: 'w-40', },
    { key: 'mcbuWithdrawal', label: 'MCBU Withdrawals', width: 'w-40', },
    { key: 'csfWithdrawal', label: 'CSF Withdrawals', width: 'w-40', },
    { key: 'noMcbuReturn', label: '# MCBU Return', width: 'w-32', },
    { key: 'mcbuReturn', label: 'MCBU/CSF Return Amount', width: 'w-32', },
    { key: 'mcbuInterest', label: 'MCBU Interest', width: 'w-40', },
    { key: 'csfReturnAmtStr', label: 'CSF Return Amount', width: 'w-32', },
    { key: 'fullPaymentPerson', label: 'Full Payment Person', width: 'w-40', },
    { key: 'fullPaymentAmount', label: 'Full Payment Amount', width: 'w-40', },
    { key: 'totalNetCollectionStr', label: 'Total Net Collection', width: 'w-40', },
    { key: 'mispay', label: 'Mispay', width: 'w-28', hasComparison: true },
    { key: 'noPastDue', label: 'PD #', width: 'w-20', hasComparison: true },
    { key: 'pastDueAmount', label: 'PD Amount', width: 'w-20', hasComparison: true },
    { key: 'pendingClients', label: 'PND', width: 'w-20' },
    { key: 'transferClients', label: 'TOC', width: 'w-20' },
    { key: 'cashOnHand', label: 'Cash On Hand', width: 'w-20' },
    { key: 'actions', label: 'Actions', width: 'w-24' }, // ADDED: Actions column
  ], [currentFilter]);

  const visibleColumnDefs = useMemo(() => {
    return columnDefs.filter(col => {
      // Show transactionType column ONLY when currentFilter is 'lo'
      if (col.key === 'transactionType') {
        return currentFilter === 'lo' && visibleColumns[col.key];
      }
      
      // Show actions column when:
      // 1. currentFilter is 'lo' AND user has rep === 3 (Branch Manager viewing LOs)
      // 2. currentFilter is 'branch' AND user is area_admin or regional_manager
      // 3. User is admin (rep === 1) - can see actions for both lo and branch levels
      if (col.key === 'actions') {
        const isAdmin = currentUser.role.rep === 1;
        const isLoLevel = currentFilter === 'lo' && currentUser.role.rep === 3;
        const isBranchLevel = currentFilter === 'branch' && 
          currentUser.role.rep === 2 && 
          (currentUser.role.shortCode === 'area_admin' || 
          currentUser.role.shortCode === 'regional_manager');
        
        // Admin can see actions for group, lo and branch levels
        const adminCanSee = isAdmin && (currentFilter === 'lo' || currentFilter === 'branch');
        // const adminCanSee = isAdmin && (currentFilter === 'group' || currentFilter === 'lo' || currentFilter === 'branch');
        
        return (isLoLevel || isBranchLevel || adminCanSee) && visibleColumns[col.key];
      }
      
      return visibleColumns[col.key];
    });
  }, [visibleColumns, columnDefs, currentFilter, currentUser.role.rep, currentUser.role.shortCode]);

  return (
    <Layout header={false} noPad={true}>
        <div className="flex flex-col h-full bg-gray-50">
            <div className="bg-white shadow">
                <div className="px-4 py-6 sm:px-6">
                <h1 className="text-2xl font-semibold text-gray-900">Branch Cash Collections</h1>
                <p className="mt-1 text-sm text-gray-500">
                    {moment(dateFilter).format('dddd, MMMM DD, YYYY')}
                </p>
                
                {viewingNestedContent && (
                  <div className="mt-2 flex items-center">
                    <button
                      onClick={handleBackNavigation}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-900 flex items-center"
                    >
                      <ChevronUp size={16} className="mr-1" />
                      Back to {parentId ? 'Higher Level' : 'All ' + viewMode.charAt(0).toUpperCase() + viewMode.slice(1) + 's'}
                    </button>
                    
                    {parentEntityName && (
                      <span className="ml-2 text-sm text-gray-700">
                        Viewing: <span className="font-medium">{parentEntityName}</span>
                      </span>
                    )}
                  </div>
                )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-white border-b border-gray-200 gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <div className="relative">
                        <input
                        type="date"
                        value={dateFilter}
                        onChange={handleDateChange}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    
                    {currentUser.role && currentUser.role.rep < 3 && shouldIncludeViewMode(currentUser) && (
                        <div className="flex space-x-1">
                        <button 
                            onClick={() => handleViewModeChange('branch')}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${viewMode === 'branch' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            View by Branch
                        </button>
                        <button 
                            onClick={() => handleViewModeChange('area')}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${viewMode === 'area' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            View by Area
                        </button>
                        <button 
                            onClick={() => handleViewModeChange('region')}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${viewMode === 'region' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            View by Region
                        </button>
                        <button 
                            onClick={() => handleViewModeChange('division')}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${viewMode === 'division' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            View by Division
                        </button>
                        </div>
                    )}
                    
                    {(currentUser.role && 
                      (currentUser.role.rep == 2) && 
                      (currentUser.role.shortCode === "deputy_director" || 
                      currentUser.role.shortCode === "regional_manager" ||
                      currentUser.role.shortCode === "area_admin") &&
                      !viewingNestedContent &&
                      !router.query.id &&
                      !router.query.filter
                    ) && (
                      <div className="relative">
                        <select
                          value={selectedBranchGroup}
                          onChange={(e) => handleBranchGroup(e.target.value)}
                          className="pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="mine">Mine</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    )}
                    {((currentUser.role && currentUser.role.rep == 3 && currentLevel == "lo") && (numberOfLo > 10 || selectedLoGroup !== 'all')) && (
                      <div className="relative">
                        <select
                          value={selectedLoGroup}
                          onChange={(e) => handleLoGroup(e.target.value)}
                          className="pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="all">All</option>
                          <option value="main">Main</option>
                          <option value="ext">Extension</option>
                        </select>
                      </div>
                    )}
                    
                    {(currentUser.role.rep === 3 && currentFilter === 'lo') && (() => {
                      const isClosed = bmBranchStatus?.status === 'closed';
                      // CHANGED: was keyed on the raw documentsStale flag, which only ever
                      // clears when AM finalizes — meaning the button stayed stuck on
                      // "Documents Need Update" even after BM had already replaced every
                      // outdated file. documentsNeedReupload correctly answers "is there
                      // still at least one file that predates the reopen," which is the
                      // question this button actually needs answered.
                      const isStale = !isClosed && bmBranchStatus?.documentsNeedReupload;
                      const isPendingApproval = !isClosed && !isStale && branchReadiness.readyToClose;

                      const label = isStale
                          ? 'Documents Need Update'
                          : isClosed
                              ? 'Branch Already Closed'
                              : isPendingApproval
                                  ? 'Pending AM Approval'
                                  : 'Upload & Close Branch';

                      const disabled = branchReadiness.loading;

                      const title =
                        branchReadiness.loading ? 'Checking branch status...'
                        : isClosed ? 'Branch is closed — click to view documents and Cash on Hand (read-only)'
                        : isStale ? 'A Loan Officer transaction was reopened after closing — review documents and Cash on Hand'
                        : isPendingApproval ? 'Documents uploaded — waiting for Area Manager to finalize. Click to review or make changes.'
                        : 'Open closing documents and Cash on Hand';

                      return (
                          <button
                              onClick={handleBmCloseBranchClick}
                              disabled={disabled}
                              title={title}
                              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${
                                  disabled
                                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                      : isStale
                                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                                          : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                          >
                              {isStale ? <AlertTriangle size={16} /> : <Lock size={16} />}
                              {label}
                          </button>
                      );
                  })()}
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Branch filter - show when filter = 'lo' and user role.rep < 3 */}
                  {currentFilter === 'lo' && currentUser.role.rep < 3 && (
                    <div className="relative">
                      <select
                        value={selectedBranchFilter}
                        onChange={handleBranchFilterChange}
                        className="pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
                      >
                        {branchFilterList.map(branch => (
                          <option key={branch._id} value={branch._id}>
                            {branch.code} - {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* LO filter - show when filter = 'group' and user role.rep < 4 */}
                  {currentFilter === 'group' && currentUser.role.rep < 4 && (
                    <div className="relative">
                      <select
                        value={selectedLoFilter}
                        onChange={handleLoFilterChange}
                        className="pl-3 pr-8 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
                      >
                        {loFilterList.map(lo => (
                          <option key={lo._id} value={lo._id}>
                            {lo.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="relative">
                      <input
                      type="text"
                      placeholder={getSearchPlaceholder()}
                      value={searchTerm}
                      onChange={handleSearch}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-64"
                      />
                      <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                  
                  <button 
                      onClick={() => setShowColumnSelector(!showColumnSelector)}
                      className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
                      title="Show/Hide Columns"
                  >
                      {showColumnSelector ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  
                  <button 
                      onClick={() => fetchCashCollectionsData(dateFilter)} 
                      className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
                      title="Refresh Data"
                  >
                      <RefreshCw size={20} />
                  </button>
                  
                  <CashCollectionsExcelExport
                    data={data}
                    grandTotalRow={grandTotalRow}
                    visibleColumnDefs={visibleColumnDefs}
                    currentFilter={currentFilter}
                    currentUser={currentUser}
                    dateFilter={dateFilter}
                    sortedData={sortedData}
                  />
              </div>
            </div>

            {showColumnSelector && (
                <div className="absolute right-4 mt-16 bg-white shadow-lg border border-gray-200 rounded-md z-10 p-4 max-h-96 overflow-y-auto">
                  <h3 className="font-medium text-gray-700 mb-2">Show/Hide Columns</h3>
                  <div className="grid grid-cols-2 gap-2">
                      {columnDefs.map(col => {
                        // Hide transactionType column option when not in LO filter
                        if (col.key === 'transactionType' && currentFilter !== 'lo') {
                          return null;
                        }
                        
                        // Hide actions column option based on user permissions
                        if (col.key === 'actions') {
                          const isLoLevel = currentFilter === 'lo' && currentUser.role.rep === 3;
                          const isBranchLevel = currentFilter === 'branch' && 
                            currentUser.role.rep === 2 && 
                            (currentUser.role.shortCode === 'area_admin' || 
                            currentUser.role.shortCode === 'regional_manager');
                          
                          if (!isLoLevel && !isBranchLevel) {
                            return null;
                          }
                        }
                        
                        return (
                          <div key={col.key} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`col-${col.key}`}
                              checked={visibleColumns[col.key]}
                              onChange={() => toggleColumnVisibility(col.key)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`col-${col.key}`} className="ml-2 text-sm text-gray-700">
                              {col.label}
                            </label>
                          </div>
                        );
                      })}
                  </div>
                </div>
            )}

            <div className="flex-1 overflow-x-auto overflow-y-auto">
                {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner />
                </div>
                ) : (
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                          <tr>
                            {visibleColumnDefs.map(column => (
                              <th 
                                key={column.key}
                                scope="col" 
                                className={`
                                  ${column.width || 'w-auto'} 
                                  px-3 py-3.5 text-left text-sm font-semibold text-gray-900 
                                  ${column.key === 'actions' ? '' : 'cursor-pointer group'}
                                  ${column.key === 'name' ? 'bg-gray-50 border-r-2 border-gray-300' : ''}
                                `}
                                style={column.key === 'name' ? {
                                  boxShadow: '2px 0 4px -1px rgba(0, 0, 0, 0.15)',
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 101,
                                } : {}}
                                onClick={column.key === 'actions' ? undefined : () => handleSort(column.key)}
                              >
                                <div className="flex items-center">
                                  <span className="break-words">{column.label}</span>
                                  {column.key !== 'actions' && (
                                    <span className="ml-1 flex-none text-gray-400 group-hover:text-gray-700">
                                      {sortConfig.key === column.key ? (
                                        sortConfig.direction === 'ascending' ? (
                                          <ChevronUp size={16} />
                                        ) : (
                                          <ChevronDown size={16} />
                                        )
                                      ) : (
                                        <ArrowUpDown size={16} className="opacity-0 group-hover:opacity-100" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {sortedData.length > 0 ? (
                            sortedData.map((row, index) => {
                              const bgRowColor = getRowBgColor(row);

                              return (
                                <tr 
                                  key={row._id || index} 
                                  onClick={(e) => {
                                    if (e.target.closest('button')) {
                                      return;
                                    }
                                    handleRowClick(row);
                                  }}
                                  className={`
                                    ${bgRowColor}
                                    hover:bg-gray-50 cursor-pointer
                                  `.trim()}
                                >
                                  {visibleColumnDefs.map(column => (
                                    <td 
                                      key={`${row._id}-${column.key}`} 
                                      className={`
                                        px-3 py-4 text-sm 
                                        ${column.key === 'name' ? 
                                          `font-medium text-gray-900 border-r-2 border-gray-300 break-words
                                          ${bgRowColor}` 
                                          : 'whitespace-nowrap text-gray-500'}
                                      `}
                                      style={column.key === 'name' ? {
                                        boxShadow: '2px 0 4px -1px rgba(0, 0, 0, 0.15)',
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 10,
                                      } : {}}
                                    >
                                      {column.key === 'name' ? (
                                        <div className="font-medium text-gray-900 break-words leading-tight flex items-center">
                                          {row[column.key]}
                                        </div>
                                      ) : column.key === 'actions' ? (
                                        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                                          {((currentFilter === 'lo' || currentFilter === 'branch') && !row.hideLock) && (
                                            <>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleOpen(row); }}
                                                className={`p-1 rounded ${
                                                  (currentFilter === 'branch' && row.approvalStatus === 'open') || loading
                                                    ? 'text-gray-400 cursor-not-allowed' 
                                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                                }`}
                                                title={currentFilter === 'branch' ? "Unlock Branch" : "Open Transaction"}
                                                disabled={(currentFilter === 'branch' && row.approvalStatus === 'open') || loading}
                                              >
                                                <Unlock size={16} />
                                              </button>

                                              {currentFilter === 'branch' && row.documentsStale ? (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleClose(row); }}
                                                  className="p-1 rounded text-amber-600 hover:text-amber-900 hover:bg-amber-50 animate-pulse"
                                                  title="Documents need re-check — click to re-upload and re-close"
                                                  disabled={loading}
                                                >
                                                  <AlertTriangle size={16} />
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); handleClose(row); }}
                                                  className={`p-1 rounded ${
                                                  (currentFilter === 'branch' && row.approvalStatus === 'closed') || loading || branchCheckLoading[row._id]
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                                                }`}
                                                  title={
                                                    branchCheckLoading[row._id] ? "Checking readiness..."
                                                    : currentFilter === 'branch'
                                                      ? (row.documentsStale ? "Re-check required — documents may be outdated" : "Lock and Approve Branch")
                                                      : "Close Transaction"
                                                  }
                                                  disabled={(currentFilter === 'branch' && row.approvalStatus === 'closed' && !row.documentsStale) || loading || branchCheckLoading[row._id]}
                                                >
                                                  {branchCheckLoading[row._id] ? (
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                  ) : (
                                                    <Lock size={16} />
                                                  )}
                                                </button>
                                              )}
                                            </>
                                          )}
                                          
                                          {currentFilter === 'group' && !row.hideLock && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRepairClick(row);
                                              }}
                                              className={`p-1 rounded flex items-center gap-1 ${
                                                repairLoading[row._id]
                                                  ? 'text-gray-400 cursor-wait'
                                                  : repairStatus[row._id] === 'ok'
                                                  ? 'text-green-600 cursor-default'
                                                  : repairStatus[row._id] === 'repaired'
                                                  ? 'text-blue-600 cursor-default'
                                                  : 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                                              }`}
                                              title={
                                                repairStatus[row._id] === 'ok' 
                                                  ? "No repairs needed" 
                                                  : repairStatus[row._id] === 'repaired'
                                                  ? "Repair completed"
                                                  : "Check & Repair Transaction"
                                              }
                                              disabled={repairLoading[row._id] || repairStatus[row._id] === 'ok'}
                                            >
                                              {repairLoading[row._id] ? (
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                              ) : repairStatus[row._id] === 'ok' ? (
                                                <CheckCircle size={16} />
                                              ) : repairStatus[row._id] === 'repaired' ? (
                                                <CheckCircle size={16} />
                                              ) : (
                                                <Wrench size={16} />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      ) : column.key === 'transactionType' ? (
                                        <div className="text-xs font-medium uppercase tracking-wider text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                          {row[column.key] || '-'}
                                        </div>
                                      ) : column.key === 'excess' && column.hasComparison ? (
                                        formatWithComparison(row.excessCurrent, row.excessPrevious, row.groupStatus)
                                      ) : column.key === 'mcbu' && column.hasComparison ? (
                                        formatWithComparison2(row.mcbu, row._value.mcbuCollection - row._value.mcbuWithdrawal - row._value.mcbuReturn, row.groupStatus)
                                      ) : column.key === 'csf' && column.hasComparison ? (
                                        formatWithComparison2(row.csf, row._value.csfCollection - row._value.csfWithdrawal - row._value.csfReturnAmt, row.groupStatus)
                                      ) : column.key === 'actualLoanCollection' && column.hasComparison ? (
                                        formatWithComparison(row.actualLoanCollectionCurrent, row.actualLoanCollectionPrevious, row.groupStatus)
                                      ) : column.key === 'activeClients' && column.hasComparison ? (
                                        formatWithComparison(row.activeClients, row.activeClientsPrevious, row.groupStatus)
                                      ) : column.key === 'activeBorrowers' && column.hasComparison ? (
                                        formatWithComparison(row.activeBorrowers, row.activeBorrowersPrevious, row.groupStatus)
                                      ) : column.key === 'totalReleasesStr' && column.hasComparison ? (        
                                        formatWithComparison2(row.totalReleasesStr, row.currentReleaseAmount - row._value.fullPaymentAmount, row.groupStatus)
                                      ) : column.key === 'totalLoanBalanceStr' && column.hasComparison ? (        
                                        formatWithComparison2(row.totalLoanBalanceStr, row.currentReleaseAmount - row._value.actualLoanCollection, row.groupStatus, true)
                                      ) : column.key === 'mcbuWithdrawal' && column.hasComparison ? (
                                        formatWithComparison(row.mcbuWithdrawalCurrent, row.mcbuWithdrawalPrevious, row.groupStatus)
                                      ) : column.key === 'noMcbuReturn' && column.hasComparison ? (
                                        formatWithComparison(row.noMcbuReturnCurrent, row.noMcbuReturnPrevious, row.groupStatus)
                                      ) : column.key === 'mcbuReturn' && column.hasComparison ? (
                                        formatWithComparison(row.mcbuReturnCurrent, row.mcbuReturnPrevious, row.groupStatus)
                                      ) : column.key === 'fullPaymentPerson' && column.hasComparison ? (
                                        formatWithComparison(row.fullPaymentPersonCurrent, row.fullPaymentPersonPrevious, row.groupStatus)
                                      ) : column.key === 'fullPaymentAmount' && column.hasComparison ? (
                                        formatWithComparison(row.fullPaymentAmountCurrent, row.fullPaymentAmountPrevious, row.groupStatus)
                                      ) : column.key === 'mispay' && column.hasComparison ? (
                                        formatWithComparison(row.mispayCurrent, row.mispayPrevious, row.groupStatus)
                                      ) : column.key === 'noPastDue' && column.hasComparison ? (
                                        formatWithComparison(row.noPastDueCurrent, row.noPastDuePrevious, row.groupStatus)
                                      ) : row[column.key] === '-' ? (
                                        <span className="text-gray-400">-</span>
                                      ) : (
                                        row[column.key] ?? '-'
                                      )}
                                    </td>
                                  ))}
                                </tr>
                            )})
                          ) : (
                            <tr>
                              <td colSpan={visibleColumnDefs.length} className="px-3 py-4 text-sm text-gray-500 text-center">
                                No data available
                              </td>
                            </tr>
                          )}
                          
                          {grandTotalRow && (
                            <tr className="bg-gray-100 font-medium sticky bottom-0 z-10">
                              {visibleColumnDefs.map(column => (
                                <td 
                                  key={`grand-total-${column.key}`} 
                                  className={`
                                    px-3 py-4 text-sm text-gray-900 font-semibold border-t-2 border-gray-300
                                    ${column.key === 'name' ? 'sticky left-0 z-30 bg-gray-100 border-r-2 break-words' : 'whitespace-nowrap'}
                                  `}
                                  style={column.key === 'name' ? {
                                    boxShadow: '2px 0 4px -1px rgba(0, 0, 0, 0.15)',
                                    position: 'sticky',
                                    left: 0,
                                  } : {}}
                                >
                                  {column.key === 'name' ? (
                                    <div className="font-medium text-gray-900 break-words leading-tight">GRAND TOTALS</div>
                                  ) : column.key === 'actions' ? (
                                    <div className="text-center text-gray-400">-</div>
                                  ) : column.key === 'transactionType' ? (
                                    <div className="text-xs font-medium uppercase tracking-wider text-gray-700 bg-gray-200 px-2 py-1 rounded">
                                      {grandTotalRow[column.key] || 'ALL'}
                                    </div>
                                  ) : column.key === 'excess' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.excessCurrent, grandTotalRow.excessPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'mcbu' && column.hasComparison ? (
                                    formatWithComparison2(grandTotalRow.mcbu, grandTotalRow._value.mcbuCollection - grandTotalRow._value.mcbuWithdrawal - grandTotalRow._value.mcbuReturn, grandTotalRow.groupStatus)
                                  ) : column.key === 'csf' && column.hasComparison ? (
                                    formatWithComparison2(grandTotalRow.csf, grandTotalRow._value.csfCollection - grandTotalRow._value.csfWithdrawal - grandTotalRow._value.csfReturnAmt, grandTotalRow.groupStatus)
                                  ) : column.key === 'actualLoanCollection' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.actualLoanCollectionCurrent, grandTotalRow.actualLoanCollectionPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'activeClients' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.activeClients, grandTotalRow.activeClientsPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'activeBorrowers' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.activeBorrowers, grandTotalRow.activeBorrowersPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'totalReleasesStr' && column.hasComparison ? (        
                                    formatWithComparison2(grandTotalRow.totalReleasesStr, grandTotalRow.currentReleaseAmount - grandTotalRow._value.fullPaymentAmount, grandTotalRow.groupStatus)
                                  ) : column.key === 'totalLoanBalanceStr' && column.hasComparison ? (        
                                    formatWithComparison2(grandTotalRow.totalLoanBalanceStr, grandTotalRow.currentReleaseAmount - grandTotalRow._value.actualLoanCollection, grandTotalRow.groupStatus)
                                  ) : column.key === 'mcbuWithdrawal' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.mcbuWithdrawalCurrent, grandTotalRow.mcbuWithdrawalPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'noMcbuReturn' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.noMcbuReturnCurrent, grandTotalRow.noMcbuReturnPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'mcbuReturn' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.mcbuReturnCurrent, grandTotalRow.mcbuReturnPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'fullPaymentPerson' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.fullPaymentPersonCurrent, grandTotalRow.fullPaymentPersonPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'fullPaymentAmount' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.fullPaymentAmountCurrent, grandTotalRow.fullPaymentAmountPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'mispay' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.mispayCurrent, grandTotalRow.mispayPrevious, grandTotalRow.groupStatus)
                                  ) : column.key === 'noPastDue' && column.hasComparison ? (
                                    formatWithComparison(grandTotalRow.noPastDueCurrent, grandTotalRow.noPastDuePrevious, grandTotalRow.groupStatus)
                                  ) : grandTotalRow[column.key] === '-' ? (
                                    <span className="text-gray-400">-</span>
                                  ) : (
                                    grandTotalRow[column.key]
                                  )}
                                </td>
                              ))}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                )}
                </div>
            </div>
            {/* Repair Confirmation Dialog */}
            {showRepairDialog && selectedRepairGroup && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-orange-500" size={24} />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Repair Transaction
                      </h3>
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto max-h-[50vh]">
                    <p className="text-gray-700 mb-4">
                      Found <span className="font-bold text-orange-600">{selectedRepairGroup.discrepancyCount}</span> discrepancy(ies) 
                      in group <span className="font-bold">{selectedRepairGroup.name}</span>.
                    </p>
                    
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Discrepancies Found:</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedRepairGroup.discrepancies?.map((disc, idx) => (
                          <div key={idx} className="text-sm bg-white p-2 rounded border border-gray-200">
                            <div className="flex justify-between">
                              <span className="font-medium">{disc.clientName || `Slot ${disc.slotNo}`}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                disc.type === 'LOAN_NOT_UPDATED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {disc.type === 'LOAN_NOT_UPDATED' ? 'Not Updated' : 'Not Found'}
                              </span>
                            </div>
                            {disc.type === 'LOAN_NOT_UPDATED' && (
                              <div className="mt-1 text-gray-500 text-xs">
                                Expected update: {disc.expected}, Actual: {disc.actual || 'N/A'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      This will update the loans table to match the cash collections data. 
                      Do you want to proceed with the repair?
                    </p>
                  </div>
                  
                  <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      onClick={cancelRepair}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                      disabled={repairLoading[selectedRepairGroup._id]}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeRepair}
                      className="px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-md flex items-center gap-2"
                      disabled={repairLoading[selectedRepairGroup._id]}
                    >
                      {repairLoading[selectedRepairGroup._id] ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Repairing...
                        </>
                      ) : (
                        <>
                          <Wrench size={16} />
                          Repair Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {reopenWarning && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-amber-500" size={24} />
                      <h3 className="text-lg font-semibold text-gray-900">Reopen Transaction?</h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-700">
                      {reopenWarning.docCount} closing document{reopenWarning.docCount > 1 ? 's have' : ' has'} already
                      been uploaded for this branch on this date. Reopening will flag the branch as needing
                      re-check, and the documents will need to be reviewed and re-uploaded before it can be
                      closed again.
                    </p>
                  </div>
                  <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      onClick={() => setReopenWarning(null)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const row = reopenWarning.row;
                        setReopenWarning(null);
                        await performOpen(row);
                      }}
                      className="px-4 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                    >
                      Reopen Anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showClosingDocsModal && closingDocsBranch && (
              <BranchClosingDocumentsModal
                isOpen={showClosingDocsModal}
                onClose={() => {
                  setShowClosingDocsModal(false);
                  setClosingDocsBranch(null);
                }}
                branchId={closingDocsBranch._id}
                branchName={closingDocsBranch.name}
                dateFor={dateFilter !== currentDate ? dateFilter : currentDate}
                currentUser={currentUser}
                cohAmount={cohAmount}
                cohBreakdown={cohBreakdownStable}
                onCohAmountChange={setCohAmount}
                onCohSave={handleCOHDataChange}
                onClosed={() => {
                  fetchCashCollectionsData(dateFilter);
                  setReadinessVersion(v => v + 1);
                }}
              />
            )}
    </Layout>
  );
};

export default ModernBranchCashCollections;