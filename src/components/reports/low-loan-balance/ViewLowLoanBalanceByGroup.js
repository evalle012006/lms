import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import { PrinterIcon } from '@heroicons/react/24/outline';
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ReactToPrint from 'node_modules/react-to-print/lib/index';
import { useRef } from "react";
import logo from "/public/images/logo.png";
import Image from 'next/image';
import { getApiBaseUrl } from '@/lib/constants';

const ViewLowBalanceByGroupsPage = ({ amount, amountOperator, noOfPayments, noOfPaymentsOperator, includeDelinquent }) => {
    const router = useRouter();
    const printRef = useRef();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const userList = useSelector(state => state.user.list);
    const [selectedLO, setSelectedLO] = useState();
    const [list, setList] = useState([]);
    const [data, setData] = useState([]);

    const { uuid } = router.query;

    const [columns, setColumns] = useState([
        {
            Header: "Group",
            accessor: 'groupName'
        },
        {
            Header: "Slot #",
            accessor: 'slotNo'
        },
        {
            Header: "Client Name",
            accessor: 'clientName'
        },
        {
            Header: "Loan Cycle",
            accessor: 'loanCycle'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "MCBU",
            accessor: 'mcbuStr'
        },
        {
            Header: "No of Payments",
            accessor: 'noOfPayments'
        },
        {
            Header: "Mispayments",
            accessor: 'noOfMispayments'
        },
        {
            Header: "Delinquent",
            accessor: 'delinquent'
        }
    ]);

    const marginTop = "30px";
    const marginRight = "5px";
    const marginBottom= "20px";
    const marginLeft = "5px";

    const getPageMargins = () => {
        return `@page { margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important; }`;
    };

    const hideComponent = () => {
        return `@media screen { .media-to-print { display: none; } }`;
    }

    const getList = async (loId) => {
        setLoading(true);
        const amountOption = JSON.stringify({ amount: amount, operator: amountOperator });
        const noOfPaymentsOption = JSON.stringify({ noOfPayments: noOfPayments, operator: noOfPaymentsOperator });
        let url = getApiBaseUrl() + 'reports/get-all-low-loan-balance?' + new URLSearchParams({ loId: currentUser.role.rep == 4 ? currentUser._id : loId, amountOption: amountOption, noOfPaymentsOption: noOfPaymentsOption });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            setList(response.data);
            setData(response.data);
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        if (uuid) {
            mounted && getList(uuid);
        } else {
            mounted && getList();
        }

        return (() => {
            mounted = false;
        });
    }, [uuid, amount, amountOperator, noOfPayments, noOfPaymentsOperator]);

    useEffect(() => {
        if (!includeDelinquent) {
            const filteredList = list.filter(loan => loan.delinquent != 'Yes');
            setData(filteredList);
        } else {
            setData(list);
        }
    }, [list, includeDelinquent]);

    useEffect(() => {
        if (uuid && userList.length > 0) {
            setSelectedLO(userList.find(lo => lo._id == uuid));
        }
    }, [userList, uuid]);

    return (
        <React.Fragment>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <div className='flex justify-end mr-6 h-10 my-auto'>
                        <ReactToPrint
                            trigger={() => <ButtonSolid label="Print" icon={[<PrinterIcon className="w-5 h-5" />, 'left']} width='!w-22'/> }
                            content={() => printRef.current }
                        />
                    </div>
                    <TableComponent columns={columns} data={data} pageSize={1000} showPagination={false} showFilters={false} hasActionButtons={false} />
                    <div ref={printRef} className='media-to-print min-h-screen w-full mt-8 p-8' style={{ fontSize: '9px' }}>
                        <style>{hideComponent()}</style>
                        <style>{getPageMargins()}</style>

                        <div className='flex flex-col justify-center leading-3'>
                            <div className='flex flex-row justify-center mb-2'>
                                <Image alt="ambercashph logo" src={logo} className="overflow-hidden mr-4" width='80' height='60' />
                                <div className='flex flex-row text-center justify-between'>
                                    <div className='flex flex-col mr-4'>
                                        <span className='font-bold my-4' style={{ fontSize: '14px' }}>AmberCash PH Micro Lending Corp</span>
                                        <span className='font-bold' style={{ fontSize: '16px' }}>List of Loan Balance</span>
                                    </div>
                                </div>
                                <Image alt="ambercashph logo" src={logo} className="overflow-hidden mr-4" width='80' height='60' />
                            </div>
                            <div className='flex flex-row ml-2'>
                                <span>Loan Officer: </span>
                                <span className='underline font-bold ml-2'>{ currentUser.role.rep == 4 ? `${currentUser.firstName} ${currentUser.lastName}` : `${selectedLO?.firstName} ${selectedLO?.lastName}` }</span>
                            </div>
                            <div className='flex flex-row justify-center w-full'>
                                <div className='flex flex-col p-2'>
                                    <div className='flex flex-col justify-between w-full'>
                                        <table className='table-auto w-full border-collapse'>
                                            <thead>
                                                <tr className="leading-4">
                                                    <th className='border border-gray-900 w-12'>Group</th>
                                                    <th className='border border-gray-900 w-8'>SL #</th>
                                                    <th className='border border-gray-900 w-40'>Client Name</th>
                                                    <th className='border border-gray-900 w-8'>Loan Cycle</th>
                                                    <th className='border border-gray-900 w-10'>Amount Release</th>
                                                    <th className='border border-gray-900 w-10'>Loan Balance</th>
                                                    <th className='border border-gray-900 w-10'>MCBU</th>
                                                    <th className='border border-gray-900 w-10'># Of Payments</th>
                                                    <th className='border border-gray-900 w-10'>Mispayments</th>
                                                    <th className='border border-gray-900 w-10'>Delinquent</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                { data.map((loan, index) => {
                                                    return (
                                                        <tr key={index} className="leading-4">
                                                            <td className='border border-gray-900'>{ loan.groupName }</td>
                                                            <td className='border border-gray-900 text-center'>{ loan.slotNo }</td>
                                                            <td className='border border-gray-900'>{ loan.clientName }</td>
                                                            <td className='border border-gray-900 text-center'>{ loan.loanCycle }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.amountReleaseStr }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.loanBalanceStr }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.mcbuStr }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.noOfPayments }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.noOfMispayments }</td>
                                                            <td className='border border-gray-900 text-left'>{ loan.delinquent }</td>
                                                        </tr>
                                                    )
                                                }) }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    )
}

export default ViewLowBalanceByGroupsPage;