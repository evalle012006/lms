import React, { useEffect, useState } from "react";
import logo from "/public/images/logo.png";
import { 
    Squares2X2Icon, 
    BuildingOffice2Icon,
    ChartBarSquareIcon,
    ClipboardDocumentIcon,
    ClipboardDocumentListIcon,
    ClipboardDocumentCheckIcon,
    UserIcon,
    UsersIcon,
    UserGroupIcon,
    TicketIcon,
    Cog6ToothIcon,
    TableCellsIcon,
    PlusIcon,
    BuildingLibraryIcon,
    ChevronDownIcon,
    UserCircleIcon,
    ArrowRightOnRectangleIcon,
    ArrowsRightLeftIcon
} from '@heroicons/react/24/solid';
import { ExclamationTriangleIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import Link from "next/link";
import { useRouter } from "node_modules/next/router";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentPage,
    setCurrentPageTitle,
    setCurrentSubMenu
} from "@/redux/actions/globalActions";
import Avatar from "@/lib/avatar";
import { userService } from "@/services/user-service";
import { fetchWrapper } from "@/lib/fetch-wrapper";

const SubNav = ({ item, index, activePath, inner=false, className }) => {
    const subMenu = useSelector(state => state.global.subMenus);
    const sub = subMenu.find(s => s.menu === item.label);
    const [subMenuOpen, setSubMenuOpen] = useState(sub && sub.open);

    const handleLogout = async () => {
        let user = userService.userValue;
        if (user && user.hasOwnProperty('user')) {
            user = user.user;
        }
        const url = `${process.env.NEXT_PUBLIC_API_URL}authenticate?`;
        const params = { user: user._id };
        const response = await fetchWrapper.get(url + new URLSearchParams(params));
        await response && response.success && response.query.acknowledged && userService.logout();
    }

    if (item.url !== ("/logout")) {
        return (
            <Link href={item.url} passHref>
                {item.hasSub ? (
                    <React.Fragment>
                        <li className={`${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"} ${activePath === item.url ? "text-gray-800 bg-teal-10" : "text-white"} ${className}`}>
                            <a className="flex flex-row rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4 mr-4 whitespace-nowrap transition duration-300 ease-in-out" onClick={() => {setSubMenuOpen(!subMenuOpen)}}>
                                {activePath === item.url ? item.icon.active : item.icon.notActive}
                                <span className={`origin-left duration-200`}>
                                    {item.label}
                                </span>
                                <ChevronDownIcon className={`ml-auto ${activePath === item.url ? 'text-gray-800 w-5 h-5' : 'text-white w-5 h-5'} ${subMenuOpen && 'rotate-180'}`} />
                            </a>
                            {subMenuOpen && (
                                <ul className="relative">
                                    {item.subMenuItems.map((menu, idx) => {
                                        return !menu.hidden && (
                                            <SubNav key={idx} item={menu} index={idx} activePath={activePath} className="ml-6" inner={true} />
                                        )
                                    })}
                                </ul>
                            )}
                        </li>
                    </React.Fragment>
                ) : (
                    <li title={item.label} className={`flex rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4
                                ${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"}
                                ${activePath === item.url ? "text-gray-800 bg-teal-10 mr-4" : "text-white"} ${className}`}>
                        {activePath === item.url ? item.icon.active : item.icon.notActive}
                        <span className={`origin-left duration-200`}>
                            {item.label}
                        </span>
                    </li>
                )}
            </Link>
        )
    } else {
        return (
            <li className={`flex rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4
                        ${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"}
                        ${activePath === item.url ? "text-gray-800 bg-teal-10" : "text-white"} ${className}`}
                        onClick={handleLogout} >
                {item.icon.active}
                <span className={`origin-left duration-200`}>
                    {item.label}
                </span>
            </li>
        )
    }
}

