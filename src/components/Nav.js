import React, { useReducer, useMemo, useCallback, useEffect, useState } from 'react';
import logo from "/public/images/logo.png";
import { 
    LayoutDashboard, 
    Store,
    Banknote,
    Building,
    Building2,
    BarChart3,
    BarChart,
    ClipboardList,
    ClipboardCheck,
    User,
    UserMinus,
    Users,
    Users2,
    Ticket,
    Settings,
    FileBarChart,
    Library,
    ChevronDown,
    ChevronRight,
    Cpu,
    ArrowRightLeft,
    CloudUpload,
    Menu,
    X,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';
import { AlertTriangle, Edit, FileSpreadsheet } from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentPage,
    setCurrentPageTitle,
    setCurrentSubMenu
} from "@/redux/actions/globalActions";
import { McbuWithdrawalIcon } from '@/lib/ui/icons/mcbu-withdrawal-icon';
import { useRef } from 'react';
import { createPortal } from 'react-dom';

// Tooltip component for collapsed sidebar items
const Tooltip = ({ children, content, show = true }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e) => {
    if (!show) return;
    setIsVisible(true);
    if (e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8
      });
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const tooltipContent = isVisible && typeof window !== 'undefined' ? (
    <div 
      className="fixed px-2 py-1 text-sm text-white bg-gray-800 rounded shadow-lg whitespace-nowrap z-[70]"
      style={{
        left: tooltipPosition.left,
        top: tooltipPosition.top,
        transform: 'translateY(-50%)'
      }}
    >
      {content}
      <div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 -left-1 top-1/2 -translate-y-1/2" />
    </div>
  ) : null;

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </div>
  );
};

