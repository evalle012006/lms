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
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentBranch, setCurrentBranch] = useState();
    const [amount, setAmount] = useState(amountSubject.value ? amountSubject.value : 1000);
    const { uuid } = router.query;

    const handleBranchFilter = (selected) => {
        setCurrentBranch(selected);
        localStorage.setItem('selectedBranch', selected._id);
        router.push(`/reports/low-loan-balance/user/${selected._id}`);
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';

        if (currentUser.role.rep == 2) {
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
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

    useEffect(() => {
        localStorage.setItem('filterLowBalanceAmount', amount);
    }, [amount]);

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
            <Header pageNo={2} pageTitle="Low Loan Balance List" pageName="lo-view" amount={amount} handleAmountChange={handleAmountChange} currentBranch={currentBranch} handleBranchFilter={handleBranchFilter} />
            <ViewLowBalanceByLOPage amount={amount} />
        </Layout>
    )
}

export default LowLoanBalanceByGroupPage;