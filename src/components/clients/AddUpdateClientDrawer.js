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
import { checkFileSize } from "@/lib/utils";
import { calculateAge } from "@/lib/date-utils";
import { useRouter } from "next/router";
import ClientSearchTool from "../dashboard/ClientSearchTool";
import { getApiBaseUrl } from "@/lib/constants";

// Section Header Component
const SectionHeader = ({ title, subtitle, className = "" }) => (
    <div className={`pb-4 border-b border-gray-200 mb-4 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
);

// Important Notice Component
const ImportantNotice = ({ children, type = "warning" }) => {
    const typeStyles = {
        warning: "border-orange-200 bg-orange-50 text-orange-800",
        error: "border-red-200 bg-red-50 text-red-800",
        info: "border-blue-200 bg-blue-50 text-blue-800"
    };

    return (
        <div className={`border rounded-lg p-4 ${typeStyles[type]} mb-4`}>
            <div className="flex items-start space-x-2">
                <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm">{children}</div>
            </div>
        </div>
    );
};

const AddUpdateClient = ({ mode = 'add', client = {}, showSidebar, setShowSidebar, onClose, flag }) => {
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const router = useRouter();
    
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const userList = useSelector(state => state.user.list);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    
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
    const [filteredGroupList, setFilteredGroupList] = useState([]);

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
        groupName: client.groupName || '',
        groupId: client.groupId || '',
        branchId: client.branchId || '',
        loId: client.loId || (currentUser.role.rep === 4 ? currentUser._id : ''),
        status: client.status || 'pending',
        delinquent: client.delinquent === "Yes",
        ciName: client?.ciName || '',
        groupLeader: client.groupLeader || false,
        duplicate: client.duplicate || false,
        archived: client.archived || false,
        archivedBy: client.archivedBy || '',
    }), [client, currentUser]);

    const validationSchema = yup.object().shape({
        firstName: yup.string().required('Please enter first name'),
        lastName: yup.string().required('Please enter last name'),
        middleName: yup.string().required('Please enter middle name'),
        ciName: yup.string().required('Please enter C.I. name'),
    });

    const hasDuplicates = useCallback(async (field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value?.toUpperCase());

        const firstName = form.values.firstName;
        const lastName = form.values.lastName;
        if (firstName && lastName) {
            try {
                const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + new URLSearchParams({ firstName: firstName?.toUpperCase(), lastName: lastName?.toUpperCase(), mode: 'duplicate' }));
                if (response.success && response.clients.length > 0) {
                    setDuplicate(true);
                    toast.warning('Client has similar name. Please verify the client first in the search client tool and contact the admin if you want to proceed.');
                    setTimeout(() => {}, 3000);
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
            let processedValues = {
                ...values,
                insertedBy: currentUser._id,
                firstName: values.firstName.trim().toUpperCase(),
                lastName: values.lastName.trim().toUpperCase(),
                middleName: values.middleName ? values.middleName.trim().toUpperCase() : '',
                birthdate: values.birthdate ? moment(values.birthdate).format("YYYY-MM-DD") : null,
                fullName: `${values.firstName.trim()} ${values.middleName} ${values.lastName.trim()}`.toUpperCase(),
                address: `${values.addressStreetNo} ${values.addressBarangayDistrict} ${values.addressMunicipalityCity} ${values.addressProvince} ${values.addressZipCode}`,
                groupId: values.groupId,
                loId: values.loId,
                duplicate,
                ciName: values?.ciName?.toUpperCase(),
                groupLeader: values.groupLeader,
                archived: values.archived || false,
                archivedBy: values.archivedBy,
            };

            if (currentUser.root !== true && (currentUser.role.rep === 4 || currentUser.role.rep === 3) && branchList.length > 0) {
                const branch = branchList.find(b => b.code === currentUser.designatedBranch);
                processedValues.branchId = branch._id;
                processedValues.branchName = branch.name;
            }

            if (mode === 'add') {
                processedValues.status = 'pending';
                processedValues.delinquent = false;
                const selectedGroupAdd = groupList.find(g => g._id === values.groupId);
                processedValues.groupName = selectedGroupAdd ? selectedGroupAdd.name : '';
                const response = await fetchWrapper.post(getApiBaseUrl() + 'clients/save/', processedValues);
                if (response.success) {
                    toast.success('Client successfully added.');
                } else {
                    toast.error(response.message);
                }
            } else if (mode === 'edit') {
                processedValues._id = client._id;
                processedValues.file = image;
                console.log(selectedGroup)
                processedValues.groupName = selectedGroup ? selectedGroup.name : '';
                processedValues.groupId = selectedGroup ? selectedGroup._id : '';
                processedValues.loId = selectedGroup ? selectedGroup.loanOfficerId : '';
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
        return await fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData);
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

    const handleChangeLO = (field, value) => {
        setLoading(true);
        const form = formikRef.current;
        form.setFieldValue(field, value);
        const selectedLO = loUsers.find(u => u._id === value);
        const loGroups = groupList.filter(g => g.loanOfficerId === value && g.occurence == selectedLO?.transactionType );
        setFilteredGroupList(loGroups);

        setLoading(false);
    }

    useEffect(() => {
        if (mode === "edit" && client.group && client.group.length > 0) {
            setSelectedGroup(client.group[0]);
        }
    }, [mode, client]);

    return (
        <SideBar 
            title={mode === 'add' ? 'Add New Client' : 'Edit Client Information'} 
            showSidebar={showSidebar} 
            setShowSidebar={setShowSidebar} 
            hasCloseButton={false}
            width="600px"
        >
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Spinner />
                </div>
            ) : (
                <div className="px-2 space-y-6">
                    {/* Search Tool for Add Mode */}
                    {mode === "add" && (
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                            <SectionHeader 
                                title="Client Search" 
                                subtitle="Search for existing clients to avoid duplicates"
                            />
                            <ClientSearchTool 
                                origin="client_list" 
                                callback={setSearchedClients} 
                                setSelected={setSelectedClient} 
                            />
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
                            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
                                
                                {/* Profile Photo Section - Edit Mode Only */}
                                {mode === 'edit' && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <SectionHeader 
                                            title="Profile Photo" 
                                            subtitle="Upload a clear photo of the client"
                                        />
                                        <div className="flex space-x-6">
                                            <div className="w-48 h-48 relative flex justify-center bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 overflow-hidden hover:border-blue-400 transition-colors">
                                                <Image 
                                                    src={photo || placeholder}
                                                    alt="Profile"
                                                    layout="fill"
                                                    objectFit="cover"
                                                    className="rounded-xl"
                                                />
                                                <input 
                                                    type="file" 
                                                    name="file" 
                                                    ref={hiddenInput} 
                                                    onChange={handleFileChange} 
                                                    className="hidden" 
                                                    accept="image/*"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div className="text-sm text-gray-600 space-y-1">
                                                    <p>Photo should be at least 300px × 300px</p>
                                                    <p>Accepted formats: JPG, PNG, GIF</p>
                                                    <p>Maximum file size: 5MB</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <ButtonSolid 
                                                        label={uploading ? "Uploading..." : "Upload Photo"} 
                                                        onClick={() => hiddenInput.current.click()} 
                                                        disabled={uploading}
                                                    />
                                                    <ButtonOutline 
                                                        label="Remove Photo" 
                                                        onClick={handleRemoveImage} 
                                                        disabled={uploading}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Group Assignment Section */}
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <SectionHeader 
                                        title="Group Assignment" 
                                        subtitle="Assign client to a loan officer and group"
                                    />
                                    
                                    {(mode === 'edit' && selectedGroup) ? (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-blue-900">Current Group</p>
                                                    <p className="text-blue-700">{selectedGroup.name}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {(currentUser.role.rep < 4 && flag != 'update-offset') && (
                                                <SelectDropdown
                                                    name="loId"
                                                    field="loId"
                                                    value={values.loId}
                                                    label="Loan Officer (Required)"
                                                    options={loUsers}
                                                    onChange={(field, value) => handleChangeLO(field, value)}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Loan Officer"
                                                    errors={touched.loId && errors.loId ? errors.loId : undefined}
                                                />
                                            )}

                                            {flag != 'update-offset' && (
                                                <SelectDropdown
                                                    name="groupId"
                                                    field="groupId"
                                                    value={values.groupId}
                                                    label="Group (Required)"
                                                    options={currentUser.role.rep == 4 ? groupList : filteredGroupList}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Group"
                                                    errors={touched.groupId && errors.groupId ? errors.groupId : undefined}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Personal Information Section */}
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <SectionHeader 
                                        title="Personal Information" 
                                        subtitle="Client's basic personal details"
                                    />
                                    
                                    {duplicate && (
                                        <ImportantNotice type="warning">
                                            <strong>Potential Duplicate Found:</strong> A client with similar name already exists. Please verify this is not a duplicate before proceeding.
                                        </ImportantNotice>
                                    )}

                                    <div className="space-y-4">
                                        <InputText
                                            name="lastName"
                                            value={values.lastName}
                                            onChange={handleChange}
                                            onBlur={(field, value) => hasDuplicates(field, value)}
                                            label="Last Name (Required)"
                                            placeholder="Enter Last Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.lastName && errors.lastName ? errors.lastName : undefined}
                                        />
                                        
                                        <InputText
                                            name="firstName"
                                            value={values.firstName}
                                            onChange={handleChange}
                                            onBlur={(field, value) => hasDuplicates(field, value)}
                                            label="First Name (Required)"
                                            placeholder="Enter First Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.firstName && errors.firstName ? errors.firstName : undefined}
                                        />
                                        
                                        <InputText
                                            name="middleName"
                                            value={values.middleName}
                                            onChange={handleChange}
                                            label="Middle Name (Required)"
                                            placeholder="Enter Middle Name or 'N/A' if none"
                                            setFieldValue={setFieldValue}
                                            errors={touched.middleName && errors.middleName ? errors.middleName : undefined}
                                        />
                                        
                                        <div onClick={openCalendar}>
                                            <InputText
                                                name="birthdate"
                                                value={values.birthdate}
                                                onChange={handleChange}
                                                setFieldValue={setFieldValue}
                                                placeholder="YYYY-MM-DD"
                                                label="Birthdate"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Address Information Section */}
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <SectionHeader 
                                        title="Address Information" 
                                        subtitle="Complete residential address"
                                    />
                                    
                                    <div className="space-y-4">
                                        <InputText
                                            name="addressStreetNo"
                                            value={values.addressStreetNo}
                                            onChange={handleChange}
                                            label="Street No."
                                            placeholder="Enter Street Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressStreetNo && errors.addressStreetNo ? errors.addressStreetNo : undefined}
                                        />
                                        
                                        <InputText
                                            name="addressBarangayDistrict"
                                            value={values.addressBarangayDistrict}
                                            onChange={handleChange}
                                            label="Barangay or District"
                                            placeholder="Enter Barangay or District"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressBarangayDistrict && errors.addressBarangayDistrict ? errors.addressBarangayDistrict : undefined}
                                        />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputText
                                                name="addressMunicipalityCity"
                                                value={values.addressMunicipalityCity}
                                                onChange={handleChange}
                                                label="Municipality or City"
                                                placeholder="Enter Municipality or City"
                                                setFieldValue={setFieldValue}
                                                errors={touched.addressMunicipalityCity && errors.addressMunicipalityCity ? errors.addressMunicipalityCity : undefined}
                                            />
                                            
                                            <InputText
                                                name="addressProvince"
                                                value={values.addressProvince}
                                                onChange={handleChange}
                                                label="Province"
                                                placeholder="Enter Province"
                                                setFieldValue={setFieldValue}
                                                errors={touched.addressProvince && errors.addressProvince ? errors.addressProvince : undefined}
                                            />
                                        </div>
                                        
                                        <InputText
                                            name="addressZipCode"
                                            value={values.addressZipCode}
                                            onChange={handleChange}
                                            label="Zip Code"
                                            placeholder="Enter Zip Code"
                                            setFieldValue={setFieldValue}
                                            errors={touched.addressZipCode && errors.addressZipCode ? errors.addressZipCode : undefined}
                                        />
                                    </div>
                                </div>

                                {/* Contact & Other Information Section */}
                                <div className="bg-white rounded-lg border border-gray-200 p-6">
                                    <SectionHeader 
                                        title="Contact & Additional Information" 
                                        subtitle="Contact details and other required information"
                                    />
                                    
                                    <div className="space-y-4">
                                        <InputText
                                            name="contactNumber"
                                            value={values.contactNumber}
                                            onChange={handleChange}
                                            label="Contact Number"
                                            placeholder="Enter Contact Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.contactNumber && errors.contactNumber ? errors.contactNumber : undefined}
                                        />
                                        
                                        <InputText
                                            name="ciName"
                                            value={values.ciName}
                                            onChange={handleChange}
                                            label="CI Name (Required)"
                                            placeholder="Enter CI Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.ciName && errors.ciName ? errors.ciName : undefined}
                                        />

                                        {/* Status Dropdown for Edit Mode */}
                                        {mode === 'edit' && currentUser.role.rep < 3 && (
                                            <SelectDropdown
                                                name="status"
                                                field="status"
                                                value={values.status}
                                                label="Client Status"
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
                                        )}
                                    </div>
                                </div>

                                {/* IMPORTANT CLIENT SETTINGS - PROMINENT SECTION */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 relative overflow-hidden">
                                    {/* Top accent bar */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                                    
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-3 bg-blue-500 rounded-lg">
                                            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-blue-900">⚠️ Important Client Settings</h3>
                                            <p className="text-sm text-blue-700">Please review these important client attributes carefully before saving</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {/* Group Leader Toggle - Always Show */}
                                        <div className="p-4 border-2 rounded-lg transition-all duration-200 border-gray-300 bg-white shadow-sm hover:shadow-md">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="p-2 bg-blue-100 rounded-lg">
                                                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-gray-900">
                                                                👑 Group Leader
                                                            </h4>
                                                            <p className="text-xs text-gray-600 mt-1">
                                                                When adding loan for this client, {transactionSettings.mcbuCsfMCBUForNM || 0} will be needed as a minimum initial MCBU.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <button
                                                        type="button"
                                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border-2 ${
                                                            values.groupLeader 
                                                                ? 'bg-blue-500 border-blue-600' 
                                                                : 'bg-gray-200 border-gray-300'
                                                        }`}
                                                        onClick={() => setFieldValue('groupLeader', !values.groupLeader)}
                                                        disabled={mode === 'edit' && client?.status !== 'pending'}
                                                    >
                                                        <span
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${
                                                                values.groupLeader ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                    <div className="text-xs text-center mt-1 font-medium">
                                                        <span className={values.groupLeader ? 'text-blue-600' : 'text-gray-500'}>
                                                            {values.groupLeader ? 'YES' : 'NO'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Delinquent Toggle - Only show for edit mode and when status is not pending */}
                                        {mode === 'edit' && values.status !== 'pending' && (
                                            <div className="p-4 border-2 rounded-lg transition-all duration-200 border-gray-300 bg-white shadow-sm hover:shadow-md">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="p-2 bg-red-100 rounded-lg">
                                                                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-gray-900">
                                                                    ⚠️ Delinquent Status
                                                                </h4>
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    Mark this client as having payment issues, overdue obligations, or collection concerns
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4">
                                                        <button
                                                            type="button"
                                                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 border-2 ${
                                                                values.delinquent 
                                                                    ? 'bg-red-500 border-red-600' 
                                                                    : 'bg-gray-200 border-gray-300'
                                                            }`}
                                                            onClick={() => setFieldValue('delinquent', !values.delinquent)}
                                                        >
                                                            <span
                                                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${
                                                                    values.delinquent ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                            />
                                                        </button>
                                                        <div className="text-xs text-center mt-1 font-medium">
                                                            <span className={values.delinquent ? 'text-red-600' : 'text-gray-500'}>
                                                                {values.delinquent ? 'YES' : 'NO'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Additional visual emphasis */}
                                    <div className="mt-4 text-xs text-blue-600 bg-blue-100 rounded-lg p-3">
                                        <strong>💡 Reminder:</strong> These setting will mark the client as a ACKP Client. Double-check before saving.
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-6 mt-8 -mx-2 px-2">
                                    <div className="flex space-x-4">
                                        <ButtonOutline 
                                            label="Cancel" 
                                            onClick={handleCancel} 
                                            className="flex-1"
                                        />
                                        <ButtonSolid 
                                            label={mode === 'add' ? 'Add Client' : 'Update Client'} 
                                            type="submit" 
                                            isSubmitting={isValidating && isSubmitting}
                                            className="flex-1"
                                        />
                                    </div>
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