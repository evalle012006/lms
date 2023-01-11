import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import moment from 'moment';
import { setCashCollectionList } from "@/redux/actions/cashCollectionActions";
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
            let mispayment = 0;

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
                    status: '-'
                };

                // if (cc.cashCollectionPerGroup.length > 0) {
                //     const ccGroup = cc.cashCollectionPerGroup[0];
                //     collection = {
                //         ...collection,
                //         ...ccGroup,
                //         currentReleaseAmountStr: formatPricePhp(ccGroup.currentReleaseAmount),
                //         excessStr: formatPricePhp(ccGroup.excess),
                //         totalReleasesStr: formatPricePhp(ccGroup.amountRelease),
                //         totalLoanBalanceStr: formatPricePhp(ccGroup.loanBalance),
                //         loanTargetStr: formatPricePhp(ccGroup.targetCollection),
                //         collectionStr: formatPricePhp(ccGroup.paymentCollection),
                //         mispayment: ccGroup.mispaymentStr,
                //         fullPaymentAmountStr: formatPricePhp(ccGroup.fullPayment),
                //         status: cc.groupCashCollections.length > 0 ? cc.groupCashCollections[0].status : 'No Saved Transaction',
                //     }
                // } 
                let noCurrentRelease = '0 / 0';
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
                        pastDue: 0,
                        pastDueStr: '-',
                        noPastDue: '-',
                        status: cc.groupCashCollections.length > 0 ? cc.groupCashCollections[0].status : 'No Saved Transaction',
                        page: 'collection'
                    };

                    totalsLoanRelease += cc.loans[0].totalRelease ? cc.loans[0].totalRelease : 0;
                    totalsLoanBalance += cc.loans[0].totalLoanBalance ? cc.loans[0].totalLoanBalance : 0;
                    targetLoanCollection += cc.loans[0].loanTarget ? cc.loans[0].loanTarget : 0;
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
                        pastDue: cc.cashCollections[0].pastDue ? cc.cashCollections[0].pastDue : 0,
                        pastDueStr: cc.cashCollections[0].pastDue ? formatPricePhp(cc.cashCollections[0].pastDue) : 0,
                        noPastDue: cc.cashCollections[0].noPastDue ? cc.cashCollections[0].noPastDue : 0
                        // total: cc.cashCollections[0].collection && cc.cashCollections[0].collection,
                        // totalStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : 0
                    };
                    excess += cc.cashCollections[0].excess ? cc.cashCollections[0].excess : 0;
                    totalLoanCollection += cc.cashCollections[0].collection ? cc.cashCollections[0].collection : 0;
                    mispayment += cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0;
                    targetLoanCollection = targetLoanCollection - cc.cashCollections[0].loanTarget;
                    totalPastDue += cc.cashCollections[0].pastDue ? cc.cashCollections[0].pastDue : 0;
                    totalNoPastDue += cc.cashCollections[0].noPastDue ? cc.cashCollections[0].noPastDue : 0;
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

                collectionData.push(collection);
            });
            
            const totals = {
                group: 'TOTALS',
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
                totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
                loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
                excessStr: excess ? formatPricePhp(excess) : 0,
                collectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
                mispayment: mispayment + ' / ' + noOfClients,
                fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
                noOfFullPayment: noOfFullPayment,
                pastDueStr: formatPricePhp(totalPastDue),
                noPastDue: totalNoPastDue,
                totalData: true,
                status: '-'
            }

            collectionData.push(totals);

            dispatch(setCashCollectionList(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
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

    // useEffect(() => {
    //     if (cashCollectionList) {
    //         const saveTotals = async () => {
    //             let totalData = cashCollectionList.find(c => c.group === "TOTALS");

    //             if (totalData) {
    //                 totalData = {
    //                     ...totalData,
    //                     loId: currentUser.role.rep === 4 ? currentUser._id : selectedLOSubject.value.length > 0 && selectedLOSubject.value
    //                 }

    //                 await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-totals', totalData);                
    //             }
    //         }

    //         saveTotals();
    //     }
    // }, [cashCollectionList]);

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