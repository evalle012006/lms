import Layout from "@/components/Layout";
import Header from "@/components/reports/Header";
import ViewLowBalanceByBranchPage from "@/components/reports/low-loan-balance/ViewLowLoanBalanceByBranch";
import ViewLowBalanceByGroupsPage from "@/components/reports/low-loan-balance/ViewLowLoanBalanceByGroup";
import ViewLowBalanceByLOPage from "@/components/reports/low-loan-balance/ViewLowLoanBalanceByLO";
import { useEffect } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";

const IncomingReloanPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [amount, setAmount] = useState(1000);
    const [amountOperator, setAmountOperator] = useState('less_than_equal');
    const [noOfPayments, setNoOfPayments] = useState(0);
    const [noOfPaymentsOperator, setNoOfPaymentsOperator] = useState('greater_than_equal');
    const [includeDelinquent, setIncludeDelinquent] = useState(true);

    const handleAmountChange = (value) => {
        localStorage.setItem('filterLowBalanceAmount', value);
        setAmount(value);
    }

    const handleAmountOperatorChange = (selected) => {
        console.log(selected)
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
    
    return (
        <Layout header={false}>
            <Header pageNo={1} pageTitle={'Loan Balance List'} amount={amount} handleAmountChange={handleAmountChange} amountOperator={amountOperator} handleAmountOperatorChange={handleAmountOperatorChange} 
                    noOfPayments={noOfPayments} handleNoOfPaymentsChange={handleNoOfPaymentsChange} noOfPaymentsOperator={noOfPaymentsOperator} handleNoOfPaymentsOperatorChange={handleNoOfPaymentsOperatorChange}
                    includeDelinquent={includeDelinquent} handleIncludeDelinquentChange={handleIncludeDelinquentChange} />
            { currentUser.role.rep < 3 && <ViewLowBalanceByBranchPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} /> }
            { currentUser.role.rep == 3 && <ViewLowBalanceByLOPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} /> }
            { currentUser.role.rep == 4 && <ViewLowBalanceByGroupsPage amount={amount} amountOperator={amountOperator} noOfPayments={noOfPayments} noOfPaymentsOperator={noOfPaymentsOperator} includeDelinquent={includeDelinquent} /> }
        </Layout>
    )
}

export default IncomingReloanPage;