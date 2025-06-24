import { getApiBaseUrl } from "@/lib/constants";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import InputText from "@/lib/ui/InputText";
import SideBar from "@/lib/ui/SideBar";
import { Formik } from 'formik';
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import * as yup from 'yup';
import Spinner from "../Spinner";

const AddUpdateDivision = ({ mode = 'add', division = {}, managerList=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        name: division.name
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name')
    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'divisions/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Division successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        setSelectedManagers([]);
                        setSelectedRegions([]);
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'divisions';
            values._id = division._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Division successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm({values: ''});
                    setSelectedManagers([]);
                    setSelectedRegions([]);
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
    }, [division]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Division' : 'Edit Division'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            name="name"
                                            value={values.name}
                                            onChange={handleChange}
                                            label="Name"
                                            placeholder="Enter Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.name && errors.name ? errors.name : undefined} />
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

export default AddUpdateDivision;