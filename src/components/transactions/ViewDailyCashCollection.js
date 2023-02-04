import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import moment from 'moment';
import { setCashCollectionList, setGroupSummaryTotals, setLoSummary } from "@/redux/actions/cashCollectionActions";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import { BehaviorSubject } from 'rxjs';

const ViewDailyCashCollectionPage = ({ pageNo, dateFilter }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const [loading, setLoading] = useState(true);

    const getCashCollections = async (selectedLO, dateFilter) => {
        setLoading(true);
        const filter = dateFilter ? true : false;

        let url = process.env.NEXT_PUBLIC_API_URL + 
            'transactions/cash-collections/get-all-loans-per-group?' 
            + new URLSearchParams({ 
                    date: dateFilter ? dateFilter : currentDate,
                    mode: 'daily', 
                    loId: selectedLO ? selectedLO : currentUser._id
                });

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
            let totalPastDue = 0;
            let totalNoPastDue = 0;
            let totalNoPaidPastDue = 0;
            let mispayment = 0;
            let offsetPerson = 0;

            let selectedBranch;
            response.data && response.data.map(cc => {
                let collection = {
                    groupId: cc._id,
                    group: cc.name,
                    noOfClients: cc.noOfClients,
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
                    pastDueStr: '-',
                    noPastDue: '-',
                    noOfFullPayment: '-',
                    offSetPerson: '-',
                    status: '-'
                };
                selectedBranch = cc.branchId;
                let noCurrentRelease = '0 / 0';
                if (!filter) {
                    if (cc.loans.length > 0) {
                        collection = {
                            groupId: cc._id,
                            group: cc.name,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: 0,
                            reCurrentRelease: 0,
                            currentReleaseAmount: 0,
                            currentReleaseAmountStr: 0,
                            // noOfPaidClients: 0,
                            activeClients: 0,
                            activeBorrowers: 0,
                            mispayment: collection.mispayment,
                            loanTarget: cc.loans[0].loanTarget && cc.loans[0].loanTarget,
                            loanTargetStr: cc.loans[0].loanTarget ? formatPricePhp(cc.loans[0].loanTarget) : 0,
                            collection: cc.loans[0].collection && cc.loans[0].collection,
                            collectionStr: cc.loans[0].collection ? formatPricePhp(cc.loans[0].collection) : 0,
                            excess: cc.loans[0].excess && cc.loans[0].excess,
                            excessStr: cc.loans[0].excess ? formatPricePhp(cc.loans[0].excess) : 0,
                            total: cc.loans[0].total,
                            totalStr: formatPricePhp(cc.loans[0].total),
                            totalReleases: cc.loans[0].totalRelease && cc.loans[0].totalRelease,
                            totalReleasesStr: cc.loans[0].totalRelease ? formatPricePhp(cc.loans[0].totalRelease) : 0,
                            totalLoanBalance: cc.loans[0].totalLoanBalance && cc.loans[0].totalLoanBalance,
                            totalLoanBalanceStr: cc.loans[0].totalLoanBalance ? formatPricePhp(cc.loans[0].totalLoanBalance) : 0,
                            fullPaymentAmount: 0,
                            fullPaymentAmountStr: 0,
                            noOfFullPayment: 0,
                            newFullPayment: 0,
                            reFullPayment: 0,
                            pastDue: cc.loans[0].pastDue,
                            pastDueStr: cc.loans[0].pastDue > 0 ? formatPricePhp(cc.loans[0].pastDue) : '-',
                            noPastDue: '-',
                            status: cc.groupCashCollections.length > 0 ? cc.groupCashCollections[0].status : 'No Saved Transaction',
                            page: 'collection'
                        };
    
                        totalsLoanRelease += cc.loans[0].totalRelease ? cc.loans[0].totalRelease : 0;
                        totalsLoanBalance += cc.loans[0].totalLoanBalance ? cc.loans[0].totalLoanBalance : 0;
                        targetLoanCollection += cc.loans[0].loanTarget ? cc.loans[0].loanTarget : 0;
                        totalPastDue += cc.loans[0].pastDue;
                    } 
    
                    if (cc.activeLoans.length > 0) {
                        collection = {
                            ...collection,
                            activeClients: cc.activeLoans[0].activeClients,
                            activeBorrowers: cc.activeLoans[0].activeBorrowers
                        }
    
                        noOfClients += cc.activeLoans[0].activeClients ? cc.activeLoans[0].activeClients : 0;
                        noOfBorrowers += cc.activeLoans[0].activeBorrowers ? cc.activeLoans[0].activeBorrowers : 0;
                    }
                    
                    if (cc.cashCollections.length > 0) {
                        // subtract the delinquent loan target from here...
                        const loanTarget = collection.loanTarget - cc.cashCollections[0].loanTarget;
                        collection = { ...collection,
                            mispayment: cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0,
                            collection: cc.cashCollections[0].collection && cc.cashCollections[0].collection,
                            collectionStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : 0,
                            excess: cc.cashCollections[0].excess && cc.cashCollections[0].excess,
                            excessStr: cc.cashCollections[0].excess ? formatPricePhp(cc.cashCollections[0].excess) : 0,
                            loanTarget: loanTarget,
                            loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : 0,
                            // pastDue: cc.cashCollections[0].pastDue ? cc.cashCollections[0].pastDue : 0,
                            // pastDueStr: cc.cashCollections[0].pastDue ? formatPricePhp(cc.cashCollections[0].pastDue) : 0,
                            noPastDue: cc.cashCollections[0].noPastDue ? cc.cashCollections[0].noPastDue : 0,
                            noPaidPastDue: cc.cashCollections[0].noPaidPastDue ? cc.cashCollections[0].noPaidPastDue : 0,
                            offsetPerson: cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0
                            // total: cc.cashCollections[0].collection && cc.cashCollections[0].collection,
                            // totalStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : 0
                        };
                        excess += cc.cashCollections[0].excess ? cc.cashCollections[0].excess : 0;
                        totalLoanCollection += cc.cashCollections[0].collection ? cc.cashCollections[0].collection : 0;
                        mispayment += cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0;
                        targetLoanCollection = targetLoanCollection - cc.cashCollections[0].loanTarget;
                        // totalPastDue += cc.cashCollections[0].pastDue ? cc.cashCollections[0].pastDue : 0;
                        totalNoPastDue += cc.cashCollections[0].noPastDue ? cc.cashCollections[0].noPastDue : 0;
                        totalNoPaidPastDue += cc.cashCollections[0].noPaidPastDue ? cc.cashCollections[0].noPaidPastDue : 0;
                        offsetPerson += cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0;
                    }
    
                    if (cc.currentRelease.length > 0) {
                        noCurrentRelease = cc.currentRelease[0].newCurrentRelease + ' / ' + cc.currentRelease[0].reCurrentRelease;
                        collection = {
                            ...collection,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0,
                            reCurrentRelease: cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0,
                            currentReleaseAmount: cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0,
                            currentReleaseAmountStr: cc.currentRelease[0].currentReleaseAmount ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : 0,
                            status: cc.groupCashCollections.length > 0 ? cc.groupCashCollections[0].status : 'No Saved Transaction',
                        };
    
                        noOfNewCurrentRelease += cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0;
                        noOfReCurrentRelease += cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0;
                        currentReleaseAmount += cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0;
                    }
    
                    if (cc.fullPayment.length > 0) {
                        // noOfFullPayment = cc.fullPayment[0].newFullPayment + ' / ' + cc.fullPayment[0].reFullPayment;
    
                        collection = {
                            ...collection,
                            fullPaymentAmount: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentAmountStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : 0,
                            noOfFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].noOfFullPayment : 0,
                            newFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].newFullPayment : 0,
                            reFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].reFullPayment : 0,
                            status: cc.groupCashCollections.length > 0 ? cc.groupCashCollections[0].status : 'No Saved Transaction',
                        };
    
                        fullPaymentAmount += cc.fullPayment[0].fullPaymentAmount ? cc.fullPayment[0].fullPaymentAmount : 0;
                        noOfFullPayment += cc.fullPayment[0].noOfFullPayment ? cc.fullPayment[0].noOfFullPayment : 0;
                    }
                } else {
                    if (cc.cashCollections.length > 0) {
                        noCurrentRelease = cc.cashCollections[0].newCurrentRelease + ' / ' + cc.cashCollections[0].reCurrentRelease;
                        collection = {
                            groupId: cc._id,
                            group: cc.name,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: cc.cashCollections[0].newCurrentRelease,
                            reCurrentRelease: cc.cashCollections[0].reCurrentRelease,
                            currentReleaseAmount: cc.cashCollections[0].currentReleaseAmount,
                            currentReleaseAmountStr: formatPricePhp(cc.cashCollections[0].currentReleaseAmount),
                            activeClients: cc.cashCollections[0].activeClients,
                            activeBorrowers: cc.cashCollections[0].activeBorrowers,
                            mispayment: cc.cashCollections[0].mispayment,
                            collection: cc.cashCollections[0].collection,
                            collectionStr: formatPricePhp(cc.cashCollections[0].collection),
                            excess: cc.cashCollections[0].excess,
                            excessStr: formatPricePhp(cc.cashCollections[0].excess),
                            loanTarget: cc.cashCollections[0].loanTarget,
                            loanTargetStr: formatPricePhp(cc.cashCollections[0].loanTarget),
                            pastDue: cc.cashCollections[0].pastDue,
                            pastDueStr: formatPricePhp(cc.cashCollections[0].pastDue),
                            noPastDue: cc.cashCollections[0].noPastDue,
                            noPaidPastDue: cc.cashCollections[0].noPaidPastDue,
                            totalReleases: cc.cashCollections[0].totalRelease,
                            totalReleasesStr: formatPricePhp(cc.cashCollections[0].totalRelease),
                            totalLoanBalance: cc.cashCollections[0].totalLoanBalance,
                            totalLoanBalanceStr: formatPricePhp(cc.cashCollections[0].totalLoanBalance),
                            fullPaymentAmount: cc.cashCollections[0].fullPaymentAmount,
                            fullPaymentAmountStr: formatPricePhp(cc.cashCollections[0].fullPaymentAmount),
                            noOfFullPayment: cc.cashCollections[0].noOfFullPayment,
                            newFullPayment: cc.cashCollections[0].newFullPayment,
                            reFullPayment: cc.cashCollections[0].reFullPayment,
                            status: '',
                            page: 'collection'
                        };
    
                        noOfNewCurrentRelease += cc.cashCollections[0].newCurrentRelease;
                        noOfReCurrentRelease += cc.cashCollections[0].reCurrentRelease;
                        currentReleaseAmount += cc.cashCollections[0].currentReleaseAmount;
                        noOfClients += cc.cashCollections[0].activeClients;
                        noOfBorrowers += cc.cashCollections[0].activeBorrowers;
                        excess += cc.cashCollections[0].excess;
                        totalLoanCollection += cc.cashCollections[0].collection;
                        mispayment += cc.cashCollections[0].mispayment;
                        totalPastDue += cc.cashCollections[0].pastDue;
                        totalNoPastDue += cc.cashCollections[0].noPastDue;
                        totalNoPaidPastDue += cc.cashCollections[0].noPaidPastDue;
                        totalsLoanRelease += cc.cashCollections[0].totalRelease;
                        totalsLoanBalance += cc.cashCollections[0].totalLoanBalance;
                        targetLoanCollection += cc.cashCollections[0].loanTarget;
                        fullPaymentAmount += cc.cashCollections[0].fullPaymentAmount;
                        noOfFullPayment += cc.cashCollections[0].noOfFullPayment;
                    } 
                }

                collectionData.push(collection);
            });
            
            const totals = {
                group: 'TOTALS',
                transfer: 0,
                noOfNewCurrentRelease: noOfNewCurrentRelease,
                noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmount: currentReleaseAmount,
                currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                totalLoanRelease: totalsLoanRelease,
                totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
                totalLoanBalance: totalsLoanBalance,
                totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
                targetLoanCollection: targetLoanCollection,
                loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
                excess: excess,
                excessStr: excess ? formatPricePhp(excess) : 0,
                collection: totalLoanCollection,
                collectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
                mispayment: mispayment,
                mispayment: mispayment + ' / ' + noOfClients,
                fullPaymentAmount: fullPaymentAmount,
                fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
                noOfFullPayment: noOfFullPayment,
                pastDue: totalPastDue,
                pastDueStr: formatPricePhp(totalPastDue),
                noPastDue: totalNoPastDue,
                noPaidPastDue: totalNoPaidPastDue,
                offsetPerson: offsetPerson,
                totalData: true,
                status: '-'
            }

            collectionData.push(totals);
            dispatch(setGroupSummaryTotals(totals));
            const dailyLos = {...createLos(totals, selectedBranch, selectedLO, dateFilter, false), losType: 'daily'};
            dispatch(setLoSummary(dailyLos));
            const currentMonth = moment().month();
            if (!filter && currentMonth === 12) {
                saveYearEndLos(totals, selectedBranch, true);
            }
            
            dispatch(setCashCollectionList(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const createLos = (totals, selectedBranch, selectedLO, dateFilter, yearEnd) => {
        let grandTotal;

        if (yearEnd) {
            grandTotal = {
                day: 'Year End',
                transfer: 0,
                newMember: 0,
                offsetPerson: 0,
                activeClients: totals.activeClients,
                loanReleasePerson: 0,
                loanReleaseAmount: 0,
                activeLoanReleasePerson: totals.activeBorrowers,
                activeLoanReleaseAmount: totals.totalLoanRelease,
                collectionAdvancePayment: totals.totalLoanRelease - totals.totalLoanBalance,//totals.excess + totals.targetLoanCollection + totals.pastDue - (totals.totalLoanRelease - totals.totalLoanBalance),
                collectionActual: totals.totalLoanRelease - totals.totalLoanBalance,
                pastDuePerson: 0,
                pastDueAmount: 0,
                fullPaymentPerson: 0,
                fullPaymentAmount: 0,
                activeBorrowers: totals.activeBorrowers,
                loanBalance: totals.totalLoanBalance
            };
        } else {
            let selectedDate = currentDate;
            if (dateFilter) {
                if (dateFilter !== currentDate) {
                    selectedDate = dateFilter;
                }
            }

            grandTotal = {
                day: selectedDate,
                transfer: totals.transfer,
                newMember: totals.noOfNewCurrentRelease,
                offsetPerson: totals.offsetPerson,
                activeClients: totals.activeClients,
                loanReleasePerson: totals.noCurrentRelease,
                loanReleaseAmount: totals.currentReleaseAmount,
                activeLoanReleasePerson: totals.activeBorrowers,
                activeLoanReleaseAmount: totals.totalLoanRelease,
                collectionTarget: totals.targetLoanCollection,
                collectionAdvancePayment: totals.excess,
                collectionActual: totals.collection,
                pastDuePerson: totals.noPastDue,
                pastDueAmount: totals.pastDue,
                fullPaymentPerson: totals.noOfFullPayment,
                fullPaymentAmount: totals.fullPaymentAmount,
                activeBorrowers: totals.activeBorrowers,
                loanBalance: totals.totalLoanBalance
            };
        }

        let month = yearEnd ? 12 : moment().month() + 1;
        let year = yearEnd ? moment().year() - 1 : moment().year();
        if (dateFilter)  {
            month = moment(dateFilter).month() + 1;
            year = moment(dateFilter).year();
        }

        return {
            userId: selectedLO ? selectedLO : currentUser._id,
            userType: 'lo',
            branchId: selectedBranch,
            month: month,
            year: year,
            data: grandTotal
        }
    }

    const saveYearEndLos = async (totals, selectedBranch, yearEnd) => {
        if (currentUser.role.rep === 4) {
            const losTotals = {...createLos(totals, selectedBranch, null, null, yearEnd), losType: 'year-end'};
    
            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loan-officer-summary/save-update-totals', losTotals);
        }
    }

    const handleRowClick = (selected) => {
        if (!selected.totalData) {
            if (pageNo === 1) {
                router.push('./daily-cash-collection/client/' + selected.groupId);
            } else if (pageNo === 2) {
                router.push('/transactions/daily-cash-collection/client/' + selected.groupId);
            }
            
            localStorage.setItem('cashCollectionDateFilter', dateFilter);
        } else {
            if (selected.group !== 'TOTALS') {
                toast.error('No loans on this group yet.')
            }
        }
    };

    const columns = [
        {
            Header: "Group",
            accessor: 'group',
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
            accessor: 'collectionStr',
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
            Header: "Save Status",
            accessor: 'status',
            Cell: StatusPill,
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        // to be implemented
        // {
        //     Header: "Remakrs",
        //     accessor: 'remarks',
        //     Filter: SelectColumnFilter,
        //     filter: 'includes'
        // }
    ];


    useEffect(() => {
        let mounted = true;
        localStorage.removeItem('cashCollectionDateFilter');
        // const checkAndUpdateLoanStatus = async () => {
        //     const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/check-loan-payment');
        //     if (response.success) {
        //         // nothing to do here...
        //     } else {
        //         toast.error('Error updating current loan status.');
        //     }

        //     setLoading(false);
        // }

        // if (branchList) {
        //     if (currentUser.role.rep < 4 && selectedLOSubject.value.length > 0) {
        //         mounted && getCashCollections(selectedLOSubject.value);
        //     } else {
        //         mounted && getCashCollections();
        //     }
        // }
        

        if (dateFilter) {
            const date = moment(dateFilter).format('YYYY-MM-DD');
            if (date !== currentDate) {
                if (currentUser.role.rep < 4 && selectedLOSubject.value.length > 0) {
                    mounted && getCashCollections(selectedLOSubject.value, date);
                } else {
                    mounted && getCashCollections(null, date);
                }
            } else {
                if (currentUser.role.rep < 4 && selectedLOSubject.value.length > 0) {
                    mounted && getCashCollections(selectedLOSubject.value, null);
                } else {
                    mounted && getCashCollections();
                }
            }
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter]);

    useEffect(() => {
        const initGroupCollectionSummary = async () => {
            const data = {
                _id: currentUser.role.rep === 4 ? currentUser._id : selectedLOSubject.value.length > 0 && selectedLOSubject.value,
                mode: 'daily',
                status: 'pending',
                currentUser: currentUser._id,
                groupSummaryIds: []
            };

            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary', data);
        }

        initGroupCollectionSummary();
    }, []);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={cashCollectionList} showPagination={false} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewDailyCashCollectionPage;