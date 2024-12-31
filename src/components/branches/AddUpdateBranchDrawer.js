import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import { getApiBaseUrl } from "@/lib/constants";

const AddUpdateBranch = ({ mode = 'add', branch = {}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        name: branch.name,
        code: branch.code,
        phoneNumber: branch.phoneNumber,
        address: branch.address,
        email: branch.email
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        code: yup
            .string()
            .required('Please enter code'),
        email: yup
            .string()
            .email('Please enter valid email address')
            .required('Please enter email address'),
        phoneNumber: yup
            .string()
            .required('Please enter phone number'),
        address: yup
            .string()
            .required('Please enter address')

    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'branches/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Branch successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'branches';
            values._id = branch._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Branch successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    onClose();
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
    }, [branch]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Branch' : 'Edit Branch'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                    <div className="mt-4">
                                        <InputText
                                            name="code"
                                            value={values.code}
                                            onChange={handleChange}
                                            label="Code"
                                            placeholder="Enter Code"
                                            setFieldValue={setFieldValue}
                                            disabled={mode !== 'add'}
                                            errors={touched.code && errors.code ? errors.code : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="name"
                                            value={values.name}
                                            onChange={handleChange}
                                            label="Name"
                                            placeholder="Enter Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.name && errors.name ? errors.name : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="address"
                                            value={values.address}
                                            onChange={handleChange}
                                            label="Address"
                                            placeholder="Enter Address"
                                            setFieldValue={setFieldValue}
                                            errors={touched.address && errors.address ? errors.address : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputEmail
                                            name="email"
                                            value={values.email}
                                            onChange={handleChange}
                                            label="Email Address"
                                            placeholder="Enter Email Address"
                                            setFieldValue={setFieldValue}
                                            errors={touched.email && errors.email ? errors.email : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="phoneNumber"
                                            value={values.phoneNumber}
                                            onChange={handleChange}
                                            label="Phone Number"
                                            placeholder="Enter Phone Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.phoneNumber && errors.phoneNumber ? errors.phoneNumber : undefined} />
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

export default AddUpdateBranch;