import { useEffect, useState } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setCurrentDate, setCurrentTime, setHoliday, setLast5DaysOfTheMonth, setLastDayOfTheMonth, setWeekend } from '@/redux/actions/systemActions';
import NavComponent from "./Nav";
import { setTransactionSettings } from "@/redux/actions/transactionsActions";
import { setHolidayList } from "@/redux/actions/holidayActions";
import moment from 'moment';
import { getLastFiveWeekdaysOfMonth, getLastWeekdayOfTheMonth } from "@/lib/date-utils";
import { getApiBaseUrl } from '@/lib/constants';
import useIsMobile from "@/lib/useIsMobile";
import HeaderComponent from "@/lib/header-component";

const Layout = ({ 
    children, 
    bgwhite = false, 
    header = true, 
    noPad = false, 
    actionButtons = [], 
    vScroll = true,
    hScroll = true,
    noVScrollBody = false,
    noHScrollBody = false
  }) => {
    const state = useSelector(state => state.global);
    const pageTitle = state.title;
    const dispatch = useDispatch();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const holidayList = useSelector(state => state.holidays.list);
    const isMobile = useIsMobile();
    const [isNavVisible, setIsNavVisible] = useState(!isMobile);
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);

    // Listen for collapse events from NavComponent
    useEffect(() => {
        const handleNavCollapse = (event) => {
            setIsNavCollapsed(event.detail.isCollapsed);
        };

        window.addEventListener('navCollapseChange', handleNavCollapse);
        return () => {
            window.removeEventListener('navCollapseChange', handleNavCollapse);
        };
    }, []);

    const getCurrentDate = async () => {
        const apiURL = `${getApiBaseUrl()}settings/current-date`;
        const response = await fetchWrapper.get(apiURL);
        if (response.success) {
            dispatch(setCurrentDate(response.currentDate));
            dispatch(setCurrentTime(response.currentTime));
        }
    }

    const getTransactionSettings = async () => {
        const apiURL = `${getApiBaseUrl()}settings/transactions`;
        const response = await fetchWrapper.get(apiURL);
        if (response.success) {
            dispatch(setTransactionSettings(response.transactions));
        }
    }

    useEffect(() => {
        getCurrentDate();
        getTransactionSettings();
    }, []);

    useEffect(() => {
        if (noVScrollBody) {
            document.body.classList.add('overflow-y-hidden');
        } else {
            document.body.classList.remove('overflow-y-auto');
        }

        if (noHScrollBody) {
            document.body.classList.add('overflow-x-hidden');
        } else {
            document.body.classList.remove('overflow-x-auto');
        }
    }, [noVScrollBody, noHScrollBody]);

    useEffect(() => {
        if (currentDate) {
            const getListHoliday = async () => {
                let url = getApiBaseUrl() + 'settings/holidays/list';
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    const holidays = response.holidays.map(h => {
                        let temp = {...h};

                        const tempDate = moment(currentDate).year() + '-' + temp.date;
                        temp.dateStr = moment(tempDate).format('MMMM DD');
        
                        return temp;
                    });
                    dispatch(setHolidayList(holidays));
        
                    let holidayToday = false;
                    const currentYear = moment(currentDate).year();
                    holidays.map(item => {
                        const holidayDate = currentYear + '-' + item.date;
        
                        if (holidayDate === currentDate) {
                            holidayToday = true;
                        }
                    });
        
                    dispatch(setHoliday(holidayToday));
                } else if (response.error) {
                    toast.error(response.message);
                }
            }
        
            const dayName = moment(currentDate).format('dddd');
        
            if (dayName === 'Saturday' || dayName === 'Sunday') {
                dispatch(setWeekend(true));
            } else {
                dispatch(setWeekend(false));
            }
            // will need to find a way for this to check if there is an update
            if (holidayList?.length === 0) {
                getListHoliday();
            }
        }
    }, [currentDate]);

    useEffect(() => {
        const holidays = holidayList.map(h => {
            return h.date;
        });

        const lastDay = getLastWeekdayOfTheMonth(moment(currentDate).year(), moment(currentDate).month() + 1, holidays);
        dispatch(setLastDayOfTheMonth(lastDay));

        const last5Days = getLastFiveWeekdaysOfMonth(moment(currentDate).year(), moment(currentDate).month() + 1, holidays);
        dispatch(setLast5DaysOfTheMonth(last5Days));
    }, [holidayList]);

    const toggleNav = () => {
        setIsNavVisible(!isNavVisible);
    };

    useEffect(() => {
        setIsNavVisible(!isMobile);
    }, [isMobile]);

    const shouldHideChildren = isMobile && isNavVisible;

    // Calculate the margin based on nav state
    const getMainContentMargin = () => {
        if (isMobile) return 'ml-0';
        if (!isNavVisible) return 'ml-0';
        if (isNavCollapsed) return 'lg:ml-16';
        return 'ml-0 lg:ml-64';
    };

    // Calculate the nav width for the fixed positioning
    const getNavWidth = () => {
        if (!isNavVisible) return 'w-0';
        if (isNavCollapsed && !isMobile) return 'lg:w-16';
        return isMobile ? 'w-full' : 'w-full lg:w-64';
    };

    return (
        <div className={`flex bg-white w-full h-screen ${vScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
            <div className={`fixed top-0 h-full ${getNavWidth()} transition-all duration-300 z-40`}>
                <NavComponent 
                    isVisible={isNavVisible} 
                    toggleNav={toggleNav} 
                    isMobile={isMobile}
                    onCollapseChange={setIsNavCollapsed}
                />
            </div>
            
            <div className={`flex flex-col flex-1 bg-neutral-200 ${getMainContentMargin()} transition-all duration-300 overflow-y-auto ${shouldHideChildren ? 'hidden' : ''}`}>
                <HeaderComponent />
                {header && (
                    <div className="bg-white p-6 gap-6 h-20 flex-shrink-0 shadow-sm">
                        <div className="flex flex-row justify-between items-center">
                            <div className="flex items-center">
                                {/* <div className="page-title text-xl font-medium">
                                    {pageTitle}
                                </div> */}
                            </div>
                            <div className="flex flex-row">
                                {actionButtons && actionButtons.map((btn, idx) => (
                                    <div key={idx} className="mr-2">
                                        {btn}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <div className={`
                    ${bgwhite ? 'bg-white' : ''} 
                    flex-1
                    ${vScroll ? 'overflow-y-auto' : 'overflow-y-hidden'}
                    ${hScroll ? 'overflow-x-auto' : 'overflow-x-hidden'}
                    ${noPad ? '' : 'p-6'}
                    pb-8
                `}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Layout;