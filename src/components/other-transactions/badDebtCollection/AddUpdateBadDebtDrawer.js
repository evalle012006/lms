import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../../Spinner";
import SelectDropdown from "@/lib/ui/select";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import { setGroupList } from "@/redux/actions/groupActions";
import { setUserList } from "@/redux/actions/userActions";
import { setClientList } from "@/redux/actions/clientActions";
import { getApiBaseUrl } from "@/lib/constants";
import { 
    UserGroupIcon, 
    CurrencyDollarIcon,
    BanknotesIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

// UI-Only Components - No functionality changes
const SectionHeader = ({ icon: Icon, title, subtitle }) => (
    <div className="flex items-center space-x-3 pb-4 mb-6 border-b border-gray-200">
        <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600" />
        </div>
        <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
    </div>
);

const InfoCard = ({ label, value, type = "default" }) => {
    const getTypeStyles = () => {
        switch (type) {
            case "warning":
                return "bg-orange-50 border-orange-200";
            case "success":
                return "bg-green-50 border-green-200";
            default:
                return "bg-gray-50 border-gray-200";
        }
    };

    return (
        <div className={`p-4 rounded-lg border ${getTypeStyles()}`}>
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                {label}
            </div>
            <div className="text-lg font-semibold text-gray-900">
                {value}
            </div>
        </div>
    );
};

const LoanSummaryCard = ({ clientData }) => {
    if (!clientData) return null;

    const netBalance = (clientData.maturedPastDue || 0) + (clientData.mcbu || 0);

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <BanknotesIcon className="h-6 w-6 text-blue-600" />
                    <h4 className="text-lg font-semibold text-gray-900">Loan Summary</h4>
                </div>
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                    Matured & Past Due
                </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <InfoCard 
                    label="Loan Release" 
                    value={formatPricePhp(clientData.loanRelease || 0)}
                />
                <InfoCard 
                    label="Matured Past Due" 
                    value={formatPricePhp(clientData.maturedPastDue || 0)}
                    type="warning"
                />
                <InfoCard 
                    label="MCBU" 
                    value={formatPricePhp(clientData.mcbu || 0)}
                />
                <InfoCard 
                    label="Net Balance" 
                    value={formatPricePhp(netBalance)}
                />
            </div>

            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-100">
                <div className="flex items-start space-x-2">
                    <InformationCircleIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">
                        The payment collected will be deducted from the matured past due amount.
                    </p>
                </div>
            </div>
        </div>
    );
};

