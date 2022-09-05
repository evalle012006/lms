import React, { useEffect, useState } from "react";
import logo from "/public/images/logo.png";
import { 
    Squares2X2Icon, 
    BuildingOffice2Icon, 
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
    UserCircleIcon
} from '@heroicons/react/24/solid';
import Link from "next/link";
import { useRouter } from "node_modules/next/router";
import { useDispatch, useSelector } from "react-redux";
import {
    setCurrentPage,
    setCurrentPageTitle,
    setCurrentSubMenu
} from "@/redux/actions/globalActions";
import Avatar from "@/lib/avatar";

const SubNav = ({ item, index, activePath, inner=false, className }) => {
    const subMenu = useSelector(state => state.global.subMenu);
    const [subMenuOpen, setSubMenuOpen] = useState(item.label === subMenu ? true : false);

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
                            <ul className="relative accordion-collapse collapse">
                                {item.subMenuItems.map((menu, idx) => {
                                    return (
                                        <SubNav key={idx} item={menu} index={idx} activePath={activePath} className="ml-6" inner={true} />
                                    )
                                })}
                            </ul>
                        )}
                    </li>
                </React.Fragment>
            ) : (
                <li className={`flex rounded-md p-2 cursor-pointer hover:opacity-70 text-sm items-center gap-x-4
                            ${!inner ? index === 0 ? "mt-2" : "mt-5" : "mt-2"}
                            ${activePath === item.url ? "text-gray-800 bg-teal-10" : "text-white"} ${className}`}>
                    {activePath === item.url ? item.icon.active : item.icon.notActive}
                    <span className={`origin-left duration-200`}>
                        {item.label}
                    </span>
                </li>
            )}
        </Link>
    )
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
        hasSub: false
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
        hasSub: false
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
        hasSub: false
    },
    {
        label: "Clients",
        url: "/clients",
        icon: {
            active: <UserIcon className="text-gray-800 w-6 h-6" />,
            notActive: <UserIcon className="text-white w-6 h-6" />,
        },
        active: false,
        borderBottom: true,
        hasSub: false
    },
    {
        label: "Transactions",
        url: "#",
        icon: {
            active: <ClipboardDocumentListIcon className="text-gray-800 w-6 h-6" />,
            notActive: <ClipboardDocumentListIcon className="text-white w-6 h-6" />,
        },
        active: false,
        borderBottom: true,
        hasSub: true,
        id: 'transactions',
        subMenuItems: [
            {
                label: "View Loans",
                url: "/loans",
                icon: {
                    active: (
                        <TicketIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <TicketIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false
            },
            {
                label: "View Applications",
                url: "/loan-applications",
                icon: {
                    active: (
                        <ClipboardDocumentCheckIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <ClipboardDocumentCheckIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false
            }
        ]
    },
    {
        label: "Settings",
        url: "#",
        icon: {
            active: <Cog6ToothIcon className="text-gray-800 w-5 h-5" />,
            notActive: <Cog6ToothIcon className="text-white w-5 h-5" />,
        },
        active: true,
        hasSub: true,
        subMenuItems: [
            {
                label: "Users",
                url: "/users",
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
            {
                label: "Roles",
                url: "/roles",
                icon: {
                    active: (
                        <UserCircleIcon className="text-gray-800 w-5 h-5" />
                    ),
                    notActive: (
                        <UserCircleIcon className="text-white w-5 h-5" />
                    ),
                },
                active: false,
                hasSub: false
            },
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
            }
        ]
    }
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
        let page = MenuItems.find((i) => i.url === activePath);
        if (!page) {
            MenuItems.forEach(menu => {
                let currentPage = menu.subMenuItems && menu.subMenuItems.find(m => m.url === activePath);
                
                if (!currentPage) {
                    menu.subMenuItems && menu.subMenuItems.forEach(item => {
                        currentPage = item.subMenuItems && item.subMenuItems.find(i => i.url === activePath);
                        
                        if (currentPage) {
                            subMenu = true;
                            page = currentPage;
                        }
                    });
                } else {
                    subMenu = true;
                    page = currentPage;
                }
            });
        }

        if (page) {
            dispatch(setCurrentPage(page.url));
            dispatch(setCurrentPageTitle(page.label));
            subMenu && dispatch(setCurrentSubMenu(page.label));
        }

        return () => {
            mounted = false;
        };
    }, [activePath]);

    useEffect(() => {
        let updatedMenu = [];
        menuItems.map((menu) => {
            let temp = {...menu};
            if (rootUser || userState.role.rep === 1) {
                // nothing to do here...
            } else {
                // if (menu.label === 'Team') {
                //     temp.hidden = true;
                // }
            }

            updatedMenu.push(temp);
        });

        setMenuItems(updatedMenu);
    }, [userState]);

    return (
        <div className='bg-main h-screen fixed duration-300 top-0 flex flex-col justify-between w-72 overflow-y-auto sm:w-screen'>
            <div className="items-center">
                <header className="flex justify-center items-center border-b border-orange-darkest py-4">
                    <div id="logo">
                        <a href="/" className="no-underline text-white md:text-2xl sm:text-4xl font-bold">
                            <img src={logo.src} className={`cursor-pointer duration-500`} />
                        </a>
                    </div>
                </header>
                <div id="profile" className="flex items-center border-b border-orange-darkest px-4 py-6">
                    <div id="img" className="w-1/4 mr-4">
                        <Avatar name={userState.firstName + " " + userState.lastName} src={userState.profile ? '/images/profiles/' + userState.profile : ""} className={`${userState.profile ? 'pt-8 pb-4 pl-8 pr-4' : 'py-1.5 px-2'} `} />
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