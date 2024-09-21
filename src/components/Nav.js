import React, { useReducer, useMemo, useCallback, useEffect, useState } from 'react';
import logo from "/public/images/logo.png";
import { 
    Squares2X2Icon, 
    BuildingStorefrontIcon,
    BuildingOfficeIcon,
    BuildingOffice2Icon,
    ChartBarSquareIcon,
    ChartBarIcon,
    ClipboardDocumentListIcon,
    ClipboardDocumentCheckIcon,
    UserIcon,
    UserMinusIcon,
    UsersIcon,
    UserGroupIcon,
    TicketIcon,
    Cog6ToothIcon,
    DocumentChartBarIcon,
    BuildingLibraryIcon,
    ChevronDownIcon,
    CpuChipIcon,
    ArrowRightOnRectangleIcon,
    ArrowsRightLeftIcon,
    CloudArrowUpIcon,
    Bars3Icon,
    XMarkIcon
} from '@heroicons/react/24/solid';
import { ExclamationTriangleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentPage,
    setCurrentPageTitle,
    setCurrentSubMenu
} from "@/redux/actions/globalActions";
import Avatar from "@/lib/avatar";
import { userService } from "@/services/user-service";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { setLosList } from "@/redux/actions/losActions";
import { setCashCollectionList } from "@/redux/actions/cashCollectionActions";
import { setUser, setUserList } from "@/redux/actions/userActions";
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import { setGroup, setGroupList } from "@/redux/actions/groupActions";
import { setClient, setClientList } from "@/redux/actions/clientActions";
import { setLoan, setLoanList } from "@/redux/actions/loanActions";

