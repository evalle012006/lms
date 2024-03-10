import Layout from "@/components/Layout";
import Header from "@/components/reports/Header";
import ViewLowBalanceByBranchPage from "@/components/reports/ViewLowLoanBalanceByBranch";
import ViewLowBalanceByGroupsPage from "@/components/reports/ViewLowLoanBalanceByGroup";
import ViewLowBalanceByLOPage from "@/components/reports/ViewLowLoanBalanceByLO";
import { useEffect } from "react";
import { useState } from "react";
import { useSelector } from "react-redux";

const IncomingReloanPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [amount, setAmount] = useState(1000);

    const handleAmountChange = (value) => {
        localStorage.setItem('filterLowBalanceAmount', value);
        setAmount(value);
    }

    useEffect(() => {
        localStorage.setItem('filterLowBalanceAmount', amount);
    }, [amount]);
    
    return (
        <Layout header={false} noPad={true}>
            <Header pageNo={1} pageTitle={'Low Loan Balance List'} amount={amount} handleAmountChange={handleAmountChange} />
            { currentUser.role.rep < 3 && <ViewLowBalanceByBranchPage amount={amount} /> }
            { currentUser.role.rep == 3 && <ViewLowBalanceByLOPage amount={amount} /> }
            { currentUser.role.rep == 4 && <ViewLowBalanceByGroupsPage amount={amount} /> }
        </Layout>
    )
}

export default IncomingReloanPage;