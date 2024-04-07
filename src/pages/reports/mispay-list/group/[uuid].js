import Layout from "@/components/Layout";
import Header from "@/components/reports/Header";
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
    const userList = useSelector(state => state.user.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const amountSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysAmount'));
    const amountOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysAmountOperator'));
    const noOfPaymentsSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysNoOfPayments'));
    const noOfPaymentsOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterMispaysNoOfPaymentsOperator'));
    const pageNoSubject = new BehaviorSubject(process.browser && localStorage.getItem('pageNo'));
    const [currentLO, setCurrentLO] = useState();
    const [amount, setAmount] = useState(amountSubject.value ? amountSubject.value : 0);
    const [amountOperator, setAmountOperator] = useState(amountOperatorSubject.value ? amountOperatorSubject.value : 'greater_than_equal');
    const [noOfPayments, setNoOfPayments] = useState(noOfPaymentsSubject.value ? noOfPaymentsSubject.value : 0);
    const [noOfPaymentsOperator, setNoOfPaymentsOperator] = useState(noOfPaymentsOperatorSubject.value ? noOfPaymentsOperatorSubject.value : 'greater_than_equal');
    const [includeDelinquent, setIncludeDelinquent] = useState(true);
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

    const handleAmountChange = (value) => {
        localStorage.setItem('filterMispaysAmount', value);
        setAmount(value);
    }

    const handleAmountOperatorChange = (selected) => {
        localStorage.setItem('filterMispaysAmountOperator', selected.value);
        setAmountOperator(selected.value);
    }

    const handleNoOfPaymentsChange = (value) => {
        localStorage.setItem('filterMispaysNoOfPayments', value);
        setNoOfPayments(value);
    }

    const handleNoOfPaymentsOperatorChange = (selected) => {
        localStorage.setItem('filterMispaysNoOfPaymentsOperator', selected.value);
        setNoOfPaymentsOperator(selected.value);
    }

    const handleIncludeDelinquentChange = (name, value) => {
        localStorage.setItem('filterMispaysIncludeDelinquent', value);
        setIncludeDelinquent(value);
    }

    useEffect(() => {
        localStorage.setItem('filterMispaysAmount', amount);
    }, [amount]);

    useEffect(() => {
        localStorage.setItem('filterMispaysAmountOperator', amountOperator);
    }, [amountOperator]);
    
    useEffect(() => {
        localStorage.setItem('filterMispaysNoOfPayments', noOfPayments);
    }, [noOfPayments]);

    useEffect(() => {
        localStorage.setItem('filterMispaysNoOfPaymentsOperator', noOfPaymentsOperator);
    }, [noOfPaymentsOperator]);

    useEffect(() => {
        localStorage.setItem('filterMispaysIncludeDelinquent', includeDelinquent);
    }, [includeDelinquent]);

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
            <Header pageNo={pageNoSubject.value} pageTitle="Mispays List" pageName="group-view" amount={amount} handleAmountChange={handleAmountChange} amountOperator={amountOperator} handleAmountOperatorChange={handleAmountOperatorChange} 
                        noOfPayments={noOfPayments} handleNoOfPaymentsChange={handleNoOfPaymentsChange} noOfPaymentsOperator={noOfPaymentsOperator} handleNoOfPaymentsOperatorChange={handleNoOfPaymentsOperatorChange}
                        includeDelinquent={includeDelinquent} handleIncludeDelinquentChange={handleIncludeDelinquentChange} currentLO={currentLO} handleLOFilter={handleLOFilter} />
            <ViewByGroupsPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} includeDelinquent={includeDelinquent} />
        </Layout>
    )
}

export default MispaysByGroupPage;