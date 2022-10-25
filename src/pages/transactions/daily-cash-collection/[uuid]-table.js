import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from 'react-hot-toast';
import React from 'react';
import { setCashCollection, setCashCollectionGroup } from '@/redux/actions/cashCollectionActions';
import { setGroup } from '@/redux/actions/groupActions';
import DetailsHeader from '@/components/groups/DetailsHeader';
import moment from 'moment';
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import TableComponent, { InputCell, SelectColumnFilter } from '@/lib/table';

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const groupClients = useSelector(state => state.cashCollection.group);
    const [data, setData] = useState([]);
    const [currentGroup, setCurrentGroup] = useState();
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [overallTotals, setOverallTotals] = useState([]);
    const [overallTotalsTitles, setOverallTotalsTitles] = useState([
        'Loan Release',
        'Loan Balance',
        'Current Release Amount',
        // '# of Payments',
        'Target Loan Collection',
        'Excess',
        'Full Payment Amount',
        'Total Loan Collection'
    ]);
    const [loan, setLoan] = useState();
    const [showRemarksModal, setShowRemarksModal] = useState(false);

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' + new URLSearchParams({ date: currentDate, mode: 'daily', groupId: uuid });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];
            let group;

            let totalLoanRelease = 0;
            let totalLoanBalance = 0;
            let totalReleaseAmount = 0;
            let totalPayments = 0;
            let totalTargetLoanCollection = 0;
            let totalExcess = 0;
            let totalLoanCollection = 0;
            let totalFullPayment = 0;

            response.data && response.data.map(cc => {
                group = cc.group;
                setCurrentGroup(cc.group);
                let collection = {
                    loanId: cc._id,
                    branchId: cc.branchId,
                    groupId: cc.groupId,
                    clientId: cc.clientId,
                    slotNo: cc.slotNo,
                    fullName: cc.client.lastName + ', ' + cc.client.firstName,
                    cycleNo: cc.loanCycle,
                    // mispayments: cc.mispayments,
                    collection: 0.00,
                    excess: 0.00,
                    excessStr: '-',
                    total: 0.00,
                    totalStr: '-',
                    noOfPayments: cc.noOfPayments,
                    noOfPaymentStr: '-',
                    activeLoan: cc.activeLoan,
                    targetCollection: cc.activeLoan,
                    targetCollectionStr: cc.activeLoan > 0 ? formatPricePhp(cc.activeLoan) : 0,
                    amountRelease: cc.amountRelease,
                    amountReleaseStr: cc.amountRelease > 0 ? formatPricePhp(cc.amountRelease) : 0,
                    loanBalance: cc.loanBalance,
                    loanBalanceStr: cc.loanBalance > 0 ? formatPricePhp(cc.loanBalance) : 0,
                    paymentCollection: 0.00,
                    occurence: cc.group.occurence,
                    currentReleaseAmount: 0.00,
                    currentReleaseAmountStr: '-',
                    fullPayment: 0,
                    fullPaymentStr: '-',
                    remarks: '',
                    clientStatus: cc.client.status ? cc.client.status : '-'
                }

                if (cc.current.length > 0) {
                    collection.excess = cc.current[0].excess;
                    collection.excessStr = formatPricePhp(cc.current[0].excess);
                    collection.paymentCollection = cc.current[0].paymentCollection;
                    collection._id = cc.current[0]._id;
                }

                if (cc.history.length > 0) {
                    // collection.collection = formatPricePhp(cc.history[0].collection);
                    // collection.excess = cc.history[0].excess;
                    // collection.excessStr = formatPricePhp(cc.history[0].excess);
                    collection.total = cc.history[0].total;
                    collection.totalStr = formatPricePhp(cc.history[0].total);
                }

                if (cc.currentRelease.length > 0) {
                    collection.currentReleaseAmount = cc.currentRelease[0].currentReleaseAmount;
                    collection.currentReleaseAmountStr = formatPricePhp(cc.currentRelease[0].currentReleaseAmount);
                }

                if (cc.fullPayment.length > 0) {
                    collection.fullPayment = cc.fullPayment[0].fullPaymentAmount;
                    collection.fullPaymentStr = formatPricePhp(cc.fullPayment[0].fullPaymentAmount);
                }

                const maxDays = cc.occurence === 'daily' ? 60 : 24;
                collection.noOfPaymentStr = cc.noOfPayments !== '-' ? cc.noOfPayments + ' / ' + maxDays : '-';

                if (cc.loanBalance <= 0) {
                    collection.status = 'completed';
                } else {
                    collection.status = 'active';
                }

                // fullpayment 0 na if not today 
                // totals accumulated
                totalLoanRelease += collection.amountRelease;
                totalLoanBalance += collection.loanBalance;
                totalReleaseAmount += collection.currentReleaseAmount;
                totalPayments += collection.noOfPayments;
                totalTargetLoanCollection += collection.targetCollection;
                totalExcess += collection.excess;
                totalLoanCollection += collection.paymentCollection;
                totalFullPayment += collection.fullPayment;

                cashCollection.push(collection);
            });

            setOverallTotals([
                totalLoanRelease,
                totalLoanBalance,
                totalReleaseAmount,
                // totalPayments,
                totalTargetLoanCollection,
                totalExcess,
                totalFullPayment,
                totalLoanCollection
            ]);

            const groupCapacity = group && group.capacity;
            if (cashCollection.length < groupCapacity) {
                group && group.availableSlots.map(g => {
                    if (g <= groupCapacity) {
                        cashCollection.push({
                            slotNo: g,
                            fullName: '-',
                            cycleNo: '-',
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            currentReleaseAmountStr: '-',
                            noOfPayments: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollection: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            status: 'open'
                        });
                    }
                });
            }

            dispatch(setCashCollectionGroup(cashCollection));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const getPendingLoans = async (groupId) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list?' + new URLSearchParams({ status: 'pending', groupId: groupId });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let currentData = [...data];
            await response.loans && response.loans.map(loan => {
                currentData.push({
                    slotNo: loan.slotNo,
                    fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                    cycleNo: loan.loanCyle,
                    amountReleaseStr: '-',
                    loanBalanceStr: '-',
                    targetCollectionStr: '-',
                    currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                    noOfPayments: '-',
                    targetCollectionStr: '-',
                    excessStr: '-',
                    paymentCollection: '-',
                    remarks: '-',
                    fullPaymentStr: '-',
                    status: 'pending'
                });
            });
            currentData.sort((a, b) => { return a.slotNo - b.slotNo; });
            setData(currentData);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const handleSaveUpdate = async () => {
        setLoading(true);
        let dataArr = groupClients && groupClients.map(cc => {
            let temp = {...cc};
            delete temp.targetCollectionStr;
            delete temp.amountReleaseStr;
            delete temp.loanBalanceStr;
            delete temp.excessStr;
            delete temp.totalStr;
            delete temp.currentReleaseAmountStr;
            delete temp.fullPaymentStr;
            delete temp.noOfPaymentStr;

            if (currentUser.role.rep === 4) {
                temp.loId = currentUser._id;
            } else {
                // const group = groupList.find(g => g._id === cc.groupId);
                temp.loId = currentGroup && currentGroup.loanOfficerId;
            }

            temp.insertBy = currentUser._id;

            temp.loanBalance = parseFloat(temp.loanBalance);
            temp.loanAmount = parseFloat(temp.loanAmount);
            temp.mode = 'daily';
            if (temp._id) {
                temp.dateModified = moment(new Date()).format('YYYY-MM-DD');
            } else {
                temp.dateAdded = moment(new Date()).format('YYYY-MM-DD');
            }

            return temp;
        }).filter(cc => cc.fullName !== '-');

        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', dataArr);
        if (response.success) {
            setLoading(false);
            toast.success('Payment collection successfully submitted.');

            getCashCollections();
        }
    }

    const handlePaymentCollectionChange = (e, index, type) => {
        if (type === 'amount') {
            let payment = e.target.value;
            if (payment) {
                if (payment % 10 !== 0) {
                    toast.error('Entered amount should be divisible by 10.');
                }
                 
                let list = groupClients.map((cc, idx) => {
                    let temp = {...cc};
                    if (idx === index) {
                        payment = payment - payment % 10; // not yet working...i think its best to check before saving???
                        temp.paymentCollection = parseFloat(payment);
                        temp.loanBalance = parseFloat(temp.loanBalance) - parseFloat(payment);
                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                        temp.total = parseFloat(temp.total) + parseFloat(payment);
                        temp.totalStr = formatPricePhp(temp.total);

                        temp.excess =  0;
                        temp.remarks = '';
                        if (parseFloat(payment) === 0) {
                            temp.mispayment = true;
                        } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                            temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                            temp.excessStr = formatPricePhp(temp.excess);
                            temp.mispayment = false;
                        } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                            temp.excess =  0;
                            temp.remarks = 'excused';
                            temp.mispayment = true;
                        } else {
                            temp.mispayment = false;
                            
                        }
                    } else {
                        temp.excess =  0;
                        temp.remarks = '';
                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                        temp.totalStr = formatPricePhp(temp.total);

                        if (parseFloat(temp.paymentCollection) === 0) {
                            temp.mispayment = true;
                        } else if (parseFloat(temp.paymentCollection) > parseFloat(temp.activeLoan)) {
                            temp.excess = parseFloat(temp.paymentCollection) - parseFloat(temp.activeLoan);
                            temp.excessStr = formatPricePhp(temp.excess);
                            temp.mispayment = false;
                        } else if (parseFloat(temp.paymentCollection) < parseFloat(temp.activeLoan)) {
                            temp.excess =  0;
                            temp.remarks = 'excused';
                            temp.mispayment = true;
                        } else {
                            temp.mispayment = false;
                        }
                    }

                    return temp;
                });

                dispatch(setCashCollectionGroup(list));
            }   
        } else if (type === 'remarks') {
            const remarks = e.target.value;
            let list = groupClients.map((cc, idx) => {
                let temp = {...cc};
                
                if (idx === index) {
                    temp.remarks = remarks;
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        }
    }

    const [rowActionButtons, setRowActionButtons] = useState([
        { label: 'Reloan', action: handleReloan},
        { label: 'Close Account', action: handleCloseAccount}
    ]);

    const handleRowClick = (selected) => {
        console.log(selected);
    }

    const handleReloan = (e, selected) => {
        e.stopPropagation();
        alert('On going implementation...');

        // show add loan in active clients
    }

    const handleCloseAccount = (e, selected) => {
        e.stopPropagation();
        setLoan(selected);
        setShowRemarksModal(true);
    }

    const closeAccount = () => {
        // to do
        // set client status to offset
    }

    const [columns, setColumns] = useState([
        {
            Header: "Slot #",
            accessor: 'slotNo'
        },
        {
            Header: "Client Name",
            accessor: 'fullName'
        },
        {
            Header: "Cycle #",
            accessor: 'cycleNo'
        },
        {
            Header: "Total Loan Release w/ SC",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Total Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "Current Releases",
            accessor: 'currentReleaseAmountStr'
        },
        {
            Header: "# of Payments",
            accessor: 'noOfPaymentStr'
        },
        {
            Header: "Target Collection",
            accessor: 'targetCollectionStr'
        },
        {
            Header: "Excess",
            accessor: 'excessStr'
        },
        {
            Header: "Actual Collection",
            accessor: 'paymentCollection',
            Cell: InputCell,
            inputType: 'number',
            onBlur: handlePaymentCollectionChange,
            disabledColumn: 'loanBalance'
        },
        {
            Header: "Fully Payment",
            accessor: 'fullPaymentStr'
        },
        {
            Header: "Mispayments",
            accessor: 'mispayments'
        },
        {
            Header: "Remarks",
            accessor: 'remarks',
            Cell: InputCell,
            inputType: 'text',
            onBlur: handlePaymentCollectionChange,
            disabledColumn: 'loanBalance',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Client Status",
            accessor: 'clientStatus',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const getCurrentGroup = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                dispatch(setGroup(response.group));
                setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentGroup(uuid) && getCashCollections(uuid);

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        setData(groupClients);
    }, [groupClients]);

    useEffect(() => {
        if (currentGroup) {
            getPendingLoans(currentGroup._id);
        }
    }, [currentGroup]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} handleSaveUpdate={handleSaveUpdate} />}
                    <div className="p-4 mt-[8rem] mb-[4rem]">
                        <TableComponent columns={columns} data={data} showFilters={true} hasActionButtons={true} rowActionButtons={rowActionButtons} rowClick={handleRowClick} />
                    </div>
                    <div className="w-full h-16 bg-white border-t-2 border-gray-300 fixed bottom-0 flex pl-8">
                        <table className="table-auto border-collapse text-sm font-proxima ml-10">
                            <thead className="text-gray-400">
                                <tr className="">
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
                                <tr className="text-lg">
                                    {overallTotals.map((o, i) => {
                                        return (
                                            <td key={i} className="px-4"><center>{ o !== 0 ? i !== 3 ? formatPricePhp(o) : o : o }</center></td>
                                        )
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <Dialog show={showRemarksModal}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        <p className="text-2xl font-normal text-dark-color">Are you sure you want to delete?</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowRemarksModal(false)} />
                            <ButtonSolid label="Close Account" type="button" className="p-2" onClick={closeAccount} />
                        </div>
                    </Dialog>
                </div>
            )}
        </Layout>
    );
}

export default CashCollectionDetailsPage;