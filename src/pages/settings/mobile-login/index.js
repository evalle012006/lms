// src/pages/settings/mobile-login/index.js
import React, { useState } from 'react';
import { Formik } from 'formik';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { setSystemSettings } from '@/redux/actions/systemActions';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { KeyRound } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-14 flex-shrink-0 rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer
            ${checked ? 'bg-green-600' : 'bg-gray-200'}`}
    >
        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow
            ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-7' : 'translate-x-0'}`} />
    </button>
);

const MobileLoginSettingsPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const state = useSelector((s) => s.systemSettings?.data || {});
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        passwordLoginEnabled: state.passwordLoginEnabled ?? false,
    };

    async function handleUpdate(values) {
        setLoading(true);
        try {
            const response = await fetchWrapper.post(`${getApiBaseUrl()}settings/system`, { ...values, _id: state._id });
            if (response.success) {
                dispatch(setSystemSettings(response.system || { ...state, ...values }));
                toast.success('Mobile login settings updated!');
            } else {
                toast.error(response.message || 'Failed to update');
            }
        } catch (error) {
            console.error('Mobile login settings update error:', error);
            toast.error('Failed to update');
        } finally {
            setLoading(false);
        }
    }

    if (!currentUser?.root) return null;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Mobile App Login Settings</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Controls whether clients can log in with a phone/ID number + password,
                    in addition to SMS OTP. OTP always remains available regardless of this
                    setting — it's the backup/recovery path if a client forgets their password.
                </p>

                <Formik initialValues={initialValues} onSubmit={handleUpdate} enableReinitialize>
                    {({ values, setFieldValue, handleSubmit }) => (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <KeyRound className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-gray-900">Password Login</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                When off, the app only shows the SMS OTP flow — clients who
                                                already set a password simply won't be offered password login
                                                until this is turned back on. Nothing is deleted.
                                            </p>
                                        </div>
                                    </div>
                                    <Toggle checked={values.passwordLoginEnabled} onChange={(v) => setFieldValue('passwordLoginEnabled', v)} />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? <Spinner size="sm" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}
                </Formik>
            </div>
        </Layout>
    );
};

export default MobileLoginSettingsPage;