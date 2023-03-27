import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from "@/components/Layout";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setHoliday, setSystemSettings, setWeekend } from '@/redux/actions/systemActions';
import { setTransactionSettings } from '@/redux/actions/transactionsActions';
import { setHolidayList } from '@/redux/actions/holidayActions';
import moment from 'moment';
import { useState } from 'react';

const Index = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    useEffect(() => {
        let mounted = true;

        const getSystemSettings = async () => {
            const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setSystemSettings(response.system));
            }
        }

        const getTransactionSettings = async () => {
            const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/transactions`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setTransactionSettings(response.transactions));
            }
        }

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

                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }

        const dayName = moment(currentDate).format('dddd');

        if (dayName === 'Saturday' || dayName === 'Sunday') {
            dispatch(setWeekend(true));
        } else {
            dispatch(setWeekend(false));
        }

        // const updateCCData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/cash-collections/update-cc-data`);
        // }

        // const updateLoanData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/loans/update-loan-data`);
        // }

        // const updateGroupClients = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}groups/update-group-clients`);
        // }

        // const updateLOSData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/cash-collection-summary/update-los-data`);
        // }

        mounted && getSystemSettings();
        mounted && getTransactionSettings();
        mounted && getListHoliday();
        // mounted && updateGroupClients();
        // mounted && updateLoanData();
        // mounted && updateCCData();
        // mounted && updateLOSData();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <Layout>
            <div className="flex space-x-4 m-4">
                
            </div>
        </Layout>
    );
}

export default Index;