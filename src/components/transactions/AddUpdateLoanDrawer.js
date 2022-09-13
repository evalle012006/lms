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
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment'
import SelectDropdown from "@/lib/ui/select";

const AddUpdateLoan = ({ mode = 'add', loan = {}, groups=[], clients=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [showAdmissionCalendar, setShowAdmissionCalendar] = useState(false);
    const [admissionDateValue, setAdmissionDateValue] = useState(new Date());
    const [showGrantedCalendar, setShowGrantedCalendar] = useState(false);
    const [dateGrantedValue, setDateGrantedValue] = useState(new Date());
    const slotArr = [...Array(40).keys()].map((val, index) => {
        const value = index + 1;
        return {label: value, value: value};
    });
    const status = [
        {label: 'Active', value: 'active'}
    ];

    const initialValues = {
        groupId: loan.groupId,
        slotNo: loan.slotNo,
        status: loan.status,
        clientId: loan.clientId,
        lastName: loan.lastName,
        firstName: loan.firstName,
        middleName: loan.middleName,
        admissionDate: loan.admissionDate,
        cbu: loan.cbu,
        lcbu: loan.lcbu,
        dateGranted: loan.dateGranted,
        principalLoan: loan.principalLoan,
        activeLoan: loan.activeLoan,
        loanBalance: loan.loanBalance,
        noOfWeeks: loan.noOfWeeks,
        coMaker: loan.coMaker
    }

    const validationSchema = yup.object().shape({
        groupId: yup
            .string()
            .required('Please select group'),
        clientId: yup
            .string()
            .required('Please select clientId'),
        principalLoan: yup
            .string()
            .required('Please enter principal loan'),
        activeLoan: yup
            .string()
            .required('Please enter active loan'),
        loanBalance: yup
            .string()
            .required('Please enter loan balance'),
        noOfWeeks: yup
            .string()
            .required('Please enter number of weeks'),
        loanBalance: yup
            .string()
            .required('Please enter co-maker'),

    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        const group = groups.find(g => g._id === values.groupId);
        values.groupName = group.name;
        const client = clients.find(c => c._id === values.clientId);
        values.firstName = client.firstName;
        values.middleName = client.middleName;
        values.lastName = client.lastName;
        values.admissionDate = admissionDateValue.toISOString();
        values.dateGranted = dateGrantedValue.toISOString();
        
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'loans/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'loans';
            values._id = loan._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Loan successfully updated.');
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

    const openCalendar = (component) => {
        if (component === 'admission') {
            setShowAdmissionCalendar(true);
        }

        if (component === 'granted') {
            setShowGrantedCalendar(true);
        }
    };

    const setSelectedDate = (e, component) => {
        if (component === 'admission') {
            setAdmissionDateValue(e);
            setShowAdmissionCalendar(false);
        }

        if (component === 'granted') {
            setDateGrantedValue(e);
            setShowGrantedCalendar(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Branch' : 'Edit Branch'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            options={groups}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="slotNo"
                                            field="slotNo"
                                            value={values.slotNo}
                                            label="Slot No."
                                            options={slotArr}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="code"
                                            value={values.code}
                                            onChange={handleChange}
                                            label="Code"
                                            placeholder="Enter Code"
                                            setFieldValue={setFieldValue}
                                            errors={touched.lastName && errors.lastName ? errors.lastName : undefined} />
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
                                    <div className="mt-4" onClick={() => openCalendar('admission')}>
                                        <InputText
                                            name="birthdate"
                                            value={moment(admissionDateValue).format('MM - DD - YYYY')}
                                            onChange={handleChange}
                                            label="Birthdate" />
                                    </div>
                                    <Calendar onChange={(e) => setSelectedDate(e, 'admission')} value={admissionDateValue} className={`px-4 mt-2 ${!showAdmissionCalendar && 'hidden'}`} />
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
                                        <InputNumber
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

export default AddUpdateLoan;