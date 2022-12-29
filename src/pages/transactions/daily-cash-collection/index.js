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
import ViewDailyCashCollectionPage from "@/components/transactions/ViewDailyCashCollection";
import ViewByBranchPage from "@/components/transactions/ViewByBranch";

const DailyCashCollectionPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState(new Date());

    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
        localStorage.setItem('cashCollectionDateFilter', filteredDate);
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

    useEffect(() => {
        if (branchList.length > 0) {
            localStorage.setItem('cashCollectionDateFilter', currentDate);

            if (currentUser.role.rep < 4) {
                const initGroupCollectionSummary = async () => {
                    if (currentUser.role.rep === 3) {
                        const branchId = branchList[0]._id;
                        const data = { currentUser: currentUser._id, mode: 'daily',  branchId: branchId}
                        await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary-by-branch', data);
                    } else {
                        const data = { currentUser: currentUser._id, mode: 'daily'}
                        await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary-by-branch', data);
                    }
                }
        
                initGroupCollectionSummary();
            }
        }
    }, [branchList]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <React.Fragment>
                    <div className="overflow-x-auto">
                        {branchList && <DetailsHeader pageTitle='Daily Cash Collections' pageName={currentUser.role.rep === 1 ? "branch-view" : ""}
                            page={1} mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                            dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                        />}
                        <div className={`p-4 ${currentUser.role.rep < 4 ? 'mt-[8rem]' : 'mt-[6rem]'} `}>
                            {currentUser.role.rep < 3 && <ViewByBranchPage dateFilter={dateFilter} />}
                            {currentUser.role.rep === 3 && <ViewByLoanOfficerPage pageNo={1} dateFilter={dateFilter} />}
                            {currentUser.role.rep === 4 && (
                                <div className='p-4 mt-[2rem]'>
                                    <ViewDailyCashCollectionPage pageNo={1} dateFilter={dateFilter} />
                                </div>
                            )}
                        </div>
                    </div>
                </React.Fragment>
            )}
        </Layout>
    );
}

export default DailyCashCollectionPage;