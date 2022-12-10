import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { setBranchList } from "@/redux/actions/branchActions";
import moment from 'moment';
import DetailsHeader from "@/components/transactions/DetailsHeaderMain";
import { setUserList } from "@/redux/actions/userActions";
import ViewByLoanOfficerPage from "@/components/transactions/ViewByLoanOfficer";
import ViewDailyCashCollectionPage from "@/components/transactions/ViewDailyCashCollection";

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


    const getListUser = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
        if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
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
                setLoading(false);
            } else {
                setLoading(false);
                toast.error('Error retrieving user list.');
            }
        } else if (branchList.length > 0) {
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
                setLoading(false);
            } else {
                setLoading(false);
                toast.error('Error retrieving user list.');
            }
        }
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
            getListUser();
            localStorage.setItem('cashCollectionDateFilter', currentDate);
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
                        {branchList && <DetailsHeader pageTitle='Daily Cash Collections' 
                            page={1} mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} 
                            dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                        />}
                        <div className={`p-4 ${currentUser.role.rep < 4 ? 'mt-[8rem]' : 'mt-[6rem]'} `}>
                            {currentUser.role.rep <= 3 && <ViewByLoanOfficerPage dateFilter={dateFilter} />}
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