import Layout from "@/components/Layout";
import Header from "@/components/reports/Header";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useRouter } from "node_modules/next/router";
import { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import ViewLowBalanceByLOPage from "@/components/reports/ViewLowLoanBalanceByLO";
import { setBranchList } from "@/redux/actions/branchActions";
import { BehaviorSubject } from 'rxjs';

const LowLoanBalanceByGroupPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const amountSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceAmount'));
    const amountOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceAmountOperator'));
    const noOfPaymentsSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceNoOfPayments'));
    const noOfPaymentsOperatorSubject = new BehaviorSubject(process.browser && localStorage.getItem('filterLowBalanceNoOfPaymentsOperator'));
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentBranch, setCurrentBranch] = useState();
    const [amount, setAmount] = useState(amountSubject.value ? amountSubject.value : 1000);
    const [amountOperator, setAmountOperator] = useState(amountOperatorSubject.value ? amountOperatorSubject.value : 'less_than_equal');
    const [noOfPayments, setNoOfPayments] = useState(noOfPaymentsSubject.value ? noOfPaymentsSubject.value : 0);
    const [noOfPaymentsOperator, setNoOfPaymentsOperator] = useState(noOfPaymentsOperatorSubject.value ? noOfPaymentsOperatorSubject.value : 'greater_than_equal');
    const { uuid } = router.query;

    const handleBranchFilter = (selected) => {
        setCurrentBranch(selected);
        localStorage.setItem('selectedBranch', selected._id);
        router.push(`/reports/low-loan-balance/user/${selected._id}`);
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
            <Header pageNo={2} pageTitle="Loan Balance List" pageName="lo-view" amount={amount} handleAmountChange={handleAmountChange} amountOperator={amountOperator} handleAmountOperatorChange={handleAmountOperatorChange} 
                    noOfPayments={noOfPayments} handleNoOfPaymentsChange={handleNoOfPaymentsChange} noOfPaymentsOperator={noOfPaymentsOperator} handleNoOfPaymentsOperatorChange={handleNoOfPaymentsOperatorChange}
                    currentBranch={currentBranch} handleBranchFilter={handleBranchFilter} />
            <ViewLowBalanceByLOPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} />
        </Layout>
    )
}

export default LowLoanBalanceByGroupPage;