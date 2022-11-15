import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from 'react-hot-toast';
import React from 'react';
import moment from 'moment';
import DetailsHeader from '@/components/transactions/DetailsHeaderMain';
import ViewDailyCashCollectionPage from '@/components/transactions/ViewDailyCashCollection';

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const [data, setData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentLO, setCurrentLO] = useState();
    const { uuid } = router.query;
    const [currentDate, setCurrentDate] = useState(moment(currentDate).format('YYYY-MM-DD'));
    const [dateFilter, setDateFilter] = useState(new Date());
    const [filter, setFilter] = useState(false);
    
    // const handleDateFilter = (selected) => {
    //     const filteredDate = selected.target.value;
    //     setDateFilter(filteredDate);
    //     if (filteredDate === currentDate) {
    //         setFilter(false);
    //     } else {
    //         setLoading(true);
    //         setFilter(true);
    //         setCurrentDate(filteredDate);

    //         getCashCollections(filteredDate);
    //     }
    // }

    const handleRowClick = (selected) => {
        // console.log(selected);
        if (selected.status === 'open') {
            console.log('open')
        }
    }


    useEffect(() => {
        let mounted = true;

        const getCurrentLO = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}users?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                setCurrentLO(response.user);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentLO();

        return () => {
            mounted = false;
        };
    }, [uuid]);

    // useEffect(() => {
    //     if (filteredData.length > 0) {
    //         setAllData(data);
    //         setData(filteredData);
    //     } else {
    //         setData(allData);
    //     }
    // }, [filteredData]);

    return (
        <Layout header={false} noPad={true}>
            <div className="overflow-x-auto">
                {currentLO && <DetailsHeader page={2} mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} selectedLO={currentLO} />}
                <div className='p-4 mt-[8rem]'>
                    <ViewDailyCashCollectionPage pageNo={2}/>
                </div>
            </div>
        </Layout>
    );
}

export default CashCollectionDetailsPage;