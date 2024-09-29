import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import InputText from "@/lib/ui/InputText";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import SelectDropdown from "@/lib/ui/select";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment';
import CheckBox from "@/lib/ui/checkbox";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
import { calculateAge, checkFileSize } from "@/lib/utils";
import { useRouter } from "next/router";
import ClientSearchTool from "../dashboard/ClientSearchTool";

const AddUpdateClient = ({ mode = 'add', client = {}, showSidebar, setShowSidebar, onClose }) => {
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const router = useRouter();
    
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const userList = useSelector(state => state.user.list);
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [photo, setPhoto] = useState(client.profile || '');
    const [image, setImage] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(client.group?.[0] || null);
    const [searchedClients, setSearchedClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [duplicate, setDuplicate] = useState(false);

    const { status } = router.query;

    const loUsers = useMemo(() => userList.filter(u => u.role.rep === 4), [userList]);

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const initialValues = useMemo(() => ({
        firstName: client.firstName || '',
        middleName: client.middleName || '',
        lastName: client.lastName || '',
        birthdate: client.birthdate || '',
        addressStreetNo: client.addressStreetNo || '',
        addressBarangayDistrict: client.addressBarangayDistrict || '',
        addressMunicipalityCity: client.addressMunicipalityCity || '',
        addressProvince: client.addressProvince || '',
        addressZipCode: client.addressZipCode || '',
        contactNumber: client.contactNumber || '',
        groupId: client.groupId || '',
        branchId: client.branchId || '',
        loId: client.loId || (currentUser.role.rep === 4 ? currentUser._id : ''),
        status: client.status || 'pending',
        delinquent: client.delinquent === "Yes",
        ciName: client?.ciName || ''
    }), [client, currentUser]);

    const validationSchema = yup.object().shape({
        firstName: yup.string().required('Please enter first name'),
        lastName: yup.string().required('Please enter last name'),
        loId: yup.string().required('Please select a Loan Officer'),
        ciName: yup.string().required('Please enter C.I. name'),
    });

    const hasDuplicates = useCallback(async (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value?.toUpperCase());

        const firstName = form.values.firstName;
        const lastName = form.values.lastName;
        if (firstName && lastName) {
            const searchText = `${firstName} ${lastName}`;
            try {
                const response = await fetchWrapper.get(`${process.env.NEXT_PUBLIC_API_URL}clients/search?${new URLSearchParams({ searchText: searchText?.toUpperCase() })}`);
                if (response.success && response.clients.length > 0) {
                    setDuplicate(true);
                    toast.warning('Client has similar name. Please verify the client first in the search client tool!');
                }
            } catch (error) {
                console.error('Error checking for duplicates:', error);
            }
        }
    }, []);

    const handleCancel = useCallback(() => {
        setShowSidebar(false);
        if (formikRef.current) {
            formikRef.current.resetForm();
        }
        setPhoto(client.profile || '');
        setImage('');
        setSelectedGroup(client.group?.[0] || null);
        setDuplicate(false);
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
        onClose();
    }, [client, onClose, setShowSidebar]);

    const handleSaveUpdate = useCallback(async (values, actions) => {
        const age = values.birthdate ? calculateAge(values.birthdate) : 0;
        if (age > 75) {
            toast.error('Client age is over 75 years old.');
            return;
        }

        setLoading(true);
        try {
            const processedValues = {
                ...values,
                insertedBy: currentUser._id,
                firstName: values.firstName.toUpperCase(),
                lastName: values.lastName.toUpperCase(),
                middleName: values.middleName ? values.middleName.toUpperCase() : '',
                birthdate: values.birthdate ? moment(values.birthdate).format("YYYY-MM-DD") : null,
                fullName: `${values.firstName} ${values.middleName} ${values.lastName}`.toUpperCase(),
                address: `${values.addressStreetNo} ${values.addressBarangayDistrict} ${values.addressMunicipalityCity} ${values.addressProvince} ${values.addressZipCode}`,
                groupName: selectedGroup ? selectedGroup.name : '',
                duplicate,
            };

            if (currentUser.root !== true && (currentUser.role.rep === 4 || currentUser.role.rep === 3) && branchList.length > 0) {
                const branch = branchList.find(b => b.code === currentUser.designatedBranch);
                processedValues.branchId = branch._id;
                processedValues.branchName = branch.name;
            }

            if (mode === 'add') {
                processedValues.status = 'pending';
                processedValues.delinquent = false;
                const response = await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}clients/save/`, processedValues);
                if (response.success) {
                    toast.success('Client successfully added.');
                } else {
                    toast.error(response.message);
                }
            } else if (mode === 'edit') {
                processedValues._id = client._id;
                processedValues.file = image;
                const response = await handleUpdateClient(processedValues);
                if (response.success) {
                    toast.success('Client successfully updated.');
                } else {
                    toast.error('Failed to update client.');
                }
            }
        } catch (error) {
            console.error('Error saving/updating client:', error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
            setShowSidebar(false);
            actions.setSubmitting(false);
            actions.resetForm();
            onClose();
        }
    }, [currentUser, selectedGroup, mode, client, image, branchList, duplicate, onClose, setShowSidebar]);

    const handleUpdateClient = async (clientData) => {
        return await fetchWrapper.sendData(`${process.env.NEXT_PUBLIC_API_URL}clients/`, clientData);
    };

    const handleFileChange = useCallback(async (e) => {
        const fileUploaded = e.target.files[0];
        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
            return;
        }

        setPhoto(URL.createObjectURL(fileUploaded));
        setImage(fileUploaded);

        const formData = new FormData();
        formData.append('file', fileUploaded);
        formData.append('origin', 'clients');
        formData.append('uuid', client?._id);

        setUploading(true);
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const responseData = await response.json();
            const updatedData = {...client, profile: responseData.fileUrl};
            const result = await handleUpdateClient(updatedData);
            if (result.success) {
                toast.success('File uploaded successfully.');
                setPhoto(responseData.fileUrl);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file. Please try again.');
            setPhoto(client.profile || '');
        } finally {
            setUploading(false);
        }
    }, [client]);

    const handleRemoveImage = useCallback(() => {
        setPhoto('');
        setImage('');
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
    }, []);

    useEffect(() => {
        if (mode === "edit" && client.group && client.group.length > 0) {
            setSelectedGroup(client.group[0]);
        }
    }, [mode, client]);

    return (
        <SideBar title={mode === 'add' ? 'Add Client' : 'Edit Client'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <Spinner />
                </div>
            ) : (
                <div className="px-2">
                    {mode === "add" && (
                        <div className="w-11/12">
                            <ClientSearchTool origin="client_list" callback={setSearchedClients} setSelected={setSelectedClient} />
                        </div>
                    )}
                    <Formik
                        enableReinitialize={true}
                        onSubmit={handleSaveUpdate}
                        initialValues={initialValues}
                        validationSchema={validationSchema}
                        innerRef={formikRef}
                    >
                        {({ values, touched, errors, handleChange, handleSubmit, setFieldValue, isSubmitting, isValidating, setFieldTouched }) => (
                            <form onSubmit={handleSubmit} autoComplete="off">
                                {mode === 'edit' && (
                                    <div className="profile-photo rounded-lg p-3 proxima-regular border">
                                        <div className="proxima-bold">Profile Photo</div>
                                        <div className="photo-row mt-4 flex space-x-4">
                                            <div className="photo-container rounded-lg">
                                                <div className="w-[200px] h-[200px] relative flex justify-center bg-slate-200 rounded-xl border overflow-hidden">
                                                    <Image 
                                                        src={photo || placeholder}
                                                        alt="Profile"
                                                        layout="fill"
                                                        objectFit="cover"
                                                    />
                                                </div>
                                                <input type="file" name="file" ref={hiddenInput} onChange={handleFileChange} className="hidden" />
                                            </div>
                                            <div className="w-48">
                                                <div className="flex flex-col space-y-4">
                                                    <span>Photo should be at least 300px x 300px</span>
                                                    <ButtonSolid label="Upload Photo" onClick={() => hiddenInput.current.click()} disabled={uploading} />
                                                    <ButtonOutline label="Remove Photo" onClick={handleRemoveImage} disabled={uploading} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(mode === 'edit' && selectedGroup) ? (
                                    <div className="mt-4">
                                        <div className="flex flex-col border rounded-md px-4 py-2 bg-white border-main">
                                            <div className="flex justify-between">
                                                <label htmlFor={'slotNo'} className="font-proxima-bold text-xs font-bold text-main">
                                                    Group
                                                </label>
                                            </div>
                                            <span className="text-gray-400">{selectedGroup.name}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="groupId"
                                            field="groupId"
                                            value={values.groupId}
                                            label="Group (Required)"
                                            options={groupList}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Group"
                                            errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                        />
                                    </div>
                                ) }
                                <div className="mt-4">
                                    <InputText
                                        name="lastName"
                                        value={values.lastName}
                                        onChange={handleChange}
                                        onBlur={(field, value) => hasDuplicates(field, value)}
                                        label="Last Name (Required)"
                                        placeholder="Enter Last Name"
                                        setFieldValue={setFieldValue}
                                        errors={touched.lastName && errors.lastName ? errors.lastName : undefined} />
                                </div>
                                <div className="mt-4">
                                    <InputText
                                        name="firstName"
                                        value={values.firstName}
                                        onChange={handleChange}
                                        onBlur={(field, value) => hasDuplicates(field, value)}
                                        label="First Name (Required)"
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
                                        value={values.birthdate}
                                        onChange={handleChange}
                                        setFieldValue={setFieldValue}
                                        placeholder="YYYY-MM-DD"
                                        label="Birthdate" />
                                </div>
                                {/* <Calendar onChange={setSelectedDate} value={dateValue} className={`px-4 mt-2 ${!showCalendar && 'hidden'}`} calendarType={'US'} /> */}
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
                                            label="Loan Officer (Required)"
                                            options={loUsers}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Loan Officer"
                                            errors={touched.loId && errors.loId ? errors.loId : undefined}
                                        />
                                    </div>
                                )}
                                <div className="mt-4">
                                    <InputText
                                        name="ciName"
                                        value={values.ciName}
                                        onChange={handleChange}
                                        label="CI Name (Required)"
                                        placeholder="Enter CI Name"
                                        setFieldValue={setFieldValue}
                                        errors={touched.ciName && errors.ciName ? errors.ciName : undefined} />
                                </div>
                                <div className="flex flex-row mt-5 pb-5">
                                    <ButtonOutline label="Cancel" onClick={handleCancel} className="mr-3" />
                                    <ButtonSolid label="Submit" type="submit" isSubmitting={isValidating && isSubmitting} />
                                </div>
                            </form>
                        )}
                    </Formik>
                </div>
            )}
        </SideBar>
    )
}

export default AddUpdateClient;