import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Spinner from "../../Spinner";
import 'react-calendar/dist/Calendar.css';
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClientList } from "@/redux/actions/clientActions";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { setUserList } from "@/redux/actions/userActions";

const AddUpdateMcbuWithdrawalDrawer = ({ origin, mode = 'add', mcbuData = {}, loan = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Mcbu Withdrawal');
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);

    const [slotNo, setSlotNo] = useState(null);
    const [loanBalance, setLoanBalance] = useState(0);
    const [mcbu, setMcbu] = useState(0);
    const [isGroupLeader, setIsGroupLeader] = useState(false);
    const [maxWithdrawalAmount, setMaxWithdrawalAmount] = useState(0);
    const [occurence, setOccurence] = useState('daily');
    console.log(loan)

    // Define a clear initial state based on mcbuData, loan, or defaults
    const initialFormState = {
        loan_id: mcbuData?.loan_id || loan?.loanId || "",
        branch_id: mcbuData?.branch_id || loan?.branchId || (currentUser?.designatedBranchId || ""),
        lo_id: mcbuData?.lo_id || loan?.loId || (currentUser?.role?.rep === 4 ? currentUser._id : ""),
        group_id: mcbuData?.group_id || loan?.groupId || "",
        client_id: mcbuData?.client_id || loan?.clientId || "",
        mcbu_withdrawal_amount: mcbuData?.mcbu_withdrawal_amount || 0,
        status: mcbuData?.status || "pending",
        division_id: mcbuData?.division_id || (currentUser?.divisionId || ""),
        region_id: mcbuData?.region_id || (currentUser?.regionId || ""),
        area_id: mcbuData?.area_id || (currentUser?.areaId || ""),
        group_leader: mcbuData?.group_leader || loan?.client?.groupLeader || false
    };
    
    const [formState, setFormState] = useState(initialFormState);
    
    // Initial values for Formik - keep in sync with formState
    const initialValues = {
        loan_id: formState.loan_id,
        branch_id: formState.branch_id,
        lo_id: formState.lo_id,
        group_id: formState.group_id,
        client_id: formState.client_id,
        mcbu_withdrawal_amount: formState.mcbu_withdrawal_amount,
        status: formState.status,
        division_id: formState.division_id,
        region_id: formState.region_id,
        area_id: formState.area_id,
        group_leader: formState.group_leader
    };

    // Create a custom validation schema based on if we're in collection mode
    const getValidationSchema = () => {
        // Base schema for mcbu_withdrawal_amount - applies in all modes
        const baseSchema = {
            mcbu_withdrawal_amount: yup
                .number()
                .integer()
                .positive()
                .moreThan(0, 'Amount should be greater than 0')
                .max(maxWithdrawalAmount, `Amount cannot exceed ${formatPricePhp(maxWithdrawalAmount)}`)
                .required('Please enter mcbu withdrawal amount')
        };

        // If we're in collection mode, we only need to validate the withdrawal amount
        // as other fields are pre-filled and read-only
        if (origin === "collection" && loan) {
            return yup.object().shape(baseSchema);
        }

        // Otherwise, validate all required fields
        return yup.object().shape({
            ...baseSchema,
            group_id: yup
                .string()
                .required('Please select a group'),
            client_id: yup
                .string()
                .required('Please select a client'),
            branch_id: yup
                .string()
                .required('Please select a branch'),
            lo_id: yup
                .string()
                .required('Please select a loan officer'),
            loan_id: yup
                .string()
                .required('Please select a loan')
        });
    };

    const validationSchema = getValidationSchema();

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        
        // Create final submission values using formState as the primary source of truth
        let submitValues = {
            loan_id: formState.loan_id,
            branch_id: formState.branch_id,
            lo_id: formState.lo_id,
            group_id: formState.group_id,
            client_id: formState.client_id,
            mcbu_withdrawal_amount: values.mcbu_withdrawal_amount, // Get this from form values
            inserted_date: new Date().toISOString(),
            inserted_by: currentUser._id,
            status: 'pending',
            division_id: formState.division_id,
            region_id: formState.region_id,
            area_id: formState.area_id,
            group_leader: formState.group_leader
        };
        
        // Additional validation
        if (!submitValues.lo_id) {
            setLoading(false);
            toast.error("Please select a loan officer");
            return;
        }
        
        if (!submitValues.group_id) {
            setLoading(false);
            toast.error("Please select a group");
            return;
        }
        
        if (!submitValues.client_id) {
            setLoading(false);
            toast.error("Please select a client");
            return;
        }

        const client = loan?.client;

        // Validate MCBU withdrawal amount against available balance and client type limits
        if (submitValues.mcbu_withdrawal_amount > maxWithdrawalAmount) {
            setLoading(false);
            if (isGroupLeader) {
                toast.error("Group leaders cannot withdraw more than the excess over ₱3,000 MCBU balance");
            } else if (occurence == 'daily') {
                toast.error("Clients cannot withdraw more than the excess over ₱1,000 MCBU balance");
            }

            return;
        }
          
    
        // API call for saving the form
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'transactions/mcbu-withdrawal/save/';
            
            fetchWrapper.post(apiUrl, submitValues)
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
            submitValues._id = mcbuData?._id;
            submitValues.modifiedBy = currentUser._id;
            submitValues.modifiedDate = new Date();
            
            fetchWrapper.post(apiUrl, submitValues)
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
    };

    // Improved handler for lo_id changes
    const handleLoIdChange = (field, value) => {
        if (!formikRef.current) return;
        
        const form = formikRef.current;
        const user = userList.find(u => u._id === value);
        
        if (user) {
            // Update both Formik AND internal state
            form.setFieldValue(field, value);
            
            setFormState(prev => ({
                ...prev,
                lo_id: value
            }));
            
            // Fetch groups for this LO
            getListGroup(user.transactionType, value, 'filter');
        }
    };
    
    // Improved handler for group_id changes
    const handleGroupIdChange = (field, value) => {
        setLoading(true);
        if (!formikRef.current) return;
        
        const form = formikRef.current;
        
        // Update both Formik AND internal state
        form.setFieldValue(field, value);
        
        setFormState(prev => ({
            ...prev,
            group_id: value
        }));
        
        // Get clients for this group
        getListClient('active', value);
        
        setLoading(false);
    };
    
    // Improved handler for client_id changes
    const handleClientIdChange = (field, value) => {
        setLoading(true);
        if (!formikRef.current) return;
        
        const form = formikRef.current;
        const client = clientList.find(c => c.value === value);
        
        // Update Formik field
        form.setFieldValue(field, value);
        
        const updates = { client_id: value };
        
        // Add loan information if available
        if (client && client.loans && client.loans.length > 0) {
            setSlotNo(client.slotNo);
            setLoanBalance(client.loans[0].loanBalance || 0);
            setMcbu(client.loans[0].mcbu || 0);
            
            form.setFieldValue('loan_id', client.loans[0]._id);
            form.setFieldValue('group_leader', client.groupLeader);
            
            updates.loan_id = client.loans[0]._id;
            updates.group_leader = client.groupLeader;
        }
        
        // Update form state with all necessary changes
        setFormState(prev => ({
            ...prev,
            ...updates
        }));
        
        setLoading(false);
    };

    const getListUser = async () => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId: currentUser.designatedBranchId });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const users = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                users.push({
                    ...u,
                    name: name,
                    label: name,
                    value: u._id
                });
            });
            users.sort((a, b) => { return a.loNo - b.loNo; });

            dispatch(setUserList(users));
        } else {
            toast.error('Error retrieving user list.');
        }
    };

    const getListGroup = async (occurence, loId, mode) => {
        setLoading(true);
        
        let url = getApiBaseUrl() + 'groups/list-by-group-occurence';
        const effectiveLoId = loId || formState.lo_id;
        
        if (currentUser.role.rep === 4) { 
            let branchId = currentUser.designatedBranchId;
            if (mode === 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: currentUser._id, occurence: occurence });
            }
            await processGroupList(url);
        } else if (currentUser.role.rep === 3) {
            let branchId = currentUser.designatedBranchId;
            if (mode === 'filter') {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: effectiveLoId, occurence: occurence, mode: 'filter' });
            } else {
                url = url + '?' + new URLSearchParams({ branchId: branchId, loId: effectiveLoId, occurence: occurence });
            }
            await processGroupList(url);
        }
    };

    const processGroupList = async (url) => {
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
    };

    const getListClient = async (status, groupId) => {
        setLoading(true);
        
        const url = getApiBaseUrl() + 'clients/list?' + new URLSearchParams({ 
            mode: "view_existing_loan", 
            branchId: currentUser.designatedBranchId, 
            groupId: groupId, 
            status: status 
        });
        
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
    };

    const handleCancel = () => {
        setShowSidebar(false);
        if (formikRef.current) {
            formikRef.current.resetForm();
        }
        onClose();
    };

    // If loan is passed directly, use its values based on origin
    useEffect(() => {
        // Only use loan data if origin is "collection" and loan is not null
        if (origin === "collection" && loan && Object.keys(loan).length > 0) {
            setSlotNo(loan.slotNo || null);
            setLoanBalance(loan.loanBalance || 0);
            setMcbu(loan.mcbu || 0);
            setOccurence(loan.occurence || 'daily');
            
            // Update form state with loan values - use all available loan data
            setFormState(prev => ({
                ...prev,
                loan_id: loan.loanId || prev.loan_id,
                branch_id: loan.branchId || prev.branch_id,
                lo_id: loan.loId || prev.lo_id,
                group_id: loan.groupId || prev.group_id,
                client_id: loan.clientId || prev.client_id,
                group_leader: loan.client?.groupLeader || loan.groupLeader || false,
                division_id: currentUser.divisionId || prev.division_id,
                region_id: currentUser.regionId || prev.region_id,
                area_id: currentUser.areaId || prev.area_id
            }));
            
            // Also update Formik if available
            if (formikRef.current) {
                formikRef.current.setFieldValue('loan_id', loan.loanId || '');
                formikRef.current.setFieldValue('branch_id', loan.branchId || '');
                formikRef.current.setFieldValue('lo_id', loan.loId || '');
                formikRef.current.setFieldValue('group_id', loan.groupId || '');
                formikRef.current.setFieldValue('client_id', loan.clientId || '');
                formikRef.current.setFieldValue('group_leader', loan.client?.groupLeader || loan.groupLeader || false);
                formikRef.current.setFieldValue('division_id', currentUser.divisionId);
                formikRef.current.setFieldValue('region_id', currentUser.regionId);
                formikRef.current.setFieldValue('area_id', currentUser.areaId);
            }
        }
    }, [origin, loan, currentUser]);

    // Initial setup effect
    useEffect(() => {
        // Skip API calls if in collection mode with loan data
        if (origin === "collection" && loan) return;
        
        if (currentUser && currentUser.role && currentUser.role.rep === 3) {
            getListUser();
        }
        
        if (currentUser && currentUser.role && currentUser.role.rep === 4) {
            // Update form state with current user values
            setFormState(prev => ({
                ...prev,
                branch_id: currentUser.designatedBranchId,
                lo_id: currentUser._id,
                division_id: currentUser.divisionId,
                region_id: currentUser.regionId,
                area_id: currentUser.areaId
            }));
            
            // Make sure Formik has the same values
            if (formikRef.current) {
                formikRef.current.setFieldValue('branch_id', currentUser.designatedBranchId);
                formikRef.current.setFieldValue('lo_id', currentUser._id);
                formikRef.current.setFieldValue('division_id', currentUser.divisionId);
                formikRef.current.setFieldValue('region_id', currentUser.regionId);
                formikRef.current.setFieldValue('area_id', currentUser.areaId);
            }
            
            // Fetch groups if we have transaction type
            if (currentUser.transactionType) {
                getListGroup(currentUser.transactionType, currentUser._id, 'filter');
            }
        }
    }, [currentUser, origin, loan]);

    // Mode change effect
    useEffect(() => {
        let mounted = true;
        
        if (mode === 'add') {
            setTitle('Add MCBU Withdrawal');
        } else if (mode === 'edit') {
            setTitle('Edit MCBU Withdrawal');
        }
    
        mounted && setLoading(false);
    
        return () => {
            mounted = false;
        };
    }, [mode]);

    // Fetch groups when editing existing data or when it's not from collection
    useEffect(() => {
        // Skip API calls if origin is collection
        if (origin === "collection") return;
        
        // Get loan officer ID from mcbuData
        let selectedLoId = mcbuData?.lo_id;
        
        // If we have a loan officer ID, find the user and get their groups
        if (selectedLoId) {
            const user = userList.find(u => u._id === selectedLoId);
            if (user) {
                getListGroup(user.transactionType, user._id, 'filter');
            }
        }
    }, [mcbuData, origin, userList]);

    // Fetch clients when editing existing data or when it's not from collection
    useEffect(() => {
        // Skip API calls if origin is collection
        if (origin === "collection") return;
        
        // Get group ID from mcbuData
        let selectedGroupId = mcbuData?.group_id;
        
        // If we have a group ID, get its clients
        if (selectedGroupId) {
            getListClient('active', selectedGroupId);
        }
    }, [mcbuData, origin, groupList]);

    // Update form state when editing an existing record
    useEffect(() => {
        if (mode === 'edit' && mcbuData?._id) {
            setFormState(prev => ({
                ...prev,
                lo_id: mcbuData?.lo_id || prev.lo_id,
                branch_id: mcbuData?.branch_id || prev.branch_id,
                loan_id: mcbuData?.loan_id || prev.loan_id,
                group_id: mcbuData?.group_id || prev.group_id,
                client_id: mcbuData?.client_id || prev.client_id,
                mcbu_withdrawal_amount: mcbuData?.mcbu_withdrawal_amount || prev.mcbu_withdrawal_amount,
                group_leader: mcbuData?.group_leader || prev.group_leader
            }));
        }
    }, [mode, mcbuData?._id]);

    // Ensure formState changes are reflected in Formik
    useEffect(() => {
        if (formikRef.current) {
            // Update all Formik values to match formState
            Object.keys(formState).forEach(key => {
                if (formState[key] !== undefined) {
                    formikRef.current.setFieldValue(key, formState[key]);
                }
            });
        }
    }, [formState]);

     // Calculate maximum withdrawal amount based on MCBU balance and client type
     useEffect(() => {
        const groupLeader = formState.group_leader || 
                           (loan?.client?.groupLeader) || 
                           (loan?.groupLeader) || 
                           false;
        
        setIsGroupLeader(groupLeader);
        
        let maxAmount = 0;
        
        if (groupLeader) {
            // Group leaders can only withdraw excess over 3000
            maxAmount = Math.max(0, mcbu - 3000);
        } else if (occurence === 'daily') {
            // Regular clients can only withdraw excess over 1000
            maxAmount = Math.max(0, mcbu - 1000);
        } else {
            maxAmount = mcbu;
        }
        
        setMaxWithdrawalAmount(maxAmount);
    }, [mcbu, formState.group_leader, loan, occurence]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <Spinner />
                ) : (
                    <div className="px-2 pb-4">
                        <Formik 
                            enableReinitialize={true}
                            onSubmit={handleSaveUpdate}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            innerRef={formikRef}
                        >
                            {({
                                values,
                                touched,
                                errors,
                                handleChange,
                                handleSubmit,
                                setFieldValue,
                                setFieldTouched,
                                isSubmitting,
                                isValidating
                            }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">
                                    {/* Show read-only fields when origin is collection */}
                                    {origin === "collection" && loan ? (
                                        <>
                                            {/* Client Name */}
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Client Name
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-600 font-medium">{loan.fullName}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Group Name */}
                                            <div className="mt-4">
                                                <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                    <div className="flex justify-between">
                                                        <label className={`font-proxima-bold text-xs font-bold text-main`}>
                                                            Group
                                                        </label>
                                                    </div>
                                                    <span className="text-gray-600">{loan?.group?.name|| '-'}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Branch Name - if available */}
                                            {loan.branchName && (
                                                <div className="mt-4">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-main`}>
                                                                Branch
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-600">{loan.branchName}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {/* Show Selection Dropdowns when not in collection mode */}
                                            {currentUser.role && currentUser.role.rep === 3 && (
                                                <div className="mt-4">
                                                    <SelectDropdown
                                                        name="lo_id"
                                                        field="lo_id"
                                                        value={formState.lo_id}
                                                        label="Loan Officer (Required)"
                                                        options={userList}
                                                        onChange={(field, value) => handleLoIdChange(field, value)}
                                                        onBlur={setFieldTouched}
                                                        placeholder="Select Loan Officer"
                                                        errors={touched.lo_id && errors.lo_id ? errors.lo_id : undefined}
                                                    />
                                                </div>
                                            )}
                                            
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="group_id"
                                                    field="group_id"
                                                    value={formState.group_id}
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
                                                    value={formState.client_id}
                                                    label="Client (Required)"
                                                    options={clientList}
                                                    onChange={(field, value) => handleClientIdChange(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Client"
                                                    errors={touched.client_id && errors.client_id ? errors.client_id : undefined}
                                                />
                                            </div>
                                        </>
                                    )}
                                    
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'slotNo'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    Slot Number
                                                </label>
                                            </div>
                                            <span className="text-gray-600">{slotNo ? slotNo : '-'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'loanBalance'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    Loan Balance
                                                </label>
                                            </div>
                                            <span className="text-gray-600">{formatPricePhp(loanBalance)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white border-main`}>
                                            <div className="flex justify-between">
                                                <label htmlFor={'mcbu'} className={`font-proxima-bold text-xs font-bold text-main`}>
                                                    MCBU Balance
                                                </label>
                                            </div>
                                            <span className="text-gray-600 font-medium">{formatPricePhp(mcbu)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <InputNumber
                                            name="mcbu_withdrawal_amount"
                                            field="mcbu_withdrawal_amount"
                                            value={values.mcbu_withdrawal_amount}
                                            onChange={handleChange}
                                            label="MCBU Withdrawal Amount (Required)"
                                            disabled={values.status === 'active'}
                                            placeholder="Enter MCBU Withdrawal Amount"
                                            setFieldValue={setFieldValue}
                                            errors={touched.mcbu_withdrawal_amount && errors.mcbu_withdrawal_amount ? errors.mcbu_withdrawal_amount : undefined}
                                        />
                                        {mcbu > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Maximum withdrawal amount: {formatPricePhp(maxWithdrawalAmount)}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-row mt-5">
                                        <ButtonOutline label="Cancel" onClick={handleCancel} className="mr-3" />
                                        <ButtonSolid 
                                            label="Submit" 
                                            type="submit" 
                                            isSubmitting={isValidating && isSubmitting} 
                                            disabled={mcbu <= 0}
                                        />
                                    </div>
                                </form>
                            )}
                        </Formik>
                    </div>
                )}
            </SideBar>
        </React.Fragment>
    );
};

export default AddUpdateMcbuWithdrawalDrawer;