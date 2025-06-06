import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import React from 'react';
import moment from 'moment';
import DetailsHeader from '@/components/transactions/DetailsHeaderMain';
import { BehaviorSubject } from 'rxjs';
import { setBranch, setBranchList } from '@/redux/actions/branchActions';
import ViewByLoanOfficerPage from '@/components/transactions/ViewByLoanOfficer';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { getApiBaseUrl } from '@/lib/constants';

const CashCollectionDetailsPage = () => {
    const [loading, setLoading] = useState(true);
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const branchList = useSelector(state => state.branch.list);
    const currentUser = useSelector(state => state.user.data);
    const branch = useSelector(state => state.branch.data);
    const [currentBranch, setCurrentBranch] = useState();
    const { uuid } = router.query;
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : currentDate);
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const loCashCollectionList = useSelector(state => state.cashCollection.lo);
    const [selectedLoGroup, setSelectedLoGroup] = useState('all');
    const [cohData, setCohData] = useState();

    const handleBranchFilter = (selected) => {
        setCurrentBranch(selected);
        localStorage.setItem('selectedBranch', selected._id);
        router.push('/transactions/branch-manager/cash-collection/users/' + selected._id);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
        getCurrentBranch(filteredDate);
    }

    const handleShowSubmitDialog = () => {
        setShowSubmitDialog(true);
    }

    const handleSubmitForLos = async () => {
        setLoading(true);

        if (currentBranch && loCashCollectionList.length > 0) {
            const pending = loCashCollectionList.filter(cc => cc.status === 'open');
            const draft = loCashCollectionList.filter(cc => cc.draft);

            const loIds = loCashCollectionList.filter(cc => {
                if (cc.activeClients > 0) {
                    return cc._id;
                }
            }).map(lo => lo._id);

            if (pending.length > 0) {
                setLoading(false);
                toast.error("One or more Loan Officer transaction is not yet closed.");
            } else if (draft.length > 0) {
                setLoading(false);
                toast.error("One or more Loan Officer transaction has a draft data.");
            } else {
                let date = currentDate;
                if (dateFilter) {
                    date = moment(dateFilter).format('YYYY-MM-DD');
                }
                
                const data = {
                    branchId: branch._id,
                    loIds: loIds,
                    currentDate: date
                }

                const resp = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collection-summary/save-update-bms', data);
    
                if (resp.success) {
                    setLoading(false);
                    toast.success('Today transactions are now available in BMS.');
                } else if (resp.error) {
                    setLoading(false);
                    toast.error(resp.message, { autoClose: 5000, hideProgressBar: false });
                }
            }
        }

        setShowSubmitDialog(false);
    }

    const getListBranch = async () => {
        setLoading(true);
        let url = getApiBaseUrl() + 'branches/list';
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
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
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

    const handleLoGroupChange = (value) => {
        setSelectedLoGroup(value);
    }

    const getCurrentBranch = async (date) => {
        const apiUrl = `${getApiBaseUrl()}branches?`;
        const params = { _id: uuid, date: date ? date : currentDate };
        const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
        if (response.success) {
            dispatch(setBranch(response.branch));
            setLoading(false);
        } else {
            toast.error('Error while loading data');
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && uuid && getCurrentBranch() && getListBranch();

        return () => {
            mounted = false;
        };
    }, [uuid, currentDate]);

    useEffect(() => {
        if (dateFilter === null) {
            setDateFilter(currentDate);
        }
    }, [currentDate]);

    useEffect(() => {
        if (branch) {
            setCurrentBranch(branch);
            setCohData(branch?.cashOnHand?.length > 0 ? branch.cashOnHand[0] : {amount: 0});
        }
    }, [branch]);

    return (
        <Layout header={false} noPad={true}>
            <div className="overflow-x-auto">
                {currentBranch && <DetailsHeader page={2} pageName="branch-view" currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                    selectedBranch={currentBranch} handleBranchFilter={handleBranchFilter} handleSubmit={handleShowSubmitDialog}
                    dateFilter={dateFilter} handleDateFilter={handleDateFilter} holiday={isHoliday} weekend={isWeekend}
                    selectedLoGroup={selectedLoGroup} handleLoGroupChange={handleLoGroupChange}
                    cohData={cohData}
                />}
                <div className='p-4 mt-40'>
                    <ViewByLoanOfficerPage pageNo={2} dateFilter={dateFilter} selectedLoGroup={selectedLoGroup} />
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
        </Layout>
    );
}

export default CashCollectionDetailsPage;