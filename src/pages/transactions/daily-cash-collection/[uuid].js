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
    const cashCollections = useSelector(state => state.cashCollection.client);
    const groupClients = useSelector(state => state.cashCollection.group);
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [data, setData] = useState([]);

    const getCashCollections = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-by-date?' + new URLSearchParams({ date: currentDate, mode: 'daily', groupId: uuid });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            dispatch(setCashCollection(response.data));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
    }

    const handleSaveUpdate = async () => {
        setLoading(true);
        let dataArr = groupClients && groupClients.map(cc => {
            let temp = {...cc};
            if (currentUser.role.rep === 4) {
                temp.loId = currentUser._id;
            }

            temp.paymentCollection = temp.paymentCollection && parseFloat(temp.paymentCollection.replace(',', ''));
            temp.loanBalance = parseFloat(temp.loanBalance.replace(',', ''));
            temp.loanAmount = parseFloat(temp.loanAmount.replace(',', ''));
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

    const handlePaymentCollectionChange = (e, index) => {
        const payment = e.target.value;
        if (payment) {
            let list = groupClients.map((cc, idx) => {
                let temp = {...cc};
                if (idx === index) {
                    temp.paymentCollection = parseFloat(payment).toFixed(2);

                    temp.excess =  0;
                    temp.remarks = '';
                    if (parseFloat(payment) === 0) {
                        temp.mispayment = true;
                    } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                        temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
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

                    if (parseFloat(temp.paymentCollection) === 0) {
                        temp.mispayment = true;
                    } else if (parseFloat(temp.paymentCollection) > parseFloat(temp.activeLoan)) {
                        temp.excess = parseFloat(temp.paymentCollection) - parseFloat(temp.activeLoan);
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

    useEffect(() => {
        const getGroupClients = async () => {
            const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
            const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'clients/list?' + new URLSearchParams({ mode: "view_active_by_group", groupId: uuid }));
            if (response.success) {
                let clients = [];
                await response.clients && response.clients.map(loan => {
                    clients.push({
                        branchId: loan.branchId,
                        groupId: loan.groupId,
                        clientId: loan.client._id,
                        loanId: loan._id,
                        // imgUrl: loan.client.profile ? imgpath + '/images/profiles/' + loan.client.profile : '',
                        lastName: loan.client.lastName,
                        firstName: loan.client.firstName,
                        middleName: loan.client.middleName ? loan.client.middleName : '',
                        slotNo: loan.slotNo,
                        groupName: loan.group.name,
                        loanAmount: formatPricePhp(loan.principalLoan),
                        loanBalance: formatPricePhp(loan.loanBalance),
                        activeLoan: loan.activeLoan,
                        paymentCollection: 0
                    });
                });
                dispatch(setCashCollectionGroup(clients));
                setLoading(false);
            } else if (response.error) {
                toast.error(response.message);
            }
        }

        if (cashCollections.length === 0) {
            uuid && getGroupClients(uuid);
            setData(groupClients);
        } else {
            setData(cashCollections);
        }

    }, [cashCollections]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} handleSaveUpdate={handleSaveUpdate} />}
                    <div className="p-4 mt-[8rem]">
                        <div className="bg-white flex flex-col rounded-md p-6">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider m-1">
                                        <th className="p-2">Slot #</th>
                                        <th className="p-2">Group</th>
                                        <th className="p-2">Last Name</th>
                                        <th className="p-2">First Name</th>
                                        <th className="p-2">Middle Name</th>
                                        <th className="p-2">Loan Amount</th>
                                        <th className="p-2">Loan Balance</th>
                                        <th className="p-2">Payment Collection</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data && data.map((cc, index) => {
                                        return (
                                            <tr key={index} className="hover:bg-slate-200 even:bg-gray-100 border-b border-b-gray-300 text-gray-600" onClick={() => handleRowClick(cc)}>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.slotNo }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.groupName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.lastName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.firstName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.middleName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.loanAmount }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.loanBalance }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <input type="number" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index)}
                                                        onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection}
                                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-main focus:border-main block w-1/2 p-2.5"/>
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