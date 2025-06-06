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
import CheckBox from '@/lib/ui/checkbox';

const SystemSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const state = useSelector(state => state.transactionsSettings.data);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    // TO DO: for some reason the initial values are not being set
    const initialValues = {
        allowWeekendTransaction: state.allowWeekendTransaction, 
        startTransactionTime: state.startTransactionTime, 
        superPwd: state.superPwd,
    }

    const validationSchema = yup.object().shape({});

    const handleUpdate = async (values, action) => {
        setLoading(true);

        let updatedValues = {...state};
        updatedValues.allowWeekendTransaction = values.allowWeekendTransaction;
        updatedValues.startTransactionTime = values.startTransactionTime;
        updatedValues.superPwd = values.superPwd;

        const apiURL = `${getApiBaseUrl()}settings/transactions`;
        const response = await fetchWrapper.post(apiURL, updatedValues);

        if (response.success) {
            dispatch(setTransactionSettings({...updatedValues}));
            setLoading(false);
            toast.success('Transaction Settings updated successfully!');
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
                                    {console.log(values)}
                                    <div className="mt-4">
                                        <CheckBox 
                                            name="allowWeekendTransaction"
                                            value={values.allowWeekendTransaction} 
                                            onChange={setFieldValue}  
                                            label={"Allow Weekend Transaction"} 
                                            size={"lg"} 
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="startTransactionTime"
                                            value={values.startTransactionTime}
                                            onChange={handleChange}
                                            label="Start Transaction Time"
                                            placeholder="Use this format 09:00 AM"
                                            setFieldValue={setFieldValue}
                                            errors={touched.startTransactionTime && errors.startTransactionTime ? errors.startTransactionTime : undefined} />
                                    </div>
                                    <div className="mt-4">
                                        <InputText
                                            name="superPwd"
                                            value={values.superPwd}
                                            onChange={handleChange}
                                            label="Super Pwd"
                                            placeholder="Please type the Super Pwd"
                                            setFieldValue={setFieldValue}
                                            errors={touched.superPwd && errors.superPwd ? errors.superPwd : undefined} />
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

export default SystemSettingsPage;