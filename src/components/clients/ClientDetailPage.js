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
import { toast } from "react-toastify";
import { setClient } from "@/redux/actions/clientActions";
import Dialog from "@/lib/ui/Dialog";
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import InputNumber from "@/lib/ui/InputNumber";
import { getApiBaseUrl } from "@/lib/constants";
import AddUpdateLoan from "../transactions/loan-application/AddUpdateLoanDrawer";
import AddUpdateClient from "./AddUpdateClientDrawer";

const ClientDetailPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const client = useSelector(state => state.client.data);
    const [clientAddress, setClientAddress] = useState('');
    const [loanList, setLoanList] = useState([]);
    const imageRef = useRef();

    const [selectedLoan, setSelectedLoan] = useState();
    const [pnNumber, setPnNumber] = useState();
    const [principalLoan, setPrincipalLoan] = useState();

    const [showPnNumberDialog, setShowPnNumberDialog] = useState(false);
    const [showPrincipalLoanDialog, setShowPrincipalLoanDialog] = useState(false);

    const [lastLoan, setLastLoan] = useState();
    const [showAddLoanDrawer, setShowAddLoanDrawer] = useState(false);

    const [uploading, setUploading] = useState(false);

    const [guarantorName, setGuarantorName] = useState('');

    const [showUpdateClientDrawer, setShowUpdateClientDrawer] = useState(false);

    const handleCloseAddLoanDrawer = () => {
        setShowAddLoanDrawer(false);
        setTimeout(() => {
            getClientDetails();
        }, 300);
    }

    const handleShowPnNumberDialog = (row) => {
        if (row.status == 'closed') {
            toast.error('Loan already closed!');
        } else if (row.status == 'reject') {
            toast.error('Loan already rejected!');
        } else {
            setSelectedLoan(row);
            setShowPnNumberDialog(true);
        }
    }

    const handleUpdatePNNumber = () => {
        if (!pnNumber) {
            toast.error('PN Number is required!');
        } else if (selectedLoan) {
            const apiUrl = getApiBaseUrl() + 'transactions/loans/update-pn-number';
            fetchWrapper.post(apiUrl, { loanId: selectedLoan._id, branchId: selectedLoan.branchId, pnNumber: pnNumber })
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowPnNumberDialog(false);
                        toast.success('PN Number successfully updated.');
                        handleCloseDialog();
                    }
                }).catch(error => {
                    console.log(error)
                });
        }
    }

    const handleShowPrincialLoanDialog = (row) => {
        if (parseInt(row.noOfPayments) > 0) {
            toast.error("Updating principal loan is not permitted since client already started paying.");
        } else if (row.status == 'closed') {
            toast.error('Loan already closed.');
        } else if (row.status == 'reject') {
            toast.error('Loan already rejected!');
        } else {
            setSelectedLoan(row);
            setShowPrincipalLoanDialog(true);
        }
    }

    const handleUpdatePrincipalLoan = () => {
        if (!principalLoan) {
            toast.error('Principal Loan is required!');
        } else if (parseFloat(principalLoan) <= 0 || parseFloat(principalLoan) < 5000 ) {
            toast.error('Invalid Principal Loan Amount!');
        } else if (selectedLoan) {
            if (selectedLoan.status == 'closed') {
                toast.error('Loan already closed');
            } else {
                const apiUrl = getApiBaseUrl() + 'transactions/loans/update-loan-release';
                fetchWrapper.post(apiUrl, { loanId: selectedLoan._id, principalLoan: parseFloat(principalLoan) })
                    .then(response => {
                        setLoading(false);
                        if (response.error) {
                            toast.error(response.message);
                        } else if (response.success) {
                            setShowPnNumberDialog(false);
                            toast.success('Principal Loan successfully updated.');
                            handleCloseDialog();
                        }
                    }).catch(error => {
                        console.log(error)
                    });
            }
        }
    }

    const handleUpdateCoMaker = (row) => {
        // params: clientId, groupId, coMaker
        // const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/add-comaker-loan';
        // fetchWrapper.post(apiUrl, values)
        //     .then(response => {
        //         setLoading(false);
        //         if (response.error) {
        //             toast.error(response.message);
        //         } else if (response.success) {
        //             setShowSidebar(false);
        //             toast.success('CoMaker successfully added.');
        //             action.setSubmitting = false;
        //             action.resetForm({values: ''});
        //             onClose();
        //         }
        //     }).catch(error => {
        //         console.log(error)
        //     });
    }

    const handleCloseDialog = () => {
        getClientDetails();
        setSelectedLoan(null);
        setPnNumber(null);
        setPrincipalLoan(null);
    }

    const dropDownActions = [
        {
            label: 'Update PN Number',
            action: handleShowPnNumberDialog,
            hidden: false
        },
        {
            label: 'Update Principal Loan',
            action: handleShowPrincialLoanDialog,
            hidden: currentUser.role.rep == 1 ? false : true
        },
    ];

    const updatePhoto = async (e) => {
        setLoading(true);
        const fileUploaded = e.target.files[0];

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            setLoading(false);
            toast.error(fileSizeMsg);
        } else {
            const formData = new FormData();
            formData.append('file', fileUploaded);
            formData.append('origin', 'clients');
            formData.append('uuid', client?._id);

            setUploading(true);
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const responseData = await response.json();
                const updatedData = {...client, archived: client.archived || false, profile: responseData.fileUrl};
                fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'clients/', updatedData)
                        .then(response => {
                            setLoading(false);
                            const updatedClient = {...response.client, profile: response.client.profile ? response.client.profile : ''};
                            dispatch(setClient(updatedClient));
                            toast.success('Photo successfully updated.');
                        }).catch(error => {
                            console.log(error);
                        });
            } catch (error) {
                console.error('Error uploading file:', error);
                toast.error('Failed to upload file. Please try again.');
            } finally {
                setUploading(false);
            }
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
            accessor: 'mispayment',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "No. of Payment",
            accessor: 'noOfPayments',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Admission Date",
            accessor: 'admissionDate',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        // {
        //     Header: "Date Granted",
        //     accessor: 'dateGranted',
        //     Filter: SelectColumnFilter,
        //     filter: 'includes'
        // },
        {
            Header: "PN Number",
            accessor: 'pnNumber',
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

    const getClientDetails = async () => {
        let url = getApiBaseUrl() + 'clients?clientId=' + client._id;

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

            setClientAddress(formatAddress({
                streetNo: client.addressStreetNo ? `${client.addressStreetNo}` : '',
                barangay: client.addressBarangayDistrict,
                city: client.addressMunicipalityCity,
                province: client.addressProvince,
                zipCode: client.addressZipCode
            }));
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
    }

    const formatAddress = (addressParts) => {
        return Object.entries(addressParts)
          .filter(([_, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => value)
          .join(', ');
    };


    useEffect(() => {
        let mounted = true;

        mounted && getClientDetails() && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [client]);

    useEffect(() => {
        if (loanList.length > 0) {
            const filteredList = loanList.filter(loan => loan.status != 'reject');
            const lastLoan = filteredList.length > 0 ? filteredList[filteredList.length - 1] : null;
            if (lastLoan) {
                const firstName = lastLoan.guarantorFirstName ? lastLoan.guarantorFirstName : '';
                const middleName = (lastLoan.guarantorMiddleName && lastLoan.guarantorMiddleName?.trim().length > 0) ? lastLoan.guarantorMiddleName : '';
                const lastName = lastLoan.guarantorLastName ? lastLoan.guarantorLastName : '';
                setGuarantorName(`${firstName} ${middleName} ${lastName}`);
            }
            setLastLoan(lastLoan);
        }
    }, [loanList])

    return (
        <div className="overflow-auto max-h-[80vh]">
            {loading ? (
                <Spinner />
            ) : (
                <React.Fragment>
                    <div className="flex flex-col space-y-4">
                        {(client.status?.toLowerCase() === 'offset' && !client.duplicate ) && (
                            <div className="flex justify-between">
                                <div></div>
                                <div className="flex items-center space-x-3">
                                    <ButtonSolid
                                        label="Add Loan"
                                        type="button"
                                        className="p-2 w-36"
                                        onClick={() => setShowAddLoanDrawer(true)}
                                    />
                                    <ButtonSolid
                                        label="Update Client"
                                        type="button"
                                        className="p-2 w-36"
                                        onClick={() => setShowUpdateClientDrawer(true)}
                                    />
                                </div>
                            </div>
                        )}
                        {/* Profile Section - Made more compact */}
                        <div className="flex-none">
                            <div className="rounded-full flex items-center justify-center mx-auto group cursor-pointer relative">
                                <div 
                                    className={`${client.profile ? 'ml-48' : 'ml-24'} top-2 text-xs cursor-pointer absolute z-20 bg-black/20 text-white rounded-3xl p-2 invisible group-hover:visible`} 
                                    onClick={() => imageRef.current.click()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                    </svg>
                                </div>
                                <Avatar 
                                    name={`${client.lastName}, ${client.firstName}`} 
                                    src={client.profile ? client.profile : placeholder.src} 
                                    className={`${client.profile ? 'p-24 px-28' : 'p-10'}`} 
                                    shape={`${client.profile ? 'square' : 'circle'}`} 
                                />
                                <input ref={imageRef} type="file" className="hidden" onChange={updatePhoto} />
                            </div>
                            <h5 className="mt-2 mb-1 text-lg font-medium text-gray-900 text-center">{`${client.lastName}, ${client.firstName}`}</h5>
                            <div className="flex justify-center mb-2">
                                <span className={`text-sm font-medium px-2.5 py-0.5 rounded ${
                                    client.status?.toLowerCase() === 'active' ? 'bg-green-100 text-green-800' :
                                    client.status?.toLowerCase() === 'offset' ? 'bg-red-100 text-red-800' :
                                    client.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {client.status?.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* General Information - More compact */}
                        <div className="flex-none">
                            <h5 className="font-proxima-bold mb-2">General Information</h5>
                            <div className="border rounded border-gray-400 text-gray-600 p-3 grid grid-cols-2 gap-3 text-sm">
                                <div><span className="font-proxima-bold">Birthdate:</span> {moment(client.birthdate).isValid() ? moment(client.birthdate).format('YYYY-MM-DD') : ''}</div>
                                <div><span className="font-proxima-bold">Registered Date:</span> {moment(client.dateAdded).format('YYYY-MM-DD')}</div>
                                <div><span className="font-proxima-bold">Contact Number:</span> {client.contactNumber}</div>
                                <div><span className="font-proxima-bold">Registered in Branch:</span> {client.branchName}</div>
                                <div className="col-span-2"><span className="font-proxima-bold">Address: </span>{clientAddress}</div>
                                <div><span className="font-proxima-bold">CI Name:</span> {client?.ciName}</div>
                                <div><span className="font-proxima-bold">Guarantor Name:</span> {guarantorName}</div>
                            </div>
                        </div>

                        {/* Loan History Table - Fixed height */}
                        <div className="flex-1">
                            <h5 className="font-proxima-bold mb-2">Loan History</h5>
                            <div className="h-[300px] overflow-auto border rounded border-gray-400">
                                <TableComponent 
                                    columns={columns} 
                                    data={loanList} 
                                    hasActionButtons={true}
                                    showFilters={false} 
                                    noPadding={true} 
                                    border={true} 
                                    dropDownActions={dropDownActions}
                                    showPagination={true}
                                    pageSize={5}
                                />
                            </div>
                        </div>

                        {/* Dialogs */}
                        {selectedLoan && (
                            <>
                                <Dialog show={showPnNumberDialog}>
                                    <h2>Update Loan PN Number</h2>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start justify-center">
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                                <div className="mt-2">
                                                    <InputText
                                                        name="pnNumber"
                                                        value={pnNumber}
                                                        onChange={(e) => setPnNumber(e.target.value)}
                                                        label="New PN Number"
                                                        placeholder="Enter PN Number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                                        <div className='flex flex-row'>
                                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowPnNumberDialog(false)} />
                                            <ButtonSolid label="Update" type="button" className="p-2 mr-3" onClick={handleUpdatePNNumber} />
                                        </div>
                                    </div>
                                </Dialog>

                                <Dialog show={showPrincipalLoanDialog}>
                                    <h2>Update Principal Loan Amount</h2>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="sm:flex sm:items-start justify-center">
                                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                                <div className="mt-2">
                                                    <InputNumber
                                                        name="principalLoan"
                                                        value={principalLoan}
                                                        onChange={(e) => setPrincipalLoan(e.target.value)}
                                                        label="New Principal Loan"
                                                        placeholder="Enter Principal Loan"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                                        <div className='flex flex-row'>
                                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowPrincipalLoanDialog(false)} />
                                            <ButtonSolid label="Update" type="button" className="p-2 mr-3" onClick={handleUpdatePrincipalLoan} />
                                        </div>
                                    </div>
                                </Dialog>
                            </>
                        )}
                    </div>
                    {lastLoan && <AddUpdateLoan origin={'client-list'} client={client} mode={'add'} loan={lastLoan} showSidebar={showAddLoanDrawer} setShowSidebar={setShowAddLoanDrawer} onClose={handleCloseAddLoanDrawer} />}
                    {showUpdateClientDrawer && (
                        <AddUpdateClient 
                            mode={'edit'} 
                            client={client} 
                            showSidebar={showUpdateClientDrawer} 
                            setShowSidebar={setShowUpdateClientDrawer} 
                            onClose={() => setShowUpdateClientDrawer(false)} 
                            flag={client.status == 'pending' ? 'update-pending' : 'update-offset'}
                        />
                    )}
                </React.Fragment>
            )}
        </div>
    );
}

export default ClientDetailPage;