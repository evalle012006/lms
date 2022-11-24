import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { formatPricePhp } from "@/lib/utils";

const ViewByLoanOfficerPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [userLOList, setUserLOList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branchFilter, setBranchFilter] = useState();
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
   
    const router = useRouter();

    // for area manager and up...
    const handleBranchFilterChange = (selected) => {
        setBranchFilter(selected.code);
        getGroupCashCollections(selected.code);
    }

    const handleRowClick = (selected) => {
        if (selected) {
            localStorage.setItem('selectedLO', selected._id);
            router.push('./daily-cash-collection/group/' + selected._id);
        }
    };

    const getGroupCashCollections = async (selectedBranch) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-group?' + new URLSearchParams({ date: currentDate, mode: 'daily', branchCode: selectedBranch ? selectedBranch : branchFilter });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];
            response.data && response.data.map(lo => {
                let collection = {
                    _id: lo._id,
                    name: `${lo.firstName} ${lo.lastName}`,
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    totalReleasesStr: '-',
                    totalLoanBalanceStr: '-',
                    loanTargetStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    collectionStr: '-',
                    mispayment: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-'
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

                collection = {
                    ...collection,
                    noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                    currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
                    activeClients: noOfClients,
                    activeBorrowers: noOfBorrowers,
                    totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
                    totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
                    loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
                    excessStr: excess ? formatPricePhp(excess) : 0,
                    totalStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
                    mispayment: mispayment + ' / ' + noOfClients,
                    fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
                    noOfFullPayment: noOfFullPayment
                }

                collectionData.push(collection);
            });

            setUserLOList(collectionData);
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const columns = [
        {
            Header: "Loan Officer",
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
            accessor: 'mispayment',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ];


    useEffect(() => {
        let mounted = true;

        if (branchList) {
            if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
                const currentBranch = branchList.find(b => b.code === currentUser.designatedBranch);
                mounted && setBranchFilter(currentBranch.code);
                mounted && getGroupCashCollections(currentBranch.code);
            }
            
            setLoading(false);
        }

        return () => {
            mounted = false;
        };
    }, [branchList]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={userLOList} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;