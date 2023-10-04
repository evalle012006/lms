import Avatar from "@/lib/avatar";
import { checkFileSize, formatPricePhp, UppercaseFirstLetter } from "@/lib/utils";
import React, { useState } from "react";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "../Spinner";
import moment from 'moment';
import placeholder from '/public/images/image-placeholder.png';
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useRef } from "react";
import toast from 'react-hot-toast';
import { setClient } from "@/redux/actions/clientActions";

const ClientDetailPage = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const client = useSelector(state => state.client.data);
    const [clientAddress, setClientAddress] = useState('');
    const [loanList, setLoanList] = useState([]);
    const imageRef = useRef();

    const updatePhoto = async (e) => {
        setLoading(true);
        const fileUploaded = e.target.files[0];

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            setLoading(false);
            toast.error(fileSizeMsg);
        } else {
            const clientData = {...client, file: fileUploaded};
            fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'clients/', clientData)
                    .then(response => {
                        setLoading(false);
                        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
                        const updatedClient = {...response.client, imgUrl: response.client.profile ? imgpath + '/images/clients/' + response.client.profile : ''};
                        dispatch(setClient(updatedClient));
                        toast.success('Photo successfully updated.');
                    }).catch(error => {
                        console.log(error);
                    });
        }
      }

    const [columns, setColumns] = useState([
        {
            Header: "Group",
            accessor: 'groupName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Status",
            Cell: StatusPill,
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
        },
        {
            Header: "Remarks",
            accessor: 'remarks',
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
                        <div className="rounded-full flex items-center justify-center mx-auto group">
                            <div className="ml-24 top-3 text-xs cursor-pointer absolute z-20 bg-black/20 text-white rounded-3xl p-2 invisible group-hover:visible" onClick={() => imageRef.current.click()}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                            </div>
                            <Avatar name={`${client.lastName}, ${client.firstName}`} src={client.profile ? client.imgUrl : placeholder.src} className={`${client.profile ? 'p-20' : 'p-12'} `} />
                            <input ref={imageRef} type="file" className="hidden" onChange={updatePhoto} />
                        </div>
                        <h5 className="mb-1 text-xl font-medium text-gray-900">{`${client.lastName}, ${client.firstName}`}</h5>
                        <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">{ client.status?.toUpperCase() }</span>
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