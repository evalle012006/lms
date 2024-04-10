import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useRouter } from "node_modules/next/router";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setBranchList } from "@/redux/actions/branchActions";
import { BehaviorSubject } from 'rxjs';
import ViewByLOPage from "@/components/reports/mispays-list/ViewByLO";
import Header from "@/components/reports/mispays-list/Header";

const MispaysByGroupPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const remarksSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysRemarks'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysDate'));
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentBranch, setCurrentBranch] = useState();
    const [remarks, setRemarks] = useState(remarksSubject.value ? remarksSubject.value : 'all');
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : currentDate);
    const { uuid } = router.query;

    const handleBranchFilter = (selected) => {
        setCurrentBranch(selected);
        localStorage.setItem('selectedBranch', selected._id);
        router.push(`/reports/mispay-list/user/${selected._id}`);
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';

        if (currentUser.role.rep == 2) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
        }
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        label: branch.name,
                        value: branch._id,
                    }
                );
            });
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }
    }

    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        localStorage.setItem('filterMispaysDate', filteredDate);
        setDateFilter(filteredDate);
    }

    const handleRemarksFilter = (selected) => {
        const value = selected.value;
        localStorage.setItem('filterMispaysRemarks', value);
        setRemarks(value);
    }

    useEffect(() => {
        localStorage.setItem('filterMispaysDate', dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        localStorage.setItem('filterMispaysRemarks', remarks);
    }, [remarks]);

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return (() => {
            mounted = false;
        });
    }, []);

    useEffect(() => {
        if (branchList && branchList.length > 0 && uuid) {
            setCurrentBranch(branchList.find(branch => branch._id == uuid));
        }
    }, [branchList, uuid]);

    return (
        <Layout noPad={true} header={false}>
            <Header pageNo={2} pageTitle="Mispays List" pageName="lo-view" remarks={remarks} handleRemarksFilter={handleRemarksFilter} dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                    currentBranch={currentBranch} handleBranchFilter={handleBranchFilter} />
            <ViewByLOPage remarks={remarks} dateFilter={dateFilter} />
        </Layout>
    )
}

export default MispaysByGroupPage;