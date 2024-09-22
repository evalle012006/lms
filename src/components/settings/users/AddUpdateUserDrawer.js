import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import SelectDropdown from "@/lib/ui/select";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
import Spinner from "@/components/Spinner";
import RadioButton from "@/lib/ui/radio-button";
import { checkFileSize } from "@/lib/utils";
import Select from 'react-select';
import { multiStyles, DropdownIndicator } from "@/styles/select";
import { getApiBaseUrl } from "@/lib/constants";

const AddUpdateUser = ({ mode = 'add', user = {}, roles = [], showSidebar, setShowSidebar, onClose }) => {    
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photo, setPhoto] = useState('');
    const [image, setImage] = useState('');
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [occurence, setOccurence] = useState('daily');
    const branchList = useSelector(state => state.branch.list);

    // Use useEffect to set the initial photo state
    useEffect(() => {
        if (mode === 'edit' && user.profile) {
            setPhoto(user.profile);
        }

        if (mode == 'edit') {
            user.profile && setPhoto(user.profile);
            user.transactionType && setOccurence(user.transactionType);
        }
    }, [mode, user]);

    const initialValues = useMemo(() => ({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        number: user.number || '',
        position: user.position || '',
        designatedBranch: user.designatedBranch || '',
        role: user.role ? user.roleId : '',
        loNo: user.loNo ? parseInt(user.loNo) : null,
        transactionType: user.transactionType || 'daily',
        branchManagerName: user?.branchManagerName || ''
    }), [user]);

    const selectedRole = useMemo(() => {
        if (user?.roleId) {
            const roleArr = user.roleId.split('-');
            return roles.find(r => r.shortCode === roleArr[1]);
        }
        return null;
    }, [user, roles]);

    const selectedBranches = useMemo(() => {
        if (user?.roleId?.startsWith('2-') && user.designatedBranch) {
            try {
                const branchesCode = JSON.parse(user.designatedBranch);
                return branchList.filter(branch => branchesCode.includes(branch.code));
            } catch (error) {
                console.error('Error parsing designatedBranch:', error);
                return [];
            }
        }
        return [];
    }, [user, branchList]);

    const validationSchema = yup.object().shape({
        firstName: yup.string().required('Please enter first name'),
        lastName: yup.string().required('Please enter last name'),
        email: yup.string().email('Please enter valid email address').required('Please enter email address'),
        number: yup.string().required('Please enter phone number'),
        position: yup.string().required('Please select a position'),
        role: yup.string().required('Please select a role'),
    });

    const handleSelectBranch = useCallback((newSelectedBranches) => {
        formikRef.current.setFieldValue('designatedBranch', JSON.stringify(newSelectedBranches.map(branch => branch.code)));
    }, []);

    const handleRoleChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
    }, []);

    const handleSaveUpdate = useCallback(async (values, actions) => {
        setLoading(true);
        try {
            const roleArr = values.roleId.split('-');
            const roleShortCode = roleArr[1];
            const selectedRole = roles.find(role => role.shortCode === roleShortCode);
            values.role = JSON.stringify(selectedRole);
            
            if (selectedRole.rep === 2) {
                values.designatedBranch = values.designatedBranch || '[]';
            } else if (selectedRole.rep > 2) {
                const selectedBranch = branchList.find(b => b.code === values.designatedBranch);
                if (selectedBranch) {
                    values.designatedBranchId = selectedBranch._id;
                }

                values.transactionType = occurence;
            }

            values.currentDate = currentDate;

            if (mode === 'add') {
                const apiUrl = getApiBaseUrl() + 'users/save/';
                const response = await fetchWrapper.post(apiUrl, values);
                if (response.error) {
                    toast.error(response.message);
                } else if (response.success) {
                    toast.success('User successfully added.');
                    onClose();
                }
            } else if (mode === 'edit') {
                values.file = image;
                await handleUpdateUser(values);
                toast.success('User successfully updated.');
                onClose();
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
            setShowSidebar(false);
            actions.setSubmitting(false);
            actions.resetForm();
            handleRemoveImage();
        }
    }, [mode, image, currentDate, roles, branchList, onClose, setShowSidebar]);

    const handleUpdateUser = async (userData) => {
        return await fetchWrapper.sendData(getApiBaseUrl() + 'users/', userData);
    };

    const handleFileChange = useCallback(async (e) => {
        const fileUploaded = e.target.files[0];
        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
        } else {
            const photoUrl = URL.createObjectURL(fileUploaded);
            setPhoto(photoUrl);
            setImage(fileUploaded);
            
            const formData = new FormData();
            formData.append('file', fileUploaded);
            formData.append('origin', 'profiles');
            formData.append('uuid', user?._id);

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
                const roleArr = user.roleId.split('-');
                const roleShortCode = roleArr[1];
                const selectedRole = roles.find(role => role.shortCode === roleShortCode);
                const updatedData = {...user, profile: responseData.fileUrl, role: JSON.stringify(selectedRole)};
                const result = await handleUpdateUser(updatedData);
                if (result.success) {
                    toast.success('File uploaded successfully.');
                    setPhoto(responseData.fileUrl); // Update photo state with the new URL
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                toast.error('Failed to upload file. Please try again.');
                setPhoto(user.profile || ''); // Revert to original photo if upload fails
            } finally {
                setUploading(false);
            }
        }
    }, [user, roles]);

    const handleRemoveImage = useCallback(() => {
        setPhoto('');
        setImage('');
        if (hiddenInput.current) {
            hiddenInput.current.value = '';
        }
    }, []);

    const handleCancel = useCallback(() => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        handleRemoveImage();
        onClose();
    }, [setShowSidebar, handleRemoveImage, onClose]);

    return (
        <SideBar title={mode === 'add' ? 'Add Team Member' : 'Edit Profile'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <Spinner />
                </div>
            ) : (
                <div className="px-2">
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
                                                        src={!photo ? placeholder : photo}
                                                        className="overflow-hidden object-cover"
                                                        width={200}
                                                        height={200}
                                                        alt="Profile Photo"
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
                                        name="lastName"
                                        value={values.lastName}
                                        onChange={handleChange}
                                        label="Last Name"
                                        placeholder="Enter Last Name"
                                        setFieldValue={setFieldValue}
                                        errors={touched.lastName && errors.lastName ? errors.lastName : undefined} />
                                </div>
                                <div className="mt-4">
                                    <InputEmail
                                        name="email"
                                        value={values.email}
                                        onChange={handleChange}
                                        disabled={mode === 'edit'}
                                        label="Email Address"
                                        placeholder="Enter Email Address"
                                        setFieldValue={setFieldValue}
                                        errors={touched.email && errors.email ? errors.email : undefined} />
                                </div>
                                <div className="mt-4">
                                    <InputText
                                        name="number"
                                        value={values.number}
                                        onChange={handleChange}
                                        label="Phone Number"
                                        placeholder="Enter Phone Number"
                                        setFieldValue={setFieldValue}
                                        errors={touched.number && errors.number ? errors.number : undefined} />
                                </div>
                                <div className="mt-4">
                                    <InputText
                                        name="position"
                                        value={values.position}
                                        onChange={handleChange}
                                        label="Position"
                                        placeholder="Enter Position in the company"
                                        setFieldValue={setFieldValue}
                                        errors={touched.position && errors.position ? errors.position : undefined} />
                                </div>
                                <div className="mt-4">
                                    <SelectDropdown
                                        name="role"
                                        field="role"
                                        value={values.role}
                                        label="Role"
                                        options={roles}
                                        onChange={(field, value) => handleRoleChange(field, value)}
                                        onBlur={setFieldTouched}
                                        placeholder="Select Role"
                                        errors={touched.role && errors.role ? errors.role : undefined}
                                    />
                                </div>
                                {selectedRole?.shortCode == 'area_admin' && (
                                    <div className="mt-4">
                                        {}
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedBranches?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedBranches?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Designated Branches
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranches}
                                                    isMulti
                                                    styles={multiStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleSelectBranch}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Select branches'}/>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {selectedRole?.rep >= 3 && (
                                    <React.Fragment>
                                        <div className="mt-4">
                                            <InputText
                                                name="branchManagerName"
                                                value={values.branchManagerName}
                                                onChange={handleChange}
                                                label="Branch Manager Name"
                                                placeholder="Enter Branch Manager Name"
                                                setFieldValue={setFieldValue}
                                                errors={touched.branchManagerName && errors.branchManagerName ? errors.branchManagerName : undefined} />
                                        </div>
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="designatedBranch"
                                                field="designatedBranch"
                                                value={values.designatedBranch}
                                                label="Designated Branch"
                                                options={branchList}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select Branch"
                                                errors={touched.designatedBranch && errors.designatedBranch ? errors.designatedBranch : undefined}
                                            />
                                        </div>
                                    </React.Fragment>
                                )}
                                {selectedRole?.rep === 4 && (
                                    <React.Fragment>
                                        <div className="mt-4">
                                            <SelectDropdown
                                                name="loNo"
                                                field="loNo"
                                                value={values.loNo}
                                                label="LO Number"
                                                options={[
                                                    {label: '1', value: 1},
                                                    {label: '2', value: 2},
                                                    {label: '3', value: 3},
                                                    {label: '4', value: 4},
                                                    {label: '5', value: 5},
                                                    {label: '6', value: 6},
                                                    {label: '7', value: 7},
                                                    {label: '8', value: 8},
                                                    {label: '9', value: 9},
                                                    {label: '10', value: 10},
                                                    {label: '11', value: 11},
                                                    {label: '12', value: 12},
                                                    {label: '13', value: 13},
                                                    {label: '14', value: 14},
                                                    {label: '15', value: 15},
                                                    {label: '16', value: 16},
                                                    {label: '17', value: 17},
                                                    {label: '18', value: 18},
                                                    {label: '19', value: 19},
                                                    {label: '20', value: 20}
                                                ]}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select LO Number"
                                                errors={touched.loNo && errors.loNo ? errors.loNo : undefined}
                                            />
                                        </div>
                                        <div className="flex flex-col mt-4 text-gray-500">
                                            <div>Transaction Type</div>
                                            <div className="flex flex-row ml-4">
                                                <RadioButton id={"radio_daily"} name="radio-occurence" label={"Daily"} checked={occurence === 'daily'} value="daily" onChange={() => setOccurence('daily')} />
                                                <RadioButton id={"radio_weekly"} name="radio-occurence" label={"Weekly"} checked={occurence === 'weekly'} value="weekly" onChange={() => setOccurence('weekly')} />
                                            </div>
                                        </div>
                                    </React.Fragment>
                                )}
                                <div className="flex flex-row mt-5 pb-6">
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

export default AddUpdateUser;