const MenuItems = [
    {
        label: "Dashboard",
        url: "/",
        icon: {
          active: (props) => <Squares2X2Icon {...props} />,
          notActive: (props) => <Squares2X2Icon {...props} />,
        },
        active: true,
        hasSub: false,
        hidden: false
      },
      {
        label: "Branches",
        url: "/branches",
        icon: {
          active: (props) => <BuildingStorefrontIcon {...props} />,
          notActive: (props) => <BuildingStorefrontIcon {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false
      },
    {
        label: "Areas",
        url: "/areas",
        icon: {
            active: (props) => <BuildingOfficeIcon {...props} />,
            notActive: (props) => <BuildingOfficeIcon {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Regions",
        url: "/regions",
        icon: {
            active: (props) => <BuildingOffice2Icon {...props} />,
            notActive: (props) => <BuildingOffice2Icon {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Divisions",
        url: "/divisions",
        icon: {
            active: (props) => <BuildingLibraryIcon {...props} />,
            notActive: (props) => <BuildingLibraryIcon {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Groups",
        url: "/groups",
        icon: {
            active: (props) => <UserGroupIcon {...props} />,
            notActive: (props) => <UserGroupIcon {...props} />,
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Clients",
        url: "#clients",
        icon: {
            active: (props) => <UserIcon {...props} />,
            notActive: (props) => <UserIcon {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Prospect Clients",
                url: "/clients?status=pending",
                icon: {
                    active: (props) => <UserIcon {...props} />,
                    notActive: (props) => <UserIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Active Clients",
                url: "/clients?status=active",
                icon: {
                    active: (props) => <UserIcon {...props} />,
                    notActive: (props) => <UserIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Offset Accounts",
                url: "/clients?status=offset",
                icon: {
                    active: (props) => <UserIcon {...props} />,
                    notActive: (props) => <UserIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            }
        ]
    },
    {
        label: "Daily Transactions",
        url: "#transactions",
        subMenuIndex: 0,
        icon: {
            active: (props) => <ClipboardDocumentListIcon {...props} />,
            notActive: (props) => <ClipboardDocumentListIcon {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardDocumentCheckIcon {...props} />,
                    notActive: (props) => <ClipboardDocumentCheckIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register (Daily)",
                url: "/transactions/daily-cash-collection", 
                icon: {
                    active: (props) => <TicketIcon {...props} />,
                    notActive: (props) => <TicketIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary", 
                icon: {
                    active: (props) => <ChartBarSquareIcon {...props} />,
                    notActive: (props) => <ChartBarSquareIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinusIcon {...props} />,
                    notActive: (props) => <UserMinusIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            // {
            //     label: "Daily Collection Sheet",
            //     url: "/transactions/daily-collection-sheet", 
            //     icon: {
            //         active: (
            //             <ClipboardDocumentIcon className="text-gray-800 w-5 h-5" />
            //         ),
            //         notActive: (
            //             <ClipboardDocumentIcon className="text-white w-5 h-5" />
            //         ),
            //     },
            //     active: false,
            //     hasSub: false,
            //     hidden: false
            // }
        ]
    },
    {
        label: "Weekly Transactions",
        url: "#weekly-transactions",
        subMenuIndex: 0,
        icon: {
            active: (props) => <ClipboardDocumentListIcon {...props} />,
            notActive: (props) => <ClipboardDocumentListIcon {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardDocumentCheckIcon {...props} />,
                    notActive: (props) => <ClipboardDocumentCheckIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register (Weekly)",
                url: "/transactions/weekly-cash-collection", 
                icon: {
                    active: (props) => <TicketIcon {...props} />,
                    notActive: (props) => <TicketIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary", 
                icon: {
                    active: (props) => <ChartBarSquareIcon {...props} />,
                    notActive: (props) => <ChartBarSquareIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinusIcon {...props} />,
                    notActive: (props) => <UserMinusIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            // {
            //     label: "Daily Collection Sheet",
            //     url: "/transactions/daily-collection-sheet", 
            //     icon: {
            //         active: (
            //             <ClipboardDocumentIcon className="text-gray-800 w-5 h-5" />
            //         ),
            //         notActive: (
            //             <ClipboardDocumentIcon className="text-white w-5 h-5" />
            //         ),
            //     },
            //     active: false,
            //     hasSub: false,
            //     hidden: false
            // }
        ]
    },
    {
        label: "BM Transactions",
        url: "#branch-manager-transactions",
        subMenuIndex: 0,
        icon: {
            active: (props) => <ClipboardDocumentListIcon {...props} />,
            notActive: (props) => <ClipboardDocumentListIcon {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications",
                icon: {
                    active: (props) => <ClipboardDocumentCheckIcon {...props} />,
                    notActive: (props) => <ClipboardDocumentCheckIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register",
                url: "/transactions/branch-manager/cash-collection", 
                icon: {
                    active: (props) => <TicketIcon {...props} />,
                    notActive: (props) => <TicketIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Branch Manager Summary",
                url: "/transactions/branch-manager/summary", 
                icon: {
                    active: (props) => <ChartBarSquareIcon {...props} />,
                    notActive: (props) => <ChartBarSquareIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            // {
            //     label: "Daily Collection Sheet",
            //     url: "/transactions/daily-collection-sheet", 
            //     icon: {
            //         active: (
            //             <ClipboardDocumentIcon className="text-gray-800 w-5 h-5" />
            //         ),
            //         notActive: (
            //             <ClipboardDocumentIcon className="text-white w-5 h-5" />
            //         ),
            //     },
            //     active: false,
            //     hasSub: false,
            //     hidden: false
            // },
            {
                label: "Transfer Client",
                url: "/transactions/transfer-client", 
                icon: {
                    active: (props) => <ArrowsRightLeftIcon {...props} />,
                    notActive: (props) => <ArrowsRightLeftIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Bad Debts",
                url: "/other-transactions/baddebt-collection",
                icon: {
                    active: (props) => <UserMinusIcon {...props} />,
                    notActive: (props) => <UserMinusIcon {...props} />,
                },
                active: false,
                hasSub: false,
                hidden: false
            }
        ]
    },
    {
        label: "Reports",
        url: "#reports",
        subMenuIndex: 1,
        icon: {
            active: (props) => <ChartBarIcon {...props} />,
            notActive: (props) => <ChartBarIcon {...props} />,
        },
        active: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Transaction by Remarks",
                url: "/reports/transaction-remarks",
                icon: {
                    active: (props) => <DocumentChartBarIcon {...props} />,
                    notActive: (props) => <DocumentChartBarIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
            {
                label: "Query Low Loan Balance",
                url: "/reports/low-loan-balance",
                icon: {
                    active: (props) => <DocumentChartBarIcon {...props} />,
                    notActive: (props) => <DocumentChartBarIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
            {
                label: "Query Mispayments",
                url: "/reports/mispay-list",
                icon: {
                    active: (props) => <DocumentChartBarIcon {...props} />,
                    notActive: (props) => <DocumentChartBarIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
        ]
    },
    {
        label: "Settings",
        url: "#settings",
        subMenuIndex: 1,
        icon: {
            active: (props) => <Cog6ToothIcon {...props} />,
            notActive: (props) => <Cog6ToothIcon {...props} />,
        },
        active: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Users",
                url: "/settings/users",
                icon: {
                    active: (props) => <UsersIcon {...props} />,
                    notActive: (props) => <UsersIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
            // {
            //     label: "Roles",
            //     url: "/settings/roles",
            //     icon: {
            //         active: (
            //             <UserCircleIcon className="text-gray-800 w-5 h-5" />
            //         ),
            //         notActive: (
            //             <UserCircleIcon className="text-white w-5 h-5" />
            //         ),
            //     },
            //     active: false,
            //     hasSub: false
            // },
            {
                label: "System",
                url: "/settings/system",
                icon: {
                    active: (props) => <CpuChipIcon {...props} />,
                    notActive: (props) => <CpuChipIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
            {
                label: "Migration",
                url: "/settings/migration",
                icon: {
                    active: (props) => <CloudArrowUpIcon {...props} />,
                    notActive: (props) => <CloudArrowUpIcon {...props} />,
                },
                active: false,
                hasSub: false
            },
            {
                label: "Reset",
                url: "/settings/reset",
                icon: {
                    active: (props) => <ExclamationTriangleIcon {...props} />,
                    notActive: (props) => <ExclamationTriangleIcon {...props} />,
                },
                active: false,
                hasSub: false
            }
        ]
    },
    {
        label: "Logout",
        url: "/logout",
        icon: {
            active: (props) => <ArrowRightOnRectangleIcon {...props} />,
            notActive: (props) => <ArrowRightOnRectangleIcon {...props} />,
        },
        active: false,
        borderBottom: true,
        hasSub: false
    }
];

const initialState = {
  activePath: null,
  menuItems: MenuItems,
  isOpen: false,
  subMenus: {},
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_PATH':
      return { ...state, activePath: action.payload };
    case 'UPDATE_MENU_ITEMS':
      return { ...state, menuItems: action.payload };
    case 'TOGGLE_MENU':
      return { ...state, isOpen: !state.isOpen };
    case 'TOGGLE_SUBMENU':
      return { 
        ...state, 
        subMenus: { 
          ...state.subMenus, 
          [action.payload]: !state.subMenus[action.payload] 
        } 
      };
    default:
      return state;
  }
}

const SubNav = React.memo(({ item, index, activePath, inner = false, className = '' }) => {
  const dispatch = useDispatch();
  const [state, localDispatch] = useReducer(reducer, initialState);
  const isSubMenuOpen = state.subMenus[item.label] || false;

  const handleLogout = async () => {
    let user = userService.userValue;
    if (user && user.hasOwnProperty('user')) {
      user = user.user;
    }
    const url = `${process.env.NEXT_PUBLIC_API_URL}authenticate?`;
    const params = { user: user._id };
    const response = await fetchWrapper.get(url + new URLSearchParams(params));
    await response && response.success && response.query.acknowledged && userService.logout();
    resetReduxState();
  }

  const resetReduxState = () => {
    dispatch(setLosList([]));
    dispatch(setCashCollectionList([]));
    dispatch(setUserList([]));
    dispatch(setBranch({}));
    dispatch(setBranchList([]));
    dispatch(setGroup({}));
    dispatch(setGroupList([]));
    dispatch(setClient(null));
    dispatch(setClientList([]));
    dispatch(setLoan(null));
    dispatch(setLoanList([]));
  }

  const toggleSubMenu = () => {
    localDispatch({ type: 'TOGGLE_SUBMENU', payload: item.label });
  }

  const IconComponent = activePath === item.url ? item.icon?.active : item.icon?.notActive;

  if (item.url !== "/logout") {
    return (
      <li className={`${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"} ${activePath === item.url ? "text-gray-800 bg-teal-10" : "text-white"} ${className}`}>
        <Link href={item.url}>
          <div 
            className="flex flex-row rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4 mr-4 whitespace-nowrap transition duration-300 ease-in-out"
            onClick={item.hasSub ? toggleSubMenu : undefined}
          >
            <IconComponent className={`w-5 h-5 ${activePath === item.url ? 'text-gray-800' : 'text-white'}`} />
            <span className="origin-left duration-200">
              {item.label}
            </span>
            {item.hasSub && (
              <ChevronDownIcon className={`ml-auto ${activePath === item.url ? 'text-gray-800 w-5 h-5' : 'text-white w-5 h-5'} ${isSubMenuOpen && 'rotate-180'}`} />
            )}
          </div>
        </Link>
        {item.hasSub && isSubMenuOpen && (
          <ul className="relative">
            {item.subMenuItems.map((menu, idx) => (
              !menu.hidden && (
                <SubNav key={idx} item={menu} index={idx} activePath={activePath} className="ml-6" inner={true} />
              )
            ))}
          </ul>
        )}
      </li>
    )
  } else {
    return (
      <li 
        className={`flex rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4
                    ${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"}
                    ${activePath === item.url ? "text-gray-800 bg-teal-10" : "text-white"} ${className}`}
        onClick={handleLogout}
      >
        <IconComponent className="w-5 h-5 text-white" />
        <span className="origin-left duration-200">
          {item.label}
        </span>
      </li>
    )
  }
});

const NavComponent = ({ isVisible, toggleNav, isMobile }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [state, localDispatch] = useReducer(reducer, initialState);
    const { activePath, menuItems } = state;
    const userState = useSelector(state => state.user.data);
    const rootUser = userState.root || false;

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

  const filteredMenuItems = useMemo(() => {
    return menuItems.map((menu) => {
      let temp = {...menu};
      if (userState.role.rep < 3) {
        if (menu.label === 'BM Transactions') {
          temp.label = "Transactions";
        }
      }

      if (rootUser || userState.role.rep === 1) {
        if (menu.label === 'Daily Transactions' || menu.label === 'Weekly Transactions') {
          temp.hidden = true;
        }
      } else if (userState.role.rep === 2 || userState.role.rep === 3) {
        if (['Divisions', 'Regions', 'Areas', 'Settings'].includes(menu.label)) {
          temp.hidden = true;
        }
        if (menu.label === 'Daily Transactions' || menu.label === 'Weekly Transactions') {
          temp.hidden = true;
        }
      } else if (userState.role.rep === 4) {
        if (['Divisions', 'Regions', 'Areas', 'Branches', 'Transfer', 'Settings', 'BM Transactions'].includes(menu.label)) {
          temp.hidden = true;
        }
        if (userState.hasOwnProperty('transactionType')) {
          if (userState.transactionType === 'daily') {
            if (menu.label === 'Weekly Transactions') {
              temp.hidden = true;
            }
          } else {
            if (menu.label === 'Daily Transactions') {
              temp.hidden = true;
            }
          }
        }
      }

      if (temp.hasSub) {
        temp.subMenuItems = temp.subMenuItems.map(sItem => {
          let sm = {...sItem};
          if (rootUser || userState.role.rep <= 2) {
            if (['Loan Officer Summary', 'Branch Manager Summary', 'Daily Collection Sheet'].includes(sm.label)) {
              sm.hidden = true;
            }
          } else if (userState.role.rep === 3) {
            if (['System', 'Roles', 'Loan Officer Summary'].includes(sm.label)) {
              sm.hidden = true;
            }
          } else if (userState.role.rep === 4) {
            if (sm.label === 'Transfer Client') {
              sm.hidden = true;
            }
          }
          return sm;
        });
      }

      return temp;
    });
  }, [userState, rootUser, menuItems]);

  useEffect(() => {
    localDispatch({ type: 'SET_ACTIVE_PATH', payload: getActivePath() });

    let subMenu = false;
    let parentMenu = '';
    let page = MenuItems.find((i) => i.url === activePath);
    if (!page) {
      MenuItems.forEach(menu => {
        let currentPage = menu.subMenuItems && menu.subMenuItems.find(m => m.url === activePath);
        if (!currentPage) {
          menu.subMenuItems && menu.subMenuItems.forEach(item => {
            currentPage = item.subMenuItems && item.subMenuItems.find(i => i.url === activePath);
            if (currentPage) {
              subMenu = true;
              parentMenu = item.subMenuIndex;
              page = currentPage;
            }
          });
        } else {
          subMenu = true;
          parentMenu = menu.subMenuIndex;
          page = currentPage;
        }
      });
    }

    if (page) {
      dispatch(setCurrentPage(page.url));
      dispatch(setCurrentPageTitle(page.label));
      subMenu && dispatch(setCurrentSubMenu(parentMenu));
    }
  }, [activePath, dispatch, getActivePath]);

  return (
    <React.Fragment>
        {isMobile && (
            <span
                className={`fixed top-4 right-4 z-50 bg-main p-2 rounded-md cursor-pointer transition duration-300 ease-in-out`}
                onClick={toggleNav}
                aria-label="Toggle menu"
            >
                {isVisible ? (
                    <XMarkIcon className="w-6 h-6 text-white" />
                ) : (
                    <Bars3Icon className="w-6 h-6 text-white" />
                )}
            </span>
        )}
        <div className={`bg-main fixed top-0 left-0 h-full w-full lg:w-64 overflow-y-auto transition-transform duration-300 ease-in-out transform z-40 
          ${isVisible || !isMobile ? 'translate-x-0' : '-translate-x-full'}`}>
            <header className="flex justify-center items-center border-b border-orange-darkest py-4">
            <div id="logo">
                <Link href="/" className="no-underline text-white md:text-2xl sm:text-4xl font-bold">
                <img src={logo.src} className="cursor-pointer duration-500" alt="Logo" />
                </Link>
            </div>
            </header>
            <div className="group relative">
                <span className="hidden group-hover:block absolute right-2 pt-1 cursor-pointer" onClick={() => router.push(`/settings/users/${userState._id}`)}>
                    <PencilSquareIcon className="text-white w-6 h-6" />
                </span>
                <div id="profile" className="flex items-center border-b border-orange-darkest px-2 py-4">
                    <div id="img" className="w-1/4 mr-6">
                        <Avatar name={userState.firstName + " " + userState.lastName} src={userState.profile ? userState.profile : ""} className={`${userState.profile ? 'p-8' : 'p-6'} `} />
                    </div>
                    <div id="welcome" className="text-white w-2/4 sm:ml-1 md:ml-6">
                        <p className="text-xs">Welcome,</p>
                        <span className="text-lg">{userState.firstName + " " + userState.lastName}</span>
                    </div>
                </div>
            </div>
            <nav className="flex-grow">
                <ul className="flex flex-col list-reset">
                    {filteredMenuItems.map((item, index) => (
                        !item.hidden && (
                            <SubNav key={index} item={item} index={index} activePath={activePath} />
                        )
                    ))}
                </ul>
            </nav>
        </div>
    </React.Fragment>
  );
};

export default React.memo(NavComponent);