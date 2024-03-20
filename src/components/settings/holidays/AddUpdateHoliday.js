import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "@/components/Spinner";
import { UppercaseFirstLetter } from "@/lib/utils";
import { getApiBaseUrl } from '@/lib/constants';

const AddUpdateHoliday = ({ mode = 'add', holiday={}, showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        name: mode === 'edit' ? UppercaseFirstLetter(holiday.name) : '',
        description: mode === 'edit' ? holiday.description : '',
        date: holiday.date
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        date: yup
            .string()
            .required('Please enter date')

    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (values.date.length !== 5) {
            setLoading(false);
            toast.error('Invalid date entered.');
        } else {
            if (mode === 'add') {
                const apiUrl = getApiBaseUrl() + 'settings/holidays/save/';
    
                fetchWrapper.post(apiUrl, values)
                    .then(response => {
                        if (response.error) {
                            toast.error(response.message);
                            setLoading(false);
                        } else if (response.success) {
                            setLoading(false);
                            setShowSidebar(false);
                            toast.success('Holiday successfully added.');
                            action.setSubmitting = false;
                            action.resetForm();
                            onClose();
                        }
                    }).catch(error => {
                        console.log(error)
                    });
            } else if (mode === 'edit') {
                const apiUrl = getApiBaseUrl() + 'settings/holidays';
                values._id = holiday._id;
                fetchWrapper.post(apiUrl, values)
                    .then(response => {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Holiday successfully updated.');
                        action.setSubmitting = false;
                        action.resetForm();
                        onClose();
                    }).catch(error => {
                        console.log(error);
                    });
            }
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
            <SideBar title={mode === 'add' ? 'Add Holiday' : 'Edit Holiday'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            name="description"
                                            value={values.description}
                                            onChange={handleChange}
                                            label="Description"
                                            placeholder="Enter Description"
                                            setFieldValue={setFieldValue}
                                            errors={touched.description && errors.description ? errors.description : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="date"
                                            value={values.date}
                                            onChange={handleChange}
                                            setFieldValue={setFieldValue}
                                            placeholder="MM-DD"
                                            label="Holiday Date" />
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

export default AddUpdateHoliday;