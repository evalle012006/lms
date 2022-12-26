import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { formatPricePhp, getTotal } from "@/lib/utils";
import { toast } from 'react-hot-toast';
import { BehaviorSubject } from 'rxjs';

const ViewByLoanOfficerPage = ({ pageNo, dateFilter }) => {
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [userLOList, setUserLOList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
   
    const router = useRouter();

    const handleRowClick = (selected) => {
        if (selected && selected.hasOwnProperty('_id')) {
            localStorage.setItem('selectedLO', selected._id);

            if (pageNo === 1) {
                router.push('./daily-cash-collection/group/' + selected._id);
            } else if (pageNo === 2) {
                router.push('/transactions/daily-cash-collection/group/' + selected._id);
            }
        }
    };

    const getGroupCashCollections = async (selectedBranch, date) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-group?' + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily', branchCode: selectedBranch });
        
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
            // let noOfNewfullPayment = 0;
            // let noOfRefullPayment = 0;
            let fullPaymentAmount = 0;
            let mispayment = 0;

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
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    groupSummaryIds: [],
                    page: 'loan-officer-summary',
                    status: '-'
                };

                if (lo.activeLoans.length > 0) {
                    collection.activeClients = lo.activeLoans[0].activeClients; 
                    collection.activeBorrowers = lo.activeLoans[0].activeBorrowers;
                    noOfClients += lo.activeLoans[0].activeClients;
                    noOfBorrowers += lo.activeLoans[0].activeBorrowers;
                }

                if (lo.loans.length > 0) {
                    collection.totalReleasesStr = formatPricePhp(lo.loans[0].totalRelease);
                    collection.totalLoanBalanceStr = formatPricePhp(lo.loans[0].totalLoanBalance);
                    collection.loanTargetStr = formatPricePhp(lo.loans[0].loanTarget);

                    totalsLoanRelease += lo.loans[0].totalRelease;
                    totalsLoanBalance += lo.loans[0].totalLoanBalance;
                    targetLoanCollection += lo.loans[0].loanTarget;
                }

                if (lo.groupCashCollections.length > 0) {
                    collection.groupSummaryIds.push.apply(collection.groupSummaryIds, lo.groupCashCollections[0].groupSummaryIds);
                    collection.status = lo.groupCashCollections[0].statusArr.find(s => s === 'pending') === 'pending' ? 'open' : 'close';
                }
                
                if (lo.cashCollections.length > 0) {
                    collection.excessStr = formatPricePhp(lo.cashCollections[0].excess);
                    collection.totalStr = formatPricePhp(lo.cashCollections[0].collection);
                    collection.mispaymentStr = lo.cashCollections[0].mispayment;

                    excess += lo.cashCollections[0].excess;
                    totalLoanCollection += lo.cashCollections[0].collection;
                    mispayment += lo.cashCollections[0].mispayment;
                }

                if (lo.currentRelease.length > 0) {
                    const newReleasePerson = lo.currentRelease[0].newCurrentRelease ? lo.currentRelease[0].newCurrentRelease : 0;
                    const reReleasePerson = lo.currentRelease[0].reCurrentRelease ? lo.currentRelease[0].reCurrentRelease : 0;
                    collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                    collection.currentReleaseAmountStr = formatPricePhp(lo.currentRelease[0].currentReleaseAmount);

                    noOfNewCurrentRelease += lo.currentRelease[0].newCurrentRelease;
                    noOfReCurrentRelease += lo.currentRelease[0].reCurrentRelease;
                    currentReleaseAmount += lo.currentRelease[0].currentReleaseAmount;
                }

                if (lo.fullPayment.length > 0) {
                    collection.noOfFullPayment = lo.fullPayment[0].noOfFullPayment;
                    collection.fullPaymentAmountStr = formatPricePhp(lo.fullPayment[0].fullPaymentAmount);

                    fullPaymentAmount += lo.fullPayment[0].fullPaymentAmount;
                    noOfFullPayment += lo.fullPayment[0].noOfFullPayment;
                    // noOfNewfullPayment += lo.fullPayment[0].newFullPayment;
                    // noOfRefullPayment += lo.fullPayment[0].reFullPayment;
                }

                collectionData.push(collection);
            });
            // response.data && response.data.map(lo => {
            //     let collection = {
            //         _id: lo._id,
            //         name: `${lo.firstName} ${lo.lastName}`,
            //         noCurrentReleaseStr: '-',
            //         currentReleaseAmountStr: '-',
            //         activeClients: '-',
            //         activeBorrowers: '-',
            //         totalReleasesStr: '-',
            //         totalLoanBalanceStr: '-',
            //         loanTargetStr: '-',
            //         excessStr: '-',
            //         totalStr: '-',
            //         mispaymentStr: '-',
            //         fullPaymentAmountStr: '-',
            //         noOfFullPayment: '-',
            //         groupSummaryIds: [],
            //         page: 'loan-officer-summary',
            //         status: '-'
            //     };

            //     let noOfClients = 0;
            //     let noOfBorrowers = 0;
            //     let totalsLoanRelease = 0;
            //     let totalsLoanBalance = 0;
            //     let noOfNewCurrentRelease = 0;
            //     let noOfReCurrentRelease = 0;
            //     let currentReleaseAmount = 0;
            //     let targetLoanCollection = 0;
            //     let excess = 0;
            //     let totalLoanCollection = 0;
            //     let noOfFullPayment = 0;
            //     let noOfNewfullPayment = 0;
            //     let noOfRefullPayment = 0;
            //     let fullPaymentAmount = 0;
            //     let mispayment = 0;
            //     let statusArr = [];

            //     lo.groups.map(group => {
            //         if (group.loans.length > 0) {
            //             noOfClients += group.loans[0].activeClients;
            //             noOfBorrowers += group.loans[0].activeBorrowers;
            //             totalsLoanRelease += group.loans[0].totalRelease;
            //             totalsLoanBalance += group.loans[0].totalLoanBalance;
            //             targetLoanCollection += group.loans[0].loanTarget;
            //         }

            //         if (group.groupCashCollections.length > 0) {
            //             collection.groupSummaryIds.push({ _id: group.groupCashCollections[0]._id, groupId: group._id, status: group.groupCashCollections[0].status });
            //             statusArr.push(group.groupCashCollections[0].status);
            //         }
                    
            //         if (group.cashCollections.length > 0) {
            //             excess += group.cashCollections[0].excess;
            //             totalLoanCollection += group.cashCollections[0].collection;
            //             mispayment += group.cashCollections[0].mispayment;
            //         }

            //         if (group.currentRelease.length > 0) {
            //             noOfNewCurrentRelease += group.currentRelease[0].newCurrentRelease;
            //             noOfReCurrentRelease += group.currentRelease[0].reCurrentRelease;
            //             currentReleaseAmount += group.currentRelease[0].currentReleaseAmount;
            //         }

            //         if (group.fullPayment.length > 0) {
            //             fullPaymentAmount += group.fullPayment[0].fullPaymentAmount;
            //             noOfFullPayment += group.fullPayment[0].noOfFullPayment;
            //             noOfNewfullPayment += group.fullPayment[0].newFullPayment;
            //             noOfRefullPayment += group.fullPayment[0].reFullPayment;
            //         }
            //     });

            //     const status = statusArr.find(s => s === 'pending') === 'pending' ? 'open' : 'close';

            //     collection = {
            //         ...collection,
            //         noOfNewCurrentRelease: noOfNewCurrentRelease,
            //         noOfReCurrentRelease: noOfReCurrentRelease,
            //         noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
            //         currentReleaseAmount: currentReleaseAmount,
            //         currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
            //         activeClients: noOfClients,
            //         activeBorrowers: noOfBorrowers,
            //         totalReleases: totalsLoanRelease,
            //         totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
            //         totalLoanBalance: totalsLoanBalance,
            //         totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
            //         loanTarget: targetLoanCollection,
            //         loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
            //         excess: excess,
            //         excessStr: excess ? formatPricePhp(excess) : 0,
            //         total: totalLoanCollection,
            //         totalStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
            //         mispayment: mispayment,
            //         mispaymentStr: mispayment + ' / ' + noOfClients,
            //         fullPaymentAmount: fullPaymentAmount,
            //         fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
            //         noOfFullPayment: noOfFullPayment,
            //         status: status
            //     }

            //     collectionData.push(collection);
            // });

            // totals
            const loTotals = {
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
                totalData: true
            };

            collectionData.push(loTotals);
            
            setUserLOList(collectionData);
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    
    const handleOpen = async (row) => {
        if (row.original.activeClients !== 0) {
            setLoading(true);
            delete row.original.page;
            delete row.original.noCurrentReleaseStr;
            delete row.original.currentReleaseAmountStr;
            delete row.original.loanTargetStr;
            delete row.original.collectionStr;
            delete row.original.excessStr;
            delete row.original.totalStr;
            delete row.original.totalReleasesStr;
            delete row.original.totalLoanBalanceStr;
            delete row.original.fullPaymentAmountStr;
            delete row.original.noFullPaymentStr;

            let data = {
                ...row.original,
                mode: 'daily',
                status: 'pending',
                currentUser: currentUser._id,
            };

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary', data);
            if (response.success) {
                toast.success(`${data.name} groups transactions are now open!`);
                window.location.reload();
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const handleClose = async (row) => {
        if (row.original.activeClients !== 0) {
            setLoading(true);
            delete row.original.page;
            delete row.original.noCurrentReleaseStr;
            delete row.original.currentReleaseAmountStr;
            delete row.original.loanTargetStr;
            delete row.original.collectionStr;
            delete row.original.excessStr;
            delete row.original.totalStr;
            delete row.original.totalReleasesStr;
            delete row.original.totalLoanBalanceStr;
            delete row.original.fullPaymentAmountStr;
            delete row.original.noFullPaymentStr;
            
            let data = {
                ...row.original,
                mode: 'daily',
                status: 'close',
                currentUser: currentUser._id,
            };

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary', data);
            if (response.success) {
                toast.success(`${data.name} groups are now closed!`);
                window.location.reload();
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const [rowActionButtons, setRowActionButtons] = useState();

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
            accessor: 'mispaymentStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ];


    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep < 4) {
            mounted && setRowActionButtons([
                { label: 'Close', action: handleClose},
                { label: 'Open', action: handleOpen}
            ]);
        }
        if (branchList.length > 0) {
            let currentBranch;
            
            if (currentUser.role.rep <= 2 && selectedBranchSubject.value) {
                currentBranch = branchList.find(b => b._id === selectedBranchSubject.value);
            } else {
                currentBranch = branchList.find(b => b.code === currentUser.designatedBranch);
            }

            if (dateFilter && currentBranch) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getGroupCashCollections(currentBranch.code, date);
                } else {
                    mounted && getGroupCashCollections(currentBranch.code);
                }
            } else {
                mounted && getGroupCashCollections(currentBranch.code);
            }
            
            setLoading(false);
        }

        return () => {
            mounted = false;
        };
    }, [branchList, dateFilter]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={userLOList} showPagination={false} showFilters={false} hasActionButtons={true} rowActionButtons={rowActionButtons} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;