import Layout from "@/components/Layout";
import Header from "@/components/reports/mispays-list/Header";
import ViewByBranchPage from "@/components/reports/mispays-list/ViewByBranch";
import ViewByGroupsPage from "@/components/reports/mispays-list/ViewByGroup";
import ViewByLOPage from "@/components/reports/mispays-list/ViewByLO";
import { useEffect } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";
import moment from 'moment'
import { BehaviorSubject } from 'rxjs';

const IncomingReloanPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const remarksSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysRemarks'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysDate'));
    const [remarks, setRemarks] = useState(remarksSubject.value ? remarksSubject.value : 'all');
    const [dateFilter, setDateFilter] = useState(dateFilterSubject.value ? dateFilterSubject.value : null);

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

    const getYesterdayDate = () => {
        let yesterday = moment(currentDate).subtract(1, 'days').format('YYYY-MM-DD');
        const dayName = moment(currentDate).format('dddd');
        if (dayName == 'Saturday') {
            yesterday = moment(currentDate).subtract(1, 'days').format('YYYY-MM-DD');
        } else if (dayName == 'Sunday') {
            yesterday = moment(currentDate).subtract(2, 'days').format('YYYY-MM-DD');
        }
        return yesterday;
    }

    useEffect(() => {
        setDateFilter(getYesterdayDate());
    }, [currentDate]);

    useEffect(() => {
        localStorage.setItem('filterMispaysDate', dateFilter);
    }, [dateFilter]);

    useEffect(() => {
        localStorage.setItem('filterMispaysRemarks', remarks);
    }, [remarks]);
    
    return (
        <Layout header={false}>
            <Header pageNo={1} pageTitle={'Mispays List'} remarks={remarks} handleRemarksFilter={handleRemarksFilter} dateFilter={dateFilter} handleDateFilter={handleDateFilter} />
            { currentUser.role.rep < 3 && <ViewByBranchPage remarks={remarks} dateFilter={dateFilter} /> }
            { currentUser.role.rep == 3 && <ViewByLOPage remarks={remarks} dateFilter={dateFilter} /> }
            { currentUser.role.rep == 4 && <ViewByGroupsPage remarks={remarks} dateFilter={dateFilter} /> }
        </Layout>
    )
}

export default IncomingReloanPage;