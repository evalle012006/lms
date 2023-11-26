import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { setBranchList } from "@/redux/actions/branchActions";
import moment from 'moment';
import DetailsHeader from "@/components/transactions/DetailsHeaderMain";
import ViewByLoanOfficerPage from "@/components/transactions/ViewByLoanOfficer";
import ViewByBranchPage from "@/components/transactions/ViewByBranch";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";

const BranchCashCollectionPage = () => {
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const branch = useSelector(state => state.branch.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState(currentDate);
    const loCollectionList = useSelector(state => state.cashCollection.lo);
    const bmSummary = useSelector(state => state.cashCollection.bmSummary);
    const [showSubmitDialog, setShowSubmitDialog] = useState(false);
    const [filter, setFilter] = useState(false);
    const [selectedLoGroup, setSelectedLoGroup] = useState('all');
    const [selectedBranchGroup, setSelectedBranchGroup] = useState('mine');

    const handleLoGroupChange = (value) => {
        setSelectedLoGroup(value);
    }

    const handleBranchGroup = (value) => {
        setSelectedBranchGroup(value);
    }

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

        if (loCollectionList.length > 0) {
            if (currentUser.role.rep === 3) {
                const pending = loCollectionList.filter(cc => cc.status === 'open');
                const draft = loCollectionList.filter(cc => cc.draft);
                const loIds = loCollectionList.filter(cc => {
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

                    const resp = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-bms', data);
        
                    if (resp.success) {
                        setLoading(false);
                        toast.success('Today transactions are now available in BMS.');
                    } else if (resp.error) {
                        setLoading(false);
                        toast.error(resp.message, { autoClose: 5000, hideProgressBar: false });
                    }
                }
            }
        }

        setShowSubmitDialog(false);
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';

        if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    }
                );
            });
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 3)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (dateFilter === null) {
            setDateFilter(currentDate);
        }
    }, [currentDate]);

    useEffect(() => {
        if (branchList.length > 0) {
            localStorage.setItem('cashCollectionDateFilter', currentDate);
        }
    }, [branchList, currentDate]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <React.Fragment>
                    <div className="overflow-x-auto">
                        {branchList && <DetailsHeader pageTitle='Branch Cash Collections' pageName={currentUser.role.rep === 1 ? "branch-view" : ""}
                            page={1} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} weekend={isWeekend} holiday={isHoliday}
                            dateFilter={dateFilter} handleDateFilter={handleDateFilter} handleSubmit={handleShowSubmitDialog} filter={filter}
                            selectedLoGroup={selectedLoGroup} handleLoGroupChange={handleLoGroupChange}
                            selectedBranchGroup={selectedBranchGroup} handleBranchGroup={handleBranchGroup}
                        />}
                        <div className={`p-4 ${currentUser.role.rep < 4 ? 'mt-[8rem]' : 'mt-[6rem]'} `}>
                            {currentUser.role.rep < 3 && <ViewByBranchPage dateFilter={dateFilter} selectedBranchGroup={selectedBranchGroup} />}
                            {currentUser.role.rep === 3 && <ViewByLoanOfficerPage pageNo={1} dateFilter={dateFilter} selectedLoGroup={selectedLoGroup} />}
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

export default BranchCashCollectionPage;