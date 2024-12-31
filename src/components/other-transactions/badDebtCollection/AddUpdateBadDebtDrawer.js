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
import { UppercaseFirstLetter } from "@/lib/utils";
import { setGroupList } from "@/redux/actions/groupActions";
import { setUserList } from "@/redux/actions/userActions";
import { setClientList } from "@/redux/actions/clientActions";
import { getApiBaseUrl } from "@/lib/constants";

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

    const initialValues = {
        clientId: data.clientId,
        groupId: data.groupId,
        branchId: data.branchId,
        loId: data.loId,
        paymentCollection: data.paymentCollection
    }

    const validationSchema = yup.object().shape({
        // clientId: yup
        //     .string()
        //     .required('Please select a client.'),
        // groupId: yup
        //     .string()
        //     .required('Please select a client.'),
        // branchId: yup
        //     .string()
        //     .required('Please select a client.'),
        // loId: yup
        //     .string()
        //     .required('Please select a client.'),
        // paymentCollection: yup
        //     .number()
        //     .integer()
        //     .positive()
        //     .required('Please enter a payment.'),
    });

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
                values.branchId = currentBranch._id;
                values.insertedBy = currentUser._id;
                values.insertedDate = new Date();
                const clientData = clientList.find(client => client._id == selectedClientId);
                if (clientData) {
                    values.loanRelease = clientData.loanRelease;
                    values.maturedPastDue = clientData.maturedPastDue;
                    values.mcbu = clientData.mcbu;
                }

                const apiUrl = getApiBaseUrl() + 'other-transactions/badDebtCollection/save/';
    
                fetchWrapper.post(apiUrl, values)
                    .then(response => {
                        if (response.error) {
                            toast.error(response.message);
                        } else if (response.success) {
                            setLoading(false);
                            setShowSidebar(false);
                            toast.success('Collection successfully added.');
                            action.setSubmitting = false;
                            action.resetForm({values: ''});
                            onClose();
                        }
                    }).catch(error => {
                        console.log(error)
                    });
            }
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    const handleLoIdChange = async (field, value) => {
        const form = formikRef.current;
        setSelectedLoId(value);
        await form.setFieldValue(field, value);

        const loData = userList.find(user => user._id == value);
        setSelectedLoType(loData?.transactionType);
    }

    const handleGroupIdChange = async(field, value) => {
        const form = formikRef.current;
        setSelectedGroupId(value);
        await form.setFieldValue(field, value);
    }

    const handleClientIdChange = async (field, value) => {
        const form = formikRef.current;
        setSelectedClientId(value);
        await form.setFieldValue(field, value);

        const clientData = clientList.find(client => client._id == value);
        setSelectedLoanId(clientData.loanId);
    }

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
    }

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
    }

    const getListClient = async (groupId) => {
        setLoading(true);
        const url = getApiBaseUrl() + 'clients/list-matured-pd?' + new URLSearchParams({ groupId: groupId });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.data.map(loan => {
                const client = loan.client[0];
                clients.push({
                    ...client,
                    loanId: loan._id,
                    label: client.name,
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
    }

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep == 3) {
            mounted && getListUser(currentBranch.code);
        } else if (currentUser.role.rep == 4) {
            mounted && setSelectedLoId(currentUser._id);
            mounted && setSelectedLoType(currentUser.transactionType);
        }

        return () => {
            mounted = false;
        };
    }, [currentUser, currentBranch]);

    useEffect(() => {
        if (selectedLoId && selectedLoType) {
            getListGroup(selectedLoType, selectedLoId);
        }
    }, [selectedLoId, selectedLoType]);

    useEffect(() => {
        if (selectedGroupId) {
            getListClient(selectedGroupId);
        }
    }, [selectedGroupId]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Bad Debt Collection' : 'Edit Bad Debt Collection'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
                {loading ? (
                    // <div className="flex items-center justify-center h-screen">
                        <Spinner />
                    // </div>
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
                                    { currentUser.role.rep == 3 && (
                                        <div className="mt-4">
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
                                    ) }
                                    <div className="mt-4">
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
                                    <div className="mt-4">
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
                                    <div className="mt-4">
                                        <InputNumber
                                            name="paymentCollection"
                                            value={values.paymentCollection}
                                            onChange={handleChange}
                                            label="Actual Collection"
                                            placeholder="Enter Actual Collection"
                                            setFieldValue={setFieldValue}
                                            errors={touched.paymentCollection && errors.paymentCollection ? errors.paymentCollection : undefined} />
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

export default AddUpdateDebtCollection;