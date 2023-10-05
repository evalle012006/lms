import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import SelectDropdown from "@/lib/ui/select";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';
import Spinner from "@/components/Spinner";
import { multiStyles, DropdownIndicator } from "@/styles/select";
import Select from 'react-select';
import { setUser } from "@/redux/actions/userActions";
import RadioButton from "@/lib/ui/radio-button";
import { checkFileSize } from "@/lib/utils";

const AddUpdateUser = ({ mode = 'add', user = {}, roles = [], branches = [], showSidebar, setShowSidebar, onClose }) => {    
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [photo, setPhoto] = useState();
    const [photoW, setPhotoW] = useState(200);
    const [photoH, setPhotoH] = useState(200);
    const [image, setImage] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [occurence, setOccurence] = useState('daily');
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const initialValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        number: user.number,
        position: user.position,
        designatedBranch: user.designatedBranch ? (user.roleId === 2 ? user.designatedBranch : user.designatedBranch) : 0,
        role: user.role ? user.roleId : '',
        loNo: user.loNo,
        transactionType: user.transactionType,
        branchManagerName: user?.branchManagerName
    }

    const validationSchema = yup.object().shape({
        firstName: yup
            .string()
            .required('Please enter first name'),
        lastName: yup
            .string()
            .required('Please enter last name'),
        email: yup
            .string()
            .email('Please enter valid email address')
            .required('Please enter email address'),
        number: yup
            .string()
            .required('Please enter phone number'),
        position: yup
            .string()
            .required('Please select a position'),
        role: yup
            .string()
            .required('Please select a role'),

    });

    const handleSelectBranch = (selectedBranch) => {
        setSelectedBranches(selectedBranch);
    }

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        let selectedBranchesCode = [];
        let selectedBranchesId = [];
        selectedBranches && selectedBranches.map(branch => {
            selectedBranchesId.push(branch._id);
            selectedBranchesCode.push(branch.code);
        });

        const selectedRole = roles.find(role => role.rep == values.role);
        values.role = JSON.stringify(selectedRole);
        let designatedBranch = '';
        let designatedBranchId = '';
        if (selectedRole.rep === 2) {
            designatedBranch = JSON.stringify(selectedBranchesCode);
            designatedBranchId = selectedBranchesId;
        } else if (selectedRole.rep > 2) {
            designatedBranch = values.designatedBranch;
            const selectedBranch = branches.find(b => b.code === designatedBranch);
            if (selectedBranch) {
                values.designatedBranchId = selectedBranch._id;
            }
        }

        values.designatedBranch = designatedBranch;
        values.transactionType = occurence;
        values.currentDate = currentDate;

        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'users/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('User successfully added.');
                        action.setSubmitting = false;
                        action.resetForm();
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            setLoading(false);
            values.file = image;
            fetchWrapper.sendData(process.env.NEXT_PUBLIC_API_URL + 'users/', values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    handleRemoveImage();
                    toast.success('User successfully updated.');
                    action.setSubmitting = false;
                    action.resetForm();
                    onClose();
                }).catch(error => {
                    console.log(error);
                });
        }
    }

    const onUploadClick = () => {
        hiddenInput.current.click();
    }

    const handleFileChange = async e => {
        const fileUploaded = e.target.files[0];

        const fileSizeMsg = checkFileSize(fileUploaded?.size);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
        } else {
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

    const loadImageFile = ({ naturalWidth, naturalHeight }) => {
        // if (naturalWidth <= naturalHeight) {
        //     const w = 200 * parseInt(naturalWidth) / parseInt(naturalHeight);
        //     setPhotoH(200);
        //     setPhotoW(w);
        // } else {
        //     const h = 200 * parseInt(naturalHeight) / parseInt(naturalWidth);
        //     setPhotoW(200);
        //     setPhotoH(h.toFixed());
        // }
    }

    const handleCancel = () => {
        setShowSidebar(false);
        formikRef.current.resetForm();
        handleRemoveImage();
        onClose();
    }

    useEffect(() => {
        let mounted = true;

        if (user.imgUrl) {
            // setPhoto(`${imgpath}/${user.imgUrl}`);
            mounted && setPhoto(`${user.imgUrl}`);
        }

        if (user.hasOwnProperty('transactionType') && user.transactionType) {
            mounted && setOccurence(user.transactionType);
        }

        if (user.roleId === 2) {
            const branchesCode = user.designatedBranch;
            let selectedBranchesList = [];
            branches && branches.map(branch => {
                branchesCode.map(b => {
                    if (branch.code === b) {
                        selectedBranchesList.push(branch);
                    }
                })
            });

            mounted && setSelectedBranches(selectedBranchesList);
        }

        setLoading(false);

        return () => {
            mounted = false;
        };
    }, [user]);

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Team Member' : 'Edit Profile'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                                            height={photoH}
                                                            onLoadingComplete={loadImageFile} />
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
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Role"
                                            errors={touched.role && errors.role ? errors.role : undefined}
                                        />
                                    </div>
                                    {values.role === 2 && (
                                        <div className="mt-4">
                                            <div className={`flex flex-col border rounded-md px-4 py-2 bg-white ${selectedBranches.length > 0 ? 'border-main' : 'border-slate-400'}`}>
                                                <div className="flex justify-between">
                                                    <label htmlFor="designatedBranch" className={`font-proxima-bold text-xs font-bold  ${selectedBranches.length > 0 ? 'text-main' : 'text-gray-500'}`}>
                                                        Designated Branches
                                                    </label>
                                                </div>
                                                <div className="block h-fit">
                                                    <Select 
                                                        options={branches}
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
                                    {values.role >= 3 && (
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
                                                    options={branches}
                                                    onChange={setFieldValue}
                                                    onBlur={setFieldTouched}
                                                    placeholder="Select Branch"
                                                    errors={touched.designatedBranch && errors.designatedBranch ? errors.designatedBranch : undefined}
                                                />
                                            </div>
                                        </React.Fragment>
                                    )}
                                    
                                    {values.role === 4 && (
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
        </React.Fragment>
    )
}

export default AddUpdateUser;