import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Spinner from "../Spinner";
import 'react-calendar/dist/Calendar.css';
import moment from 'moment'
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import RadioButton from "@/lib/ui/radio-button";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList } from "@/redux/actions/clientActions";
import { UppercaseFirstLetter } from "@/lib/utils";

const AddUpdateTransferClient = ({ mode = 'add', client = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Transfer Client');
    const branchList = useSelector(state => state.branch.list);

    const [slotNumbers, setSelectedSlotNumbers] = useState([]);

    const [sourceUserList, setSourceUserList] = useState([]);
    const [sourceGroupList, setSourceGroupList] = useState([]);
    const [selectedSourceBranch, setSelectedSourceBranch] = useState();
    const [selectedSourceUser, setSelectedSourceUser] = useState();
    const [selectedSourceGroup, setSelectedSourceGroup] = useState();

    const [targetUserList, setTargetUserList] = useState([]);
    const [targetGroupList, setTargetGroupList] = useState([]);
    const [selectedTargetBranch, setSelectedTargetBranch] = useState();
    const [selectedTargetUser, setSelectedTargetUser] = useState();
    const [selectedTargetGroup, setSelectedTargetGroup] = useState();

    const initialValues = {
        sourceBranchId: client.sourceBranchId,
        sourceUserId: client.sourceUserId,
        sourceGroupId: client.sourceGroupId,
        targetBranchId: client.targetbranchId,
        targetUserId: client.targetUserId,
        targetGroupId: client.targetGroupId,
        selectedClientId: client.clientId,
        selectedSlotNo: client.selectedSlotNo
    }

    const validationSchema = yup.object().shape({
        sourceBranchId: yup
            .string()
            .required('Please select a source branch.'),
        sourceUserId: yup
            .string()
            .required('Please select a source loan officer.'),
        sourceGroupId: yup
            .string()
            .required('Please select a source group.'),
        targetBranchId: yup
            .string()
            .required('Please select a target branch.'),
        targetUserId: yup
            .string()
            .required('Please select a target loan officer.'),
        targetGroupId: yup
            .string()
            .required('Please select a target group.'),
        selectedClientId: yup
            .string()
            .required('Please select client to transfer.'),
        selectedSlotNo: yup
            .string()
            .required('Please select slot number.')
    });

    const getListUser = async (selectedBranch, type) => {
        if (selectedBranch) {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
            let selectedBranch = {};
            if (type === "source") {
                selectedBranch = selectedSourceBranch;
            } else {
                selectedBranch = selectedTargetBranch;
            }

            url = url + '?' + new URLSearchParams({ branchCode: selectedBranch.code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push(
                        {
                            ...u,
                            value: u._id,
                            label: UppercaseFirstLetter(name)
                        }
                    );
                });
                userList.sort((a, b) => { return a.loNo - b.loNo; });
                if (type === "source") {
                    setSourceUserList(userList);
                    setSourceGroupList([]);
                    setSelectedSourceGroup({});
                    dispatch(setTransferClientList([]));
                } else {
                    // selected user won't reset...
                    setTargetUserList(userList);
                    setTargetGroupList([]);
                    setSelectedTargetGroup({});
                }
                
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async (selectedUser, type) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list';
        let selectedBranch = {};
        if (type === "source") {
            selectedBranch = selectedSourceBranch;
        } else {
            selectedBranch = selectedTargetBranch;
        }
        
        if (selectedUser) {
            url = url + '?' + new URLSearchParams({ branchId: selectedBranch._id, loId: selectedUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groups = [];
                await response.groups && response.groups.map(group => {
                    groups.push({
                        ...group,
                        day: UppercaseFirstLetter(group.day),
                        value: group._id,
                        label: group.name
                    });
                });
                groups.sort((a, b) => { return a.groupNo - b.groupNo; });

                if (type === "source") {
                    setSourceGroupList(groups);
                    setSelectedSourceGroup({});
                    dispatch(setTransferClientList([]));
                } else {
                    setTargetGroupList(groups);
                    setSelectedTargetGroup({});
                }

                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListClient = async (groupId) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list?' + new URLSearchParams({ mode: "view_all_by_group", groupId: groupId });;

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '-',
                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '-',
                    delinquent: client.loans.length > 0 ? client.delinquent ? "Yes" : "No" : '-',
                    label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
                    value: client._id
                });   
            });
            dispatch(setTransferClientList(clients));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const handleChangeBranch = (selected, type) => {
        if (type === "source") {
            setSelectedSourceBranch(selected);
        } else {
            setSelectedTargetBranch(selected);
        }
    }

    const handleChangeUser = (selected, type) => {
        if (type === "source") {
            setSelectedSourceUser(selected);
        } else {
            setSelectedTargetUser(selected);
        }
    }

    const handleChangeGroup = (selected, type) => {
        if (type === "source") {
            setSelectedSourceGroup(selected);
        } else {
            if (selected._id === selectedSourceGroup._id) {
                toast.error('Selected group is the same as the source group.');
                setSelectedTargetGroup(null);
            } else if (selected.occurence !== selectedSourceGroup.occurence) {
                toast.error(`Please select a ${selectedSourceGroup.occurence} group.`);
                setSelectedTargetGroup(null);
            } else if (selected.status === 'available') {
                setSelectedTargetGroup(selected);
            } else {
                toast.error("Selected group is currently full.");
                setSelectedTargetGroup(null);
            }
        }
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (transferList) {
            if (mode === 'all') {
                let tempList = transferList.map(loan => {
                    let temp = {...loan};

                    temp.selected = selectAll;

                    if (temp.selected === false) {
                        delete temp.error;
                    }
                    
                    return temp;
                });

                dispatch(setTransferClientList(tempList));
            } else if (mode === 'row') {
                let tempList = transferList.map((loan, index) => {
                    let temp = {...loan};
    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;

                        if (temp.selected === false) {
                            delete temp.error;
                        }
                    }
    
                    return temp;
                });

                dispatch(setTransferClientList(tempList));
            }
        }
    }

    // const handleTransfer = async () => {
    //     setLoading(true);
    //     if (selectedSourceGroup._id === selectedTargetGroup._id) {
    //         toast.error('Selected source and target group are the same.');
    //     } else {
    //         const updatedClientList = [...transferList];
    //         let selectedClientList = transferList && transferList.filter(client => client.selected === true);

    //         if (selectedClientList.length > 0) {
    //             if (selectedTargetGroup) {
    //                 const updatedSelectedClientList = selectedClientList.map(client => {
    //                     let uClient = {...client};

    //                     uClient.branchId = selectedTargetBranch?._id;
    //                     uClient.loId = selectedTargetUser?._id;
    //                     uClient.groupId = selectedTargetGroup?._id;
    //                     uClient.groupName = selectedTargetGroup?.name;
    //                     uClient.sameLo = client.loId === selectedTargetUser?._id;
    //                     uClient.oldGroupId = client.groupId;
    //                     uClient.oldBranchId = client.branchId;
    //                     uClient.oldLoId = client.loId;

    //                     const index = updatedClientList.findIndex(c => c._id === uClient._id);
    //                     if (index > -1) {
    //                         updatedClientList[index] = uClient;
    //                     }

    //                     return uClient;
    //                 });

    //                 dispatch(setTransferClientList(updatedClientList));
    //                 const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client', updatedSelectedClientList);

    //                 if (response.success) {
    //                     setLoading(false);
    //                     let msg = 'Selected client/s successfully transfered.';
    //                     if (response?.message) {
    //                         msg = msg + ' ' + response.message;
    //                     }
    //                     toast.success(msg);
    //                     setTimeout(() => {
    //                         getListClient(selectedSourceGroup._id);
    //                     }, 800);
    //                 } else if (response.error) {
    //                     setLoading(false);
    //                     toast.error(response.message);
    //                 }
    //             } else {
    //                 setLoading(false);
    //                 toast.error("Please select target group.");
    //             }
    //         } else {
    //             setLoading(false);
    //             toast.error('No client selected.');
    //         }
    //     }
    // }

    const handleSaveUpdate = (values, action) => {
        // if (values.principalLoan % 1000 === 0) {
        //     if (type === 'weekly' && (!values.mcbu || parseFloat(values.mcbu) < 50)) {
        //         toast.error('Invalid MCBU amount. Please enter at least 50.');
        //     } else if (loanTerms === 100 && values.principalLoan < 10000) {
        //         toast.error('For 100 days loan term, principal amount should be greater than or equal to 10,0000.');
        //     } else {
        //         setLoading(true);
        //         let group;
        //         values.currentDate = currentDate;
        //         values.clientId = clientId;
        //         if (mode !== 'reloan') {
        //             values.groupId = selectedGroup;
        //             group = groupList.find(g => g._id === values.groupId);
        //             values.groupName = group.name;
        //             const branch = branchList.find(b => b._id === group.branchId);
        //             values.branchId = branch._id;
        //             values.brancName = branch.name;
        //             values.loId = group.loanOfficerId;
        //         } else {
        //             group = loan.group;
        //             values.loId = group.loanOfficerId;
        //             values.groupId = loan.groupId;
        //             values.groupName = loan.groupName;
        //             values.mode = 'reloan';
        //             values.oldLoanId = loan.loanId;
        //             values.clientId = loan.clientId;
        //             values.branchId = loan.branchId;
        //         }

        //         values.slotNo = mode !== 'reloan' ? slotNo : loan.slotNo;
        //         values.occurence = group.occurence;

        //         if (values.occurence === 'weekly') {
        //             values.groupDay = group.day;
        //         }

        //         if (values.status !== 'active') {
        //             if (group.occurence === 'weekly') {
        //                 values.activeLoan = (values.principalLoan * 1.20) / 24;
        //             } else if (group.occurence === 'daily') {
        //                 values.loanTerms = loanTerms;
        //                 if (loanTerms === 60) {
        //                     values.activeLoan = (values.principalLoan * 1.20) / 60;
        //                 } else {
        //                     values.activeLoan = (values.principalLoan * 1.20) / 100;
        //                 }
        //             }
            
        //             values.loanBalance = values.principalLoan * 1.20; // initial
        //             values.amountRelease = values.loanBalance;
        //         }

        //         values.group = group;

        //         if (mode === 'add' || mode === 'reloan') {
        //             // should check if the user has previous loan that is loanCycle 0, then set the loanCycle to 1
        //             const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/save/';

        //             values.lastUpdated = null;  // use only when updating the mispayments
        //             values.admissionDate = moment(values.admissionDate).format('YYYY-MM-DD');
        //             values.status = 'pending';
        //             values.loanCycle = values.loanCycle ? values.loanCycle : 1;
        //             values.noOfPayments = 0;
        //             values.insertedBy = currentUser._id;
        //             values.currentReleaseAmount = values.amountRelease;

        //             fetchWrapper.post(apiUrl, values)
        //                 .then(response => {
        //                     setLoading(false);
        //                     if (response.error) {
        //                         toast.error(response.message);
        //                     } else if (response.success) {
        //                         setShowSidebar(false);
        //                         toast.success('Loan successfully added.');
        //                         action.setSubmitting = false;
        //                         action.resetForm({values: ''});
        //                         setSelectedGroup();
        //                         setClientId();
        //                         setSlotNo();
        //                         setSlotNumber();
        //                         onClose();
        //                     }
        //                 }).catch(error => {
        //                     console.log(error)
        //                 });
        //         } else if (mode === 'edit') {
        //             const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans';
        //             values._id = loan._id;
        //             values.modifiedBy = currentUser._id;
        //             values.modifiedDate = moment(new Date()).format("YYYY-MM-DD");
        //             fetchWrapper.post(apiUrl, values)
        //                 .then(response => {
        //                     if (response.success) {
        //                         let error = false;
        //                         if (values.status === 'active' && values.groupId !== loan.groupId) {
        //                             let params = { groupId: values.groupId, oldGroupId: loan.groupId };
                                    
        //                             fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'groups/update-group', params)
        //                                 .then(response => {
        //                                     if (response.error) {
        //                                         setLoading(false);
        //                                         error = true;
        //                                         toast.error(response.message);
        //                                     }
        //                             });
        //                         }

        //                         if (!error) {
        //                             setLoading(false);
        //                             setShowSidebar(false);
        //                             toast.success('Loan successfully updated.');
        //                             action.setSubmitting = false;
        //                             action.resetForm();
        //                             setSelectedGroup();
        //                             setClientId();
        //                             setSlotNo();
        //                             setSlotNumber();
        //                             onClose();
        //                         }
        //                     } else if (response.error) {
        //                         setLoading(false);
        //                         toast.error(response.message);
        //                     }
        //                 }).catch(error => {
        //                     console.log(error);
        //                 });
        //         }
        //     }
        // } else {
        //     toast.error('Principal Loan must be divisible by 1000');
        // }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        // setSelectedGroup();
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        if (mode === 'add') {
            setTitle('Add Transfer Client');
        } else if (mode === 'edit') {
            setTitle('Edit Transfer Client');
            const form = formikRef.current;
            // setClientId(loan.clientId);
            // setSelectedGroup(loan.groupId);
            // setSlotNo(loan.slotNo);

            // form.setFieldValue('clientId', loan.clientId);
            // form.setFieldValue('groupId', loan.groupId);
            // form.setFieldValue('slotNo', loan.slotNo);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [mode]);

    useEffect(() => {
        getListUser(selectedSourceBranch, "source");
    }, [selectedSourceBranch]);

    useEffect(() => {
        getListGroup(selectedSourceUser, "source");
    }, [selectedSourceUser]);

    useEffect(() => {
        getListUser(selectedTargetBranch, "target");
    }, [selectedTargetBranch]);

    useEffect(() => {
        getListGroup(selectedTargetUser, "target");
    }, [selectedTargetUser]);

    useEffect(() => {
        if (selectedSourceGroup) {
            getListClient(selectedSourceGroup._id);
        }
    }, [selectedSourceGroup]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    </div>
                ) : (
                    <div className="px-2">
                        <Formik enableReinitialize={true}
                            onSubmit={handleSaveUpdate}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            innerRef={formikRef}>{({
                                values,
                                actions,
                                touched,
                                errors,
                                handleChange,
                                handleSubmit,
                                setFieldValue,
                                resetForm,
                                isSubmitting,
                                isValidating,
                                setFieldTouched
                            }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="groupId"
                                            field="groupId"
                                            value={selectedGroup}
                                            label="Group"
                                            options={groupList}
                                            onChange={(field, value) => handleGroupIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="clientId"
                                            field="clientId"
                                            value={clientId}
                                            label="Client"
                                            options={clientList}
                                            onChange={(field, value) => handleClientIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Client"
                                            errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="slotNo"
                                            field="slotNo"
                                            value={slotNo}
                                            label="Slot Number"
                                            options={slotNumber}
                                            onChange={(field, value) => handleSlotNoChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Slot No"
                                            errors={touched.slotNo && errors.slotNo ? errors.slotNo : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="mcbu"
                                            value={values.mcbu}
                                            onChange={handleChange}
                                            label="MCBU"
                                            placeholder="Enter MCBU"
                                            setFieldValue={setFieldValue}
                                            errors={touched.mcbu && errors.mcbu ? errors.mcbu : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="principalLoan"
                                            value={values.principalLoan}
                                            onChange={handleChange}
                                            label="Principal Loan"
                                            disabled={values.status === 'active'}
                                            placeholder="Enter Principal Loan"
                                            setFieldValue={setFieldValue}
                                            errors={touched.principalLoan && errors.principalLoan ? errors.principalLoan : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="pnNumber"
                                            value={values.pnNumber}
                                            onChange={handleChange}
                                            label="Promisory Note Number"
                                            placeholder="Enter PN Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.pnNumber && errors.pnNumber ? errors.pnNumber : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="coMaker"
                                            value={values.coMaker}
                                            onChange={handleChange}
                                            label="Co-Maker"
                                            placeholder="Enter Co-Maker"
                                            setFieldValue={setFieldValue}
                                            errors={touched.coMaker && errors.coMaker ? errors.coMaker : undefined} />
                                    </div>
                                    <div className="flex flex-row mt-5">
                                        <ButtonOutline label="Cancel" onClick={handleCancel} className="mr-3" />
                                        <ButtonSolid label="Submit" type="submit" isSubmitting={isValidating && isSubmitting} />
                                    </div>
                                </form>
                            )}
                        </Formik>
                    </div>
                )}
            </SideBar>
        </React.Fragment>
    )
}

export default AddUpdateTransferClient;