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

const AddUpdateLoan = ({ mode = 'add', loan = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);

    const initialValues = {
        branchId: loan.branchId,
        groupId: loan.groupId,
        slotNo: loan.slotNo,
        clientId: loan.clientId,
        fullName: loan.fullName,
        admissionDate: loan.admissionDate,
        mcbu: loan.mcbu,
        dateGranted: loan.dateGranted,
        principalLoan: loan.principalLoan,
        activeLoan: loan.activeLoan,
        loanBalance: loan.loanBalance,
        noOfPayments: loan.noOfPayments,
        coMaker: loan.coMaker,
        status: loan.status,
    }

    const validationSchema = yup.object().shape({
        groupId: yup
            .string()
            .required('Please select a group'),
        clientId: yup
            .string()
            .required('Please select a client'),
        principalLoan: yup
            .number()
            .integer()
            .positive()
            .moreThan(0, 'Princal loan should be greater than 0')
            .required('Please enter principal loan'),
        coMaker: yup
            .string()
            .required('Please enter co-maker')
    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        const group = groupList.find(g => g._id === values.groupId);
        values.groupName = group.name;
        const branch = branchList.find(b => b._id === group.branchId);
        values.branchId = branch._id;
        values.brancName = branch.name;

        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/save/';

            values.lastUpdated = null;  // use only when updating the mispayments
            values.admissionDate = moment(values.admissionDate).format('YYYY-MM-DD');

            if (group.occurence === 'weekly') {
                values.mcbu = 50;
                values.activeLoan = (values.principalLoan * 1.20) / 24;
            } else if (group.occurence === 'daily') {
                values.activeLoan = (values.principalLoan * 1.20) / 60;
            }

            values.loanBalance = values.principalLoan * 1.20; // initial
            values.loanCycle = 1;
            values.noOfPayments = 0;
            values.status = 'pending';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setShowSidebar(false);
                        toast.success('Loan successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans';
            values._id = loan._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.success) {
                        let error = false;
                        if (values.status === 'active' && values.groupId !== loan.groupId) {
                            let params = { groupId: values.groupId, oldGroupId: loan.groupId };
                            
                            fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'groups/update-group', params)
                                .then(response => {
                                    if (response.error) {
                                        setLoading(false);
                                        error = true;
                                        toast.error(response.message);
                                    }
                            });
                        }

                        if (!error) {
                            setLoading(false);
                            setShowSidebar(false);
                            toast.success('Loan successfully updated.');
                            action.setSubmitting = false;
                            action.resetForm();
                            onClose();
                        }
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Loan' : 'Edit Loan'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            value={values.groupId}
                                            label="Group"
                                            options={groupList}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="clientId"
                                            field="clientId"
                                            value={values.clientId}
                                            label="Client"
                                            options={clientList}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Client"
                                            errors={touched.clientId && errors.clientId ? errors.clientId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="principalLoan"
                                            value={values.principalLoan}
                                            onChange={handleChange}
                                            label="Principal Loan"
                                            placeholder="Enter Principal Loan"
                                            setFieldValue={setFieldValue}
                                            errors={touched.principalLoan && errors.principalLoan ? errors.principalLoan : undefined} />
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

export default AddUpdateLoan;