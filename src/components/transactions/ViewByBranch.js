import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import moment from 'moment';
import { formatPricePhp, getTotal } from "@/lib/utils";

const ViewByBranchPage = ({dateFilter, type}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const [branchCollectionData, setBranchCollectionData] = useState([]);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const dayName = moment().format('dddd').toLowerCase();

    const router = useRouter();
    // check group status if there is pending change row color to orange/yellow else white
    const getBranchCashCollections = async (date) => {
        setLoading(true);
        const filter = date ? true : false;
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-branch';

        if (currentUser.role.rep === 2) {
            url = url + "?" + new URLSearchParams({ date: date ? date : currentDate, mode: type, areaManagerId: currentUser._id, dayName: dayName });
        } else {
            url = url + "?" + new URLSearchParams({ date: date ? date : currentDate, mode: type, dayName: dayName });
        }
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];

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
            let fullPaymentAmount = 0;
            let mispayment = 0;
            let totalPastDue = 0;
            let totalNoPastDue = 0;
            let totalMcbu = 0;
            let totalMcbuCol = 0;
            let totalMcbuWithdrawal = 0;
            let totalMcbuReturnNo = 0;
            let totalMcbuReturnAmt = 0;
            
            response.data.map(branch => {
                let collection = {
                    _id: branch._id,
                    name: branch.code + ' - ' + branch.name,
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    totalReleasesStr: '-',
                    totalLoanBalanceStr: '-',
                    loanTargetStr: '-',
                    mcbuStr: '-',
                    mcbuColStr: '-',
                    mcbuWithdrawalStr: '-',
                    mcbuReturnAmtStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    pastDueStr: '-',
                    noPastDue: '-',
                    page: 'branch-summary',
                    status: '-'
                };

                if (!filter) {
                    if (branch.groupCashCollections.length > 0) {
                        const open = branch.groupCashCollections[0].statusArr.find(status => status === 'open');
                        if (open) {
                            collection.status = 'open';
                        } else {
                            collection.status = 'close';
                        }
                    }

                    if (branch.activeLoans.length > 0) {
                        collection.activeClients = branch.activeLoans[0].activeClients; 
                        collection.activeBorrowers = branch.activeLoans[0].activeBorrowers;
                        noOfClients += branch.activeLoans[0].activeClients;
                        noOfBorrowers += branch.activeLoans[0].activeBorrowers;
                    }
    
                    if (branch.loans.length > 0) {
                        collection.totalReleasesStr = branch.loans[0].totalRelease > 0 ? formatPricePhp(branch.loans[0].totalRelease) : '-';
                        collection.totalLoanBalanceStr = branch.loans[0].totalLoanBalance > 0 ? formatPricePhp(branch.loans[0].totalLoanBalance) : '-';
                        collection.loanTarget = branch.loans[0].loanTarget;
                        collection.loanTargetStr = branch.loans[0].loanTarget > 0 ? formatPricePhp(branch.loans[0].loanTarget) : '-';
                        collection.pastDue = branch.loans[0].pastDue;
                        collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = branch.loans[0].noPastDue;
                        collection.mcbu = branch.loans[0].mcbu;
                        collection.mcbuStr = branch.loans[0].mcbu > 0 ? formatPricePhp(branch.loans[0].mcbu) : '-';
                        collection.mcbuCol = 0;
                        collection.mcbuColStr = '-';
                        collection.mcbuWithdrawal = 0;
                        collection.mcbuWithdrawalStr = '-';
                        collection.noMcbuReturn = 0;
                        collection.mcbuReturnAmt = 0;
                        collection.mcbuReturnAmtStr = '-';
    
                        totalsLoanRelease += branch.loans[0].totalRelease;
                        totalsLoanBalance += branch.loans[0].totalLoanBalance;
                        targetLoanCollection += branch.loans[0].loanTarget;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        // totalMcbu += collection.mcbu;
                    }

                    if (branch.groups.length > 0) {
                        targetLoanCollection = 0;
                        let loLoanTarget = 0;
                        let loMcbu = 0;
                        branch.groups.map(g => {
                            if (g.loanTarget.length > 0) {
                                loLoanTarget += g.loanTarget[0].loanTarget;
                                loMcbu += g.loanTarget[0].mcbu;
                            }
                        });

                        collection.loanTarget = loLoanTarget;
                        collection.loanTargetStr = loLoanTarget > 0 ? formatPricePhp(loLoanTarget) : '-';
                        targetLoanCollection += loLoanTarget;
                        collection.mcbu = loMcbu;
                        collection.mcbuStr = loMcbu > 0 ? formatPricePhp(loMcbu) : '-';
                        totalMcbu += collection.mcbu;
                    }

                    totalMcbu += collection.mcbu ? collection.mcbu : 0;
                    
                    if (branch.cashCollections.length > 0) {
                        const loanTarget = collection.loanTarget - branch.cashCollections[0].loanTarget;
    
                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                        collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                        collection.mispaymentStr = branch.cashCollections[0].mispayment > 0 ? branch.cashCollections[0].mispayment : '-';
                        // collection.mcbu = branch.cashCollections[0].mcbu;
                        // collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = branch.cashCollections[0].mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = branch.cashCollections[0].noMcbuReturn;
                        collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
    
                        excess += branch.cashCollections[0].excess;
                        totalLoanCollection += branch.cashCollections[0].collection;
                        mispayment += branch.cashCollections[0].mispayment;
                        targetLoanCollection = targetLoanCollection - branch.cashCollections[0].loanTarget;
                        // totalMcbu += collection.mcbu;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                    }
    
                    if (branch.currentRelease.length > 0) {
                        const newReleasePerson = branch.currentRelease[0].newCurrentRelease ? branch.currentRelease[0].newCurrentRelease : 0;
                        const reReleasePerson = branch.currentRelease[0].reCurrentRelease ? branch.currentRelease[0].reCurrentRelease : 0;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmountStr = formatPricePhp(branch.currentRelease[0].currentReleaseAmount);
    
                        noOfNewCurrentRelease += branch.currentRelease[0].newCurrentRelease;
                        noOfReCurrentRelease += branch.currentRelease[0].reCurrentRelease;
                        currentReleaseAmount += branch.currentRelease[0].currentReleaseAmount;
                    }
    
                    if (branch.fullPayment.length > 0) {
                        collection.noOfFullPayment = branch.fullPayment[0].noOfFullPayment;
                        collection.fullPaymentAmountStr = formatPricePhp(branch.fullPayment[0].fullPaymentAmount);
    
                        fullPaymentAmount += branch.fullPayment[0].fullPaymentAmount;
                        noOfFullPayment += branch.fullPayment[0].noOfFullPayment;
                        // noOfNewfullPayment += branch.fullPayment[0].newFullPayment;
                        // noOfRefullPayment += branch.fullPayment[0].reFullPayment;
                    }
                } else {
                    // const dayNameFilter = moment(date).format('dddd').toLowerCase();
                    // let loanTarget = 0;
                    // if ((cc.occurence === 'weekly' && cc.day === dayNameFilter) || cc.occurence === 'daily') {
                    //     loanTarget = branch.cashCollections[0].loanTarget && branch.cashCollections[0].loanTarget;
                    // }
                    if (branch.cashCollections.length > 0) {
                        collection.activeClients = branch.cashCollections[0].activeClients; 
                        collection.activeBorrowers = branch.cashCollections[0].activeBorrowers;

                        collection.totalReleasesStr = branch.cashCollections[0].totalRelease > 0 ? formatPricePhp(branch.cashCollections[0].totalRelease) : '-';
                        collection.totalLoanBalanceStr = branch.cashCollections[0].totalLoanBalance > 0 ? formatPricePhp(branch.cashCollections[0].totalLoanBalance) : '-';
                        collection.loanTarget = branch.cashCollections[0].loanTarget;
                        collection.loanTargetStr = branch.cashCollections[0].loanTarget > 0 ? formatPricePhp(branch.cashCollections[0].loanTarget) : '-';
                        
                        collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                        collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                        collection.mispaymentStr = branch.cashCollections[0].mispayment;
                        collection.pastDue = branch.cashCollections[0].pastDue ? branch.cashCollections[0].pastDue : 0;
                        collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = branch.cashCollections[0].noPastDue ? branch.cashCollections[0].noPastDue : 0;

                        collection.mcbu = branch.cashCollections[0].mcbu ? branch.cashCollections[0].mcbu: 0;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                        collection.mcbuCol = branch.cashCollections[0].mcbuCol ? branch.cashCollections[0].mcbuCol: 0;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol): '-';
                        collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal ? branch.cashCollections[0].mcbuWithdrawal: 0;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal): '-';
                        collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo ? branch.cashCollections[0].mcbuReturnNo: 0;
                        collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt ? branch.cashCollections[0].mcbuReturnAmt: 0;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt): '-';

                        const newReleasePerson = branch.cashCollections[0].newCurrentRelease;
                        const reReleasePerson = branch.cashCollections[0].reCurrentRelease;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmountStr = formatPricePhp(branch.cashCollections[0].currentReleaseAmount);

                        collection.noOfFullPayment = branch.cashCollections[0].noOfFullPayment;
                        collection.fullPaymentAmountStr = formatPricePhp(branch.cashCollections[0].fullPaymentAmount);
    
                        noOfClients += branch.cashCollections[0].activeClients;
                        noOfBorrowers += branch.cashCollections[0].activeBorrowers;
                        totalsLoanRelease += branch.cashCollections[0].totalRelease;
                        totalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                        targetLoanCollection += branch.cashCollections[0].loanTarget;
                        excess += branch.cashCollections[0].excess;
                        totalLoanCollection += branch.cashCollections[0].collection;
                        mispayment += branch.cashCollections[0].mispayment;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        noOfNewCurrentRelease += branch.cashCollections[0].newCurrentRelease;
                        noOfReCurrentRelease += branch.cashCollections[0].reCurrentRelease;
                        currentReleaseAmount += branch.cashCollections[0].currentReleaseAmount;
                        fullPaymentAmount += branch.cashCollections[0].fullPaymentAmount;
                        noOfFullPayment += branch.cashCollections[0].noOfFullPayment;
                        totalMcbu += collection.mcbu ? collection.mcbu : 0;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                    }
                }

                collectionData.push(collection);
            });

            const branchTotals = {
                name: 'TOTALS',
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                totalReleasesStr: formatPricePhp(totalsLoanRelease),
                totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
                loanTargetStr: formatPricePhp(targetLoanCollection),
                excessStr: formatPricePhp(excess),
                totalStr: formatPricePhp(totalLoanCollection),
                mispaymentStr: mispayment + ' / ' + noOfClients,
                fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
                noOfFullPayment: noOfFullPayment,
                pastDueStr: formatPricePhp(totalPastDue),
                noPastDue: totalNoPastDue,
                mcbu: totalMcbu,
                mcbuStr: formatPricePhp(totalMcbu),
                mcbuCol: totalMcbuCol,
                mcbuColStr: formatPricePhp(totalMcbuCol),
                mcbuWithdrawal: totalMcbuWithdrawal,
                mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
                noMcbuReturn: totalMcbuReturnNo,
                mcbuReturnAmt: totalMcbuReturnAmt,
                mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
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

    const [columns, setColumns] = useState();

    const handleRowClick = (selected) => {
        router.push(`/transactions/branch-manager/cash-collection/users/${selected._id}`);
        localStorage.setItem('selectedBranch', selected._id);
    };

    useEffect(() => {
        let cols = [];
        if (type === 'daily') {
            cols = [
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
                },
                {
                    Header: "PD #",
                    accessor: 'noPastDue'
                },
                {
                    Header: "PD Amount",
                    accessor: 'pastDueStr'
                }
            ];
        } else {
            cols = [
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
                    Header: "MCBU",
                    accessor: 'mcbuStr',
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
                    Header: "MCBU Collection",
                    accessor: 'mcbuColStr',
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
                    Header: "MCBU Withdrawal",
                    accessor: 'mcbuWithdrawalStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "# MCBU Return",
                    accessor: 'noMcbuReturn',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "MCBU Return",
                    accessor: 'mcbuReturnAmtStr',
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
                },
                {
                    Header: "PD #",
                    accessor: 'noPastDue'
                },
                {
                    Header: "PD Amount",
                    accessor: 'pastDueStr'
                }
            ];
        }

        setColumns(cols);
    }, []);

    useEffect(() => {
        let mounted = true;

        if (dateFilter.dateFilter) {
            const date = moment(dateFilter.dateFilter).format('YYYY-MM-DD');
            if (date !== currentDate) {
                mounted && getBranchCashCollections(date);
            } else {
                mounted && getBranchCashCollections();
            }
        } else {
            mounted && getBranchCashCollections();
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter]);
    

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