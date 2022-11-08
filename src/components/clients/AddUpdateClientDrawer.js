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
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
// add loan officer per client
const AddUpdateClient = ({ mode = 'add', client = {}, showSidebar, setShowSidebar, onClose }) => {
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const userList = useSelector(state => state.user.list);
    const [loUsers, setLoUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [photo, setPhoto] = useState();
    const [photoW, setPhotoW] = useState(200);
    const [photoH, setPhotoH] = useState(200);
    const [image, setImage] = useState('');

    const initialValues = {
        firstName: client.firstName,
        middleName: client.middleName,
        lastName: client.lastName,
        birthdate: client.birthdate,
        addressStreetNo: client.addressStreetNo,
        addressBarangayDistrict: client.addressBarangayDistrict,
        addressMunicipalityCity: client.addressMunicipalityCity,
        addressProvince: client.addressProvince,
        addressZipCode: client.addressZipCode,
        contactNumber: client.contactNumber,
        // groupId: client.groupId,
        branchId: client.branchId,
        loId: client.loId,
        status: client.status,
        delinquent: client.delinquent === "Yes" ? true : false,
    }

    const validationSchema = yup.object().shape({
        firstName: yup
            .string()
            .required('Please enter first name'),
        lastName: yup
            .string()
            .required('Please enter last name'),
        // addressBarangayDistrict: yup
        //     .string()
        //     .required('Please enter barangay or district'),
        // addressMunicipalityCity: yup
        //     .string()
        //     .required('Please enter municipality or city'),
        // addressProvince: yup
        //     .string()
        //     .required('Please enter province'),
        // addressZipCode: yup
        //     .string()
        //     .required('Please enter zip code'),
        loId: yup
            .string()
            .required('Please select a Loan Officer')
    });

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const setSelectedDate = (e) => {
        setDateValue(e);
        setShowCalendar(false);
    };

    const handleSaveUpdate = (values, action) => {
        let error = false;
        setLoading(true);
        values.insertedBy = currentUser._id;
        values.middleName = values.middleName ? values.middleName : '';
        values.addressBarangayDistrict = values.addressBarangayDistrict ? values.addressBarangayDistrict : '';
        values.addressMunicipalityCity = values.addressMunicipalityCity ? values.addressMunicipalityCity : '';
        values.addressProvince = values.addressProvince ? values.addressProvince : '';
        values.addressStreetNo = values.addressStreetNo ? values.addressStreetNo : '';
        values.addressZipCode = values.addressZipCode ? values.addressZipCode : '';
        values.birthdate = dateValue.toISOString();
        // const group = groupList && groupList.find(g => g._id === values.groupId);
        // values.groupName = group.name;
        if (currentUser.root !== true && (currentUser.role.rep === 4 || currentUser.role.rep === 3) && branchList.length > 0) {
            const branch = branchList.find(b => b.code === currentUser.designatedBranch);
            values.branchId = branch._id;
            values.branchName = branch.name;
        } // if area manager it should be able to select a branch where this client is
        
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'clients/save/';

            values.status = 'pending';
            values.delinquent = false;

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                        error = true;
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        action.setSubmitting = false;
                        action.resetForm();
                        setDateValue(new Date());
                        onClose();
                        toast.success('Client successfully added.');
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            values._id = client._id;
            if (image.trim().length > 0) {
                values.file = image;
            }
            fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'clients/', values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    action.setSubmitting = false;
                    action.resetForm();
                    setDateValue(new Date());
                    onClose();
                    toast.success('Client successfully updated.');
                }).catch(error => {
                    console.log(error);
                });
        }

        // if (error !== true) {
        //     // update group slot no and status
        //     let params = { groupId: values.groupId };

        //     if (values.groupId !== client.groupId) {
        //         params.oldGroupId = client.groupId;
        //     }
            
        //     fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'groups/list', params)
        //         .then(response => {
        //             if (response.error) {
        //                 toast.error(response.message);
        //             } else {
                        // setLoading(false);
                        // setShowSidebar(false);
                        // action.setSubmitting = false;
                        // action.resetForm();
                        // setDateValue(new Date());
                        // onClose();
        //             }
        //     });
        // }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        setDateValue(new Date());
        onClose();
    }

    const onUploadClick = () => {
        hiddenInput.current.click();
    }

    const handleFileChange = async e => {
        if (e.target.value) {
            const fileUploaded = e.target.files[0];
            setPhoto(URL.createObjectURL(fileUploaded));
            setImage(fileUploaded);
        }
    }

    const handleRemoveImage = () => {
        setPhoto('');
        setImage('');
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
    }

    useEffect(() => {
        let mounted = true;

        if (client.imgUrl) {
            mounted && setPhoto(`${client.imgUrl}`);
        }

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [client]);

    useEffect(() => {
        if (userList) {
            const temp = userList.filter(u => u.role.rep === 4);
            setLoUsers(temp);
        }
    }, [userList]);

    useEffect(() => {
        if (currentUser && currentUser.role.rep === 4) {
            const form = formikRef.current;
            form.setFieldValue('loId', currentUser._id);
        }
    }, [currentUser]);

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
                                    {mode === 'edit' && (
                                        <div className="profile-photo rounded-lg p-3 proxima-regular border">
                                            <div className="proxima-bold">Profile Photo</div>
                                            <div className="photo-row mt-4 flex space-x-4">
                                                <div className="photo-container rounded-lg">
                                                    <div className="w-[200px] h-[200px] relative flex justify-center bg-slate-200 rounded-xl border overflow-hidden">
                                                        <Image src={!photo ? placeholder : photo}
                                                            className="overflow-hidden"
                                                            width={photoW}
                                                            height={photoH} />
                                                    </div>
                                                    <input type="file" name="file" ref={hiddenInput} onChange={(e) => handleFileChange(e)} className="hidden" />
                                                </div>
                                                <div className="w-48">
                                                    <div className="flex flex-col space-y-4">
                                                        <span>Photo should be at least 300px x 300px</span>
                                                        <ButtonSolid label="Upload Photo" onClick={onUploadClick} />
                                                        <ButtonOutline label="Remove Photo" onClick={handleRemoveImage} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                    <div className="mt-4" onClick={openCalendar}>
                                        <InputText
                                            name="birthdate"
                                            value={moment(dateValue).format('YYYY-MM-DD')}
                                            onChange={handleChange}
                                            setFieldValue={setFieldValue}
                                            label="Birthdate" />
                                    </div>
                                    <Calendar onChange={setSelectedDate} value={dateValue} className={`px-4 mt-2 ${!showCalendar && 'hidden'}`} calendarType={'US'} />
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
                                    <div>Other Information</div>
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
                                    {/* <div className="mt-4">
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
                                    </div> */}
                                    {mode === 'edit' && currentUser.role.rep < 4 && (
                                        <React.Fragment>
                                            <div className="mt-4">
                                                <SelectDropdown
                                                    name="status"
                                                    field="status"
                                                    value={values.status}
                                                    label="Status"
                                                    options={[
                                                        {label: 'Pending', value: 'pending'},
                                                        {label: 'Active', value: 'active'},
                                                        {label: 'Offset', value: 'offset'}
                                                    ]}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Status"
                                                    errors={touched.status && errors.status ? errors.status : undefined}
                                                />
                                            </div>
                                        </React.Fragment>
                                    )}
                                    {mode === 'edit' && (
                                        <div className="mt-4">
                                            <CheckBox 
                                                name="delinquent"
                                                value={values.delinquent} 
                                                onChange={setFieldValue}  
                                                label={"Delinquent"} 
                                                size={"lg"} 
                                            />
                                        </div>
                                    )}
                                    {currentUser.role.rep < 4 && (
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="loId"
                                                field="loId"
                                                value={values.loId}
                                                label="Loan Officer"
                                                options={loUsers}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Loan Officer"
                                                errors={touched.loId && errors.loId ? errors.loId : undefined}
                                            />
                                        </div>
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