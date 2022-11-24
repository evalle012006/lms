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
import { setUserList } from '@/redux/actions/userActions';

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [data, setData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentLO, setCurrentLO] = useState();
    const { uuid } = router.query;
    const [currentDate, setCurrentDate] = useState(moment(currentDate).format('YYYY-MM-DD'));
    const [dateFilter, setDateFilter] = useState(new Date());
    const [filter, setFilter] = useState(false);

    const handleLOFilter = (selected) => {
        setCurrentLO(selected);
        localStorage.setItem('selectedLO', selected._id);
        router.push('/transactions/daily-cash-collection/group/' + selected._id);
    }
    
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

        const getListUser = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
            if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
            } else if (currentUser.root !== true && currentUser.role.rep === 2 && branchList.length > 0) {
                // url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
            }
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userData = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userData.push(
                        {
                            ...u,
                            name: name,
                            label: name,
                            value: u._id
                        }
                    );
                });
                dispatch(setUserList(userData));
            } else {
                toast.error('Error retrieving user list.');
            }

        }

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
        mounted && branchList && getListUser();

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
                {currentLO && <DetailsHeader page={2} mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} selectedLO={currentLO} handleLOFilter={handleLOFilter} />}
                <div className='p-4 mt-[8rem]'>
                    <ViewDailyCashCollectionPage pageNo={2}/>
                </div>
            </div>
        </Layout>
    );
}

export default CashCollectionDetailsPage;