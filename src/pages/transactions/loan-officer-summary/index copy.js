import React from "react";
import Layout from "@/components/Layout"
import { useEffect } from "react";
import { useState } from "react";
import Spinner from "@/components/Spinner";
import { useDispatch, useSelector } from "node_modules/react-redux/es/exports";
import { setLosList } from "@/redux/actions/losActions";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from 'react-hot-toast';
import LOSHeader from "@/components/transactions/los/Header";

const LoanOfficerSummary = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.los.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [selectedBranch, setSelectedBranch] = useState();

    const getListLos = async (date) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loan-officer-summary';
        let losList = [];
        if (currentUser.role.rep === 1) {
            url = url + '?' + new URLSearchParams({ date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ loId: currentUser._id, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            const getCurrentBranch = async () => {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}branches?`;
                const params = { code: currentUser.designatedBranch };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    setSelectedBranch(response.branch);
                } else {
                    toast.error('Error while loading data');
                }
            }

            mounted && getCurrentBranch();
        }

        mounted && getListLos('2022-12-12');
        mounted && setLoading(false);

        return (() => {
            mounted = false;
        })
    }, []);

    return (
        <Layout header={false} noPad={false} hScroll={false}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="flex flex-col">
                    <LOSHeader page={1} pageTitle="Loan Officers Summary" selectedBranch={selectedBranch}/>
                    <div className="flex flex-col h-[50rem] max-h-[50rem] mt-40 pl-6 pr-2">
                        <div className="block overflow-auto rounded-xl w-full">
                            <table className="relative w-full table-auto border-collapse text-sm bg-white mb-6">
                                <thead>
                                    <tr>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-l-0 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Date</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Trans.</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">New Member</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Off-set Person</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Active Clients</th>
                                        <th colSpan={2} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-4 text-gray-500 uppercase">Loan Release</th>
                                        <th colSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 text-gray-500 uppercase">COLLECTION (with service charges)</th>
                                        <th colSpan={2} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 text-gray-500 uppercase">Pastdue</th>
                                        <th rowSpan={2} colSpan={2} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 text-gray-500 uppercase">FULL PAYMENT (with service charge)</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Active Borrowers</th>
                                        <th rowSpan={3} className="bg-white sticky border border-gray-300 border-r-0 border-t-0 top-0 px-4 py-2 text-gray-500 uppercase">Loan Balance</th>
                                    </tr>
                                    <tr>
                                        <th colSpan={2} className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">(with service charges)</th>
                                        <th colSpan={3} className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">REGULAR LOAN</th>
                                        <th rowSpan={2} className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Person</th>
                                        <th rowSpan={2} className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Amount</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Person</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Amount</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Target</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Advance Payment</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Actual</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Person</th>
                                        <th className="bg-white sticky border border-gray-300 px-4 text-gray-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {list.map((item, index) => {
                                        // const date = item._id.dateAdded;
                                        return (
                                            <tr key={index}>
                                                <td className="px-4 py-4 text-center">{ item._id }</td>
                                                <td className="px-4 py-4 text-center">{ item.transfer }</td>
                                                <td className="px-4 py-4 text-center">{ item.newMember }</td>
                                                <td className="px-4 py-4 text-center">{ item.offsetPerson }</td>
                                                <td className="px-4 py-4 text-center">{ item.activeClients }</td>
                                                <td className="px-4 py-4 text-center">{ item.loanReleasePerson }</td>
                                                <td className="px-4 py-4 text-center">{ item.loanReleaseAmount }</td>
                                                <td className="px-4 py-4 text-center">{ item.collectionTarget }</td>
                                                <td className="px-4 py-4 text-center">{ item.collectionAdvancePayment }</td>
                                                <td className="px-4 py-4 text-center">{ item.collectionActual }</td>
                                                <td className="px-4 py-4 text-center">{ item.pastDuePerson }</td>
                                                <td className="px-4 py-4 text-center">{ item.pastDueAmount }</td>
                                                <td className="px-4 py-4 text-center">{ item.fullPaymentPerson }</td>
                                                <td className="px-4 py-4 text-center">{ item.fullPaymentAmount }</td>
                                                <td className="px-4 py-4 text-center">{ item.activeBorrowers }</td>
                                                <td className="px-4 py-4 text-center">{ item.loanBalance }</td>
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
    )
}

export default LoanOfficerSummary;