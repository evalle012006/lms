import Avatar from "@/lib/avatar";
import { formatPricePhp, UppercaseFirstLetter } from "@/lib/utils";
import React, { useState } from "react";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import Spinner from "../Spinner";
import moment from 'moment';
import placeholder from '/public/images/image-placeholder.png';
import TableComponent, { SelectColumnFilter } from "@/lib/table";
import { fetchWrapper } from "@/lib/fetch-wrapper";

const ClientDetailPage = () => {
    const [loading, setLoading] = useState(true);
    const client = useSelector(state => state.client.data);
    const [clientAddress, setClientAddress] = useState('');
    const [loanList, setLoanList] = useState([]);

    const [columns, setColumns] = useState([
        {
            Header: "Group",
            accessor: 'groupName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Status",
            accessor: 'loanStatus',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Miss Payments",
            accessor: 'missPayments',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "No. of Payment",
            accessor: 'noOfPayment',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Admission Date",
            accessor: 'admissionDate',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Date Granted",
            accessor: 'dateGranted',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);


    useEffect(() => {
        let mounted = true;

        const getClientDetails = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'clients?clientId=' + client._id;
    
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanData = [];
                await response.client && response.client.map(client => {
                    client.loans.length > 0 && client.loans.map(loan => {
                        loanData.push({
                            ...loan,
                            groupName: loan.groupName,
                            slotNo: loan.slotNo > 0 ? loan.slotNo : '-',
                            missPayments: loan.missPayments ? loan.missPayments : 0,
                            loanStatus: loan.status,
                            loanBalanceStr: loan.loanBalance ? formatPricePhp(loan.loanBalance) : 0.00,
                            missPayments: loan.missPayments ?  loan.missPayments : 0,
                            noOfPayment: loan.noOfPayment ? loan.noOfPayment : 0
                        });
                    });
                });
                setLoanList(loanData);
            } else if (response.error) {
                toast.error(response.message);
            }
            setLoading(false);
        }

        mounted && setClientAddress(`${client.addressStreetNo ? client.addressStreetNo + ',': ''} ${client.addressBarangayDistrict}, ${client.addressMunicipalityCity}, ${client.addressProvince}, ${client.addressZipCode}`);
        mounted && getClientDetails() && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [client]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ): (
                <React.Fragment>
                    <div className="flex flex-col items-center font-proxima">
                        <Avatar name={`${client.lastName}, ${client.firstName}`} src={client.profile ? client.imgUrl : placeholder.src} className={`${client.profile ? 'p-20' : 'p-12'} `} />
                        <h5 className="mb-1 text-xl font-medium text-gray-900">{`${client.lastName}, ${client.firstName}`}</h5>
                        <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-green-200 dark:text-green-900">{ UppercaseFirstLetter(client.status) }</span>
                        <div className="flex flex-col mt-4 md:mt-6">
                            <h5 className="font-proxima-bold">General Information</h5>
                            <div className="border rounded border-gray-400 text-gray-600 p-4 grid grid-cols-2 gap-2">
                                <div><span className="font-proxima-bold">Birthdate:</span> { moment(client.birthdate).format('YYYY-MM-DD') }</div>
                                <div><span className="font-proxima-bold">Registered Date:</span> { moment(client.dateAdded).format('YYYY-MM-DD') }</div>
                                <div><span className="font-proxima-bold">Contact Number:</span> { client.contactNumber }</div>
                                <div><span className="font-proxima-bold">Registered in Branch:</span> { client.branchName }</div>
                                <div className="col-span-2"><span className="font-proxima-bold">Address: </span>{clientAddress}</div>
                            </div>
                        </div>
                        <div className="flex flex-col mt-4 md:mt-6">
                            <h5 className="font-proxima-bold">Loan History</h5>
                            <TableComponent columns={columns} data={loanList} hasActionButtons={false} showFilters={false} noPadding={true} border={true} />
                        </div>
                    </div>
                </React.Fragment>
            )}
        </React.Fragment>
    )
}

export default ClientDetailPage;