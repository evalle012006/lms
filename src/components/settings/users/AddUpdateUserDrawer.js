import React, { useState, useEffect, useRef } from "react";
import { Formik } from 'formik';
import * as yup from 'yup';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "@/redux/actions/userActions";
import SelectDropdown from "@/lib/ui/select";
import InputText from "@/lib/ui/InputText";
import InputEmail from "@/lib/ui/InputEmail";
import InputNumber from "@/lib/ui/InputNumber";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import SideBar from "@/lib/ui/SideBar";
import Spinner from "../Spinner";
import placeholder from '/public/images/image-placeholder.png';
import Image from 'next/image';

const AddUpdateUser = ({ mode = 'add', user = {}, roles = [], showSidebar, setShowSidebar, onClose }) => {
    const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
    const hiddenInput = useRef(null);
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [photo, setPhoto] = useState();
    const [photoW, setPhotoW] = useState(200);
    const [photoH, setPhotoH] = useState(200);
    const [image, setImage] = useState('');
    const loggedInUser = useSelector(state => state.user.data);
    const initialValues = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        number: user.number,
        position: user.position,
        role: user.role ? user.role.value : '',
        newRole: ''
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

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        const selectedRole = roles.find(role => role.rep == values.role);
        values.role = JSON.stringify(selectedRole);
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
            fetchWrapper.sendData('/api/users/', values)
                .then(response => {
                    // if (loggedInUser.email === values.email) {
                    //     dispatch(setUser({
                    //         ...loggedInUser,
                    //         firstName: values.firstName,
                    //         lastName: values.lastName,
                    //         email: values.email,
                    //         number: values.number,
                    //         position: values.position,
                    //         role: values.role
                    //     }));
                    // }
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
        if (e.target.value) {
            const fileUploaded = e.target.files[0];
            setPhoto(URL.createObjectURL(fileUploaded));
            setImage(fileUploaded);
        }
    }

    const handleRemoveImage = () => {
        setPhoto('');
        setImage('');
        hiddenInput.current.value = '';
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
    }

    useEffect(() => {
        let mounted = true;

        setPhoto(`${imgpath}/${user.imgUrl}`);
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
                                            label="Email Address"
                                            placeholder="Enter Email Address"
                                            setFieldValue={setFieldValue}
                                            errors={touched.email && errors.email ? errors.email : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputNumber
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
                                            label="Platform Role"
                                            options={roles}
                                            onChange={setFieldValue}
                                            onBlur={setFieldTouched}
                                            placeholder="Select Role"
                                            errors={touched.role && errors.role ? errors.role : undefined}
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

export default AddUpdateUser;