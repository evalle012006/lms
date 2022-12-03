import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { formatPricePhp, getTotal } from "@/lib/utils";
import { toast } from 'react-hot-toast';

const ViewByLoanOfficerPage = ({ dateFilter }) => {
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
        if (selected && selected.hasOwnProperty('_id')) {
            localStorage.setItem('selectedLO', selected._id);
            router.push('./daily-cash-collection/group/' + selected._id);
        }
    };

    const getGroupCashCollections = async (selectedBranch, date) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-group?' + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily', branchCode: selectedBranch ? selectedBranch : branchFilter });
        
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
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    groupSummaryIds: [],
                    page: 'loan-officer-summary'
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

                    if (group.groupCashCollections.length > 0) {
                        collection.groupSummaryIds.push({ _id: group.groupCashCollections[0]._id, groupId: group._id, status: group.groupCashCollections[0].status });
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
                    noOfFullPayment: noOfFullPayment,
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
            // let totalNoOfNewfullPayment = getTotal(collectionData, 'activeBorrowers');
            // let totalNoOfRefullPayment = getTotal(collectionData, 'activeBorrowers');
            let totalFullPaymentAmount = getTotal(collectionData, 'fullPaymentAmount');
            let totalMispayment = getTotal(collectionData, 'mispayment');

            const loTotals = {
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
        if (branchList) {
            if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
                const currentBranch = branchList.find(b => b.code === currentUser.designatedBranch);
                mounted && setBranchFilter(currentBranch.code);
                
                if (dateFilter) {
                    const date = moment(dateFilter).format('YYYY-MM-DD');
                    if (date !== currentDate) {
                        mounted && getGroupCashCollections(currentBranch.code, date);
                    } else {
                        mounted && getGroupCashCollections(currentBranch.code);
                    }
                } else {
                    mounted && getGroupCashCollections(currentBranch.code);
                }
            }
            
            setLoading(false);
        }

        return () => {
            mounted = false;
        };
    }, [currentUser, branchList, dateFilter]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={userLOList} showFilters={false} hasActionButtons={true} rowActionButtons={rowActionButtons} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;