import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import moment from 'moment';
import { formatPricePhp, getTotal } from "@/lib/utils";

const ViewByBranchPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);
    const [branchCollectionData, setBranchCollectionData] = useState([]);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));

    const router = useRouter();

    const getBranchCashCollections = async (date) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-branch?' + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily' });
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];
            
            response.data.map(branch => {
                let collection = {
                    _id: branch._id,
                    name: branch.name,
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    totalReleasesStr: '-',
                    totalLoanBalanceStr: '-',
                    loanTargetStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    page: 'branch-summary',
                    status: '-'
                };

                let noOfClients = 0;
                let noOfBorrowers = 0;
                let totalsLoanRelease = 0;
                let totalsLoanBalance = 0;
                let noOfNewCurrentRelease = 0;
                let noOfReCurrentRelease = 0;
                let currentReleaseAmount = 0;
                let targetLoanCollection = 0;
                let excess = 0;
                let totalLoanCollection = 0;
                let noOfFullPayment = 0;
                let noOfNewfullPayment = 0;
                let noOfRefullPayment = 0;
                let fullPaymentAmount = 0;
                let mispayment = 0;

                branch.users.map(lo => {
                    lo.groups.map(group => {
                        if (group.loans.length > 0) {
                            noOfClients += group.loans[0].activeClients;
                            noOfBorrowers += group.loans[0].activeBorrowers;
                            totalsLoanRelease += group.loans[0].totalRelease;
                            totalsLoanBalance += group.loans[0].totalLoanBalance;
                            targetLoanCollection += group.loans[0].loanTarget;
                        }
                        
                        if (group.cashCollections.length > 0) {
                            excess += group.cashCollections[0].excess;
                            totalLoanCollection += group.cashCollections[0].total;
                            mispayment += group.cashCollections[0].mispayment;
                        }
    
                        if (group.currentRelease.length > 0) {
                            noOfNewCurrentRelease += group.currentRelease[0].newCurrentRelease;
                            noOfReCurrentRelease += group.currentRelease[0].reCurrentRelease;
                            currentReleaseAmount += group.currentRelease[0].currentReleaseAmount;
                        }
    
                        if (group.fullPayment.length > 0) {
                            fullPaymentAmount += group.fullPayment[0].fullPaymentAmount;
                            noOfFullPayment += group.fullPayment[0].noOfFullPayment;
                            noOfNewfullPayment += group.fullPayment[0].newFullPayment;
                            noOfRefullPayment += group.fullPayment[0].reFullPayment;
                        }
                    });
                });
    
                collection = {
                    ...collection,
                    noOfNewCurrentRelease: noOfNewCurrentRelease,
                    noOfReCurrentRelease: noOfReCurrentRelease,
                    noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                    currentReleaseAmount: currentReleaseAmount,
                    currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
                    activeClients: noOfClients,
                    activeBorrowers: noOfBorrowers,
                    totalReleases: totalsLoanRelease,
                    totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
                    totalLoanBalance: totalsLoanBalance,
                    totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
                    loanTarget: targetLoanCollection,
                    loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
                    excess: excess,
                    excessStr: excess ? formatPricePhp(excess) : 0,
                    total: totalLoanCollection,
                    totalStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
                    mispayment: mispayment,
                    mispaymentStr: mispayment + ' / ' + noOfClients,
                    fullPaymentAmount: fullPaymentAmount,
                    fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
                    noOfFullPayment: noOfFullPayment
                }

                collectionData.push(collection);
            });

            // totals
            let totalNoOfClients = getTotal(collectionData, 'activeClients');
            let totalNoOfBorrowers = getTotal(collectionData, 'activeBorrowers');
            let totalsLoanRelease = getTotal(collectionData, 'totalReleases');
            let totalsLoanBalance = getTotal(collectionData, 'totalLoanBalance');
            let totalNoOfNewCurrentRelease = getTotal(collectionData, 'noOfNewCurrentRelease');
            let totalNoOfReCurrentRelease = getTotal(collectionData, 'noOfReCurrentRelease');
            let totalCurrentReleaseAmount = getTotal(collectionData, 'currentReleaseAmount');
            let totalTargetLoanCollection = getTotal(collectionData, 'loanTarget');
            let totalExcess = getTotal(collectionData, 'excess');
            let totalLoanCollection = getTotal(collectionData, 'total');
            let totalNoOfFullPayment = getTotal(collectionData, 'noOfFullPayment');
            let totalFullPaymentAmount = getTotal(collectionData, 'fullPaymentAmount');
            let totalMispayment = getTotal(collectionData, 'mispayment');

            const branchTotals = {
                name: 'TOTALS',
                noCurrentReleaseStr: totalNoOfNewCurrentRelease + ' / ' + totalNoOfReCurrentRelease,
                currentReleaseAmountStr: formatPricePhp(totalCurrentReleaseAmount),
                activeClients: totalNoOfClients,
                activeBorrowers: totalNoOfBorrowers,
                totalReleasesStr: formatPricePhp(totalsLoanRelease),
                totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
                loanTargetStr: formatPricePhp(totalTargetLoanCollection),
                excessStr: formatPricePhp(totalExcess),
                totalStr: formatPricePhp(totalLoanCollection),
                mispaymentStr: totalMispayment + ' / ' + totalNoOfClients,
                fullPaymentAmountStr: formatPricePhp(totalFullPaymentAmount),
                noOfFullPayment: totalNoOfFullPayment,
                totalData: true
            };

            collectionData.push(branchTotals);
            
            setBranchCollectionData(collectionData);
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Branch Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Active Clients", // total number of clients per group
            accessor: 'activeClients',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Total Loan Releases",
            accessor: 'totalReleasesStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Active Borrowers", // with balance
            accessor: 'activeBorrowers',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Total Loan Balance",
            accessor: 'totalLoanBalanceStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Current Release Person",
            accessor: 'noCurrentReleaseStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Current Release Amount",
            accessor: 'currentReleaseAmountStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Target Loan Collection",
            accessor: 'loanTargetStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Excess",
            accessor: 'excessStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Actual Loan Collection",
            accessor: 'totalStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Full Payment Person",
            accessor: 'noOfFullPayment',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Full Payment Amount",
            accessor: 'fullPaymentAmountStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Mispay",
            accessor: 'mispaymentStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleRowClick = (selected) => {
        router.push('./daily-cash-collection/users/' + selected._id);
        localStorage.setItem('selectedBranch', selected._id);
    };

    useEffect(() => {
        let mounted = true;

        mounted && getBranchCashCollections();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            {loading ?
                (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : <TableComponent columns={columns} data={branchCollectionData} hasActionButtons={false} rowActionButtons={false} showFilters={false} pageSize={50} rowClick={handleRowClick} />}
        </React.Fragment>
    );
}

export default ViewByBranchPage;