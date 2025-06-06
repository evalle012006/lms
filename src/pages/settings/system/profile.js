import { Formik } from 'formik';
import * as yup from 'yup';
import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import InputEmail from '@/lib/ui/InputEmail';
import InputText from '@/lib/ui/InputText';
import { setSystemSettings } from '@/redux/actions/systemActions';
import Spinner from '@/components/Spinner';
import { getApiBaseUrl } from '@/lib/constants';

const ProfileSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const state = useSelector(state => state.systemSettings.data);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        companyName: state.companyName, 
        companyAddress: state.companyAddress, 
        companyEmail: state.companyEmail,
        companyPhoneNumber: state.companyPhoneNumber,
        branchCode: state.branchCode,
        branchName: state.branchName,
        branchAddress: state.branchAddress,
        branchPhoneNumber: state.branchPhoneNumber
    }

    const validationSchema = yup.object().shape({});

    const handleUpdate = async (values, action) => {
        setLoading(true);
        const apiURL = `${getApiBaseUrl()}settings/system`;
        const response = await fetchWrapper.post(apiURL, values);

        if (response.success) {
            dispatch(setSystemSettings({...values}));
            setLoading(false);
            toast.success('System Profile updated successfully!');
        }
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(false);

        return () => {
            mounted = false;
        };
    }, [state]);

    return (
        <React.Fragment>
            {loading ? (
                    // <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    // </div>
                ) : (
                    <div className="profile-photo bg-white rounded-lg p-3 proxima-regular mt-10 lg:w-5/6 w-80 lg:mt-0 m-4">
                        <div className="proxima-bold mt-2">System Settings</div>
                        <Formik onSubmit={handleUpdate} initialValues={initialValues} validationSchema={validationSchema}>
                            {({ values, actions, touched, errors, handleChange, handleSubmit, setFieldValue }) => (
                                <form onSubmit={handleSubmit} autoComplete="off">
                                    <div className="mt-4">
                                        <InputText
                                            name="companyName"
                                            value={values.companyName}
                                            onChange={handleChange}
                                            label="Company Name"
                                            placeholder="Please type the Company Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.companyName && errors.companyName ? errors.companyName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="companyAddress"
                                            value={values.companyAddress}
                                            onChange={handleChange}
                                            label="Company Address"
                                            placeholder="Please type the Company Address"
                                            setFieldValue={setFieldValue}
                                            errors={touched.companyAddress && errors.companyAddress ? errors.companyAddress : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputEmail
                                            disabled={true}
                                            name="companyEmail"
                                            value={values.companyEmail}
                                            onChange={handleChange}
                                            label="Company Email"
                                            placeholder="Please type the Company Email"
                                            setFieldValue={setFieldValue}
                                            errors={touched.companyEmail && errors.companyEmail ? errors.companyEmail : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="companyPhoneNumber"
                                            value={values.companyPhoneNumber}
                                            onChange={handleChange}
                                            label="Company Phone Number"
                                            placeholder="Please type the Company Phone Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.companyPhoneNumber && errors.companyPhoneNumber ? errors.companyPhoneNumber : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="branchCode"
                                            value={values.branchCode}
                                            onChange={handleChange}
                                            label="Branch Code"
                                            placeholder="Please type the Branch Code"
                                            setFieldValue={setFieldValue}
                                            errors={touched.branchCode && errors.branchCode ? errors.branchCode : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="branchName"
                                            value={values.branchName}
                                            onChange={handleChange}
                                            label="Branch Name"
                                            placeholder="Please type the Branch Name"
                                            setFieldValue={setFieldValue}
                                            errors={touched.branchName && errors.branchName ? errors.branchName : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            disabled={true}
                                            name="branchAddress"
                                            value={values.branchAddress}
                                            onChange={handleChange}
                                            label="Branch Address"
                                            placeholder="Please type the Branch Address"
                                            setFieldValue={setFieldValue}
                                            errors={touched.branchAddress && errors.branchAddress ? errors.branchAddress : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="branchPhoneNumber"
                                            value={values.branchPhoneNumber}
                                            onChange={handleChange}
                                            label="Branch Phone Number"
                                            placeholder="Please type the Branch Phone Number"
                                            setFieldValue={setFieldValue}
                                            errors={touched.branchPhoneNumber && errors.branchPhoneNumber ? errors.branchPhoneNumber : undefined} />
                                    </div>
                                    <div className="mt-4 grid justify-items-end">
                                        <button type="submit" className="bg-main border border-main rounded-md text-sm text-white font-bold proxima-regular px-5 py-2">
                                            {loading && <svg role="status" className="inline w-4 h-4 mr-3 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
                                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
                                            </svg>}
                                            Update
                                        </button>
                                    </div>
                                </form>
                            )}
                        </Formik>
                    </div>
                )
            }
        </React.Fragment>
    );
}

export default ProfileSettingsPage;