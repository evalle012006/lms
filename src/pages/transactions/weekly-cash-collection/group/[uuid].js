import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import React from 'react';
import moment from 'moment';
import DetailsHeader from '@/components/transactions/DetailsHeaderMain';
import ViewCashCollectionPage from '@/components/transactions/ViewCashCollection';
import { setUserList } from '@/redux/actions/userActions';
import { BehaviorSubject } from 'rxjs';
import { setBranchList } from '@/redux/actions/branchActions';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import Spinner from '@/components/Spinner';
import { getApiBaseUrl } from '@/lib/constants';

const WeeklyCashCollectionDetailsPage = () => {
    const [loading, setLoading] = useState(false);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const userList = useSelector(state => state.user.list);
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const loCollectionList = useSelector(state => state.cashCollection.lo);
    const loSummary = useSelector(state => state.cashCollection.loSummary);
    const bmSummary = useSelector(state => state.cashCollection.bmSummary);
    const [currentLO, setCurrentLO] = useState();
    const { uuid } = router.query;
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : currentDate);
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);

    const handleLOFilter = (selected) => {
        setCurrentLO(selected);
        localStorage.setItem('selectedLO', selected._id);
        router.push(`/transactions/${selected.transactionType}-cash-collection/group/${selected._id}`);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
    }

    const handleShowSubmitDialog = () => {
        setShowSubmitDialog(true);
    }

    const handleSubmitForLos = async () => {
        setLoading(true);

        if ((currentUser.role.rep === 1 || currentUser.role.rep === 3) && (cashCollectionList.length > 0 || loCollectionList.length > 0)) {
            const pending = cashCollectionList.filter(cc => cc.status === 'pending');
            const draft = cashCollectionList.filter(cc => cc.draft);
            const pendingLoans = cashCollectionList.filter(cc => cc.group == "GRAND TOTALS").map(cc => cc.totalPendingLoans);

            if (pending.length > 0) {
                setLoading(false);
                toast.error("One or more group/s transaction is not yet closed.");
            } else if (draft.length > 0) {
                setLoading(false);
                toast.error("One or more group/s transaction has a draft data.");
            } else if (pendingLoans > 0) {
                setLoading(false);
                toast.error("One or more group/s transaction has pending loans. Please move the date of release or reject the loan/s.");
            } else {
                if (loSummary && Object.keys(loSummary).length > 0) {
                    const resp = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collection-summary/save-update-totals', loSummary);
        
                    if (resp.success) {
                        setLoading(false);
                        toast.success('Today transactions are now available in LOS.');
                    } else if (resp.error) {
                        setLoading(false);
                        toast.error(resp.message);
                    }
                }
            }
        }

        setShowSubmitDialog(false);
    }

    // const handleRowClick = (selected) => {
    //     // console.log(selected);
    //     if (selected.status === 'open') {
    //         console.log('open')
    //     }
    // }

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
        }
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch
                    }
                );
            });

            if (selectedBranchSubject.value) {
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
            const apiUrl = `${getApiBaseUrl()}users?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                setCurrentLO(response.user);
            } else {
                toast.error('Error while loading data');
            }
        }

        if (!currentLO && typeof currentLO == 'undefined') {
            mounted && uuid && getCurrentLO();
        }

        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        const getListUser = async () => {
            let url = getApiBaseUrl() + 'users/list';
            if (branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ loOnly: true, branchCode: branchList[0]?.code });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    let userDataList = [];
                    response.users && response.users.map(u => {
                        const name = `${u.firstName} ${u.lastName}`;
                        userDataList.push(
                            {
                                ...u,
                                name: name,
                                label: name,
                                value: u._id
                            }
                        );
                    });
                    userDataList.sort((a, b) => { return a.loNo - b.loNo; });
                    dispatch(setUserList(userDataList));
                } else {
                    toast.error('Error retrieving user list.');
                }
            }
        }

        if (branchList) {
            getListUser();
        }
    }, [branchList]);

    useEffect(() => {
        if (dateFilter === null) {
            setDateFilter(currentDate);
        }
    }, [currentDate]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <div className="overflow-x-auto">
                    {currentLO && <DetailsHeader page={2} pageName="lo-view" mode={'weekly'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                        selectedLO={currentLO} handleLOFilter={handleLOFilter} handleSubmit={handleShowSubmitDialog}
                        dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                    />}
                    <div className='p-4 mt-40'>
                        <ViewCashCollectionPage pageNo={2} dateFilter={dateFilter} type={'weekly'} />
                    </div>
                    <Dialog show={showSubmitDialog}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        <p className="text-xl font-normal text-dark-color">
                                            Are you sure you want to submit the transaction for the day? After submitting, you won't be able to update the transactions for today.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowSubmitDialog(false)} />
                            <ButtonSolid label="Yes, submit" type="button" className="p-2" onClick={handleSubmitForLos} />
                        </div>
                    </Dialog>
                </div>
            )}
        </Layout>
    );
}

export default WeeklyCashCollectionDetailsPage;