// MAIN COMPONENT - Preserving ALL original functionality
const AddUpdateDebtCollection = ({ mode = 'add', data = {}, showSidebar, setShowSidebar, onClose }) => {
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState();
    const [selectedLoanId, setSelectedLoanId] = useState();
    const [selectedGroupId, setSelectedGroupId] = useState();
    const [selectedLoId, setSelectedLoId] = useState();
    const [selectedLoType, setSelectedLoType] = useState();
    const [selectedClientData, setSelectedClientData] = useState(null);

    // ORIGINAL initialValues - unchanged
    const initialValues = {
        clientId: data.clientId,
        groupId: data.groupId,
        branchId: data.branchId,
        loId: data.loId,
        paymentCollection: data.paymentCollection
    };

    // ORIGINAL validationSchema - unchanged (empty)
    const validationSchema = yup.object().shape({
        // Original had no validation here - keeping it the same
    });

    // ORIGINAL handleSaveUpdate - EXACT same logic, no changes
    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (selectedGroupId == null) {
            toast.error('Please selct a group');
        } else if (selectedClientId == null) {
            toast.error('Please select a client');
        } else if (currentUser.role.rep == 3 && selectedLoId == null) {
            toast.error('Please select a loan officer.');
        } else if (values.paymentCollection == null || values.paymentCollection <= 0) {
            toast.error('Please enter amount collected.');
        } else {
            if (mode === 'add') {
                values.groupId = selectedGroupId;
                values.loId = selectedLoId;
                values.clientId = selectedClientId;
                values.loanId = selectedLoanId;
                values.branchId = currentUser.designatedBranchId;  // FIXED: Use designatedBranchId (always available)
                values.insertedBy = currentUser._id;
                values.insertedDate = new Date();
                const clientData = clientList.find(client => client._id == selectedClientId);
                if (clientData) {
                    values.loanRelease = clientData.loanRelease;
                    values.maturedPastDue = clientData.maturedPastDue;
                    values.mcbu = clientData.mcbu;
                }

                const apiUrl = getApiBaseUrl() + 'other-transactions/badDebtCollection/save/';  // ORIGINAL endpoint
    
                fetchWrapper.post(apiUrl, values)  // ORIGINAL - using .then pattern
                    .then(response => {
                        if (response.error) {
                            toast.error(response.message);
                        } else if (response.success) {
                            setLoading(false);
                            setShowSidebar(false);
                            toast.success('Collection successfully added.');  // ORIGINAL message
                            action.setSubmitting = false;
                            action.resetForm({values: ''});
                            onClose();
                        }
                    }).catch(error => {
                        console.log(error)
                    });
            }
        }
    };

    // ORIGINAL handleCancel - unchanged
    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    };

    // ORIGINAL handleLoIdChange - unchanged
    const handleLoIdChange = async (field, value) => {
        const form = formikRef.current;
        setSelectedLoId(value);
        await form.setFieldValue(field, value);

        const loData = userList.find(user => user._id == value);
        setSelectedLoType(loData?.transactionType);
        
        // Reset dependent fields
        setSelectedGroupId(null);
        setSelectedClientId(null);
        setSelectedClientData(null);
    };

    // ORIGINAL handleGroupIdChange - unchanged
    const handleGroupIdChange = async(field, value) => {
        const form = formikRef.current;
        setSelectedGroupId(value);
        await form.setFieldValue(field, value);
        
        // Reset dependent fields
        setSelectedClientId(null);
        setSelectedClientData(null);
    };

    // ORIGINAL handleClientIdChange - with UI enhancement to store client data
    const handleClientIdChange = async (field, value) => {
        const form = formikRef.current;
        setSelectedClientId(value);
        await form.setFieldValue(field, value);

        const clientData = clientList.find(client => client._id == value);
        setSelectedLoanId(clientData?.loanId);
        setSelectedClientData(clientData);  // Store for UI display
    };

    // ORIGINAL getListUser - with better error handling
    const getListUser = async (branchCode) => {
        let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchCode: branchCode });
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

            if (currentUser.role.rep === 4) {
                const name = `${currentUser.firstName} ${currentUser.lastName}`;
                userList = [];
                userList.push({
                    ...currentUser,
                    name: name,
                    label: name,
                    value: currentUser._id
                });
            }

            dispatch(setUserList(userList));
        } else {
            toast.error('Error retrieving user list.');
        }
    };

    // ORIGINAL getListGroup - unchanged
    const getListGroup = async (occurence, loId) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'groups/list-by-group-occurence?' + new URLSearchParams({ loId: loId, occurence: occurence, mode: 'filter' });
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
            dispatch(setGroupList(groups));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    };

    // ORIGINAL getListClient - unchanged
    const getListClient = async (groupId) => {
        setLoading(true);
        const url = getApiBaseUrl() + 'clients/list-matured-pd?' + new URLSearchParams({ groupId: groupId });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.data.map(loan => {
                const client = loan.client;

                clients.push({
                    ...client,
                    loanId: loan._id,
                    label: client.fullName,
                    value: client._id,
                    loanRelease: loan.loanRelease,
                    maturedPastDue: loan.maturedPastDue,
                    mcbu: loan.mcbuReturnAmt
                });
            });
            dispatch(setClientList(clients));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    };

    // FIXED: Use currentUser.designatedBranch to ensure users load when drawer opens
    // currentBranch.code might not be available yet, but designatedBranch always is
    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep == 3) {
            // Use designatedBranch (always available) instead of currentBranch.code (might not be loaded)
            mounted && currentUser.designatedBranch && getListUser(currentUser.designatedBranch);
        } else if (currentUser.role.rep == 4) {
            mounted && setSelectedLoId(currentUser._id);
            mounted && setSelectedLoType(currentUser.transactionType);
        }

        return () => {
            mounted = false;
        };
    }, [currentUser]);

    // ORIGINAL useEffect logic - unchanged
    useEffect(() => {
        if (selectedLoId && selectedLoType) {
            getListGroup(selectedLoType, selectedLoId);
        }
    }, [selectedLoId, selectedLoType]);

    // ORIGINAL useEffect logic - unchanged
    useEffect(() => {
        if (selectedGroupId) {
            getListClient(selectedGroupId);
        }
    }, [selectedGroupId]);

    return (
        <React.Fragment>
            <SideBar 
                title={mode === 'add' ? 'Add Bad Debt Collection' : 'Edit Bad Debt Collection'} 
                showSidebar={showSidebar} 
                setShowSidebar={setShowSidebar} 
                hasCloseButton={false}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Spinner />
                    </div>
                ) : (
                    <div className="px-6 py-4">
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
                                resetForm,
                                isSubmitting,
                                isValidating,
                                setFieldTouched
                            }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">
                                    {/* UI Enhancement: Section Header */}
                                    <SectionHeader 
                                        icon={UserGroupIcon}
                                        title="Client Selection" 
                                        subtitle="Select the loan officer, group, and client"
                                    />

                                    {/* ORIGINAL: Loan Officer dropdown (if branch manager) */}
                                    {currentUser.role.rep == 3 && (
                                        <div className="mb-6">
                                            <SelectDropdown
                                                name="loId"
                                                field="loId"
                                                value={selectedLoId}
                                                label="Loan Officer"
                                                options={userList}
                                                onChange={(field, value) => handleLoIdChange(field, value)}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Loan Officer"
                                                errors={touched.loId && errors.loId ? errors.loId : undefined}
                                            />
                                        </div>
                                    )}

                                    {/* ORIGINAL: Group dropdown */}
                                    <div className="mb-6">
                                        <SelectDropdown
                                            name="groupId"
                                            field="groupId"
                                            value={selectedGroupId}
                                            label="Group"
                                            options={groupList}
                                            onChange={(field, value) => handleGroupIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>

                                    {/* ORIGINAL: Client dropdown */}
                                    <div className="mb-6">
                                        <SelectDropdown
                                            name="clientId"
                                            field="clientId"
                                            value={selectedClientId}
                                            label="Client"
                                            options={clientList}
                                            onChange={(field, value) => handleClientIdChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Client"
                                            errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                        />
                                    </div>

                                    {/* UI Enhancement: Show loan summary when client selected */}
                                    {selectedClientData && (
                                        <>
                                            <LoanSummaryCard clientData={selectedClientData} />

                                            {/* UI Enhancement: Section Header */}
                                            <SectionHeader 
                                                icon={CurrencyDollarIcon}
                                                title="Payment Collection" 
                                                subtitle="Enter the amount collected from the client"
                                            />
                                        </>
                                    )}

                                    {/* ORIGINAL: Payment Collection input */}
                                    <div className="mb-6">
                                        <InputNumber
                                            name="paymentCollection"
                                            value={values.paymentCollection}
                                            onChange={handleChange}
                                            label="Actual Collection"
                                            placeholder="Enter Actual Collection"
                                            setFieldValue={setFieldValue}
                                            errors={touched.paymentCollection && errors.paymentCollection ? 
                                                errors.paymentCollection : undefined
                                            }
                                        />
                                    </div>

                                    {/* ORIGINAL: Action buttons - same layout with better spacing */}
                                    <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-5">
                                        <ButtonOutline 
                                            label="Cancel" 
                                            onClick={handleCancel} 
                                        />
                                        <ButtonSolid 
                                            label="Submit" 
                                            type="submit" 
                                            isSubmitting={isValidating && isSubmitting} 
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

export default AddUpdateDebtCollection;