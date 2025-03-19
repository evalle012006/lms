import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Spinner from "../../Spinner";
import 'react-calendar/dist/Calendar.css';
import moment, { min } from 'moment'
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import RadioButton from "@/lib/ui/radio-button";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList, setComakerList } from "@/redux/actions/clientActions";
import { UppercaseFirstLetter, checkIfWeekend, formatPricePhp, getNextValidDate } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import DatePicker2 from "@/lib/ui/DatePicker2";
import { setUserList } from "@/redux/actions/userActions";

const AddUpdateMcbuWithdrawalDrawer = ({ origin, mode = 'add', loan = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Mcbu Withdrawal');
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const mcbuData = useSelector(state => state.mcbuWithdrawal.data);

    const [selectedLo, setSelectedLo] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [clientId, setClientId] = useState(null);
    const [slotNo, setSlotNo] = useState(null);
    const [loanBalance, setLoanBalance] = useState(0);
    const [mcbu, setMcbu] = useState(0);

    const initialValues = {
        loan_id: mcbuData.loan_id,
        branch_id: mcbuData.branch_id,
        lo_id: mcbuData.lo_id,
        group_id: mcbuData.group_id,
        client_id: mcbuData.client_id,
        mcbu_withdrawal_amount: mcbuData.mcbu_withdrawal_amount,
        status: loan.status,
    }

    const validationSchema = yup.object().shape({
        group_id: yup
            .string()
            .required('Please select a group'),
        client_id: yup
            .string()
            .required('Please select a client'),
        mcbu_withdrawal_amount: yup
            .number()
            .integer()
            .positive()
            .moreThan(0, 'Amount should be greater than 0')
            .required('Please enter mcbu withdrawal amount'),
        branch_id: yup
            .string()
            .required('Please select a branch'),
        lo_id: yup
            .string()
            .required('Please select a loan officer'),
        loan_id: yup
            .string()
            .required('Please select a loan'),
    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'transactions/mcbu-withdrawal/save/';
            
            // Prepare the data
            const savingData = {
                ...values,
                inserted_by: currentUser._id,
                status: 'pending' // Or whatever initial status you want
            };
    
            fetchWrapper.post(apiUrl, savingData)
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowSidebar(false);
                        toast.success('MCBU Withdrawal successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        onClose();
                    }
                }).catch(error => {
                    setLoading(false);
                    console.log(error);
                    toast.error('An error occurred while saving');
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'transactions/mcbu-withdrawal/update';
            values._id = mcbuData._id;
            values.modifiedBy = currentUser._id;
            values.modifiedDate = new Date();
            
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('MCBU Withdrawal successfully updated.');
                        action.setSubmitting = false;
                        action.resetForm();
                        onClose();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }).catch(error => {
                    setLoading(false);
                    console.log(error);
                    toast.error('An error occurred while updating');
                });
        }
    }

    const handleLoIdChange = (field, value) => {
        const form = formikRef.current;
        const u = userList.find(u => u._id == value);
        if (u) {
            setSelectedLo(u);
            form.setFieldValue(field, value);

            getListGroup(u.transactionType, value, 'filter');
        }
    }

    const handleGroupIdChange = (field, value) => {
        const form = formikRef.current;
        setSelectedGroup(value);
        form.setFieldValue(field, value);
        getListClient('active', value);
    }

    // Handle client selection
    const handleClientIdChange = (field, value) => {
        const form = formikRef.current;
        setClientId(value);
        form.setFieldValue(field, value);
        
        if (value && value.loans && value.loans.length > 0) {
            setSlotNo(value.slotNo);
            form.setFieldValue('loan_id', value.loans[0]._id);
            
            // Set loan balance and MCBU balance
            setLoanBalance(value.loans[0].loanBalance || 0);
            setMcbu(value.loans[0].mcbu || 0);
        }
    }

    const getListUser = async () => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId: currentUser.designatedBranchId });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    }
                );
            });
            userList.sort((a, b) => { return a.loNo - b.loNo; });

            dispatch(setUserList(userList));
        } else {
            toast.error('Error retrieving user list.');
        }
    }

    const getListGroup = async (occurence, loId, mode) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'groups/list-by-group-occurence';
        if (currentUser.role.rep === 4) { 
            let branchId = currentUser.designatedBranchId;
            if (mode == 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence });
            }
            processGroupList(url);
        } else if (currentUser.role.rep === 3) {
            let branchId = currentUser.designatedBranchId;
            if (mode == 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: loId, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: loId, occurence: occurence });
            }
            processGroupList(url);
        }
    }

    const processGroupList = async (url, origin) => {
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });
            groups.sort((a,b) => { return a.groupNo - b.groupNo });
            dispatch(setGroupList(groups));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListClient = async (status, groupId) => {
        setLoading(true);
        const url = getApiBaseUrl() + 'clients/list?' + new URLSearchParams({ mode: "view_existing_loan", branchId: currentUser.designatedBranchId, groupId: groupId, status: status });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                let temp = {
                    ...client.client,
                    loans: [client],
                    label: UppercaseFirstLetter(`${client.slotNo} - ${client.client.lastName}, ${client.client.firstName}`),
                    value: client.client._id,
                    slotNo: client.slotNo
                };
                delete temp.loans[0].client;
                clients.push(temp);
            });

            clients.sort((a,b) => { return a.slotNo - b.slotNo });

            dispatch(setClientList(clients));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    useEffect(() => {
        if (currentUser.role.rep === 3) {
            getListUser();
        }
    }, [currentUser]);

    useEffect(() => {
        let mounted = true;
        const form = formikRef.current;
        if (mode === 'add') {
            setTitle('Add Mcbu Withdrawal');
            
            // For loan officers, pre-select their own data
            if (currentUser.role.rep === 4) {
                // Pre-populate with LO's branch and LO ID
                form.setFieldValue('branch_id', currentUser.designatedBranchId);
                form.setFieldValue('lo_id', currentUser._id);
                // Get groups for this LO
                getListGroup(currentUser.transactionType, currentUser._id, 'filter');
            } 
            // For branch managers
            else if (currentUser.role.rep === 3) {
                form.setFieldValue('branch_id', currentUser.designatedBranchId);
            }
        } else if (mode === 'edit') {
            setTitle('Edit Mcbu Withdrawal');
            
            // Fetch additional data needed for edit mode
            // if (loan && loan.loId) {
            //     getListGroup(loan.occurence, loan.loId, 'filter');
                
                // Pre-select the loan officer
                // const lo = userList.find(u => u.value === loan.loId);
                // if (lo) setSelectedLo(lo);
                
                // // If we have group info, pre-select it and fetch clients
                // if (loan.groupId) {
                //     const group = groupList.find(g => g.value === loan.groupId);
                //     if (group) {
                //         setSelectedGroup(group);
                //         getListClient('active', loan.groupId);
                        
                //         // If we have client info, pre-select it
                //         if (loan.clientId && clientList.length > 0) {
                //             const client = clientList.find(c => c.value === loan.clientId);
                //             if (client) {
                //                 setClientId(client);
                //                 setSlotNo(client.slotNo);
                //                 setLoanBalance(client.loans[0].loanBalance || 0);
                //                 setMcbu(client.loans[0].mcbu || 0);
                //             }
                //         }
                //     }
                // }
            // } else if (mcbuData && mcbuData?._id) {
                // const lo = userList.find(u => u.value === mcbuData.lo_id);
                // if (lo) setSelectedLo(lo);

                // const group = groupList.find(g => g.value === mcbuData.group_id);
                // if (group) {
                //     setSelectedGroup(group);
                //     getListClient('active', mcbuData.group_id);

                //     const client = clientList.find(c => c.value === mcbuData.client_id);
                //     if (client) {
                //         setClientId(client);
                //         setSlotNo(client.slotNo);
                //         setLoanBalance(client.loans[0].loanBalance || 0);
                //         setMcbu(client.loans[0].mcbu || 0);
                //     }
                // }
            // }
        }
    
        mounted && setLoading(false);
    
        return () => {
            mounted = false;
        };
    }, [mode, currentUser]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <Spinner />
                ) : (
                    <div className="px-2 pb-4">
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
                                    { currentUser.role.rep === 3 && (
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="lo_id"
                                                field="lo_id"
                                                value={selectedLo && selectedLo._id}
                                                label="Loan Officer (Required)"
                                                options={userList}
                                                onChange={(field, value) => handleLoIdChange(field, value)}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Loan Officer"
                                                errors={touched.lo_id && errors.lo_id ? errors.lo_id : undefined}
                                            />
                                        </div>
                                    ) }
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="group_id"
                                            field="group_id"
                                            value={selectedGroup}
                                            label="Group (Required)"
                                            options={groupList}
                                            onChange={(field, value) => handleGroupIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.group_id && errors.group_id ? errors.group_id : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="client_id"
                                            field="client_id"
                                            value={clientId}
                                            label="Client (Required)"
                                            options={clientList}
                                            onChange={(field, value) => handleClientIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Client"
                                            errors={touched.client_id && errors.client_id ? errors.client_id : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    Slot Number
                                                </label>
                                            </div>
                                            <span className="text-gray-400">{ slotNo ? slotNo : '-' }</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    Loan Balance
                                                </label>
                                            </div>
                                            <span className="text-gray-400">{ formatPricePhp(loanBalance) }</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    MCBU Balance
                                                </label>
                                            </div>
                                            <span className="text-gray-400">{ formatPricePhp(mcbu) }</span>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="mcbu_withdrawal_amount"
                                            value={values.mcbu_withdrawal_amount}
                                            onChange={handleChange}
                                            label="MCBU Withdrawal Amount (Required)"
                                            disabled={values.status === 'active'}
                                            placeholder="Enter MCBU Withdrawal Amount"
                                            setFieldValue={setFieldValue}
                                            errors={touched.mcbu_withdrawal_amount && errors.mcbu_withdrawal_amount ? errors.mcbu_withdrawal_amount : undefined} />
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

export default AddUpdateMcbuWithdrawalDrawer;