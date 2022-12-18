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
import { BehaviorSubject } from 'rxjs';
import { setBranchList } from '@/redux/actions/branchActions';

const CashCollectionDetailsPage = () => {
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentLO, setCurrentLO] = useState();
    const { uuid } = router.query;
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : new Date());

    const handleLOFilter = (selected) => {
        setCurrentLO(selected);
        localStorage.setItem('selectedLO', selected._id);
        router.push('/transactions/daily-cash-collection/group/' + selected._id);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
    }

    // const handleRowClick = (selected) => {
    //     // console.log(selected);
    //     if (selected.status === 'open') {
    //         console.log('open')
    //     }
    // }

    const getListBranch = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch
                    }
                );
            });

            if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                branches = [branches.find(b => b.code === currentUser.designatedBranch)];
            } else if (selectedBranchSubject.value) {
                branches = [branches.find(b => b._id === selectedBranchSubject.value)];
            }
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
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

        mounted && uuid && getCurrentLO() && getListBranch();

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        const getListUser = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
            if (branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let userList = [];
                    response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                        const name = `${u.firstName} ${u.lastName}`;
                        userList.push(
                            {
                                ...u,
                                name: name,
                                label: name,
                                value: u._id
                            }
                        );
                    });
                    dispatch(setUserList(userList));
                } else {
                    toast.error('Error retrieving user list.');
                }
            }
        }

        if (branchList) {
            getListUser();
        }
    }, [branchList]);

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
                {currentLO && <DetailsHeader page={2} pageName="lo-view" mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                    selectedLO={currentLO} handleLOFilter={handleLOFilter} 
                    dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                />}
                <div className='p-4 mt-[8rem]'>
                    <ViewDailyCashCollectionPage pageNo={2} dateFilter={dateFilter} />
                </div>
            </div>
        </Layout>
    );
}

export default CashCollectionDetailsPage;