import React, { useReducer, useMemo, useCallback, useEffect, useState } from 'react';
import logo from "/public/images/logo.png";
import { 
    LayoutDashboard, 
    Store,
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
import { AlertTriangle, Edit } from 'lucide-react';
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
          console.log('Backdrop clicked');
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
          pointerEvents: 'auto' // Ensure it's clickable
        }}
        onClick={(e) => {
          console.log('Dropdown container clicked');
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
                  // Use setTimeout to ensure dropdown closes first
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

  console.log('Creating portal for CollapsedSubmenu');
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
        roles: [] // Empty means visible to all roles
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
        roles: [1, 2, 3] // Only visible to roles 1, 2, 3
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
        roles: [1, 2]
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
        roles: [1, 2]
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
        roles: [1]
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
        roles: []
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
        roles: [],
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
        roles: [4], // Only for role 4 with daily transaction type
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
                url: "/transactions/daily-cash-collection", 
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
              label: "Mcbu Withdrawals",
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
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: [3, 4]
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
        roles: [4], // Only for role 4 with weekly transaction type
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
                url: "/transactions/weekly-cash-collection", 
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
              label: "Mcbu Withdrawals",
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
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: [3, 4]
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
        displayLabel: "Transactions", // Alternative label for certain roles
        icon: {
            active: (props) => <ClipboardList {...props} />,
            notActive: (props) => <ClipboardList {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        roles: [2, 3],
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
                label: "Loan Officer Register",
                url: "/transactions/branch-manager/cash-collection", 
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
                label: "Branch Manager Summary",
                url: "/transactions/branch-manager/summary", 
                icon: {
                    active: (props) => <BarChart3 {...props} />,
                    notActive: (props) => <BarChart3 {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: [3]
            },
            {
              label: "Mcbu Withdrawals",
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
                label: "Transfer Client",
                url: "/transactions/transfer-client", 
                icon: {
                    active: (props) => <ArrowRightLeft {...props} />,
                    notActive: (props) => <ArrowRightLeft {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false,
                roles: [2, 3]
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
        roles: [1],
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
                roles: []
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
                roles: [1]
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
                roles: []
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
                roles: []
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
const isItemVisibleForRole = (item, userRole, userRoot, userTransactionType) => {
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

  // Check if user's role is in the allowed roles
  const hasRoleAccess = item.roles.includes(userRole);

  // For transaction type specific items
  if (item.transactionType && userRole === 4) {
    return hasRoleAccess && userTransactionType === item.transactionType;
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
        openSubmenus: {}, // Close all submenus when toggling collapse
        collapsedDropdown: null // Close any collapsed dropdown
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

// Individual menu item component
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
      <li className={`mx-2 ${index === 0 ? 'mt-2' : 'mt-3'}`} ref={menuItemRef}>
        <Tooltip content={displayLabel} show={!isCollapsedDropdownOpen}>
          <div 
            className={`flex justify-center items-center rounded-md p-3 cursor-pointer transition-all duration-200 relative
              ${isActive ? 'bg-teal-600 text-white' : 'text-white hover:bg-gray-700'}
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
          className={`flex items-center rounded-md p-3 mx-4 cursor-pointer transition-all duration-200 relative
            ${isActive ? 'bg-teal-600 text-white' : 'text-white hover:bg-gray-700'}
          `}
          onClick={handleClick}
        >
          <IconComponent className="w-5 h-5 flex-shrink-0" />
          <span className="ml-3 font-medium flex-1">{displayLabel}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''}`} />
        </div>
      ) : (
        // Regular menu items - wrapped in Link
        <Link href={item.url}>
          <div 
            className={`flex items-center rounded-md p-3 mx-4 cursor-pointer transition-all duration-200 relative
              ${isActive ? 'bg-teal-600 text-white' : 'text-white hover:bg-gray-700'}
            `}
            onClick={handleClick}
          >
            <IconComponent className="w-5 h-5 flex-shrink-0" />
            <span className="ml-3 font-medium flex-1">{displayLabel}</span>
          </div>
        </Link>
      )}
      
      {/* Submenu */}
      {item.hasSub && isSubmenuOpen && !isCollapsed && (
        <div className="ml-8 mt-2 relative z-[55]">
          {/* Left border indicator */}
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-600"></div>
          
          <ul className="space-y-1">
            {item.subMenuItems.filter(subItem => !subItem.hidden).map((subItem, idx) => (
              <li key={idx}>
                <Link href={subItem.url}>
                  <div 
                    className={`flex items-center p-2 mx-2 rounded-md cursor-pointer transition-all duration-200 relative z-[55]
                      ${activePath === subItem.url ? 'bg-teal-500 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}
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
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-400"></div>
                    )}
                    <subItem.icon.notActive className="w-4 h-4 flex-shrink-0" />
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
    if (!userState) return [];

    const userRole = userState?.role?.rep;
    const userRoot = userState?.root || false;
    const userTransactionType = userState?.transactionType;

    return MenuItems.filter(item => {
      const isVisible = isItemVisibleForRole(item, userRole, userRoot, userTransactionType);
      
      if (!isVisible) return false;

      // Filter submenu items if the item has submenus
      if (item.hasSub && item.subMenuItems) {
        const filteredSubItems = item.subMenuItems.filter(subItem => 
          isItemVisibleForRole(subItem, userRole, userRoot, userTransactionType)
        );
        
        // Return a copy with filtered submenu items
        return {
          ...item,
          subMenuItems: filteredSubItems,
          hidden: filteredSubItems.length === 0 && item.hasSub // Hide parent if no visible subitems
        };
      }

      return true;
    }).map(item => {
      // Apply any label transformations
      if (item.label === 'BM Transactions' && userRole < 3) {
        return { ...item, displayLabel: 'Transactions' };
      }
      return item;
    });
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
            parentMenu = menu; // Track the parent menu
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

  // Remove the separate useEffect that was closing all submenus

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