import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from 'react-hot-toast';
import React from 'react';
import moment from 'moment';
import DetailsHeader from '@/components/transactions/DetailsHeaderMain';
import { BehaviorSubject } from 'rxjs';
import { setBranch, setBranchList } from '@/redux/actions/branchActions';
import ViewByLoanOfficerPage from '@/components/transactions/ViewByLoanOfficer';

const CashCollectionDetailsPage = () => {
    const [loading, setLoading] = useState(true);
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branch = useSelector(state => state.branch.data);
    const [currentBranch, setCurrentBranch] = useState();
    const { uuid } = router.query;
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : new Date());

    const handleBranchFilter = (selected) => {
        setCurrentBranch(selected);
        localStorage.setItem('selectedBranch', selected._id);
        router.push('/transactions/daily-cash-collection/users/' + selected._id);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
    }

    const getListBranch = async () => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];

                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });

                dispatch(setBranchList(branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];

                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });

                dispatch(setBranchList(branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    useEffect(() => {
        let mounted = true;

        const getCurrentBranch = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}branches?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                dispatch(setBranch(response.branch));
                setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentBranch() && getListBranch();

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        if (branch) {
            setCurrentBranch(branch);
        }
    }, [branch]);

    return (
        <Layout header={false} noPad={true}>
            <div className="overflow-x-auto">
                {currentBranch && <DetailsHeader page={2} pageName="branch-view" mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                    selectedBranch={currentBranch} handleBranchFilter={handleBranchFilter} 
                    dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                />}
                <div className='p-4 mt-[8rem]'>
                    <ViewByLoanOfficerPage pageNo={2} dateFilter={dateFilter} type={'daily'} />
                </div>
            </div>
        </Layout>
    );
}

export default CashCollectionDetailsPage;