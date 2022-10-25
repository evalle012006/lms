import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { setGroupList } from "@/redux/actions/groupActions";
import { formatPricePhp, UppercaseFirstLetter } from "@/lib/utils";
import { setBranchList } from "@/redux/actions/branchActions";
import moment from 'moment';
import { setCashCollectionList } from "@/redux/actions/cashCollectionActions";
import DetailsHeader from "@/components/transactions/DetailsHeaderMain";
import { setUserList } from "@/redux/actions/userActions";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";

const DailyCashCollectionPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const [loading, setLoading] = useState(true);
    const [overallTotals, setOverallTotals] = useState([]);
    const [overallTotalsTitles, setOverallTotalsTitles] = useState([
        'Active Clients',
        'Active Borrowers',
        'Loan Release',
        'Loan Balance',
        'No. Of Current Release Person',
        'Current Release Amount',
        'Target Loan Collection',
        'Excess',
        'Total Loan Collection',
        'No. Of Full Payment Person',
        'Full Payment Amount',
        'Mispayments' // 5/9
    ]);

    const router = useRouter();

    const getListBranch = async () => {
        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        // value: branch._id,
                        // label: UppercaseFirstLetter(branch.name)
                    }
                );
            });

            if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                branches = [branches.find(b => b.code === currentUser.designatedBranch)];
            } 
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getListGroup = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence'
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, occurence: 'daily' });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, occurence: 'daily' });
        } else {
            url = url + '?' + new URLSearchParams({ occurence: 'daily' });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    day: UppercaseFirstLetter(group.day),
                    // value: group._id,
                    // label: UppercaseFirstLetter(group.name)
                });
            });
            dispatch(setGroupList(groups));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const getListUser = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
        if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
        } else if (currentUser.root !== true && currentUser.role.rep === 2 && branchList.length > 0) {
            // url = url + '?' + new URLSearchParams({ branchCode: branchList[0].code });
        }
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name
                        // value: u._id,
                        // label: UppercaseFirstLetter(name)
                    }
                );
            });
            dispatch(setUserList(userList));
        } else {
            toast.error('Error retrieving user list.');
        }

        setLoading(false);
    }

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-group';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', loId: currentUser._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', branchId: branchList[0]._id });
        } else if (currentUser.root !== true && currentUser.role.rep === 2) { // for area manager
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily', areaManagerId: currentUser._id });
        } else { // administrator
            url = url + '?' + new URLSearchParams({ date: currentDate, mode: 'daily' });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];
            response.data && response.data.map(cc => {
                if (cc.groupCashCollections.length > 0) {
                    collectionData.push(cc.groupCashCollections[0]);
                    return false;
                } else {
                    let collection = {
                        groupId: cc._id,
                        group: cc.name,
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
                        mispayments: '-',
                        fullPaymentAmountStr: '-',
                        noFullPaymentStr: '-',
                        status: '-'
                    };

                    if (cc.loans.length > 0) {
                        let noCurrentRelease = '0 / 0';
                        if (cc.currentRelease.length > 0) {
                            noCurrentRelease = cc.currentRelease[0].newCurrentRelease + ' / ' + cc.currentRelease[0].reCurrentRelease;
                        }

                        let noFullPayment = '0 / 0';
                        if (cc.fullPayment.length > 0) {
                            noFullPayment = cc.fullPayment[0].newFullPayment + ' / ' + cc.fullPayment[0].reFullPayment;
                        }

                        collection = {
                            groupId: cc._id,
                            group: cc.name,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: cc.currentRelease.length > 0 ? cc.currentRelease[0].newCurrentRelease : 0,
                            reCurrentRelease: cc.currentRelease.length > 0 ? cc.currentRelease[0].reCurrentRelease : 0,
                            currentReleaseAmount: cc.currentRelease.length > 0 && cc.currentRelease[0].currentReleaseAmount,
                            currentReleaseAmountStr: cc.currentRelease.length > 0 ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : 0,
                            // noOfPaidClients: 0,
                            activeClients: cc.loans[0].activeClients ? cc.loans[0].activeClients : 0,
                            activeBorrowers: cc.loans[0].activeBorrowers ? cc.loans[0].activeBorrowers : 0,
                            mispayments: collection.mispayments,
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
                            fullPaymentAmount: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentAmountStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : 0,
                            noFullPaymentStr: noFullPayment,
                            newFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].newFullPayment : 0,
                            reFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].reFullPayment : 0,
                            status: 'open',
                            page: 'collection'
                        };
                    } else if (cc.cashCollections.length > 0) {
                        // const loanNoOfClients = cc.loans.length > 0 ? cc.loans[0].noOfClients : 0;
                        collection = { ...collection,
                            // groupId: cc._id,
                            // group: cc.name,
                            // noCurrentRelease: cc.currentRelease.length > 0 ? cc.currentRelease[0].noOfCurrentRelease : 0,
                            // currentReleaseAmount: cc.currentRelease.length > 0 && cc.currentRelease[0].currentReleaseAmount,
                            // currentReleaseAmountStr: cc.currentRelease.length > 0 ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : 0,
                            // noOfPaidClients: cc.cashCollections[0].noOfClients ? cc.cashCollections[0].noOfClients : 0,
                            // noOfClients: cc.cashCollections[0].noOfClients ? cc.cashCollections[0].noOfClients + '/' + loanNoOfClients : 0 + '/' + cc.loans[0].noOfClients,
                            mispayments: cc.cashCollections[0].mispayments ? cc.cashCollections[0].mispayments : 0,
                            // loanTarget: cc.cashCollections[0].loanTarget && cc.cashCollections[0].loanTarget,
                            // loanTargetStr: cc.cashCollections[0].loanTarget ? formatPricePhp(cc.cashCollections[0].loanTarget) : 0,
                            collection: cc.cashCollections[0].collection && cc.cashCollections[0].collection,
                            collectionStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : 0,
                            excess: cc.cashCollections[0].excess && cc.cashCollections[0].excess,
                            excessStr: cc.cashCollections[0].excess ? formatPricePhp(cc.cashCollections[0].excess) : 0,
                            total: cc.cashCollections[0].total && cc.cashCollections[0].total,
                            totalStr: cc.cashCollections[0].total ? formatPricePhp(cc.cashCollections[0].total) : 0.00,
                            // totalReleases: cc.loans.length > 0 ? formatPricePhp(cc.loans[0].totalRelease) : 0.00,
                            // totalLoanBalance: cc.loans.length > 0 && cc.loans[0].totalLoanBalance,
                            // totalLoanBalanceStr: cc.loans.length > 0 ? formatPricePhp(cc.loans[0].totalLoanBalance) : 0.00,
                            // fullPaymentAmount: cc.fullPayment.length > 0 && cc.fullPayment[0].fullPaymentAmount,
                            // fullPaymentAmountStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : 0.00,
                            // status: 'open',
                            // page: 'collection'
                        };
                    }

                    collectionData.push(collection);
                }
            });

            let noOfClients = 0;
            let noOfBorrowers = 0;
            let totalLoanRelease = 0;
            let totalLoanBalance = 0;
            // let noOfCurrentRelease = 0;
            let noOfNewCurrentRelease = 0;
            let noOfReCurrentRelease = 0;
            let currentReleaseAmount = 0;
            let targetLoanCollection = 0;
            let excess = 0;
            let totalLoanCollection = 0;
            let noOfNewfullPayment = 0;
            let reOfNewfullPayment = 0;
            let fullPaymentAmount = 0;
            let mispayments = 0;
            
            collectionData.map(cc => {
                if (cc.status !== '-') {
                    noOfClients += cc.activeClients ? cc.activeClients : 0;
                    noOfBorrowers += cc.activeBorrowers ? cc.activeBorrowers : 0;
                    totalLoanRelease += cc.totalReleases ? cc.totalReleases : 0;
                    totalLoanBalance += cc.totalLoanBalance ? cc.totalLoanBalance : 0;
                    // noOfCurrentRelease += cc.noCurrentRelease ? cc.noCurrentRelease : 0;
                    noOfNewCurrentRelease += cc.newCurrentRelease ? cc.newCurrentRelease : 0;
                    noOfReCurrentRelease += cc.reCurrentRelease ? cc.reCurrentRelease : 0;
                    currentReleaseAmount += cc.currentReleaseAmount ? cc.currentReleaseAmount : 0;
                    targetLoanCollection += cc.loanTarget ? cc.loanTarget : 0;
                    excess += cc.excess ? cc.excess : 0;
                    totalLoanCollection += cc.total ? cc.total : 0;
                    fullPaymentAmount += cc.fullPaymentAmount ? cc.fullPaymentAmount : 0;
                    noOfNewfullPayment += cc.newFullPayment ? cc.newFullPayment : 0;
                    reOfNewfullPayment += cc.reFullPayment ? cc.reFullPayment : 0;
                    mispayments += cc.mispayments && cc.mispayments !== '-' ? cc.mispayments : 0;
                }
            });

            setOverallTotals([
                noOfClients,
                noOfBorrowers,
                totalLoanRelease,
                totalLoanBalance,
                noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmount,
                targetLoanCollection,
                excess,
                totalLoanCollection,
                noOfNewfullPayment + ' / ' + reOfNewfullPayment,
                fullPaymentAmount,
                mispayments + ' / ' + noOfClients
            ]);

            dispatch(setCashCollectionList(collectionData));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const handleRowClick = (selected) => {
        if (selected.status !== '-') {
            router.push('./daily-cash-collection/' + selected.groupId);
        } else {
            toast.error('No loans on this group yet.')
        }
    };

    // useEffect(() => {
    //     if ((currentUser.role && currentUser.role.rep !== 1)) {
    //         router.push('/');
    //     }
    // }, []);

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
            accessor: 'totalStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Full Payment Person",
            accessor: 'noFullPaymentStr',
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
            Header: "Mispayments",
            accessor: 'mispayments',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Status",
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

    const handleOpen = async (row) => {
        setLoading(true);
        delete row.original.page;
        let data = { ...row.original, 
            dateAdded: moment(new Date()).format('YYYY-MM-DD'), 
            modifiedBy: currentUser._id, 
            status: 'open',
            loId: currentUser._id,
            branchId: branchList[0]._id
        };
        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary', data);
        if (response.success) {
            toast.success(`${data.group} group is now open!`);
        } else {
            toast.error('Error updating group summary.');
        }

        setLoading(false);
    }

    const handleClose = async (row) => {
        setLoading(true);
        delete row.original.page;
        let data = { ...row.original, 
            dateAdded: moment(new Date()).format('YYYY-MM-DD'), 
            modifiedBy: currentUser._id, 
            status: 'close',
            loId: currentUser._id,
            branchId: branchList[0]._id
        };
        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save-groups-summary', data);
        if (response.success) {
            toast.success(`${data.group} group is now closed!`);
        } else {
            toast.error('Error updating group summary.');
        }

        setLoading(false);
    }

    const [rowActionButtons, setRowActionButtons] = useState([]);


    useEffect(() => {
        let mounted = true;

        const checkAndUpdateLoanStatus = async () => {
            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/check-loan-payment');
            if (response.success) {
                // nothing to do here...
            } else {
                toast.error('Error updating current loan status.');
            }

            setLoading(false);
        }

        if (currentUser.role.rep >= 4) {
            mounted && setRowActionButtons([
                { label: 'Close', action: handleClose}
            ]);
        } else {
            mounted && setRowActionButtons([
                { label: 'Open', action: handleOpen},
                { label: 'Close', action: handleClose}
            ]);
        }
        
        mounted && getListBranch() && checkAndUpdateLoanStatus();

        return () => {
            mounted = false;
        };
    }, [currentUser]);

    useEffect(() => {
        if (branchList) {
            getListGroup();
            getListUser();
            getCashCollections();
        }
    }, [branchList]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <React.Fragment>
                    <div className="overflow-x-auto">
                        <DetailsHeader pageTitle='Daily Cash Collections' mode={'daily'} currentDate={moment(currentDate).format('dddd, MMMM DD, YYYY')} />
                        <div className={`p-4 ${currentUser.role.rep < 4 ? 'mt-[8rem]' : 'mt-[6rem]'} `}>
                            <TableComponent columns={columns} data={cashCollectionList} showFilters={false} hasActionButtons={true} rowActionButtons={rowActionButtons} rowClick={handleRowClick} />
                        </div>
                    </div>
                    <div className="w-11/12 h-18 bg-white border-t-2 border-gray-300 fixed bottom-0 flex">
                        <table className="table-auto border-collapse text-sm font-proxima w-11/12 overflow-auto">
                            <thead className="text-gray-400">
                                <tr className="w-8">
                                    {overallTotalsTitles.map((o, i) => {
                                        return (
                                            <th key={i} className="px-4">
                                                { o }
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="text-base">
                                    {overallTotals.map((o, i) => {
                                        return (
                                            <React.Fragment key={i}>
                                                {i === 0 || i === 1 || i === 4 || i === 9 || i === 11 ? (
                                                    <td className="px-4"><center>{ o }</center></td>
                                                ) : (
                                                    <td className="px-4"><center>{ o ? formatPricePhp(o) : 0 }</center></td>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </React.Fragment>
            )}
        </Layout>
    );
}

export default DailyCashCollectionPage;