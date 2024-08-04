import { useEffect, useState } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setCurrentDate, setCurrentTime, setHoliday, setLastDayOfTheMonth, setWeekend } from '@/redux/actions/systemActions';
import NavComponent from "./Nav";
import { setTransactionSettings } from "@/redux/actions/transactionsActions";
import { setHolidayList } from "@/redux/actions/holidayActions";
import moment from 'moment';
import { getLastWeekdayOfTheMonth } from "@/lib/utils";
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid';
import useIsMobile from "@/lib/useIsMobile";

const Layout = ({ 
    children, 
    bgwhite = false, 
    header = true, 
    noPad = false, 
    actionButtons = [], 
    vScroll = false,  // New prop for vertical scroll
    hScroll = true  // Changed default to false for horizontal scroll
  }) => {
    const state = useSelector(state => state.global);
    const pageTitle = state.title;
    const dispatch = useDispatch();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const holidayList = useSelector(state => state.holidays.list);
    const isMobile = useIsMobile();
    const [isNavVisible, setIsNavVisible] = useState(!isMobile);

    const getCurrentDate = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/current-date`;
        const response = await fetchWrapper.get(apiURL);
        if (response.success) {
            dispatch(setCurrentDate(response.currentDate));
            dispatch(setCurrentTime(response.currentTime));
        }
    }

    const getTransactionSettings = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/transactions`;
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
        if (currentDate) {
            const getListHoliday = async () => {
                let url = process.env.NEXT_PUBLIC_API_URL + 'settings/holidays/list';
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
    }, [holidayList]);

    const toggleNav = () => {
        setIsNavVisible(!isNavVisible);
    };

    useEffect(() => {
        setIsNavVisible(!isMobile);
    }, [isMobile]);

    return (
        <div className="flex bg-white">
            <NavComponent isVisible={isNavVisible} toggleNav={toggleNav} isMobile={isMobile} />
            <div className={`flex flex-col bg-neutral-200 duration-300 min-h-full ${isNavVisible && !isMobile ? 'lg:ml-64' : 'ml-0'} flex-1`}>
                {header && (
                    <div className="bg-white p-6 gap-6 h-20">
                        <div className="flex flex-row justify-between items-center">
                            <div className="flex items-center">
                                {/* {isMobile && (
                                    <button onClick={toggleNav} className="mr-4">
                                        {isNavVisible ? (
                                            <XMarkIcon className="h-6 w-6" />
                                        ) : (
                                            <Bars3Icon className="h-6 w-6" />
                                        )}
                                    </button>
                                )} */}
                                <div className="page-title">
                                    {pageTitle}
                                </div>
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
                    flex-grow 
                    ${vScroll ? 'overflow-y-auto' : 'overflow-y-hidden'}
                    ${hScroll ? 'overflow-x-auto' : 'overflow-x-hidden'}
                    `}>
                        {children}
                </div>
            </div>
        </div>
    );
}

export default Layout;