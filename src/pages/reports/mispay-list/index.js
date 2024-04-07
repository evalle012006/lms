import Layout from "@/components/Layout";
import Header from "@/components/reports/Header";
import ViewByBranchPage from "@/components/reports/mispays-list/ViewByBranch";
import ViewByGroupsPage from "@/components/reports/mispays-list/ViewByGroup";
import ViewByLOPage from "@/components/reports/mispays-list/ViewByLO";
import { useEffect } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";

const IncomingReloanPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [amount, setAmount] = useState(0);
    const [amountOperator, setAmountOperator] = useState('greater_than_equal');
    const [noOfPayments, setNoOfPayments] = useState(0);
    const [noOfPaymentsOperator, setNoOfPaymentsOperator] = useState('greater_than_equal');
    const [includeDelinquent, setIncludeDelinquent] = useState(true);

    const handleAmountChange = (value) => {
        localStorage.setItem('filterMispaysAmount', value);
        setAmount(value);
    }

    const handleAmountOperatorChange = (selected) => {
        console.log(selected)
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
    
    return (
        <Layout header={false}>
            <Header pageNo={1} pageTitle={'Mispays List'} amount={amount} handleAmountChange={handleAmountChange} amountOperator={amountOperator} handleAmountOperatorChange={handleAmountOperatorChange} 
                    noOfPayments={noOfPayments} handleNoOfPaymentsChange={handleNoOfPaymentsChange} noOfPaymentsOperator={noOfPaymentsOperator} handleNoOfPaymentsOperatorChange={handleNoOfPaymentsOperatorChange}
                    includeDelinquent={includeDelinquent} handleIncludeDelinquentChange={handleIncludeDelinquentChange} />
            { currentUser.role.rep < 3 && <ViewByBranchPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} /> }
            { currentUser.role.rep == 3 && <ViewByLOPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} /> }
            { currentUser.role.rep == 4 && <ViewByGroupsPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} includeDelinquent={includeDelinquent} /> }
        </Layout>
    )
}

export default IncomingReloanPage;