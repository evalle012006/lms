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
import { formatPricePhp } from '@/lib/utils';

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const groupClients = useSelector(state => state.cashCollection.group);
    const groupList = useSelector(state => state.group.list);
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [data, setData] = useState([]);

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' + new URLSearchParams({ date: currentDate, mode: 'daily', groupId: uuid });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];
            response.data && response.data.map(cc => {
                let collection = {
                    loanId: cc._id,
                    branchId: cc.branchId,
                    groupId: cc.groupId,
                    clientId: cc.clientId,
                    slotNo: cc.slotNo,
                    mispayments: cc.mispayments,
                    collection: 0.00,
                    excess: 0.00,
                    excessStr: '-',
                    total: 0.00,
                    totalStr: '-',
                    noOfPayments: cc.noOfPayments,
                    activeLoan: cc.activeLoan,
                    targetCollection: cc.activeLoan,
                    targetCollectionStr: formatPricePhp(cc.activeLoan),
                    amountRelease: cc.amountRelease,
                    amountReleaseStr: formatPricePhp(cc.amountRelease),
                    loanBalance: cc.loanBalance,
                    loanBalanceStr: formatPricePhp(cc.loanBalance),
                    paymentCollection: 0.00,
                    remarks: ''
                }

                if (cc.current.length > 0) {
                    collection.paymentCollection = cc.current[0].paymentCollection;
                    collection._id = cc.current[0]._id;
                }

                if (cc.history.length > 0) {
                    collection.collection = formatPricePhp(cc.history[0].collection);
                    collection.excess = cc.history[0].excess;
                    collection.excessStr = formatPricePhp(cc.history[0].excess);
                    collection.total = cc.history[0].total;
                    collection.totalStr = formatPricePhp(cc.history[0].total);
                }

                cashCollection.push(collection);
            });
            dispatch(setCashCollectionGroup(cashCollection));
        } else {
            toast.error('Error retrieving branches list.');
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

            if (currentUser.role.rep === 4) {
                temp.loId = currentUser._id;
            } else {
                const group = groupList.find(g => g._id === cc.groupId);
                temp.loId = group && group.loanOfficerId;
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
        });

        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', dataArr);
        if (response.success) {
            setLoading(false);
            toast.success('Payment collection successfully submitted.');

            getCashCollections();
        }
    }

    const handlePaymentCollectionChange = (e, index, type) => {
        if (type === 'amount') {
            const payment = e.target.value;
            if (payment) {
                let list = groupClients.map((cc, idx) => {
                    let temp = {...cc};
                    
                    if (idx === index) {
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
                        console.log(temp)
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

    const handleRowClick = (selected) => {
        console.log(selected);
    }

    useEffect(() => {
        let mounted = true;

        const getCurrentGroup = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                await dispatch(setGroup(response.group));
                await setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentGroup(uuid) && getCashCollections(uuid);

        return () => {
            mounted = false;
        };
    }, [uuid]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {groupClients && <DetailsHeader page={'transaction'} handleSaveUpdate={handleSaveUpdate} />}
                    <div className="p-4 mt-[8rem]">
                        <div className="bg-white flex flex-col rounded-md p-6">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider m-1">
                                        <th className="p-2">Slot #</th>
                                        <th className="p-2">Loan Release Amount w/ SC</th>
                                        <th className="p-2"># of Payments</th>
                                        <th className="p-2">Loan Balance</th>
                                        <th className="p-2">Excess</th>
                                        <th className="p-2">Total Collection</th>
                                        <th className="p-2">Target Collection</th>
                                        <th className="p-2">Actual Collection</th>
                                        <th className="p-2">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupClients && groupClients.map((cc, index) => {
                                        return (
                                            <tr key={index} className="hover:bg-slate-200 even:bg-gray-100 border-b border-b-gray-300 text-gray-600 font-proxima" onClick={() => handleRowClick(cc)}>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.slotNo }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.noOfPayments }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.excessStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.totalStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.targetCollectionStr }</td>
                                                {/** if loan status is completed, hide the payment collection input and show Reloan and Close **/}
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <input type="number" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'amount')}
                                                        onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection}
                                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-main focus:border-main block w-10/12 p-2.5"/>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <input type="text" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'remarks')}
                                                        onClick={(e) => e.stopPropagation()} defaultValue={cc.remarks}
                                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-main focus:border-main block w-full p-2.5"/>
                                                </td>
                                            </tr>    
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default CashCollectionDetailsPage;