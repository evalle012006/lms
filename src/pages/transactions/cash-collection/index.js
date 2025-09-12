import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Calendar, Download, RefreshCw, Eye, EyeOff, Info, ArrowUpDown } from 'lucide-react';
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";
import moment from 'moment';
import { useRouter } from "next/router";
import { setCashCollectionBranch } from "@/redux/actions/cashCollectionActions";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import Layout from '@/components/Layout';
import { buildModernBranchCashCollectionsSourceQuery, shouldIncludeViewMode } from '@/lib/utils';

const ModernBranchCashCollections = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  
  const currentUser = useSelector(state => state.user.data);
  const branchList = useSelector(state => state.branch.list);
  const branchCollectionData = useSelector(state => state.cashCollection.branch);
  const currentDate = useSelector(state => state.systemSettings.currentDate);
  const isHoliday = useSelector(state => state.systemSettings.holiday);
  const isWeekend = useSelector(state => state.systemSettings.weekend);
  
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => {
    // Check if there's a date in the URL parameters, otherwise use current date
    return router.query.date || moment().format('YYYY-MM-DD');
  });
  const [viewMode, setViewMode] = useState(() => {
    // Set default based on user role
    if (currentUser && !shouldIncludeViewMode(currentUser)) {
      return 'branch'; // default for restricted users
    }
    return router.query.viewMode || 'branch';
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

  const buildApiParams = (baseParams) => {
    const params = new URLSearchParams();
    
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value);
      }
    });
    
    return params;
  };

  const formatWithComparison = (current, previous) => {
    if (current === undefined || previous === undefined || current === '-' || previous === '-') {
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

  const formatWithComparison2 = (current, diff) => {
    if (current === undefined) {
      return current;
    }
    
    const sign = diff > 0 ? '+' : '';
    const isPositive = diff >= 0;

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
    setLoading(true);
    try {
      const formattedDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
      const currentSystemDate = moment().format('YYYY-MM-DD');
      
      const baseParams = {
        dateAdded: formattedDate,
        currentDate: currentSystemDate,
        _name: 'get_cash_collections_page_data',
      };
      
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
        const processedData = response.data.map(item => {
          const formattedName = filter === 'branch' && item.code ? 
            `${item.code} - ${item.name}` : 
            item.name;

          // Get current day name for weekly group filtering
          const currentDayName = moment().format('dddd').toLowerCase();
          
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

  // useEffect(() => {
  //   if (currentUser?.role && currentUser.role.rep > 3) {
  //     router.push('/');
  //   }
  // }, [currentUser, router]);

  useEffect(() => {
    // Only set viewMode from router if user role allows it
    if (router.query.viewMode && shouldIncludeViewMode(currentUser)) {
      setViewMode(router.query.viewMode);
    }
    
    // Set date from URL parameter if it exists
    if (router.query.date) {
      setDateFilter(router.query.date);
    }
    
    setViewingNestedContent(!!router.query.id);
    
    if (router.query.parentId) {
      setParentId(router.query.parentId);
    }
    
    if (router.query.parentViewMode) {
      setParentViewMode(router.query.parentViewMode);
    }
    
    // Update filter state based on router query
    if (router.query.filter) {
      setCurrentFilter(router.query.filter);
      setCurrentLevel(router.query.filter);
    }
  }, [router.query.viewMode, router.query.id, router.query.parentId, router.query.parentViewMode, router.query.filter, router.query.date, currentUser]);

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

  // Pre-save collections for weekly groups
  useEffect(() => {
    const shouldPreSave = () => {
      // Must be viewing groups
      if (currentFilter !== 'group' && router.query.filter !== 'group') {
        return false;
      }

      // Must have required conditions
      if (isHoliday || isWeekend || !currentDate || !router.query.id) {
        return false;
      }

      // Must have data loaded
      if (!data || data.length === 0) {
        return false;
      }

      // Check if any groups have weekly occurrence
      const hasWeeklyGroups = data.some(item => 
        !item.totalData && item.occurence === 'weekly'
      );

      console.log('Pre-save check:', {
        currentFilter,
        routerFilter: router.query.filter,
        isHoliday,
        isWeekend,
        currentDate,
        currentDayName: moment().format('dddd').toLowerCase(),
        loId: router.query.id,
        dataLength: data.length,
        hasWeeklyGroups,
        weeklyGroupsData: data.filter(item => !item.totalData && item.occurence === 'weekly').map(item => ({
          name: item.name,
          occurence: item.occurence,
          groupDay: item.groupDay,
          targetLoanCollection: item.targetLoanCollection
        }))
      });

      return hasWeeklyGroups;
    };

    if (shouldPreSave()) {
      const preSaveCollections = async () => {
        const requestData = {
          loId: router.query.id, // This is the loan officer ID when viewing groups
          currentDate: currentDate,
          currentUser: currentUser._id
        };

        console.log('Triggering pre-save collections with data:', requestData);

        try {
          const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/pre-save-collections', requestData);
          console.log('Pre-save collections completed for weekly groups:', response);
        } catch (error) {
          console.error('Error in pre-save collections:', error);
        }
      };

      const timer = setTimeout(() => {
        preSaveCollections();
      }, 1500); // Slightly longer delay to ensure data is loaded

      return () => clearTimeout(timer);
    }
  }, [currentFilter, router.query.filter, isHoliday, isWeekend, currentDate, router.query.id, data, currentUser]);
  
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
    if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
    const currentDate = moment().format('YYYY-MM-DD');
    
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
          // For role.rep = 3 (branch manager), the parentId should be the branch ID
          if (currentUser.role.rep === 3) {
            if (currentUser.role.shortCode === 'area_admin') {
              // For area admins, parentId should be the branch ID from the selected branch
              updatedQuery.parentId = selected._id;
            } else {
              // For branch managers, parentId should be their designated branch
              updatedQuery.parentId = currentUser.designatedBranchId;
            }
          } else {
            // For other roles, preserve the existing logic
            updatedQuery.parentId = router.query.id; // branch ID
            // Preserve deeper hierarchy if exists
            if (router.query.parentId) {
              updatedQuery.branchId = router.query.id;
            }
          }
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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
      if (router.query.date && router.query.date !== moment().format('YYYY-MM-DD')) {
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

  const applyLoGroupFilter = (data) => {
    if (currentFilter !== 'lo' || selectedLoGroup === 'all') {
      return data;
    }
    
    return data.filter(item => {
      if (item.totalData) return true; // Always include total row
      
      const loNo = parseInt(item.loNo);
      if (isNaN(loNo)) return false;
      
      if (selectedLoGroup === 'main') {
        return loNo >= 1 && loNo <= 10;
      } else if (selectedLoGroup === 'ext') {
        return loNo >= 11;
      }
      
      return true;
    });
  };

  const filteredData = useMemo(() => {
    const dataSource = currentFilter === 'branch' && branchCollectionData?.length > 0 
      ? branchCollectionData 
      : data;
    
    // UPDATED: Apply LO group filter first
    const loGroupFiltered = applyLoGroupFilter(dataSource);
    
    const normalRows = loGroupFiltered.filter(item => !item.totalData);
    
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
    
    // UPDATED: Apply LO group filter to total row as well
    const loGroupFiltered = applyLoGroupFilter(dataSource);
    return loGroupFiltered.find(item => item.totalData === true);
  }, [branchCollectionData, data, currentFilter, selectedLoGroup]);

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


  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    transactionType: true, // ADDED: Include transactionType column for loan officers only
    loanTargetStr: true,
    excess: true, 
    actualLoanCollection: true,
    mcbuCollection: true,
    mcbu: true,
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
    csfReturnAmtStr: true,
    transferClients: true,
    csfIn: true,
    cashOnHand: currentUser.role.rep <= 3,
    totalNetCollectionStr: true,
  });

  const columnDefs = useMemo(() => [
    { key: 'name', label: getEntityColumnLabel(), width: 'w-64' },
    { key: 'transactionType', label: 'Occurrence', width: 'w-24' }, // ADDED: Transaction Type/Occurrence column for loan officers only
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
    { key: 'mcbuReturn', label: 'MCBU Return Amount', width: 'w-32', },
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
  ], [currentFilter]);

  // UPDATED: Filter visible columns - only show transactionType when filter is 'lo'
  const visibleColumnDefs = useMemo(() => {
    return columnDefs.filter(col => {
      // Show transactionType column ONLY when currentFilter is 'lo'
      if (col.key === 'transactionType') {
        return currentFilter === 'lo' && visibleColumns[col.key];
      }
      return visibleColumns[col.key];
    });
  }, [visibleColumns, columnDefs, currentFilter]);

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

            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="flex items-center space-x-4">
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
                      !viewingNestedContent && // Add this condition to hide when viewing nested content
                      !router.query.id && // Also hide when there's an ID in the query (alternative check)
                      !router.query.filter // Hide when there's a filter applied (lo, group, etc.)
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
                    {((currentUser.role && currentUser.role.rep == 3 || currentLevel == "lo") && numberOfLo > 10 ) && (
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
                </div>
                
                <div className="flex items-center space-x-2">
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
                    
                    <button 
                        className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md"
                        title="Export as CSV"
                    >
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {showColumnSelector && (
                <div className="absolute right-4 mt-16 bg-white shadow-lg border border-gray-200 rounded-md z-10 p-4 max-h-96 overflow-y-auto">
                <h3 className="font-medium text-gray-700 mb-2">Show/Hide Columns</h3>
                <div className="grid grid-cols-2 gap-2">
                    {columnDefs.map(col => {
                      // UPDATED: Only show transactionType column option when filter is 'lo'
                      if (col.key === 'transactionType' && currentFilter !== 'lo') {
                        return null;
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

            <div className="flex-1 overflow-x-auto px-6">
                {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner />
                </div>
                ) : (
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                {visibleColumnDefs.map(column => (
                                    <th 
                                    key={column.key}
                                    scope="col" 
                                    className={`${column.width || 'w-auto'} px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer group`}
                                    onClick={() => handleSort(column.key)}
                                    >
                                    <div className="flex items-center">
                                        <span>{column.label}</span>
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
                                    </div>
                                    </th>
                                ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {sortedData.length > 0 ? (
                                  sortedData.map((row, index) => (
                                    <tr 
                                        key={row._id || index} 
                                        onClick={() => handleRowClick(row)}
                                        className={`
                                          ${row.status === 'close' ? 'bg-red-50' : ''} 
                                          ${row.isDraft ? 'bg-orange-100' : ''} 
                                          ${!row.isDraft && row.groupStatus && row.groupStatus !== 'closed' ? 'bg-blue-100' : ''} 
                                          hover:bg-gray-50 cursor-pointer
                                        `.trim()}
                                    >
                                        {visibleColumnDefs.map(column => (
                                        <td key={`${row._id}-${column.key}`} className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {column.key === 'name' ? (
                                            <div className="font-medium text-gray-900">{row[column.key]}</div>
                                            ) : column.key === 'transactionType' ? (
                                              <div className="text-xs font-medium uppercase tracking-wider text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                {row[column.key] || '-'}
                                              </div>
                                            ) : column.key === 'excess' && column.hasComparison ? (
                                            formatWithComparison(row.excessCurrent, row.excessPrevious)
                                            ) : column.key === 'mcbu' && column.hasComparison ? (
                                            formatWithComparison2(row.mcbu, row._value.mcbuCollection - row._value.mcbuWithdrawal - row._value.mcbuReturn)
                                            ) : column.key === 'csf' && column.hasComparison ? (
                                            formatWithComparison2(row.csf, row._value.csfCollection - row._value.csfWithdrawal - row._value.csfReturnAmt)
                                            ) : column.key === 'actualLoanCollection' && column.hasComparison ? (
                                            formatWithComparison(row.actualLoanCollectionCurrent, row.actualLoanCollectionPrevious)
                                            ) : column.key === 'activeClients' && column.hasComparison ? (
                                            formatWithComparison(row.activeClients, row.activeClientsPrevious)
                                            ) : column.key === 'activeBorrowers' && column.hasComparison ? (
                                            formatWithComparison(row.activeBorrowers, row.activeBorrowersPrevious)
                                            ) : column.key === 'totalReleasesStr' && column.hasComparison ? (        
                                            formatWithComparison2(row.totalReleasesStr, row.currentReleaseAmount - row._value.fullPaymentAmount)
                                            ) : column.key === 'totalLoanBalanceStr' && column.hasComparison ? (        
                                            formatWithComparison2(row.totalLoanBalanceStr, row.currentReleaseAmount - row._value.actualLoanCollection)
                                            ) : column.key === 'mcbuWithdrawal' && column.hasComparison ? (
                                            formatWithComparison(row.mcbuWithdrawalCurrent, row.mcbuWithdrawalPrevious)
                                            ) : column.key === 'noMcbuReturn' && column.hasComparison ? (
                                            formatWithComparison(row.noMcbuReturnCurrent, row.noMcbuReturnPrevious)
                                            ) : column.key === 'mcbuReturn' && column.hasComparison ? (
                                            formatWithComparison(row.mcbuReturnCurrent, row.mcbuReturnPrevious)
                                            ) : column.key === 'fullPaymentPerson' && column.hasComparison ? (
                                            formatWithComparison(row.fullPaymentPersonCurrent, row.fullPaymentPersonPrevious)
                                            ) : column.key === 'fullPaymentAmount' && column.hasComparison ? (
                                            formatWithComparison(row.fullPaymentAmountCurrent, row.fullPaymentAmountPrevious)
                                            ) : column.key === 'mispay' && column.hasComparison ? (
                                            formatWithComparison(row.mispayCurrent, row.mispayPrevious)
                                            ) : column.key === 'noPastDue' && column.hasComparison ? (
                                            formatWithComparison(row.noPastDueCurrent, row.noPastDuePrevious)
                                            ) : row[column.key] === '-' ? (
                                            <span className="text-gray-400">-</span>
                                            ) : (
                                            row[column.key] ?? '-'
                                            )}
                                        </td>
                                        ))}
                                    </tr>
                                  ))
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
                                    <td key={`grand-total-${column.key}`} className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-semibold border-t-2 border-gray-300">
                                            {column.key === 'name' ? (
                                            <div className="font-medium text-gray-900">GRAND TOTALS</div>
                                            ) : column.key === 'transactionType' ? (
                                              <div className="text-xs font-medium uppercase tracking-wider text-gray-700 bg-gray-200 px-2 py-1 rounded">
                                                {grandTotalRow[column.key] || 'ALL'}
                                              </div>
                                            ) : column.key === 'excess' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.excessCurrent, grandTotalRow.excessPrevious)
                                            ) : column.key === 'actualLoanCollection' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.actualLoanCollectionCurrent, grandTotalRow.actualLoanCollectionPrevious)
                                            ) : column.key === 'activeClients' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.activeClients, grandTotalRow.activeClientsPrevious)
                                            ) : column.key === 'activeBorrowers' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.activeBorrowers, grandTotalRow.activeBorrowersPrevious)
                                            ) : column.key === 'totalReleasesStr' && column.hasComparison ? (        
                                            formatWithComparison(grandTotalRow.totalReleasesStr, grandTotalRow.totalReleasesPreviousStr)
                                            ) : column.key === 'totalLoanBalanceStr' && column.hasComparison ? (        
                                              formatWithComparison(grandTotalRow.totalLoanBalanceStr, grandTotalRow.totalLoanBalancePreviousStr)
                                            ) : column.key === 'mcbuWithdrawal' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.mcbuWithdrawalCurrent, grandTotalRow.mcbuWithdrawalPrevious)
                                            ) : column.key === 'noMcbuReturn' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.noMcbuReturnCurrent, grandTotalRow.noMcbuReturnPrevious)
                                            ) : column.key === 'mcbuReturn' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.mcbuReturnCurrent, grandTotalRow.mcbuReturnPrevious)
                                            ) : column.key === 'fullPaymentPerson' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.fullPaymentPersonCurrent, grandTotalRow.fullPaymentPersonPrevious)
                                            ) : column.key === 'fullPaymentAmount' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.fullPaymentAmountCurrent, grandTotalRow.fullPaymentAmountPrevious)
                                            ) : column.key === 'mispay' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.mispayCurrent, grandTotalRow.mispayPrevious)
                                            ) : column.key === 'noPastDue' && column.hasComparison ? (
                                            formatWithComparison(grandTotalRow.noPastDueCurrent, grandTotalRow.noPastDuePrevious)
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
    </Layout>
  );
};

export default ModernBranchCashCollections;