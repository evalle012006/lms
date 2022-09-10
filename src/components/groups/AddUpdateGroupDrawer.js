import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import SelectDropdown from "@/lib/ui/select";

const AddUpdateGroup = ({ mode = 'add', group = {}, branches = [], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(group.name);
    const [day, setDay] = useState(group.day);
    const [dayNo, setDayNo] = useState(group.dayNo);
    const days = [
        {label: 'Monday', value: 'monday', dayNo: 1}, 
        {label: 'Tuesday', value: 'tuesday', dayNo: 2}, 
        {label: 'Wednesday', value: 'wednesday', dayNo: 3}, 
        {label: 'Thursday', value: 'thursday', dayNo: 4}, 
        {label: 'Friday', value: 'friday', dayNo: 5}
    ];

    const initialValues = {
        name: name,
        branchId: group.branchId,
        day: day,
        dayNo: dayNo,
        time: group.time,
        groupNo: group.groupNo
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        branchId: yup
            .string()
            .required('Please select a branch'),
        day: yup
            .string()
            .required('Please select a day'),
        time: yup
            .string()
            .required('Please enter time'),
        groupNo: yup
            .string()
            .required('Please select a group number'),

    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        values.name = name;
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'groups/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Group successfully added.');
                        action.setSubmitting = false;
                        action.resetForm();
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'groups';
            values._id = group._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Group successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm();
                    onClose();
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
    }

    const handleChangeDay = async (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        const day = days.find(d => d.value === value);
        // set formik field value and state
        setDayNo(day.dayNo);
        setDay(value);
        form.setFieldValue(field, value);
        setLoading(false);
    }

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [group]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Group' : 'Edit Group'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            onChange={(e) => setName(e.target.value)}
                                            label="Name"
                                            placeholder="Enter Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.name && errors.name ? errors.name : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="day"
                                            field="day"
                                            value={values.day}
                                            label="Day"
                                            options={days}
                                            onChange={(field, value) => handleChangeDay(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Day"
                                            errors={touched.day && errors.day ? errors.day : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
                                            name="dayNo"
                                            value={values.dayNo}
                                            onChange={handleChange}
                                            label="Day No"
                                            placeholder="Enter day number"
                                            disabled={true}
                                            setFieldValue={setFieldValue}
                                            errors={touched.dayNo && errors.dayNo ? errors.dayNo : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="time"
                                            value={values.time}
                                            onChange={handleChange}
                                            label="Time"
                                            placeholder="Enter Time"
                                            setFieldValue={setFieldValue}
                                            errors={touched.time && errors.time ? errors.time : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                                name="groupNo"
                                                field="groupNo"
                                                value={values.groupNo}
                                                label="Group Number"
                                                options={[
                                                    { label: 1, value: 1 },
                                                    { label: 2, value: 2 },
                                                    { label: 3, value: 3 },
                                                    { label: 4, value: 4 },
                                                    { label: 5, value: 5 },
                                                    { label: 6, value: 6 },
                                                    { label: 7, value: 7 },
                                                    { label: 8, value: 8 }
                                                ]}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Group Number"
                                                errors={touched.groupNo && errors.groupNo ? errors.groupNo : undefined}
                                            />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="branchId"
                                            field="branchId"
                                            value={values.branchId}
                                            label="Branch"
                                            options={branches}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Branch"
                                            errors={touched.branchId && errors.branchId ? errors.branchId : undefined}
                                        />
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

export default AddUpdateGroup;