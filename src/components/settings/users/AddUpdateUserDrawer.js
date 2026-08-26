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
import Spinner from "@/components/Spinner";
import RadioButton from "@/lib/ui/radio-button";
import { checkFileSize } from "@/lib/utils";
import Select from 'react-select';
import { multiStyles, DropdownIndicator } from "@/styles/select";
import { getApiBaseUrl, ACCELERATED_WEEKLY_CATEGORIES } from "@/lib/constants";
import PrivateImage from "@/components/common/PrivateImage";
import moment from "moment";

const DEFAULT_USER = {};
const DEFAULT_ROLES = [];

const AddUpdateUser = ({ mode = 'add', user = DEFAULT_USER, roles = DEFAULT_ROLES, showSidebar, setShowSidebar, onClose }) => {    
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photo, setPhoto] = useState('');
    const [image, setImage] = useState('');
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const [occurence, setOccurence] = useState('daily');
    const branchList = useSelector(state => state.branch.list);
    const divisionList = useSelector(state => state.division.list);
    const areaList = useSelector(state => state.area.list);
    const regionList = useSelector(state => state.region.list);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState([]);

    const [selectedBranches, setSelectedBranches] = useState([]);
    const [removingBiometric, setRemovingBiometric] = useState(false);
    const [biometricRemoved, setBiometricRemoved]   = useState(false);

    const [role, setRole] = useState();
    const [weeklyScheduleType, setWeeklyScheduleType] = useState('standard');
    // NEW: which name theme (cars, birds, fish, ...) an accelerated-weekly LO uses
    const [acceleratedCategory, setAcceleratedCategory] = useState(null);

    const performClose = () => {
        setRole(null);
        setSelectedBranches([]);
        setSelectedBranchFilter([])
        onClose();
    };

    useEffect(() => {
        const currentRole = role ?? user.roleId;

        if (mode === 'edit') {
            user.profile && setPhoto(user.profile);
            user.transactionType && setOccurence(user.transactionType);
            user.weeklyScheduleType && setWeeklyScheduleType(user.weeklyScheduleType);
            // NEW: hydrate category on edit — falls back to null (forces the
            // admin to pick one) rather than silently defaulting to 'cars',
            // since legacy accelerated LOs created before this feature won't
            // have a category on record.
            setAcceleratedCategory(user.acceleratedCategory || null);
        }

        if (currentRole?.includes('2-')) {
            const [rep, shortCode] = currentRole?.split('-');
            switch (shortCode) {
                case 'area_admin':
                    setSelectedBranchFilter(prev =>
                        prev?.id === user.areaId && prev?.field === 'areaId'
                            ? prev
                            : { id: user.areaId, field: 'areaId' }
                    );
                    break;
                case 'regional_manager':
                    setSelectedBranchFilter(prev =>
                        prev?.id === user.regionId && prev?.field === 'regionId'
                            ? prev
                            : { id: user.regionId, field: 'regionId' }
                    );
                    break;
                case 'deputy_director':
                    setSelectedBranchFilter(prev =>
                        prev?.id === user.divisionId && prev?.field === 'divisionId'
                            ? prev
                            : { id: user.divisionId, field: 'divisionId' }
                    );
                    break;
                default:
                    break;
            }
        }

        setRole(prev => prev === currentRole ? prev : currentRole);
    }, [user, mode, areaList, regionList, divisionList, branchList]);


    const filteredByRoleBranchList = useMemo(() => 
        {   
            const list = branchList.filter(b => !!selectedBranchFilter && b[selectedBranchFilter?.field] == selectedBranchFilter?.id );
            return list;
        }, 
    [role, selectedBranchFilter]);

    useEffect(() => {
        if (role?.includes('2-')) {
            const branchCodes = JSON.parse(user.designatedBranch ?? '[]');
            const branches = branchList.filter(branch => branchCodes.includes(branch.code));
            setSelectedBranches(branches);
        }
    }, [role, selectedBranchFilter]);

    const initialValues = useMemo(() => ({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        number: user.number || '',
        position: user.position || '',
        designatedBranch: user.designatedBranch || null,
        designatedBranchId: user.designatedBranchId || null,
        role: user.role ? user.roleId : '',
        loNo: user.loNo ? parseInt(user.loNo) : null,
        transactionType: user.transactionType || 'daily',
        weeklyScheduleType: user.weeklyScheduleType || 'standard',
        acceleratedCategory: user.acceleratedCategory || null,
        branchManagerName: user?.branchManagerName || '',
        areaId: user?.areaId || '',
        regionId: user?.regionId || '',
        divisionId: user?.divisionId || '',
    }), [user]);

    const selectedRole = useMemo(() => {
        if (role) {
            const [rep, shortCode] = role.split('-') ?? [];
            const selected = roles.find(r => r.rep === +rep);
            return { ...selected, shortCode};
        }
        return null;
    }, [user, role]);

    // NEW: acceleratedCategory is conditionally required — only when rep=4,
    // occurence=weekly, weeklyScheduleType=accelerated. yup.when() reads
    // sibling form values, not the local occurence/weeklyScheduleType state,
    // so this depends on those fields also being current in Formik values
    // (handled via setFieldValue in the change handlers below).
    const validationSchema = yup.object().shape({
        firstName: yup.string().required('Please enter first name'),
        lastName: yup.string().required('Please enter last name'),
        email: yup.string().email('Please enter valid email address').required('Please enter email address'),
        number: yup.string().required('Please enter phone number'),
        position: yup.string().required('Please select a position'),
        role: yup.string().required('Please select a role'),
        acceleratedCategory: yup.string().nullable().when(['transactionType', 'weeklyScheduleType'], {
            is: (transactionType, weeklyScheduleType) =>
                transactionType === 'weekly' && weeklyScheduleType === 'accelerated',
            then: (schema) => schema.required('Please select a group category'),
            otherwise: (schema) => schema.nullable(),
        }),
    });

    const handleSelectBranch = useCallback((newSelectedBranches) => {
        formikRef.current.setFieldValue('designatedBranch', JSON.stringify(newSelectedBranches.map(branch => branch.code)));
        setSelectedBranches(newSelectedBranches);
    }, []);

    const handleRoleChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setRole(value);
    }, []);

    const handleBranchChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedBranchFilter({ id: value, field });
    }, []);

    const handleAreaChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedBranchFilter({ id: value, field });
    }, []);

    const handleRegionChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedBranchFilter({ id: value, field });
    }, []);

    const handleDivisionChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setSelectedBranchFilter({ id: value, field });
    }, []);

    const handleTransactionTypeChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setOccurence(value);
        if (value !== 'weekly') {
            setWeeklyScheduleType('standard');
            form.setFieldValue('weeklyScheduleType', 'standard');
            // NEW: clear category when leaving weekly entirely — daily and
            // standard-weekly don't use it, and a stale value here would get
            // submitted and silently ignored server-side, which masks bugs.
            setAcceleratedCategory(null);
            form.setFieldValue('acceleratedCategory', null);
        }
    }, []);

    const handleWeeklyScheduleTypeChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setWeeklyScheduleType(value);
        // NEW: clear category when switching away from accelerated
        if (value !== 'accelerated') {
            setAcceleratedCategory(null);
            form.setFieldValue('acceleratedCategory', null);
        }
    }, []);

    // NEW
    const handleAcceleratedCategoryChange = useCallback((field, value) => {
        const form = formikRef.current;
        form.setFieldValue(field, value);
        setAcceleratedCategory(value);
    }, []);

    const handleSaveUpdate = useCallback(async (values, actions) => {
        setLoading(true);
        try {
            const roleArr = values.role.split('-');
            const roleShortCode = roleArr[1];
            const selectedRole = roles.find(role => role.shortCode === roleShortCode);
            values.role = JSON.stringify(selectedRole);

            if (selectedRole.rep === 2) {
                values.designatedBranch = values.designatedBranch || '[]';
                if (selectedRole.shortCode === 'area_admin') {
                    const selectedArea = areaList.find(a => a._id === values.areaId);
                    if (selectedArea) {
                        values.areaId = selectedArea._id;
                        values.regionId = selectedArea.regionId;
                        values.divisionId = selectedArea.divisionId;
                    }
                } else if (selectedRole.shortCode === 'regional_manager') {
                    const selectedRegion = regionList.find(r => r._id === values.regionId);
                    if (selectedRegion) {
                        values.areaId = null;
                        values.regionId = selectedRegion._id;
                        values.divisionId = selectedRegion.divisionId;
                    }
                } else if (selectedRole.shortCode === 'deputy_director') {
                    const selectedDivision = divisionList.find(d => d._id === values.divisionId);
                    if (selectedDivision) {
                        values.areaId = null;
                        values.regionId = null;
                        values.divisionId = selectedDivision._id;
                    }
                }
            } else if (selectedRole.rep >= 3) {
                const selectedBranch = branchList.find(b => b.code === values.designatedBranch);
                if (selectedBranch) {
                    values.designatedBranchId = selectedBranch._id;
                    values.areaId = selectedBranch.areaId;
                    values.regionId = selectedBranch.regionId;
                    values.divisionId = selectedBranch.divisionId;
                }

                values.transactionType = occurence;
                values.weeklyScheduleType = occurence === 'weekly'
                    ? weeklyScheduleType
                    : null;
                // NEW: only meaningful for weekly+accelerated — null everywhere else
                // so it can't linger from a prior selection.
                values.acceleratedCategory = (occurence === 'weekly' && weeklyScheduleType === 'accelerated')
                    ? acceleratedCategory
                    : null;
            }

            values.currentDate = currentDate;

            if (mode === 'add') {
                const apiUrl = getApiBaseUrl() + 'users/save/';
                const response = await fetchWrapper.post(apiUrl, values);
                if (response.error) {
                    toast.error(response.message);
                } else if (response.success) {
                    toast.success('User successfully added.');
                    performClose();
                }
            } else if (mode === 'edit') {
                values.file = image;
                const updateResult = await handleUpdateUser(values);
                if (updateResult?.error) {
                    toast.error(updateResult.message || 'Update failed.');
                } else {
                    toast.success('User successfully updated.');
                    performClose();
                }
            }
        } catch (error) {
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
            setShowSidebar(false);
            actions.setSubmitting(false);
            actions.resetForm();
            handleRemoveImage();
        }
    }, [mode, image, currentDate, roles, branchList, onClose, setShowSidebar, occurence, weeklyScheduleType, acceleratedCategory]);

    const handleUpdateUser = async (userData) => {
        return await fetchWrapper.sendData(getApiBaseUrl() + 'users/', JSON.parse(JSON.stringify(userData)));
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
                const updatedData = { ...user, profile: responseData.fileKey, role: JSON.stringify(selectedRole), _skipLog: true };
                console.log('file updated', updatedData);
                const result = await handleUpdateUser(updatedData);
                if (result.success) {
                    toast.success('File uploaded successfully.');
                    setPhoto(responseData.fileKey);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                toast.error('Failed to upload file. Please try again.');
                setPhoto(user.profile || '');
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
        performClose();
    }, [setShowSidebar, handleRemoveImage, onClose]);

    return (
        <SideBar title={mode === 'add' ? 'Add Team Member' : 'Edit Profile'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
            {loading ? (
                <Spinner />
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
                                                    <PrivateImage 
                                                        src={photo || null}
                                                        className="overflow-hidden object-cover"
                                                        width={200}
                                                        height={200}
                                                        alt="Profile Photo"
                                                        fallback={placeholder}
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
                                {selectedRole?.shortCode?.includes('area_admin') && (
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="areaId"
                                            field="areaId"
                                            value={values.areaId}
                                            label="Area"
                                            options={areaList}
                                            onChange={(field, value) => handleAreaChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Area"
                                            errors={touched.area && errors.area ? errors.area : undefined}
                                        />
                                    </div>
                                )}
                                {selectedRole?.shortCode?.includes('regional_manager') && (
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
                                            errors={touched.region && errors.region ? errors.region : undefined}
                                        />
                                    </div>
                                )}
                                {selectedRole?.shortCode?.includes('deputy_director') && (
                                    <div className="mt-4">
                                        <SelectDropdown
                                            name="divisionId"
                                            field="divisionId"
                                            value={values.divisionId}
                                            label="Division"
                                            options={divisionList}
                                            onChange={(field, value) => handleDivisionChange(field, value)}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Division"
                                            errors={touched.division && errors.division ? errors.division : undefined}
                                        />
                                    </div>
                                )}
                                {selectedRole?.shortCode == 'area_admin' && (
                                    <div className="mt-4">
                                        <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedBranches?.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                            <div className="flex justify-between">
                                                <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedBranches?.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                    Designated Branches
                                                </label>
                                            </div>
                                            <div className="block h-fit">
                                                <Select 
                                                    options={filteredByRoleBranchList}
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
                                                onChange={(field, value) => handleBranchChange(field, value)}
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
                                                options={[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => ({label: String(n), value: n}))}
                                                onChange={setFieldValue}
                                                onBlur={setFieldTouched}
                                                placeholder="Select LO Number"
                                                errors={touched.loNo && errors.loNo ? errors.loNo : undefined}
                                            />
                                        </div>
                                        <div className="flex flex-col mt-4 text-gray-500">
                                            <div>Transaction Type</div>
                                            <div className="flex flex-row ml-4">
                                                <RadioButton id={"radio_daily"} name="radio-occurence" label={"Daily"} checked={occurence === 'daily'} value="daily" onChange={(field, value) => handleTransactionTypeChange(field, 'daily')} />
                                                <RadioButton id={"radio_weekly"} name="radio-occurence" label={"Weekly"} checked={occurence === 'weekly'} value="weekly" onChange={(field, value) => handleTransactionTypeChange(field, 'weekly')} />
                                            </div>
                                            {occurence === 'weekly' && (
                                                <div className="flex flex-col mt-3 ml-4">
                                                    <div className="text-xs uppercase text-gray-400">Weekly Mode</div>
                                                    <div className="flex flex-row mt-1">
                                                        <RadioButton id={"radio_standard"} name="radio-weekly-schedule" label={"Standard (24 wks)"} checked={weeklyScheduleType === 'standard'} value="standard" onChange={(field, value) => handleWeeklyScheduleTypeChange('weeklyScheduleType', 'standard')} />
                                                        <RadioButton id={"radio_accelerated"} name="radio-weekly-schedule" label={"Accelerated (12 wks)"} checked={weeklyScheduleType === 'accelerated'} value="accelerated" onChange={(field, value) => handleWeeklyScheduleTypeChange('weeklyScheduleType', 'accelerated')} />
                                                    </div>
                                                </div>
                                            )}
                                            {occurence === 'weekly' && weeklyScheduleType === 'accelerated' && (
                                                <div className="mt-3 ml-4">
                                                    <div className="text-xs uppercase text-gray-400 mb-1">Group Category</div>
                                                    <SelectDropdown
                                                        name="acceleratedCategory"
                                                        field="acceleratedCategory"
                                                        value={values.acceleratedCategory}
                                                        options={ACCELERATED_WEEKLY_CATEGORIES.map(c => ({ label: c.label, value: c.key }))}
                                                        onChange={(field, value) => handleAcceleratedCategoryChange(field, value)}
                                                        onBlur={setFieldTouched}
                                                        placeholder="Select a category"
                                                        errors={touched.acceleratedCategory && errors.acceleratedCategory ? errors.acceleratedCategory : undefined}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                )}
                                
                                {mode === 'edit' && (
                                    <div className="mt-4 space-y-3">
                                        <div className="p-4 border border-gray-200 rounded-xl">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                        user.biometricCredentialId && !biometricRemoved
                                                            ? 'bg-teal-100' : 'bg-gray-100'
                                                    }`}>
                                                        <svg className={`w-4 h-4 ${
                                                            user.biometricCredentialId && !biometricRemoved
                                                                ? 'text-teal-600' : 'text-gray-400'
                                                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">Fingerprint Login</p>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {user.biometricCredentialId && !biometricRemoved
                                                                ? `Registered${user.biometricDeviceName ? ` · ${user.biometricDeviceName}` : ''}${user.biometricRegisteredAt ? ` · ${moment(user.biometricRegisteredAt).format('MMM D, YYYY')}` : ''}`
                                                                : 'Not registered'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                {user.biometricCredentialId && !biometricRemoved ? (
                                                    <button
                                                        type="button"
                                                        disabled={removingBiometric}
                                                        onClick={async () => {
                                                            if (!confirm(`Remove fingerprint login for ${user.firstName} ${user.lastName}? They will need to re-register on next login.`)) return;
                                                            setRemovingBiometric(true);
                                                            try {
                                                                const res = await fetchWrapper.post(
                                                                    getApiBaseUrl() + 'users/biometric-remove',
                                                                    { userId: user._id }
                                                                );
                                                                if (res.success) {
                                                                    setBiometricRemoved(true);
                                                                    toast.success('Fingerprint login removed. User will be prompted to re-register on next login.');
                                                                } else {
                                                                    toast.error('Failed to remove fingerprint.');
                                                                }
                                                            } catch {
                                                                toast.error('An error occurred.');
                                                            } finally {
                                                                setRemovingBiometric(false);
                                                            }
                                                        }}
                                                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-600
                                                            border border-red-200 rounded-lg hover:bg-red-50
                                                            disabled:opacity-50 transition-colors"
                                                    >
                                                        {removingBiometric ? 'Removing...' : 'Remove'}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">
                                                        User registers on login
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {user?.lockedUntil && moment().isBefore(moment(user.lockedUntil)) && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-red-700">🔒 Account Locked</p>
                                                    <p className="text-xs text-red-500 mt-0.5">
                                                        Unlocks at {moment(user.lockedUntil).format('MMM D, h:mm A')}
                                                        {' · '}{user.loginAttempts || 0} failed attempt{user.loginAttempts !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await fetchWrapper.post(getApiBaseUrl() + 'users/', {
                                                                _id:          user._id,
                                                                loginAttempts: 0,
                                                                lockedUntil:  null,
                                                                role:         JSON.stringify(user.role),
                                                            });
                                                            toast.success('Account unlocked successfully.');
                                                            performClose();
                                                        } catch {
                                                            toast.error('Failed to unlock account.');
                                                        }
                                                    }}
                                                    className="flex-shrink-0 px-3 py-2 bg-red-600 text-white text-xs
                                                        font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                                >
                                                    Unlock Now
                                                </button>
                                            </div>
                                        )}
                                    </div>
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