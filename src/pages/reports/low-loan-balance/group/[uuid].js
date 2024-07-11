import Layout from "@/components/Layout";
import Header from "@/components/reports/low-loan-balance/Header";
import ViewLowBalanceByGroupsPage from "@/components/reports/low-loan-balance/ViewLowLoanBalanceByGroup";
import { BehaviorSubject } from 'rxjs';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { setUserList } from "@/redux/actions/userActions";
import { useRouter } from "node_modules/next/router";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getApiBaseUrl } from '@/lib/constants';

const LowLoanBalanceByGroupPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const userList = useSelector(state => state.user.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const amountSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceAmount'));
    const amountOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceAmountOperator'));
    const noOfPaymentsSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceNoOfPayments'));
    const noOfPaymentsOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceNoOfPaymentsOperator'));
    const pageNoSubject = new BehaviorSubject(process.browser && localStorage.getItem('pageNo'));
    const [currentLO, setCurrentLO] = useState();
    const [amount, setAmount] = useState(amountSubject.value ? amountSubject.value : 1000);
    const [amountOperator, setAmountOperator] = useState(amountOperatorSubject.value ? amountOperatorSubject.value : 'less_than_equal');
    const [noOfPayments, setNoOfPayments] = useState(noOfPaymentsSubject.value ? noOfPaymentsSubject.value : 0);
    const [noOfPaymentsOperator, setNoOfPaymentsOperator] = useState(noOfPaymentsOperatorSubject.value ? noOfPaymentsOperatorSubject.value : 'greater_than_equal');
    const [includeDelinquent, setIncludeDelinquent] = useState(true);
    const { uuid } = router.query;

    const handleLOFilter = (selected) => {
        setCurrentLO(selected);
        router.push(`/reports/low-loan-balance/group/${selected._id}`);
    }

    const getListUser = async (branchId) => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ loOnly: true, branchId: currentUser.role.rep == 3 ? currentUser.designatedBranchId : branchId });
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
        localStorage.setItem('filterLowBalanceAmount', value);
        setAmount(value);
    }

    const handleAmountOperatorChange = (selected) => {
        localStorage.setItem('filterLowBalanceAmountOperator', selected.value);
        setAmountOperator(selected.value);
    }

    const handleNoOfPaymentsChange = (value) => {
        localStorage.setItem('filterLowBalanceNoOfPayments', value);
        setNoOfPayments(value);
    }

    const handleNoOfPaymentsOperatorChange = (selected) => {
        localStorage.setItem('filterLowBalanceNoOfPaymentsOperator', selected.value);
        setNoOfPaymentsOperator(selected.value);
    }

    const handleIncludeDelinquentChange = (name, value) => {
        localStorage.setItem('filterLowBalanceIncludeDelinquent', value);
        setIncludeDelinquent(value);
    }

    useEffect(() => {
        localStorage.setItem('filterLowBalanceAmount', amount);
    }, [amount]);

    useEffect(() => {
        localStorage.setItem('filterLowBalanceAmountOperator', amountOperator);
    }, [amountOperator]);
    
    useEffect(() => {
        localStorage.setItem('filterLowBalanceNoOfPayments', noOfPayments);
    }, [noOfPayments]);

    useEffect(() => {
        localStorage.setItem('filterLowBalanceNoOfPaymentsOperator', noOfPaymentsOperator);
    }, [noOfPaymentsOperator]);

    useEffect(() => {
        localStorage.setItem('filterLowBalanceIncludeDelinquent', includeDelinquent);
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
            <Header pageNo={pageNoSubject.value} pageTitle="Loan Balance List" pageName="group-view" amount={amount} handleAmountChange={handleAmountChange} amountOperator={amountOperator} handleAmountOperatorChange={handleAmountOperatorChange} 
                        noOfPayments={noOfPayments} handleNoOfPaymentsChange={handleNoOfPaymentsChange} noOfPaymentsOperator={noOfPaymentsOperator} handleNoOfPaymentsOperatorChange={handleNoOfPaymentsOperatorChange}
                        includeDelinquent={includeDelinquent} handleIncludeDelinquentChange={handleIncludeDelinquentChange} currentLO={currentLO} handleLOFilter={handleLOFilter} />
            <ViewLowBalanceByGroupsPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} includeDelinquent={includeDelinquent} />
        </Layout>
    )
}

export default LowLoanBalanceByGroupPage;