// Dropdown for collapsed submenu items
const CollapsedSubmenu = ({ item, activePath, isOpen, onClose, position }) => {
  if (!isOpen || typeof window === 'undefined') return null;

  const dropdownContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[45] bg-black bg-opacity-10"
        onClick={(e) => {
          onClose();
        }}
      />
      
      {/* Dropdown */}
      <div 
        className="fixed bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden min-w-[200px] w-max z-[60]"
        style={{
          top: Math.max(position.top, 10),
          left: Math.min(position.left, window.innerWidth - 220),
          maxHeight: '400px',
          overflowY: 'auto',
          pointerEvents: 'auto'
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="py-1">
          {item.subMenuItems?.filter(subItem => !subItem.hidden).map((subItem, idx) => (
            <div 
              key={idx}
              className={`flex items-center px-4 py-3 text-sm cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap
                ${activePath === subItem.url ? 'bg-teal-50 text-teal-600 border-l-2 border-teal-600' : 'text-gray-800'}
              `}
              style={{ pointerEvents: 'auto' }}
              onMouseEnter={() => console.log('Mouse enter:', subItem.label)}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => {
                try {
                  e.stopPropagation();
                  onClose();
                  setTimeout(() => {
                    window.location.href = subItem.url;
                  }, 100);
                } catch (error) {
                  console.error('Error in onMouseUp handler:', error);
                }
              }}
            >
              <subItem.icon.notActive className={`w-4 h-4 mr-3 flex-shrink-0 ${activePath === subItem.url ? 'text-teal-600' : 'text-gray-500'}`} />
              <span className="font-medium" style={{ pointerEvents: 'none' }}>{subItem.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return createPortal(dropdownContent, document.body);
};

// Menu configuration
const MenuItems = [
    {
        label: "Dashboard",
        url: "/",
        icon: {
          active: (props) => <LayoutDashboard {...props} />,
          notActive: (props) => <LayoutDashboard {...props} />,
        },
        active: true,
        hasSub: false,
        hidden: false,
        roles: []
    },
    {
        label: "Branches",
        url: "/branches",
        icon: {
          active: (props) => <Store {...props} />,
          notActive: (props) => <Store {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false,
        roles: ["admin"]
    },
    {
        label: "Areas",
        url: "/areas",
        icon: {
            active: (props) => <Building {...props} />,
            notActive: (props) => <Building {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false,
        roles: ["admin"]
    },
    {
        label: "Regions",
        url: "/regions",
        icon: {
            active: (props) => <Building2 {...props} />,
            notActive: (props) => <Building2 {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false,
        roles: ["admin"]
    },
    {
        label: "Divisions",
        url: "/divisions",
        icon: {
            active: (props) => <Library {...props} />,
            notActive: (props) => <Library {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false,
        roles: ["admin"]
    },
    {
        label: "Groups",
        url: "/groups",
        icon: {
            active: (props) => <Users2 {...props} />,
            notActive: (props) => <Users2 {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false,
        roles: ["admin", "branch_manager", "loan_officer"]
    },
    {
        label: "Clients",
        url: "#clients",
        icon: {
            active: (props) => <User {...props} />,
            notActive: (props) => <User {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        roles: ["admin", "branch_manager", "loan_officer"],
        subMenuItems: [
            {
                label: "Prospect Clients",
                url: "/clients?status=pending",
                icon: {
                    active: (props) => <User {...props} />,
                    notActive: (props) => <User {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Active Clients",
                url: "/clients?status=active",
                icon: {
                    active: (props) => <User {...props} />,
                    notActive: (props) => <User {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Offset Accounts",
                url: "/clients?status=offset",
                icon: {
                    active: (props) => <User {...props} />,
                    notActive: (props) => <User {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            }
        ]
    },
    {
        label: "Daily Transactions",
        url: "#transactions",
        icon: {
            active: (props) => <ClipboardList {...props} />,
            notActive: (props) => <ClipboardList {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        roles: ["loan_officer"],
        transactionType: 'daily',
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardCheck {...props} />,
                    notActive: (props) => <ClipboardCheck {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Loan Officer Register (Daily)",
                url: "/transactions/cash-collection/", 
                icon: {
                    active: (props) => <Ticket {...props} />,
                    notActive: (props) => <Ticket {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Transaction Summary",
                url: "/transactions/summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["cashier", "loan_officer"]
            },
            {
                label: "Daily Collection Sheet",
                url: "/transactions/daily-collection-sheet",
                icon: {
                    active: (props) => <FileSpreadsheet {...props} />,
                    notActive: (props) => <FileSpreadsheet {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["loan_officer"]
            },
            {
              label: "Denomination",
              url: '/transactions/denomination',
              icon: {
                  active: (props) => <Banknote {...props} />,
                  notActive: (props) => <Banknote {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: []
            },
            {
              label: "MCBU/CSF Withdrawals",
              url: "/transactions/mcbu-withdrawal",
              icon: {
                  active: (props) => <McbuWithdrawalIcon {...props} />,
                  notActive: (props) => <McbuWithdrawalIcon {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: []
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinus {...props} />,
                    notActive: (props) => <UserMinus {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            }
        ]
    },
    {
        label: "Weekly Transactions",
        url: "#weekly-transactions",
        icon: {
            active: (props) => <ClipboardList {...props} />,
            notActive: (props) => <ClipboardList {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        roles: ["loan_officer"],
        transactionType: 'weekly',
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardCheck {...props} />,
                    notActive: (props) => <ClipboardCheck {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Loan Officer Register (Weekly)",
                url: "/transactions/cash-collection/", 
                icon: {
                    active: (props) => <Ticket {...props} />,
                    notActive: (props) => <Ticket {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Transaction Summary",
                url: "/transactions/summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["cashier", "loan_officer"]
            },
            {
                label: "Daily Collection Sheet",
                url: "/transactions/daily-collection-sheet",
                icon: {
                    active: (props) => <FileSpreadsheet {...props} />,
                    notActive: (props) => <FileSpreadsheet {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["loan_officer"]
            },
            {
              label: "Denomination",
              url: '/transactions/denomination',
              icon: {
                  active: (props) => <Banknote {...props} />,
                  notActive: (props) => <Banknote {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: []
            },
            {
              label: "MCBU/CSF Withdrawals",
              url: "/transactions/mcbu-withdrawal",
              icon: {
                  active: (props) => <McbuWithdrawalIcon {...props} />,
                  notActive: (props) => <McbuWithdrawalIcon {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: []
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinus {...props} />,
                    notActive: (props) => <UserMinus {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            }
        ]
    },
    {
        label: "BM Transactions",
        url: "#branch-manager-transactions",
        displayLabel: "Transactions",
        icon: {
            active: (props) => <ClipboardList {...props} />,
            notActive: (props) => <ClipboardList {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        roles: ["admin", "deputy_director", "regional_manager", "area_admin", "cashier", "finance", "branch_manager"],
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardCheck {...props} />,
                    notActive: (props) => <ClipboardCheck {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
            },
            // {
            //     label: "Loan Approval",
            //     url: "/transactions/loan-applications/admin-view",
            //     icon: {
            //         active: (props) => <ClipboardCheck {...props} />,
            //         notActive: (props) => <ClipboardCheck {...props} />,
            //     },
            //     active: false,
            //     hasSub: false,
            //     hidden: false,
            //     roles: ["admin", "deputy_director", "regional_manager", "area_admin"]
            // },
            {
                label: "Loan Officer Register",
                url: "/transactions/cash-collection/", 
                icon: {
                    active: (props) => <Ticket {...props} />,
                    notActive: (props) => <Ticket {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
            },
            {
                label: "Transaction Summary",
                url: "/transactions/summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["branch_manager"]
            },
            {
                label: "Daily Collection Sheet",
                url: "/transactions/daily-collection-sheet",
                icon: {
                    active: (props) => <FileSpreadsheet {...props} />,
                    notActive: (props) => <FileSpreadsheet {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["branch_manager"]
            },
            {
              label: "Denomination",
              url: '/transactions/denomination',
              icon: {
                  active: (props) => <Banknote {...props} />,
                  notActive: (props) => <Banknote {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: []
            },
            {
              label: "MCBU/CSF Withdrawals",
              url: "/transactions/mcbu-withdrawal",
              icon: {
                  active: (props) => <McbuWithdrawalIcon {...props} />,
                  notActive: (props) => <McbuWithdrawalIcon {...props} />,
              },
              active: false,
              hasSub: false,
              hidden: false,
              roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
            },
            {
                label: "Transfer Client",
                url: "/transactions/transfer-client", 
                icon: {
                    active: (props) => <ArrowRightLeft {...props} />,
                    notActive: (props) => <ArrowRightLeft {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
            },
            {
                label: "Management Transactions",
                url: "/management-transactions",
                icon: {
                    active: (props) => <Banknote {...props} />,
                    notActive: (props) => <Banknote {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                // roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
                roles: ["admin"]
            },
            {
                label: "Fund Transfer",
                url: "/transactions/fund-transfer", 
                icon: {
                    active: (props) => <Banknote {...props} />,
                    notActive: (props) => <Banknote {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager", "finance"]
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinus {...props} />,
                    notActive: (props) => <UserMinus {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin", "deputy_director", "regional_manager", "area_admin", "branch_manager"]
            },
            {
                label: "TEST",
                url: "/transactions/branch-manager/cash-collection", 
                icon: {
                    active: (props) => <Ticket {...props} />,
                    notActive: (props) => <Ticket {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            },
        ]
    },
    {
        label: "Reports",
        url: "#reports",
        icon: {
            active: (props) => <BarChart {...props} />,
            notActive: (props) => <BarChart {...props} />,
        },
        active: true,
        hasSub: true,
        hidden: false,
        roles: [],
        subMenuItems: [
            {
                label: "Transaction by Remarks",
                url: "/reports/transaction-remarks",
                icon: {
                    active: (props) => <FileBarChart {...props} />,
                    notActive: (props) => <FileBarChart {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Query Low Loan Balance",
                url: "/reports/low-loan-balance",
                icon: {
                    active: (props) => <FileBarChart {...props} />,
                    notActive: (props) => <FileBarChart {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
            {
                label: "Query Mispayments",
                url: "/reports/mispay-list",
                icon: {
                    active: (props) => <FileBarChart {...props} />,
                    notActive: (props) => <FileBarChart {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: []
            },
        ]
    },
    {
        label: "Settings",
        url: "#settings",
        icon: {
            active: (props) => <Settings {...props} />,
            notActive: (props) => <Settings {...props} />,
        },
        active: true,
        hasSub: true,
        hidden: false,
        roles: ["admin"],
        subMenuItems: [
            {
                label: "Users",
                url: "/settings/users",
                icon: {
                    active: (props) => <Users {...props} />,
                    notActive: (props) => <Users {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            },
            {
                label: "Manage Account Types",
                url: "/settings/management-account-types",
                icon: {
                    active: (props) => <Edit {...props} />,
                    notActive: (props) => <Edit {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            },
            {
                label: "System",
                url: "/settings/system",
                icon: {
                    active: (props) => <Cpu {...props} />,
                    notActive: (props) => <Cpu {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            },
            {
                label: "Migration",
                url: "/settings/migration",
                icon: {
                    active: (props) => <CloudUpload {...props} />,
                    notActive: (props) => <CloudUpload {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            },
            {
                label: "Reset",
                url: "/settings/reset",
                icon: {
                    active: (props) => <AlertTriangle {...props} />,
                    notActive: (props) => <AlertTriangle {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: ["admin"]
            }
        ]
    }
];

// Helper functions for localStorage
const getStoredCollapseState = () => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('sidebarCollapsed');
      return stored ? JSON.parse(stored) : false;
    } catch (error) {
      console.error('Error reading collapse state from localStorage:', error);
      return false;
    }
  }
  return false;
};

const setStoredCollapseState = (isCollapsed) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
    } catch (error) {
      console.error('Error storing collapse state to localStorage:', error);
    }
  }
};

// Role-based visibility helper
const isItemVisibleForRole = (item, userShortCode, userRoot, userTransactionType, parentRoles = null) => {
  // Root users can see everything except items specifically excluded
  if (userRoot) {
    // Hide daily/weekly transactions for root users, they use BM transactions
    if (item.label === 'Daily Transactions' || item.label === 'Weekly Transactions') {
      return false;
    }
    return true;
  }

  // If item has no role restrictions, it's visible to all
  if (!item.roles || item.roles.length === 0) {
    return true;
  }

  // For submenu items, check if submenu role is in parent's allowed roles
  if (parentRoles && parentRoles.length > 0) {
    // If submenu has specific roles, they must also be in parent's roles
    if (item.roles && item.roles.length > 0) {
      const hasCommonRole = item.roles.some(role => parentRoles.includes(role));
      if (!hasCommonRole) {
        // Submenu role not in parent's roles, hide it
        return false;
      }
    }
  }

  // Check if user's shortCode is in the allowed roles
  const hasRoleAccess = item.roles.includes(userShortCode);

  // For transaction type specific items (only for loan_officer role)
  if (item.transactionType && userShortCode === 'loan_officer') {
    const result = hasRoleAccess && userTransactionType === item.transactionType;
    return result;
  }

  return hasRoleAccess;
};

const initialState = {
  activePath: null,
  isCollapsed: false,
  openSubmenus: {},
  collapsedDropdown: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_PATH':
      return { ...state, activePath: action.payload };
    case 'TOGGLE_COLLAPSE':
      const newCollapsedState = !state.isCollapsed;
      setStoredCollapseState(newCollapsedState);
      return { 
        ...state, 
        isCollapsed: newCollapsedState,
        openSubmenus: {},
        collapsedDropdown: null
      };
    case 'SET_COLLAPSED':
      return { ...state, isCollapsed: action.payload };
    case 'TOGGLE_SUBMENU':
      return { 
        ...state, 
        openSubmenus: { 
          ...state.openSubmenus, 
          [action.payload]: !state.openSubmenus[action.payload] 
        } 
      };
    case 'SET_OPEN_SUBMENUS':
      return { ...state, openSubmenus: action.payload };
    case 'SET_COLLAPSED_DROPDOWN':
      return { ...state, collapsedDropdown: action.payload };
    case 'CLOSE_COLLAPSED_DROPDOWN':
      return { ...state, collapsedDropdown: null };
    default:
      return state;
  }
}

// Individual menu item component with full-width active background
const MenuItem = React.memo(({ item, index, activePath, isCollapsed, isMobile, onMenuClick, state, dispatch }) => {
  const router = useRouter();
  const menuItemRef = useRef(null);

  // Check if submenu should be open
  const isSubmenuOpen = state.openSubmenus[item.label] || false;
  const isCollapsedDropdownOpen = state.collapsedDropdown === item.label;

  const handleClick = (e) => {
    if (item.hasSub) {
      e.preventDefault();
      e.stopPropagation();
      
      if (isCollapsed && !isMobile) {
        // Calculate position for dropdown
        if (menuItemRef.current) {
          const rect = menuItemRef.current.getBoundingClientRect();
          const position = {
            top: rect.top,
            left: rect.right + 8
          };
          
          // Toggle collapsed dropdown
          if (isCollapsedDropdownOpen) {
            dispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' });
          } else {
            dispatch({ type: 'SET_COLLAPSED_DROPDOWN', payload: item.label });
          }
        }
      } else {
        // Toggle regular submenu
        dispatch({ type: 'TOGGLE_SUBMENU', payload: item.label });
      }
    } else {
      // Close mobile menu when clicking a non-submenu item
      if (isMobile && onMenuClick) {
        onMenuClick();
      }
      // Close collapsed dropdown when clicking a regular menu item
      if (isCollapsed && !isMobile) {
        dispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' });
      }
      // Remove hash from URL after navigation
      setTimeout(() => {
        const newUrl = window.location.href.split('#')[0];
        window.history.replaceState({}, document.title, newUrl);
      }, 0);
    }
  };

  const IconComponent = activePath === item.url ? item.icon?.active : item.icon?.notActive;
  const isActive = activePath === item.url;
  const displayLabel = item.displayLabel || item.label;

  // Collapsed view
  if (isCollapsed && !isMobile) {
    return (
      <li className={`${index === 0 ? 'mt-2' : 'mt-3'}`} ref={menuItemRef}>
        <Tooltip content={displayLabel} show={!isCollapsedDropdownOpen}>
          <div 
            className={`flex justify-center items-center p-3 cursor-pointer transition-all duration-200 relative
              ${isActive 
                ? 'bg-teal-600 text-white' 
                : 'text-white hover:bg-gray-700'
              }
              ${item.hasSub && isCollapsedDropdownOpen ? 'bg-gray-600' : ''}
            `}
            onClick={handleClick}
          >
            <IconComponent className="w-5 h-5" />
            {item.hasSub && (
              <ChevronDown className={`w-3 h-3 absolute -bottom-0.5 -right-0.5 text-white bg-teal-500 rounded-full p-0.5 transition-transform duration-200 ${isCollapsedDropdownOpen ? 'rotate-180' : ''}`} />
            )}
          </div>
        </Tooltip>
        
        {item.hasSub && isCollapsedDropdownOpen && (
          <CollapsedSubmenu 
            item={item} 
            activePath={activePath} 
            isOpen={isCollapsedDropdownOpen}
            onClose={() => dispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' })}
            position={{
              top: menuItemRef.current?.getBoundingClientRect().top || 0,
              left: (menuItemRef.current?.getBoundingClientRect().right || 0) + 8
            }}
          />
        )}
      </li>
    );
  }

  // Expanded view
  return (
    <li className={`${index === 0 ? 'mt-2' : 'mt-3'}`}>
      {item.hasSub ? (
        // Menu items with submenus - no Link wrapper
        <div 
          className={`flex items-center p-3 cursor-pointer transition-all duration-200 relative
            ${isActive 
              ? 'bg-teal-600 text-white' 
              : 'text-white hover:bg-gray-700'
            }
          `}
          onClick={handleClick}
        >
          <IconComponent className="w-5 h-5 flex-shrink-0 ml-1" />
          <span className="ml-3 font-medium flex-1">{displayLabel}</span>
          <ChevronDown className={`w-4 h-4 mr-1 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''}`} />
        </div>
      ) : (
        // Regular menu items - wrapped in Link
        <Link href={item.url}>
          <div 
            className={`flex items-center p-3 cursor-pointer transition-all duration-200 relative
              ${isActive 
                ? 'bg-teal-600 text-white' 
                : 'text-white hover:bg-gray-700'
              }
            `}
            onClick={handleClick}
          >
            <IconComponent className="w-5 h-5 flex-shrink-0 ml-1" />
            <span className="ml-3 font-medium flex-1">{displayLabel}</span>
          </div>
        </Link>
      )}
      
      {/* Submenu */}
      {item.hasSub && isSubmenuOpen && !isCollapsed && (
        <div className="ml-8 mt-2 relative z-[55]">
          {/* Left border indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400"></div>
          
          <ul className="space-y-1">
            {item.subMenuItems.filter(subItem => !subItem.hidden).map((subItem, idx) => (
              <li key={idx}>
                <Link href={subItem.url}>
                  <div 
                    className={`flex items-center p-2 cursor-pointer transition-all duration-200 relative z-[55]
                      ${activePath === subItem.url 
                        ? 'bg-teal-500 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }
                    `}
                    onClick={(e) => {
                      if (isMobile && onMenuClick) {
                        onMenuClick();
                      }
                      setTimeout(() => {
                        const newUrl = window.location.href.split('#')[0];
                        window.history.replaceState({}, document.title, newUrl);
                      }, 0);
                    }}
                  >
                    {/* Active indicator */}
                    {activePath === subItem.url && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400"></div>
                    )}
                    <subItem.icon.notActive className="w-4 h-4 flex-shrink-0 ml-1" />
                    <span className="ml-3 text-sm font-medium">{subItem.label}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
});

const NavComponent = ({ isVisible, toggleNav, isMobile, onCollapseChange }) => {
  const router = useRouter();
  const dispatch = useDispatch();
  const [state, localDispatch] = useReducer(reducer, initialState);
  const { activePath, isCollapsed, openSubmenus, collapsedDropdown } = state;
  const userState = useSelector(state => state.user.data);

  const getActivePath = useCallback(() => {
    const path = router.asPath.replace("#", "");
    const paths = path.split("/").filter((p) => p);

    let currentPath = '';
    if (!path && paths.length > 0) {
      if (paths.length === 1) {
        currentPath = "/".concat(paths[0]);
      } else if (paths.length === 2) {
        currentPath = "/".concat(paths[0]).concat("/").concat(paths[1]);
      }
    } else {
      currentPath = path;
    }

    return currentPath;
  }, [router.asPath]);

  // Filter menu items based on user role
  const filteredMenuItems = useMemo(() => {
    if (!userState) {
      // console.log('❌ Nav Debug - No userState found, returning empty array');
      return [];
    }

    const userShortCode = userState?.role?.shortCode;
    const userRoot = userState?.root || false;
    const userTransactionType = userState?.transactionType;

    // console.log('🔍 Nav Debug - User info:', {
    //   userShortCode,
    //   userRoot,
    //   userTransactionType
    // });

    // First, filter items based on visibility
    const visibleItems = MenuItems.filter(item => {
      const isVisible = isItemVisibleForRole(item, userShortCode, userRoot, userTransactionType);
      // console.log(`🔍 Nav Debug - Item "${item.label}" visibility:`, {
      //   isVisible,
      //   itemRoles: item.roles,
      //   userShortCode,
      //   userRoot,
      //   transactionType: item.transactionType,
      //   userTransactionType
      // });
      return isVisible;
    });

    // Then, process each visible item (filter subitems and apply transformations)
    const processedItems = visibleItems.map(item => {
      // Create a copy of the item
      let processedItem = { ...item };

      // Filter submenu items if the item has submenus
      if (item.hasSub && item.subMenuItems) {
        const filteredSubItems = item.subMenuItems.filter(subItem => {
          // Pass parent roles to submenu visibility check
          const subItemVisible = isItemVisibleForRole(
            subItem, 
            userShortCode, 
            userRoot, 
            userTransactionType,
            item.roles // Pass parent's roles for inheritance check
          );
          // console.log(`🔍 Nav Debug - SubItem "${subItem.label}" of "${item.label}" visibility:`, {
          //   subItemVisible,
          //   subItemRoles: subItem.roles,
          //   parentRoles: item.roles,
          //   userShortCode
          // });
          return subItemVisible && !subItem.hidden;
        });
        
        // Update the processed item with filtered subitems
        processedItem.subMenuItems = filteredSubItems;
        
        // Hide parent if no visible subitems (but only if it originally had subitems)
        if (filteredSubItems.length === 0 && item.hasSub) {
          processedItem.hidden = true;
        }
      }

      // Apply any label transformations
      if (item.label === 'BM Transactions' && userShortCode === 'branch_manager') {
        processedItem.displayLabel = 'Transactions';
      }

      return processedItem;
    });

    // Filter out any items that became hidden during processing
    const finalItems = processedItems.filter(item => !item.hidden);

    // console.log('🔍 Nav Debug - Final filtered menu items:', finalItems.map(item => ({
    //   label: item.label,
    //   displayLabel: item.displayLabel,
    //   roles: item.roles,
    //   subItemsCount: item.subMenuItems?.length || 0
    // })));

    return finalItems;
  }, [userState]);

  // Handle menu item click to close mobile nav
  const handleMenuClick = useCallback(() => {
    if (isMobile) {
      toggleNav();
    }
  }, [isMobile, toggleNav]);

  // Initialize collapse state from localStorage on component mount
  useEffect(() => {
    const storedCollapse = getStoredCollapseState();
    localDispatch({ type: 'SET_COLLAPSED', payload: storedCollapse });
  }, []);

  // Notify parent component when collapse state changes
  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
    // Also dispatch a custom event for backwards compatibility
    window.dispatchEvent(new CustomEvent('navCollapseChange', { 
      detail: { isCollapsed } 
    }));
  }, [isCollapsed, onCollapseChange]);

  // Set active path and update Redux state
  useEffect(() => {
    const currentPath = getActivePath();
    localDispatch({ type: 'SET_ACTIVE_PATH', payload: currentPath });

    // Find the current page and update Redux
    let page = MenuItems.find((i) => i.url === currentPath);
    let parentMenu = null;
    
    if (!page) {
      MenuItems.forEach(menu => {
        if (menu.subMenuItems) {
          const currentPage = menu.subMenuItems.find(m => m.url === currentPath);
          if (currentPage) {
            page = currentPage;
            parentMenu = menu;
          }
        }
      });
    }
    
    if (page) {
      dispatch(setCurrentPage(page.url));
      dispatch(setCurrentPageTitle(page.label));
    }

    // Auto-open parent submenu if we're on a submenu page
    if (parentMenu) {
      localDispatch({ type: 'SET_OPEN_SUBMENUS', payload: { [parentMenu.label]: true } });
    } else {
      // Only close submenus if we're NOT on a submenu page
      localDispatch({ type: 'SET_OPEN_SUBMENUS', payload: {} });
    }
    
    // Always close collapsed dropdown when route changes
    localDispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' });
  }, [activePath, dispatch, getActivePath, router.asPath]);

  // Auto-collapse on mobile and prevent collapse functionality on mobile
  useEffect(() => {
    if (isMobile) {
      localDispatch({ type: 'SET_COLLAPSED', payload: false });
    }
  }, [isMobile]);

  // Override collapse functionality for mobile
  const toggleCollapse = useCallback(() => {
    if (!isMobile) {
      localDispatch({ type: 'TOGGLE_COLLAPSE' });
    }
  }, [isMobile]);

  // Close collapsed dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (collapsedDropdown && isCollapsed) {
        const submenuElement = event.target.closest('.collapsed-submenu-container');
        if (!submenuElement) {
          localDispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' });
        }
      }
    };

    if (collapsedDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [collapsedDropdown, isCollapsed]);

  // Close collapsed dropdown when route changes or sidebar expands
  useEffect(() => {
    if (collapsedDropdown) {
      localDispatch({ type: 'CLOSE_COLLAPSED_DROPDOWN' });
    }
  }, [router.asPath, isCollapsed]);

  return (
    <React.Fragment>
      {/* Mobile menu toggle */}
      {isMobile && (
        <button
          className="fixed top-4 right-4 z-50 bg-main p-2 rounded-md transition-all duration-300 ease-in-out"
          onClick={toggleNav}
          aria-label="Toggle menu"
        >
          {isVisible ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>
      )}

      {/* Sidebar */}
      <div className={`bg-main fixed top-0 left-0 h-full overflow-y-auto transition-all duration-300 ease-in-out transform z-50 
        ${isVisible || !isMobile ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed && !isMobile ? 'w-16' : 'w-64'}
      `}>
        
        {/* Header */}
        <div className={`relative py-4 border-b border-gray-200 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {/* Collapse Toggle Button - Only show when NOT collapsed and on desktop */}
          {!isMobile && !isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="absolute top-4 right-4 hidden lg:block p-1.5 rounded-md text-white hover:bg-gray-700 transition-colors duration-200 z-10"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
          
          {/* Expand button when collapsed - centered */}
          {!isMobile && isCollapsed && (
            <div className="flex justify-center mb-2">
              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-md text-white hover:bg-gray-700 transition-colors duration-200"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {/* Logo */}
          <div className="flex justify-center">
            {!isCollapsed ? (
              <Link href="/" className="no-underline text-white">
                <img src={logo.src} className="cursor-pointer duration-500" alt="Logo" />
              </Link>
            ) : (
              !isMobile && (
                <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
                  <span className="text-main font-bold text-xs">ACPH</span>
                </div>
              )
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-grow py-4">
          <ul className="space-y-1">
            {filteredMenuItems.map((item, index) => (
              !item.hidden && (
                <MenuItem 
                  key={index} 
                  item={item} 
                  index={index} 
                  activePath={activePath} 
                  isCollapsed={isCollapsed} 
                  isMobile={isMobile} 
                  onMenuClick={handleMenuClick}
                  state={state}
                  dispatch={localDispatch}
                />
              )
            ))}
          </ul>
        </nav>
      </div>
    </React.Fragment>
  );
};

export default React.memo(NavComponent);