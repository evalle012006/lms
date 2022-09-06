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
import Spinner from "@/components/Spinner";
import CheckBox from "@/lib/ui/checkbox";

const AddUpdateRole = ({ mode = 'add', role = {}, permissions=[], showSidebar, setShowSidebar, onClose }) => {
    const formikRef = useRef();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [fieldName, setFieldName] = useState({});
    let fieldErrors = '';

    const initialValues = {
        name: role.name,
        shortCode: role.shortCode,
        ...fieldName
    }

    const validationSchema = yup.object().shape({
        name: yup
            .string()
            .required('Please enter name'),
        shortCode: yup
            .string()
            .required('Please enter code')

    });

    const handleSaveUpdate = (values, action) => {
        setLoading(true);
        if (mode === 'add') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'roles/save/';

            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    if (response.error) {
                        toast.error(response.message);
                    } else if (response.success) {
                        setLoading(false);
                        setShowSidebar(false);
                        toast.success('Role successfully added.');
                        action.setSubmitting = false;
                        action.resetForm();
                        onClose();
                    }
                }).catch(error => {
                    console.log(error)
                });
        } else if (mode === 'edit') {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL + 'roles';
            values._id = role._id;
            fetchWrapper.post(apiUrl, values)
                .then(response => {
                    setLoading(false);
                    setShowSidebar(false);
                    toast.success('Role successfully updated.');
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

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, [role]);

    useEffect(() => {
        let fieldObject = {};

        permissions && permissions.map(p => {
            fieldObject['p-' + p.shortCode] = false;
        });

        setFieldName(fieldObject);
    }, [permissions])

    return (
        <React.Fragment>
            <SideBar title={mode === 'add' ? 'Add Role' : 'Edit Role'} showSidebar={showSidebar} setShowSidebar={setShowSidebar} hasCloseButton={false}>
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
                                            onChange={handleChange}
                                            label="Name"
                                            placeholder="Enter Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.name && errors.name ? errors.name : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="shortCode"
                                            value={values.shortCode}
                                            onChange={handleChange}
                                            label="Code"
                                            placeholder="Enter Code"
                                            setFieldValue={setFieldValue}
                                            errors={touched.shortCode && errors.shortCode ? errors.shortCode : undefined} />
                                    </div>
                                    <div className={`w-full border rounded-md mt-4 p-4 ${fieldErrors && 'border-red-400'}`}>
                                        <div className="pb-4 border-b">Permissions</div>
                                        <div className="grid gap-4 grid-cols-3 mt-4">
                                            {permissions.map((item, index) => {
                                                fieldErrors = errors[item.shortCode];
                                                return (
                                                    <div key={index}>
                                                        <CheckBox id={item.shortCode} value={values['p-' + item.shortCode]} onChange={handleChange}  label={item.name} size={"lg"} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {fieldErrors && <div className="mt-4 text-red-400 text-xs font-medium">One or more nutrient fields are blank. All nutrients are required.</div>}
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

export default AddUpdateRole;