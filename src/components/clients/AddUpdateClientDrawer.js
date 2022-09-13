import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import SelectDropdown from "@/lib/ui/select";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment'
import CheckBox from "@/lib/ui/checkbox";

const AddUpdateClient = ({ mode = 'add', client = {}, groups = [], branches = [], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);

    const initialValues = {
        firstName: client.firstName,
        middleName: client.clientName,
        lastName: client.lastName,
        birthdate: client.birthdate,
        addressStreetNo: client.addressStreetNo,
        addressBarangayDistrict: client.addressBarangayDistrict,
        addressMunicipalityCity: client.addressMunicipalityCity,
        addressProvince: client.addressProvince,
        addressZipCode: client.addressZipCode,
        contactNumber: client.contactNumber,
        groupId: client.groupId,
        branchId: client.branchId,
        status: client.status,
        delinquent: client.delinquent ? client.delinquent : false
    }

    const validationSchema = yup.object().shape({
        firstName: yup
            .string()
            .required('Please enter first name'),
        lastName: yup
            .string()
            .required('Please enter last name'),
        addressBarangayDistrict: yup
            .string()
            .required('Please enter barangay or district'),
        addressMunicipalityCity: yup
            .string()
            .required('Please enter municipality or city'),
        addressProvince: yup
            .string()
            .required('Please enter province'),
        addressZipCode: yup
            .string()
            .required('Please enter zip code'),
        groupId: yup
            .string()
            .required('Please select a group')
    });

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const setSelectedDate = (e) => {
        setDateValue(e);
        setShowCalendar(false);
    };

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        values.birthdate = dateValue.toISOString();
        const group = groups && groups.find(g => g._id === values.groupId);
        const branch = group && branches.find(b => b._id === group.branchId);
        values.groupName = group.name;
        values.branchId = branch._id;
        values.branchName = branch.name;
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'clients/save/';

            values.status = 'active';
            values.delinquent = false;

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
                        setDateValue(new Date());
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'clients';
            values._id = client._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Client successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm();
                    setDateValue(new Date());
                    onClose();
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        setDateValue(new Date());
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [client]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Client' : 'Edit Client'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            name="firstName"
                                            value={values.firstName}
                                            onChange={handleChange}
                                            label="First Name"
                                            placeholder="Enter First Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.firstName && errors.firstName ? errors.firstName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="middleName"
                                            value={values.middleName}
                                            onChange={handleChange}
                                            label="Middle Name"
                                            placeholder="Enter Middle Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.middleName && errors.middleName ? errors.middleName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="lastName"
                                            value={values.lastName}
                                            onChange={handleChange}
                                            label="Last Name"
                                            placeholder="Enter Last Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.lastName && errors.lastName ? errors.lastName : undefined} />
                                    </div>
                                    <div className="mt-4" onClick={openCalendar}>
                                        <InputText
                                            name="birthdate"
                                            value={moment(dateValue).format('MM - DD - YYYY')}
                                            onChange={handleChange}
                                            label="Birthdate" />
                                    </div>
                                    <Calendar onChange={setSelectedDate} value={dateValue} className={`px-4 mt-2 ${!showCalendar && 'hidden'}`} />
                                    <div>Address Information</div>
                                    <div className="mt-4">
                                        <InputText
                                            name="addressStreetNo"
                                            value={values.addressStreetNo}
                                            onChange={handleChange}
                                            label="Street No"
                                            placeholder="Enter Street No."
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressStreetNo && errors.addressStreetNo ? errors.addressStreetNo : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="addressBarangayDistrict"
                                            value={values.addressBarangayDistrict}
                                            onChange={handleChange}
                                            label="Barangay or District"
                                            placeholder="Enter Barangay or District"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressBarangayDistrict && errors.addressBarangayDistrict ? errors.addressBarangayDistrict : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="addressMunicipalityCity"
                                            value={values.addressMunicipalityCity}
                                            onChange={handleChange}
                                            label="Municipality or City"
                                            placeholder="Enter Municipality or City"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressMunicipalityCity && errors.addressMunicipalityCity ? errors.addressMunicipalityCity : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="addressProvince"
                                            value={values.addressProvince}
                                            onChange={handleChange}
                                            label="Province"
                                            placeholder="Enter Province"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressProvince && errors.addressProvince ? errors.addressProvince : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="addressZipCode"
                                            value={values.addressZipCode}
                                            onChange={handleChange}
                                            label="Zip Code"
                                            placeholder="Enter Zip Code"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressZipCode && errors.addressZipCode ? errors.addressZipCode : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="contactNumber"
                                            value={values.contactNumber}
                                            onChange={handleChange}
                                            label="Contact Number"
                                            placeholder="Enter Contact Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.contactNumber && errors.contactNumber ? errors.contactNumber : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="groupId"
                                            field="groupId"
                                            value={values.groupId}
                                            label="Group"
                                            options={groups}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                    {mode === 'edit' && (
                                        <React.Fragment>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="status"
                                                    field="status"
                                                    value={values.status}
                                                    label="Status"
                                                    options={[
                                                        {label: 'Active', value: 'active'},
                                                        {label: 'Inactive', value: 'inactive'}
                                                    ]}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Status"
                                                    errors={touched.status && errors.status ? errors.status : undefined}
                                                />
                                            </div>
                                            <div className="mt-4">
                                                <CheckBox 
                                                    name={delinquent}
                                                    value={values.delinquent} 
                                                    onChange={setFieldValue}  
                                                    label={"Delinquent"} 
                                                    size={"lg"} 
                                                />
                                            </div>
                                        </React.Fragment>
                                    )}
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

export default AddUpdateClient;