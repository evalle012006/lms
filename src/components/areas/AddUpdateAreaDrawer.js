import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import {  useSelector } from "react-redux";
import SelectDropdown from "@/lib/ui/select";
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import { getApiBaseUrl } from "@/lib/constants";

const AddUpdateArea = ({ mode = 'add', area = {}, managerList=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const regionList = useSelector(state => state.region.list);
    const [loading, setLoading] = useState(false);

    const initialValues = {
        name: area.name,
        regionId: area.regionId,
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        regionId: yup
            .string()
            .required('Please choose region')
    });

    const handleRegionChange = (field, value) => {
        const form = formikRef.current;
        const region = regionList.find(r => r.value === value);
        
        form.setFieldValue(field, value);
        form.setFieldValue('divisionId', region.divisionId);

    };

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (mode === 'add') {
            const apiUrl = getApiBaseUrl() + 'areas/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Area successfully added.');
                        action.setSubmitting = false;
                        action.resetForm({values: ''});
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = getApiBaseUrl() + 'areas';
            values._id = area._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Area successfully updated.');
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
    }, [area, mode, regionList]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Area' : 'Edit Area'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                        <SelectDropdown
                                            name="regionId"
                                            field="regionId"
                                            value={values.regionId}
                                            label="Region"
                                            options={regionList}
                                            onChange={(field, value) => handleRegionChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Region"
                                            errors={touched.regionId && errors.regionId ? errors.regionId : undefined}
                                        />
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

export default AddUpdateArea;