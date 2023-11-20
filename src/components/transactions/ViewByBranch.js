import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import moment from 'moment';
import { formatPricePhp, getTotal } from "@/lib/utils";
import { setCashCollectionBranch } from "@/redux/actions/cashCollectionActions";

const ViewByBranchPage = ({dateFilter, type, selectedBranchGroup}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const branchCollectionData = useSelector(state => state.cashCollection.branch);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);

    const router = useRouter();
    // check group status if there is pending change row color to orange/yellow else white
    const getBranchCashCollections = async (date) => {
        setLoading(true);
        const filter = date ? true : false;
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-branch';

        if (currentUser.role.rep === 2) {
            if (currentUser.role.shortCode !== 'area_admin') {
                url = url + "?" + new URLSearchParams({ date: date ? date : currentDate, mode: type, areaManagerId: currentUser._id, dayName: dayName, currentDate: currentDate, selectedBranchGroup: selectedBranchGroup });
            } else {
                url = url + "?" + new URLSearchParams({ date: date ? date : currentDate, mode: type, areaManagerId: currentUser._id, dayName: dayName, currentDate: currentDate, selectedBranchGroup: 'mine' });
            }
        } else {
            url = url + "?" + new URLSearchParams({ date: date ? date : currentDate, mode: type, dayName: dayName, currentDate: currentDate });
        }
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];

            let noOfClients = 0;
            let noOfBorrowers = 0;
            let noOfPendings = 0;
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
            let totalTransfer = 0;
            
            response.data.map(branch => {
                let collection = {
                    _id: branch._id,
                    name: branch.code + ' - ' + branch.name,
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    pendingClients: '-',
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
                    transfer: '-',
                    page: 'branch-summary',
                    status: '-'
                };

                let groupStatus = 'open';
                if (branch?.draftCollections?.length > 0) {
                    const transactionStatus = branch.draftCollections[0].groupStatusArr.filter(status => status === "pending");
                    const draft = branch.draftCollections[0].hasDraftsArr.filter(d => d === true);
                    if (transactionStatus.length == 0 && draft.length == 0) {
                        groupStatus = 'close';
                    }
                } else if (branch.cashCollections.length > 0) {
                    const transactionStatus = branch.cashCollections[0].groupStatusArr.filter(status => status === "pending");
                    const draft = branch.cashCollections[0].hasDraftsArr.filter(d => d === true);
                    if (transactionStatus.length == 0 && draft.length == 0) {
                        groupStatus = 'close';
                    }
                }

                if (!filter && (isWeekend || isHoliday)) {
                    groupStatus = 'close';
                }

                if (!filter) {
                    if (branch.activeLoans.length > 0) {
                        collection.activeClients = branch.activeLoans[0].activeClients; 
                        collection.activeBorrowers = branch.activeLoans[0].activeBorrowers;
                        collection.pendingClients = branch.activeLoans[0].pendingClients;
                        noOfClients += branch.activeLoans[0].activeClients;
                        noOfBorrowers += branch.activeLoans[0].activeBorrowers;
                        noOfPendings = branch.activeLoans[0].pendingClients;
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
                        collection.status = groupStatus;
    
                        totalsLoanRelease += branch.loans[0].totalRelease;
                        totalsLoanBalance += branch.loans[0].totalLoanBalance;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        // totalMcbu += collection.mcbu;
                    }
                    
                    if (branch?.draftCollections?.length > 0) {
                        const draftCollection = branch.draftCollections[branch.draftCollections.length - 1];
                        const loanTarget = collection.loanTarget - draftCollection.loanTarget;

                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excessStr = draftCollection.excess > 0 ? formatPricePhp(draftCollection.excess) : '-';
                        collection.totalStr = draftCollection.collection > 0 ? formatPricePhp(draftCollection.collection) : '-';
                        collection.mispaymentStr = draftCollection.mispayment > 0 ? draftCollection.mispayment : '-';
                        collection.mcbu = draftCollection.mcbu;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = draftCollection.mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = draftCollection.mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = draftCollection.mcbuReturnNo;
                        collection.mcbuReturnAmt = draftCollection.mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.transfer = draftCollection.transfer;
                        collection.transferred = draftCollection.transferred;

                        if (collection.transferred > 0) {
                            collection.transfer = collection.transfer - collection.transferred;
                        }
    
                        excess += draftCollection.excess;
                        totalLoanCollection += draftCollection.collection;
                        mispayment += draftCollection.mispayment;
                        // targetLoanCollection = targetLoanCollection - draftCollection.loanTarget;
                        // totalMcbu += collection.mcbu;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    } else if (branch.cashCollections.length > 0) {
                        const loanTarget = collection.loanTarget - branch.cashCollections[0].loanTarget;

                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                        collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                        collection.mispaymentStr = branch.cashCollections[0].mispayment > 0 ? branch.cashCollections[0].mispayment : '-';
                        collection.mcbu = branch.cashCollections[0].mcbu;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = branch.cashCollections[0].mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo;
                        collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.transfer = branch.cashCollections[0].transfer;
                        collection.transferred = branch.cashCollections[0].transferred;

                        if (collection.transferred > 0) {
                            collection.transfer = collection.transfer - collection.transferred;
                        }
    
                        excess += branch.cashCollections[0].excess;
                        totalLoanCollection += branch.cashCollections[0].collection;
                        mispayment += branch.cashCollections[0].mispayment;
                        // targetLoanCollection = targetLoanCollection - branch.cashCollections[0].loanTarget;
                        // totalMcbu += collection.mcbu;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
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
                    }
                } else {
                    if (branch.cashCollections.length > 0) {
                        collection.activeClients = branch.cashCollections[0].activeClients; 
                        collection.activeBorrowers = branch.cashCollections[0].activeBorrowers;
                        collection.pendingClients = branch.cashCollections[0].pendingClients;

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
                        collection.status = groupStatus;

                        collection.transfer = branch.cashCollections[0].transfer;
                        collection.transferred = branch.cashCollections[0].transferred;

                        if (collection.transferred > 0) {
                            collection.transfer = collection.transfer - collection.transferred;
                        }
    
                        noOfClients += branch.cashCollections[0].activeClients;
                        noOfBorrowers += branch.cashCollections[0].activeBorrowers;
                        noOfPendings += branch.cashCollections[0].pendingClients;
                        totalsLoanRelease += branch.cashCollections[0].totalRelease;
                        totalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                        // targetLoanCollection += branch.cashCollections[0].loanTarget;
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
                        // totalMcbu += collection.mcbu ? collection.mcbu : 0;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    }
                }

                collectionData.push(collection);
            });

            collectionData.map(c => {
                totalMcbu += c.mcbu ? c.mcbu : 0;
                targetLoanCollection += (c.loanTarget && c.loanTarget !== '-') ? c.loanTarget : 0;
            });

            const branchTotals = {
                name: 'TOTALS',
                transfer: totalTransfer,
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                pendingClients: noOfPendings,
                totalReleasesStr: formatPricePhp(totalsLoanRelease),
                totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
                loanTargetStr: targetLoanCollection > 0 ? formatPricePhp(targetLoanCollection) : 0,
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
            
            dispatch(setCashCollectionBranch(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const [columns, setColumns] = useState();

    const handleRowClick = (selected) => {
        if (!selected?.totalData) {
            router.push(`/transactions/branch-manager/cash-collection/users/${selected._id}`);
            localStorage.setItem('selectedBranch', selected._id);
        }
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
                },
                {
                    Header: "PND",
                    accessor: 'pendingClients'
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
                    Header: "MCBU Refund",
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
                },
                {
                    Header: "PND",
                    accessor: 'pendingClients'
                },
                {
                    Header: "TFR",
                    accessor: 'transfer'
                }
            ];
        }

        setColumns(cols);
    }, []);

    useEffect(() => {
        let mounted = true;
        
        if (dateFilter) {
            const date = moment(dateFilter).format('YYYY-MM-DD');
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
    }, [dateFilter, selectedBranchGroup]);
    

    return (
        <React.Fragment>
            {loading ?
                (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : <TableComponent columns={columns} data={branchCollectionData} hasActionButtons={false} rowActionButtons={false} showFilters={false} showPagination={false} pageSize={100} rowClick={handleRowClick} />}
        </React.Fragment>
    );
}

export default ViewByBranchPage;