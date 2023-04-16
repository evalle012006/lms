import { useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setCurrentDate, setHoliday, setWeekend } from '@/redux/actions/systemActions';
import NavComponent from "./Nav";
import { setTransactionSettings } from "@/redux/actions/transactionsActions";
import { setHolidayList } from "@/redux/actions/holidayActions";
import moment from 'moment';

const Layout = ({ children, bgwhite = false, header = true, noPad = false, actionButtons = [], hScroll = true }) => {
    const state = useSelector(state => state.global);
    const pageTitle = state.title;
    const dispatch = useDispatch();
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const getCurrentDate = async () => {
        const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/current-date`;
        const response = await fetchWrapper.get(apiURL);
        if (response.success) {
            dispatch(setCurrentDate(response.currentDate));
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

            getListHoliday();
        }
    }, [currentDate]);

    return (
        <div className="flex bg-white">
            <NavComponent />
            <div className={`ml-[16rem] flex flex-col bg-neutral-200 duration-300 w-screen h-screen ${hScroll ? 'overflow-x-auto' : 'overflow-hidden'}`}>
                {header && (
                    <div className="bg-white p-6 gap-6 h-20">
                        <div className="flex flex-row justify-between">
                            <div className="page-title">
                                {pageTitle}
                            </div>
                            <div className="flex flex-row">
                                {actionButtons && actionButtons.map((btn, idx) => {
                                    return (
                                        <div key={idx} className="mr-2">
                                            {btn}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                <div className={`${bgwhite && 'bg-white'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Layout;