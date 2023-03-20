import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { setBranchList } from "@/redux/actions/branchActions";
import moment from 'moment';
import DetailsHeader from "@/components/transactions/DetailsHeaderMain";
import ViewByLoanOfficerPage from "@/components/transactions/ViewByLoanOfficer";
import ViewCashCollectionPage from "@/components/transactions/ViewCashCollection";
import ViewByBranchPage from "@/components/transactions/ViewByBranch";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";

const WeeklyCashCollectionPage = () => {
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState(new Date());
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const loCollectionList = useSelector(state => state.cashCollection.lo);
    const loSummary = useSelector(state => state.cashCollection.loSummary);
    const bmSummary = useSelector(state => state.cashCollection.bmSummary);
    // const [weekend, setWeekend] = useState(false);
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);
    const [filter, setFilter] = useState(false);

    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
        if (filteredDate === currentDate) {
            setFilter(false);
        } else {
            setFilter(true);    
        }
        
        localStorage.setItem('cashCollectionDateFilter', filteredDate);
    }

    const handleShowSubmitDialog = () => {
        setShowSubmitDialog(true);
    }

    const handleSubmitForLos = async () => {
        setLoading(true);

        if (cashCollectionList.length > 0 || loCollectionList.length > 0) {
            if (currentUser.role.rep === 3) {
                const pending = loCollectionList.filter(lo => lo.status === 'open');
                if (pending.length > 0) {
                    setLoading(false);
                    toast.error("One or more lo/s transaction is not yet closed.");
                } else {
                    if (bmSummary && Object.keys(bmSummary).length > 0) {
                        const resp = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', bmSummary);
            
                        if (resp.success) {
                            setLoading(false);
                            toast.success('Today transactions are now available in LOS.');
                        } else if (resp.error) {
                            setLoading(false);
                            toast.error(resp.message);
                        }
                    }
                }
            } else if (currentUser.role.rep === 4) {
                const pending = cashCollectionList.filter(cc => cc.status === 'pending');
                if (pending.length > 0) {
                    setLoading(false);
                    toast.error("One or more group/s transaction is not yet closed.");
                } else {
                    if (loSummary && Object.keys(loSummary).length > 0) {
                        const resp = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', loSummary);
            
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
        }

        setShowSubmitDialog(false);
    }

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
            } 
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    useEffect(() => {
        let mounted = true;
        
        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, [currentUser]);

    // useEffect(() => {
    //     if (branchList.length > 0) {
    //         localStorage.setItem('cashCollectionDateFilter', currentDate);
    //         if (currentUser.role.rep < 4) {
    //             const initGroupCollectionSummary = async () => {
    //                 if (currentUser.role.rep === 3) {
    //                     const branchId = branchList[0]._id;
    //                     const data = { currentUser: currentUser._id, mode: 'weekly',  branchId: branchId}
    //                     await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary-by-branch', data);
    //                 } else {
    //                     const data = { currentUser: currentUser._id, mode: 'weekly'}
    //                     await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary-by-branch', data);
    //                 }
    //             }
        
    //             initGroupCollectionSummary();
    //         }
    //     }
    // }, [branchList]);

    // useEffect(() => {
    //     const dayName = moment().format('dddd');

    //     if (dayName === 'Saturday' || dayName === 'Sunday') {
    //         setWeekend(true);
    //     } else {
    //         setWeekend(false);
    //     }
    // }, []);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <React.Fragment>
                    <div className="overflow-x-auto">
                        {branchList && <DetailsHeader pageTitle='Weekly Cash Collections' pageName={currentUser.role.rep === 1 ? "branch-view" : ""}
                            page={1} mode={'weekly'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} weekend={isWeekend} holiday={isHoliday}
                            dateFilter={dateFilter} handleDateFilter={handleDateFilter} handleSubmit={handleShowSubmitDialog} filter={filter}
                        />}
                        <div className={`p-4 ${currentUser.role.rep < 4 ? 'mt-[8rem]' : 'mt-[6rem]'} `}>
                            {currentUser.role.rep < 3 && <ViewByBranchPage dateFilter={dateFilter} type={'weekly'} />}
                            {currentUser.role.rep === 3 && <ViewByLoanOfficerPage pageNo={1} dateFilter={dateFilter} type={'weekly'} />}
                            {currentUser.role.rep === 4 && (
                                <div className='p-4 mt-[2rem]'>
                                    <ViewCashCollectionPage pageNo={1} dateFilter={dateFilter} type={'weekly'} />
                                </div>
                            )}
                        </div>
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
                </React.Fragment>
            )}
        </Layout>
    );
}

export default WeeklyCashCollectionPage;