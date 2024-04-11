import Layout from "@/components/Layout";
import Header from "@/components/reports/mispays-list/Header";
import { BehaviorSubject } from 'rxjs';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { setUserList } from "@/redux/actions/userActions";
import { useRouter } from "node_modules/next/router";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import ViewByGroupsPage from "@/components/reports/mispays-list/ViewByGroup";

const MispaysByGroupPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const userList = useSelector(state => state.user.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const remarksSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysRemarks'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysDate'));
    const pageNoSubject = new BehaviorSubject(process.browser && localStorage.getItem('pageNo'));
    const [currentLO, setCurrentLO] = useState();
    const [remarks, setRemarks] = useState(remarksSubject.value ? remarksSubject.value : 'all');
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : currentDate);
    const { uuid } = router.query;

    const handleLOFilter = (selected) => {
        setCurrentLO(selected);
        router.push(`/reports/mispay-list/group/${selected._id}`);
    }

    const getListUser = async (branchId) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list?' + new URLSearchParams({ loOnly: true, branchId: currentUser.role.rep == 3 ? currentUser.designatedBranchId : branchId });
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

        if (currentUser.role.rep < 3 && selectedBranchSubject.value) {
            mounted && getListUser(selectedBranchSubject.value);
        } else {
            mounted && getListUser();
        }

        return (() => {
            mounted = false;
        });
    }, []);

    useEffect(() => {
        if (userList && userList.length > 0 && uuid) {
            setCurrentLO(userList.find(lo => lo._id == uuid));
        }
    }, [userList, uuid]);

    return (
        <Layout noPad={true} header={false}>
            <Header pageNo={pageNoSubject.value} pageTitle="Mispays List" pageName="group-view" remarks={remarks} handleRemarksFilter={handleRemarksFilter} dateFilter={dateFilter} handleDateFilter={handleDateFilter}
                    currentLO={currentLO} handleLOFilter={handleLOFilter} />
            <ViewByGroupsPage remarks={remarks} dateFilter={dateFilter} />
        </Layout>
    )
}

export default MispaysByGroupPage;