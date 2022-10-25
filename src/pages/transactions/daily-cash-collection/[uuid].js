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
import AddUpdateLoan from '@/components/transactions/AddUpdateLoanDrawer';

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const groupClients = useSelector(state => state.cashCollection.group);
    const [data, setData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
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
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' + new URLSearchParams({ date: currentDate, mode: 'daily', groupId: uuid });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];
            let group;

            let totalLoanRelease = 0;
            let totalLoanBalance = 0;
            let totalReleaseAmount = 0;
            // let totalPayments = 0;
            let totalTargetLoanCollection = 0;
            let totalExcess = 0;
            let totalLoanCollection = 0;
            let totalFullPayment = 0;

            response.data && response.data.map(cc => {
                group = cc.group;
                setCurrentGroup(cc.group);
                let collection = {
                    group: cc.group,
                    loanId: cc._id,
                    branchId: cc.branchId,
                    groupId: cc.groupId,
                    groupName: cc.groupName,
                    clientId: cc.clientId,
                    slotNo: cc.slotNo,
                    fullName: cc.client.lastName + ', ' + cc.client.firstName,
                    loanCycle: cc.loanCycle,
                    mispayments: cc.mispayments,
                    collection: 0,
                    excess: 0,
                    excessStr: '-',
                    total: 0,
                    totalStr: '-',
                    noOfPayments: cc.noOfPayments,
                    activeLoan: cc.activeLoan,
                    targetCollection: cc.activeLoan,
                    targetCollectionStr: cc.activeLoan > 0 ? formatPricePhp(cc.activeLoan) : 0,
                    amountRelease: cc.amountRelease,
                    amountReleaseStr: cc.amountRelease > 0 ? formatPricePhp(cc.amountRelease) : 0,
                    loanBalance: cc.loanBalance,
                    loanBalanceStr: cc.loanBalance > 0 ? formatPricePhp(cc.loanBalance) : 0,
                    paymentCollection: 0,
                    occurence: cc.group.occurence,
                    currentReleaseAmount: 0,
                    currentReleaseAmountStr: '-',
                    fullPayment: 0,
                    fullPaymentStr: '-',
                    remarks: '',
                    clientStatus: cc.client.status ? cc.client.status : '-'
                }

                delete cc._id;

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

                if (cc.fullPaymentTotal.length > 0) {
                    totalFullPayment += cc.fullPaymentTotal[0].fullPaymentAmount;
                }

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
                // totalPayments += collection.noOfPayments;
                totalTargetLoanCollection += collection.targetCollection;
                totalExcess += collection.excess;
                totalLoanCollection += collection.paymentCollection;
                // totalFullPayment += collection.fullPayment;

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
                            loanCycle: '-',
                            amountReleaseStr: '-',
                            mispayments: '-',
                            loanBalanceStr: '-',
                            currentReleaseAmountStr: '-',
                            noOfPayments: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollection: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            clientStatus: '-',
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

    const getTomorrowPendingLoans = async (groupId) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list-tomorrow-pending?' + new URLSearchParams({ groupId: groupId });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let currentData = [...data];
            await response.loans && response.loans.map(loan => {
                currentData.push({
                    slotNo: loan.slotNo,
                    fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                    loanCycle: loan.loanCyle,
                    amountReleaseStr: '-',
                    loanBalanceStr: '-',
                    targetCollectionStr: '-',
                    mispayments: '-',
                    currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                    noOfPayments: '-',
                    targetCollectionStr: '-',
                    excessStr: '-',
                    paymentCollection: '-',
                    remarks: '-',
                    fullPaymentStr: '-',
                    status: loan.status === 'active' ? 'tomorrow' : 'pending',
                    clientStatus: loan.client.status
                });
            });
            
            currentData.sort((a, b) => { return a.slotNo - b.slotNo; });
            setData(currentData);
            setAllData(currentData);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }


    const handleSaveUpdate = async () => {
        setLoading(true);
        const dataArr = groupClients && groupClients.map(cc => {
            if (cc.status === 'active') {
                let temp = {...cc};
                delete temp.group;
                delete temp.origData;
                delete temp.targetCollectionStr;
                delete temp.amountReleaseStr;
                delete temp.loanBalanceStr;
                delete temp.excessStr;
                delete temp.totalStr;
                delete temp.currentReleaseAmountStr;
                delete temp.fullPaymentStr;

                if (currentUser.role.rep === 4) {
                    temp.loId = currentUser._id;
                } else {
                    temp.loId = currentGroup && currentGroup.loanOfficerId;
                }

                temp.insertBy = currentUser._id;

                temp.loanBalance = parseFloat(temp.loanBalance);
                temp.amountRelease = parseFloat(temp.amountRelease);
                temp.mode = 'daily';
                if (temp._id) {
                    temp.dateModified = moment(new Date()).format('YYYY-MM-DD');
                } else {
                    temp.dateAdded = moment(new Date()).format('YYYY-MM-DD');
                }

                return temp;   
            }
        }).filter(cc => typeof cc !== 'undefined');

        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', dataArr);
        if (response.success) {
            setLoading(false);
            toast.success('Payment collection successfully submitted.');

            setTimeout(() => {
                getCashCollections();
            }, 1000);
        }
    }

    const handlePaymentCollectionChange = (e, index, type) => {
        if (type === 'amount') {
            let payment = e.target.value ? e.target.value : 0;
            if (payment) {
                if (payment % 10 !== 0) {
                    toast.error('Entered amount should be divisible by 10.');
                }

                let list = data.map((cc, idx) => {
                    let temp = {...cc};
                    if (idx === index) {
                        if (temp.hasOwnProperty('origData')) {
                            temp.loanBalance = temp.origData.loanBalance;
                            temp.total = temp.origData.total;
                        } else {
                            temp.origData = {...cc};
                        }
                        payment = payment - payment % 10; // not yet working...i think its best to check before saving???
                        temp.paymentCollection = parseFloat(payment);
                        temp.loanBalance = parseFloat(temp.loanBalance) - parseFloat(payment);
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : 0;
                        temp.total = parseFloat(temp.total) + parseFloat(payment);
                        temp.totalStr = formatPricePhp(temp.total);

                        temp.excess =  0;
                        temp.excessStr = '-';
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

                list.sort((a, b) => { return a.slotNo - b.slotNo; });
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

    const handleRowClick = (selected) => {
        console.log(selected);
        if (selected.status === 'open') {
            console.log('open')
        }
    }

    const handleReloan = (e, selected) => {
        e.stopPropagation();
        setShowAddDrawer(true);
        setLoan(selected);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        window.location.reload();
    }

    const handleCloseAccount = (e, selected) => {
        e.stopPropagation();
        setLoan(selected);
        setShowRemarksModal(true);
    }

    const closeAccount = () => {
        setLoading(true);
        fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'clients/close-account', {...loan, remarks: closeAccountRemarks})
            .then(response => {
                setLoading(false);
                toast.success('Loan successfully closed.');
                getCashCollections();
                setShowRemarksModal(false);
                setCloseAccountRemarks('');
            }).catch(error => {
                console.log(error);
            });
    }

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
            getTomorrowPendingLoans(currentGroup._id);
        }
    }, [currentGroup]);

    useEffect(() => {
        if (filteredData.length > 0) {
            setAllData(data);
            setData(filteredData);
        } else {
            setData(allData);
            // setFilteredData([]);
        }
    }, [filteredData]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} />}
                    <div className="p-4 mt-[10rem] mb-[4rem]">
                        <div className="bg-white flex flex-col rounded-md p-6 overflow-auto">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider m-1">
                                        <th className="p-2 text-center">Slot #</th>
                                        <th className="p-2 text-center">Client Name</th>
                                        <th className="p-2 text-center">Cycle #</th>
                                        <th className="p-2 text-center">Total Loan Release w/ SC</th>
                                        <th className="p-2 text-center">Total Loan Balance</th>
                                        <th className="p-2 text-center">Current Releases</th>
                                        <th className="p-2 text-center"># of Payments</th>
                                        <th className="p-2 text-center">Target Collection</th>
                                        <th className="p-2 text-center">Excess</th>
                                        <th className="p-2 text-center">Actual Collection</th>
                                        <th className="p-2 text-center">Fully Payment</th>
                                        <th className="p-2 text-center">Mispayments</th>
                                        <th className="p-2 text-center">Remarks</th>
                                        <th className="p-2 text-center">Client Status</th>
                                        <th className="p-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data && data.map((cc, index) => {
                                        const maxDays = cc.occurence === 'daily' ? 60 : 24;
                                        const noOfPaymentStr = cc.noOfPayments !== '-' ? cc.noOfPayments + ' / ' + maxDays : '-';
                                        let rowBg = 'even:bg-gray-100';
                                        if (cc.status === 'pending') {
                                            rowBg = 'bg-yellow-100';
                                        } else if (cc.status === 'completed') {
                                            rowBg = 'bg-green-100';
                                        } else if (cc.status === 'tomorrow') {
                                            rowBg = 'bg-lime-100';
                                        }

                                        return (
                                            <tr key={index} onClick={() => handleRowClick(cc)}
                                                    className={`w-full hover:bg-slate-200 border-b border-b-gray-300 text-gray-600 font-proxima ${rowBg}`} >
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.slotNo }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.fullName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.loanCycle }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.currentReleaseAmountStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ noOfPaymentStr }</td>{/** after submitting please update the no of payments **/}
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer ${cc.status !== 'active' && 'text-center'} ${cc.hasOwnProperty('_id') && 'text-right'}`}>
                                                    { cc.status === 'active' && !cc.hasOwnProperty('_id') ? (
                                                        <input type="number" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'amount')}
                                                            onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection}
                                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                        focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        ): 
                                                            <React.Fragment>
                                                                {cc.hasOwnProperty('_id') ? cc.paymentCollection : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispayments }</td>
                                                { cc.status === 'active' ? (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                            { cc.remarks !== '-' ? (
                                                                <input type="text" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'remarks')}
                                                                    onClick={(e) => e.stopPropagation()} defaultValue={cc.remarks}
                                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                                focus:ring-main focus:border-main block p-2.5" style={{ width: '200px' }}/>
                                                            ) : ('-') }
                                                        </td>
                                                    ) : (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                            { cc.status === 'completed' ? 'Fully Paid' : '-'}
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.clientStatus }</td>
                                                { cc.status === 'completed' ? (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                            <div className='flex flex-row p-4'>
                                                                <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />
                                                                <XCircleIcon className="w-5 h-5" title="Close" onClick={(e) => handleCloseAccount(e, cc)} />
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer"></td>
                                                    )
                                                }
                                            </tr>    
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
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
                                            <td key={i} className="px-4"><center>{ o !== 0  ? formatPricePhp(o) : o }</center></td>
                                        )
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {loan && <AddUpdateLoan mode={'reloan'} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />}
                    <Dialog show={showRemarksModal}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                    <textarea rows="4" value={closeAccountRemarks} onChange={(e) => setCloseAccountRemarks(e.target.value)}
                                            className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                        border-gray-300 focus:ring-blue-500 focus:border-main" 
                                            placeholder="Enter remarks..."></textarea>
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