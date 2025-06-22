import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SelectDropdown from "@/lib/ui/select";
import SideBar from "@/lib/ui/SideBar";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import Spinner from "@/components/Spinner";
import { getApiBaseUrl } from "@/lib/constants";
import InputNumber from "@/lib/ui/InputNumber";

const AddUpdateFundTransfer = ({ mode = 'add', fundTransfer = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('Add Fund Transfer');
    const branchList = useSelector(state => state.branch.list);

    const [selectedGiverBranch, setSelectedGiverBranch] = useState();
    const [selectedReceiverBranch, setSelectedReceiverBranch] = useState();
    const [selectedAccount, setSelectedAccount] = useState();

    // Account options
    const accountOptions = [
        { value: 'BMC', label: 'Bank Manager\'s Check' },
        { value: 'B2B', label: 'Bank to Bank' },
        { value: 'REC', label: 'Remittance Center' },
        { value: 'CFT', label: 'Cash Fund Transfer' },
        { value: 'FFPAY', label: 'Payment for Furniture & Fixture' },
        { value: 'FTMO', label: 'FT to Main Office' },
        { value: 'MCPAY', label: 'Payment for Motorcycle' },
        { value: 'OSPAY', label: 'Payment for Office Supplies' },
        { value: 'MEDPAY', label: 'Payment for Medicine due to Medical Mission' },
        { value: 'RGGPAY', label: 'Payment for Relief Goods & Grants due to Calamity' },
        { value: 'UCRPAY', label: 'Unclaim Return of Client' },
        { value: 'ADVPAY', label: 'Advances due to Accident & Others' },
        { value: 'RENTPAY', label: 'Payment for Rental' },
        { value: 'DBPAY', label: 'Payment for Death Benefits' },
        { value: 'CPPAY', label: 'Payment for Communication & Postage' },
        { value: 'BDPPAY', label: 'Payment for Business Development' },
        { value: 'CLIPAY', label: 'Payment of Client' },
        { value: 'SDTR', label: 'Salary Disbursement due to Staff Transfer' },
        { value: 'EXPOTH', label: 'Any Expenses not Mentioned Above' }
    ];

    const initialValues = {
        giverBranchId: fundTransfer.giverBranchId || '',
        receiverBranchId: fundTransfer.receiverBranchId || '',
        amount: fundTransfer.amount || '',
        account: fundTransfer.account || '',
        description: fundTransfer.description || ''
    }

    const validationSchema = yup.object().shape({
        giverBranchId: yup
            .string()
            .required('Please select a giver branch.'),
        receiverBranchId: yup
            .string()
            .required('Please select a receiver branch.')
            .test('different-branches', 'Giver and receiver branches must be different', function(value) {
                return value !== this.parent.giverBranchId;
            })
            .test('not-same-as-designated', 'Cannot transfer to the same branch', function(value) {
                // For branch users, ensure they're not transferring to their own branch
                if (currentUser?.role?.rep === 3 && currentUser?.designatedBranchId) {
                    return value !== currentUser.designatedBranchId;
                }
                return true;
            }),
        amount: yup
            .number()
            .positive('Amount must be greater than zero')
            .required('Please enter transfer amount.'),
        account: yup
            .string()
            .required('Please select account type.'),
        description: yup
            .string()
            .min(5, 'Description must be at least 5 characters')
            .max(500, 'Description must not exceed 500 characters')
            .required('Please enter transfer description.')
    });

    const handleChangeGiverBranch = (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedGiverBranch(value);
        
        // Reset receiver branch if it's the same as giver branch
        if (selectedReceiverBranch === value) {
            setSelectedReceiverBranch('');
            form.setFieldValue('receiverBranchId', '');
        }
    }

    const handleChangeReceiverBranch = (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedReceiverBranch(value);
    }

    const handleChangeAccount = (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedAccount(value);
    }

    const reset = () => {
        if (currentUser?.role?.rep === 3 && currentUser?.designatedBranchId) {
            // For branch users, keep their designated branch as giver, reset only receiver and account
            setSelectedGiverBranch(currentUser.designatedBranchId);
            setSelectedReceiverBranch('');
            setSelectedAccount('');
        } else {
            // For other users, reset all
            setSelectedGiverBranch('');
            setSelectedReceiverBranch('');
            setSelectedAccount('');
        }
    }

    const handleSaveUpdate = (values, actions) => {
        setLoading(true);
        
        // Additional validation
        if (values.giverBranchId === values.receiverBranchId) {
            setLoading(false);
            toast.error('Giver and receiver branches must be different.');
            return;
        }

        if (values.amount <= 0) {
            setLoading(false);
            toast.error('Transfer amount must be greater than zero.');
            return;
        }

        // Prepare payload
        const payload = {
            ...values,
            amount: parseFloat(values.amount),
            insertedById: currentUser._id,
            insertedDate: currentDate,
            status: 'pending',
            giverApprovalStatus: 'pending',
            receiverApprovalStatus: 'pending',
            giverApprovalId: null,
            receiverApprovalId: null,
            giverRejectReason: null,
            receiverRejectReason: null,
            approvedRejectedDate: null
        };

        if (mode === "add") {
            fetchWrapper.post(getApiBaseUrl() + 'transactions/fund-transfer/save', payload)
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowSidebar(false);
                        toast.success('Fund transfer successfully added.');
                        actions.setSubmitting(false);
                        actions.resetForm({ values: '' });
                        reset();
                        onClose(true); // Pass true to trigger refresh
                    }
                }).catch(error => {
                    setLoading(false);
                    toast.error('Error creating fund transfer.');
                    console.error(error);
                });
        } else {
            // Update mode
            payload._id = fundTransfer._id;
            payload.currentUserId = currentUser._id;
            payload.modifiedById = currentUser._id;
            payload.modifiedDate = currentDate;
            
            fetchWrapper.put(getApiBaseUrl() + 'transactions/fund-transfer/update', payload)
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowSidebar(false);
                        toast.success('Fund transfer successfully updated.');
                        actions.setSubmitting(false);
                        actions.resetForm({ values: '' });
                        reset();
                        onClose(true); // Pass true to trigger refresh
                    }
                }).catch(error => {
                    setLoading(false);
                    toast.error('Error updating fund transfer.');
                    console.error(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current?.resetForm();
        reset();
        onClose();
    }

    // Get giver branch options based on user role
    const getGiverBranchOptions = () => {
        if (!branchList) return [];
        
        // For branch users (role.rep = 3), only show their designated branch
        if (currentUser?.role?.rep === 3 && currentUser?.designatedBranchId) {
            return branchList.filter(branch => branch._id === currentUser.designatedBranchId);
        }
        
        // For other users, show all branches
        return branchList;
    }

    // Get receiver branch options (exclude selected giver branch)
    const getReceiverBranchOptions = () => {
        if (!branchList) return [];
        return branchList.filter(branch => branch._id !== selectedGiverBranch);
    }

    // Get branch name by ID
    const getBranchName = (branchId) => {
        const branch = branchList?.find(b => b._id === branchId);
        return branch ? branch.name : '';
    }

    // Get account label by value
    const getAccountLabel = (accountValue) => {
        const account = accountOptions.find(a => a.value === accountValue);
        return account ? account.label : '';
    }

    // Get status display info
    const getStatusInfo = (status) => {
        switch (status) {
            case 'approved':
                return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', text: 'Approved' };
            case 'rejected':
                return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', text: 'Rejected' };
            case 'pending':
            default:
                return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'Pending' };
        }
    }

    useEffect(() => {
        let mounted = true;

        if (mode === 'add') {
            setTitle('Add Fund Transfer');
            
            // Auto-select designated branch for branch users
            if (currentUser?.role?.rep === 3 && currentUser?.designatedBranchId && branchList) {
                const form = formikRef.current;
                if (form && mounted) {
                    setSelectedGiverBranch(currentUser.designatedBranchId);
                    form.setFieldValue('giverBranchId', currentUser.designatedBranchId);
                }
            }
        } else if (mode === 'edit') {
            setTitle('Edit Fund Transfer');
            
            if (fundTransfer && Object.keys(fundTransfer).length > 0) {
                setSelectedGiverBranch(fundTransfer.giverBranchId);
                setSelectedReceiverBranch(fundTransfer.receiverBranchId);
                setSelectedAccount(fundTransfer.account);
            }
        }

        return () => {
            mounted = false;
        };
    }, [mode, fundTransfer, currentUser?.designatedBranchId, branchList]);

    return (
        <React.Fragment>
            <SideBar title={title} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    <Spinner />
                ) : (
                    <div className="px-2 pb-8">
                        {/* Transaction Code Display - Only show in edit mode */}
                        {mode === 'edit' && fundTransfer?.transactionCode && (
                            <div className="mt-4 mb-6">
                                <div className="border rounded-md px-4 py-3 bg-blue-50 border-blue-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                                                Transaction Code
                                            </label>
                                            <div className="mt-1">
                                                <span className="font-mono text-lg font-semibold text-blue-800 bg-white px-3 py-1 rounded border border-blue-300">
                                                    {fundTransfer.transactionCode}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-blue-500">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Current Status Display - Only show in edit mode */}
                        {mode === 'edit' && fundTransfer && (
                            <div className="mt-4 mb-6">
                                <h3 className="text-sm font-bold text-main mb-3">Current Status</h3>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Giver Approval
                                        </label>
                                        <div className={`px-3 py-2 rounded-md border ${getStatusInfo(fundTransfer.giverApprovalStatus).bg} ${getStatusInfo(fundTransfer.giverApprovalStatus).border}`}>
                                            <span className={`text-sm font-medium ${getStatusInfo(fundTransfer.giverApprovalStatus).color}`}>
                                                {getStatusInfo(fundTransfer.giverApprovalStatus).text}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Receiver Approval
                                        </label>
                                        <div className={`px-3 py-2 rounded-md border ${getStatusInfo(fundTransfer.receiverApprovalStatus).bg} ${getStatusInfo(fundTransfer.receiverApprovalStatus).border}`}>
                                            <span className={`text-sm font-medium ${getStatusInfo(fundTransfer.receiverApprovalStatus).color}`}>
                                                {getStatusInfo(fundTransfer.receiverApprovalStatus).text}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Overall Status */}
                                <div className="mt-3">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Overall Status
                                    </label>
                                    <div className={`mt-1 px-3 py-2 rounded-md border ${getStatusInfo(fundTransfer.status).bg} ${getStatusInfo(fundTransfer.status).border}`}>
                                        <span className={`text-sm font-medium ${getStatusInfo(fundTransfer.status).color}`}>
                                            {getStatusInfo(fundTransfer.status).text}
                                        </span>
                                    </div>
                                </div>

                                {/* Show reject reasons if any */}
                                {(fundTransfer.giverRejectReason || fundTransfer.receiverRejectReason) && (
                                    <div className="mt-3">
                                        <label className="text-xs font-bold text-red-600 uppercase tracking-wider">
                                            Rejection Reason(s)
                                        </label>
                                        <div className="mt-1 px-3 py-2 rounded-md border bg-red-50 border-red-200">
                                            {fundTransfer.giverRejectReason && (
                                                <div className="text-sm text-red-800">
                                                    <span className="font-medium">Giver:</span> {fundTransfer.giverRejectReason}
                                                </div>
                                            )}
                                            {fundTransfer.receiverRejectReason && (
                                                <div className="text-sm text-red-800 mt-1">
                                                    <span className="font-medium">Receiver:</span> {fundTransfer.receiverRejectReason}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="border-b border-zinc-300 h-4 mt-6"></div>
                            </div>
                        )}

                        <Formik 
                            enableReinitialize={true}
                            onSubmit={handleSaveUpdate}
                            initialValues={initialValues}
                            validationSchema={validationSchema}
                            innerRef={formikRef}
                        >
                            {({
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
                                            name="account"
                                            field="account"
                                            value={selectedAccount}
                                            label="Account Type"
                                            options={accountOptions}
                                            onChange={(field, value) => handleChangeAccount(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Account Type"
                                            disabled={mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved')}
                                            errors={touched.account && errors.account ? errors.account : undefined}
                                        />
                                        {mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved') && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                Cannot change account type after approval
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="giverBranchId"
                                            field="giverBranchId"
                                            value={selectedGiverBranch}
                                            label="From Branch (Giver)"
                                            options={getGiverBranchOptions()}
                                            onChange={(field, value) => handleChangeGiverBranch(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Giver Branch"
                                            disabled={currentUser?.role?.rep === 3}
                                            errors={touched.giverBranchId && errors.giverBranchId ? errors.giverBranchId : undefined}
                                        />
                                        {mode === 'edit' && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                Giver branch cannot be changed after creation
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="receiverBranchId"
                                            field="receiverBranchId"
                                            value={selectedReceiverBranch}
                                            label="To Branch (Receiver)"
                                            options={getReceiverBranchOptions()}
                                            onChange={(field, value) => handleChangeReceiverBranch(field, value)}
                                            onBlur={setFieldTouched}
                                            disabled={!selectedGiverBranch || (mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved'))}
                                            placeholder="Select Receiver Branch"
                                            errors={touched.receiverBranchId && errors.receiverBranchId ? errors.receiverBranchId : undefined}
                                        />
                                        {mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved') && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                Cannot change receiver branch after approval
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <InputNumber
                                            name="amount"
                                            value={values.amount}
                                            label="Transfer Amount"
                                            placeholder="Enter transfer amount"
                                            onChange={handleChange}
                                            onBlur={() => setFieldTouched('amount', true)}
                                            disabled={mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved')}
                                            errors={touched.amount && errors.amount ? errors.amount : undefined}
                                        />
                                        {mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved') && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                Cannot change amount after approval
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <div className={`
                                            flex justify-between rounded-md px-4 py-1 border mb-2 bg-white
                                            ${values.description ? 'border border-main' : 'border-slate-400'}
                                            ${errors.description && touched.description && 'border border-red-400'}
                                        `}>
                                            <div className="flex flex-col w-full">
                                                <label htmlFor="description" className={`
                                                    text-xs font-bold 
                                                    ${values.description ? 'text-main' : 'text-gray-500'}
                                                    ${errors.description && touched.description && 'text-red-400'}
                                                `}>
                                                    Description
                                                </label>
                                                <textarea
                                                    name="description"
                                                    value={values.description}
                                                    onChange={handleChange}
                                                    onBlur={() => setFieldTouched('description', true)}
                                                    placeholder="Enter transfer description/purpose"
                                                    rows={4}
                                                    disabled={mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved')}
                                                    className={`
                                                        p-1 pl-0 text-gray-500 font-medium border-none focus:ring-0 text-sm resize-none
                                                        ${errors.description && touched.description && 'text-red-400'}
                                                        ${mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved') && 'bg-gray-50 cursor-not-allowed'}
                                                    `}
                                                />
                                            </div>
                                        </div>
                                        {errors.description && touched.description && (
                                            <span className="text-red-400 text-xs font-medium">{errors.description}</span>
                                        )}
                                        {mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved') && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                Cannot change description after approval
                                            </p>
                                        )}
                                    </div>

                                    {/* Transfer Summary */}
                                    {selectedGiverBranch && selectedReceiverBranch && values.amount && selectedAccount && (
                                        <React.Fragment>
                                            <div className="border-b border-zinc-300 h-4 mt-6"></div>
                                            <div className="mt-4">
                                                <h3 className="text-sm font-bold text-main mb-3">Transfer Summary</h3>
                                                
                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                From Branch
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700">{getBranchName(selectedGiverBranch)}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                To Branch
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700">{getBranchName(selectedReceiverBranch)}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                Transfer Amount
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700 font-semibold">{formatPricePhp(parseFloat(values.amount || 0))}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                Account Type
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700">{getAccountLabel(selectedAccount)}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                {mode === 'edit' ? 'Created By' : 'Requested By'}
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700">
                                                            {mode === 'edit' && fundTransfer.insertedBy 
                                                                ? `${fundTransfer.insertedBy.firstName} ${fundTransfer.insertedBy.lastName}`
                                                                : `${currentUser?.firstName} ${currentUser?.lastName}`
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                {mode === 'edit' ? 'Created Date' : 'Request Date'}
                                                            </label>
                                                        </div>
                                                        <span className="text-gray-700">
                                                            {mode === 'edit' && fundTransfer.insertedDate 
                                                                ? new Date(fundTransfer.insertedDate).toLocaleDateString()
                                                                : currentDate
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <div className={`flex flex-col border rounded-md px-4 py-2 bg-gray-50 border-gray-300`}>
                                                        <div className="flex justify-between">
                                                            <label className={`font-proxima-bold text-xs font-bold text-gray-600`}>
                                                                Status
                                                            </label>
                                                        </div>
                                                        <span className={`font-medium ${mode === 'edit' ? getStatusInfo(fundTransfer.status).color : 'text-yellow-600'}`}>
                                                            {mode === 'edit' 
                                                                ? getStatusInfo(fundTransfer.status).text
                                                                : 'Pending Approval'
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )}

                                    <div className="flex flex-row mt-6">
                                        <ButtonOutline 
                                            label="Cancel" 
                                            onClick={handleCancel} 
                                            className="mr-3" 
                                            disabled={isSubmitting}
                                        />
                                        <ButtonSolid 
                                            label={mode === 'edit' ? 'Update Transfer' : 'Submit Transfer'} 
                                            type="submit" 
                                            isSubmitting={isValidating && isSubmitting} 
                                            disabled={mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved' || fundTransfer.status === 'approved' || fundTransfer.status === 'rejected')}
                                        />
                                    </div>
                                    
                                    {mode === 'edit' && (fundTransfer.giverApprovalStatus === 'approved' || fundTransfer.receiverApprovalStatus === 'approved' || fundTransfer.status === 'approved' || fundTransfer.status === 'rejected') && (
                                        <p className="mt-2 text-xs text-gray-500 text-center">
                                            This transfer cannot be modified due to its current approval status
                                        </p>
                                    )}
                                </form>
                            )}
                        </Formik>
                    </div>
                )}
            </SideBar>
        </React.Fragment>
    )
}

export default AddUpdateFundTransfer;