const MenuItems = [
    {
        label: "Dashboard",
        url: "/",
        icon: {
            active: <Squares2X2Icon className="text-gray-800 w-5 h-5 lg:w-6 lg:h-6" />,
            notActive: (
                <Squares2X2Icon className={`text-white w-5 h-5 lg:w-6 lg:h-6`} />
            ),
        },
        active: true,
        hasSub: false,
        hidden: false
    },
    {
        label: "Branches",
        url: "/branches",
        icon: {
            active: (
                <BuildingOffice2Icon className="text-gray-800 w-5 h-5" />
            ),
            notActive: (
                <BuildingOffice2Icon className="text-white w-5 h-5" />
            ),
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Groups",
        url: "/groups",
        icon: {
            active: (
                <UserGroupIcon className="text-gray-800 w-5 h-5" />
            ),
            notActive: (
                <UserGroupIcon className="text-white w-5 h-5" />
            ),
        },
        active: false,
        hasSub: false,
        hidden: false
    },
    {
        label: "Clients",
        url: "#clients",
        icon: {
            active: <UserIcon className="text-gray-800 w-6 h-6" />,
            notActive: <UserIcon className="text-white w-6 h-6" />,
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
                    active: (
                        <UserIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <UserIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Active Clients",
                url: "/clients?status=active",
                icon: {
                    active: (
                        <UserIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <UserIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Offset Accounts",
                url: "/clients?status=offset",
                icon: {
                    active: (
                        <UserIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <UserIcon className="text-white w-5 h-5" />
                    ),
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
            active: <ClipboardDocumentListIcon className="text-gray-800 w-6 h-6" />,
            notActive: <ClipboardDocumentListIcon className="text-white w-6 h-6" />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications?type=daily",
                icon: {
                    active: (
                        <ClipboardDocumentCheckIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ClipboardDocumentCheckIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register (Daily)",
                url: "/transactions/daily-cash-collection", 
                icon: {
                    active: (
                        <TicketIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <TicketIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary?type=daily", 
                icon: {
                    active: (
                        <ChartBarSquareIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ChartBarSquareIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            }
        ]
    },
    {
        label: "Weekly Transactions",
        url: "#weekly-transactions",
        subMenuIndex: 0,
        icon: {
            active: <ClipboardDocumentListIcon className="text-gray-800 w-6 h-6" />,
            notActive: <ClipboardDocumentListIcon className="text-white w-6 h-6" />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications?type=weekly",
                icon: {
                    active: (
                        <ClipboardDocumentCheckIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ClipboardDocumentCheckIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register (Weekly)",
                url: "/transactions/weekly-cash-collection", 
                icon: {
                    active: (
                        <TicketIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <TicketIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Summary",
                url: "/transactions/loan-officer-summary?type=weekly", 
                icon: {
                    active: (
                        <ChartBarSquareIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ChartBarSquareIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            }
        ]
    },
    {
        label: "BM Transactions",
        url: "#branch-manager-transactions",
        subMenuIndex: 0,
        icon: {
            active: <ClipboardDocumentListIcon className="text-gray-800 w-6 h-6" />,
            notActive: <ClipboardDocumentListIcon className="text-white w-6 h-6" />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Loan Approval",
                url: "/transactions/loan-applications?type=branch",
                icon: {
                    active: (
                        <ClipboardDocumentCheckIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ClipboardDocumentCheckIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Loan Officer Register",
                url: "/transactions/branch-manager/cash-collection", 
                icon: {
                    active: (
                        <TicketIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <TicketIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Branch Manager Summary",
                url: "/transactions/branch-manager/summary", 
                icon: {
                    active: (
                        <ChartBarSquareIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ChartBarSquareIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
            {
                label: "Transfer Client",
                url: "/transactions/area-manager/transfer-client", 
                icon: {
                    active: (
                        <ArrowsRightLeftIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ArrowsRightLeftIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false,
                hidden: false
            },
        ]
    },
// -Consolidated BMS
    {
        label: "Settings",
        url: "#settings",
        subMenuIndex: 1,
        icon: {
            active: <Cog6ToothIcon className="text-gray-800 w-5 h-5" />,
            notActive: <Cog6ToothIcon className="text-white w-5 h-5" />,
        },
        active: true,
        hasSub: true,
        hidden: false,
        subMenuItems: [
            {
                label: "Users",
                url: "/settings/users",
                icon: {
                    active: (
                        <UsersIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <UsersIcon className="text-white w-5 h-5" />
                    ),
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
                    active: (
                        <BuildingLibraryIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <BuildingLibraryIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false
            },
            // {
            //     label: "Automation",
            //     url: "/settings/automation",
            //     icon: {
            //         active: (
            //             <AdjustmentsHorizontalIcon className="text-gray-800 w-5 h-5" />
            //         ),
            //         notActive: (
            //             <AdjustmentsHorizontalIcon className="text-white w-5 h-5" />
            //         ),
            //     },
            //     active: false,
            //     hasSub: false
            // },
            {
                label: "Reset",
                url: "/settings/reset",
                icon: {
                    active: (
                        <ExclamationTriangleIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ExclamationTriangleIcon className="text-white w-5 h-5" />
                    ),
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
            active: <ArrowRightOnRectangleIcon className="text-white w-6 h-6" />
        },
        active: false,
        borderBottom: true,
        hasSub: false
    },
];

const NavComponent = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [activePath, setActivePath] = useState(null);
    const [hidden, setHidden] = useState(true);
    const userState = useSelector(state => state.user.data);
    const [menuItems, setMenuItems] = useState(MenuItems);
    const [rootUser, setRootUser] = useState(userState.root ? userState.root : false);

    const getActivePath = () => {
        const path = router.asPath.replace("#", "");
        const paths = path.split("/").filter((p) => p);
        
        let currentPath = '';
        if (paths.length > 0) {
            if (paths.length === 1) {
                currentPath = "/".concat(paths[0]);
            } else if (paths.length === 2) {
                currentPath = "/".concat(paths[0]).concat("/").concat(paths[1]);
            }
        } else {
            currentPath = path;
        }

        return currentPath;
    };

    useEffect(() => {
        let mounted = true;
        mounted && setActivePath(getActivePath());

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

        return () => {
            mounted = false;
        };
    }, [activePath]);

    useEffect(() => {
        let updatedMenu = menuItems.map((menu) => {
            let temp = {...menu};
            if (userState.role.rep < 3) {
                if (menu.label === 'BM Transactions') {
                    temp.label = "Transactions";
                }
            }

            if (rootUser || userState.role.rep === 1) {
                if (menu.label === 'Daily Transactions') {
                    temp.hidden = true;
                }

                if (menu.label === 'Weekly Transactions') {
                    temp.hidden = true;
                }
            } else if (userState.role.rep === 2) {
                if (menu.label === 'Settings') {
                    temp.hidden = true;
                }
                
                if (menu.label === 'Daily Transactions') {
                    temp.hidden = true;
                }

                if (menu.label === 'Weekly Transactions') {
                    temp.hidden = true;
                }

            } else if (userState.role.rep === 3) {
                if (menu.label === 'Settings') {
                    temp.hidden = true;
                }

                if (menu.label === 'Transfer') {
                    temp.hidden = true;
                }

                if (menu.label === 'Daily Transactions') {
                    temp.hidden = true;
                }

                if (menu.label === 'Weekly Transactions') {
                    temp.hidden = true;
                }

                if (menu.label === "Transfer Client") {
                    temp.hidden = true;
                }
            }  else if (userState.role.rep === 4) {
                if (menu.label === 'Branches') {
                    temp.hidden = true;
                }

                if (menu.label === 'Transfer') {
                    temp.hidden = true;
                }

                if (menu.label === 'Settings') {
                    temp.hidden = true;
                }

                if (menu.label === 'BM Transactions') {
                    temp.hidden = true;
                }

                if (menu.label === "Transfer Client") {
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

                    if (rootUser || userState.role.rep === 1) {
                        if (sm.label === 'Loan Officer Summary') {
                            sm.hidden = true;
                        }
                        if (sm.label === 'Branch Manager Summary') {
                            sm.hidden = true;
                        }
                    } else if (userState.role.rep === 2) {
                        if (sm.label === 'Loan Officer Summary') {
                            sm.hidden = true;
                        }
                        if (sm.label === 'Branch Manager Summary') {
                            sm.hidden = true;
                        }
                    } else if (userState.role.rep === 3) {
                        if (sm.label === 'System') {
                            sm.hidden = true;
                        }
                        if (sm.label === 'Roles') {
                            sm.hidden = true;
                        }

                        if (sm.label === 'Loan Officer Summary') {
                            sm.hidden = true;
                        }
                    }  else if (userState.role.rep === 4) {
                        // to do
                    }

                    return sm;
                });
            }

            return temp;
        });

        setMenuItems(updatedMenu);
    }, [userState]);

    return (
        <div className='bg-main h-screen fixed duration-300 top-0 flex flex-col justify-between w-64 overflow-y-auto sm:w-screen'>
            <div className="items-center">
                <header className="flex justify-center items-center border-b border-orange-darkest py-4">
                    <div id="logo">
                        <a href="/" className="no-underline text-white md:text-2xl sm:text-4xl font-bold">
                            <img src={logo.src} className={`cursor-pointer duration-500`} />
                        </a>
                    </div>
                </header>
                {/** add click event to navigate to user profile **/}
                <div id="profile" className="flex items-center border-b border-orange-darkest px-4 py-4">
                    <div id="img" className="w-1/4 mr-4">
                        <Avatar name={userState.firstName + " " + userState.lastName} src={userState.profile ? '/images/profiles/' + userState.profile : ""} className={`${userState.profile ? 'py-8 px-6' : 'py-1.5 px-2'} `} />
                    </div>
                    <div id="welcome" className="text-white w-2/4 sm:ml-1 md:ml-4">
                        <p className="text-xs">Welcome,</p>
                        <span className="text-lg">{userState.firstName + " " + userState.lastName}</span>
                    </div>
                </div>
                <ul id="menu" className="flex flex-col list-reset sm:hidden md:block">
                    {menuItems.map((item, index) => {
                        return !item.hidden && (
                            <SubNav key={index} item={item} index={index} activePath={activePath} />
                        )
                    })}
                </ul>
            </div>
        </div>
    );
}

export default NavComponent;