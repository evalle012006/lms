// src/pages/settings/sms/index.js
import React, { useState } from 'react';
import { Formik } from 'formik';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { setSystemSettings } from '@/redux/actions/systemActions';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { MessageSquare, Bell, KeyRound } from 'lucide-react';

const Toggle = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-7 w-14 flex-shrink-0 rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none
            ${checked ? 'bg-green-600' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow
            ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-7' : 'translate-x-0'}`} />
    </button>
);

const SmsSettingsPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const state = useSelector((s) => s.systemSettings?.data || {});
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        smsEnabled:                 state.smsEnabled                 ?? false,
        smsSenderName:              state.smsSenderName              || '',
        smsNotificationsEnabled:    state.smsNotificationsEnabled    ?? true,
        smsNotificationsSenderName: state.smsNotificationsSenderName || '',
        smsOtpEnabled:              state.smsOtpEnabled              ?? true,
        smsOtpSenderName:           state.smsOtpSenderName           || '',
    };

    async function handleUpdate(values) {
        setLoading(true);
        try {
            const response = await fetchWrapper.post(`${getApiBaseUrl()}settings/system`, { ...values, _id: state._id });
            if (response.success) {
                dispatch(setSystemSettings(response.system || { ...state, ...values }));
                toast.success('SMS settings updated successfully!');
            } else {
                toast.error(response.message || 'Failed to update SMS settings');
            }
        } catch (error) {
            console.error('SMS settings update error:', error);
            toast.error('Failed to update SMS settings');
        } finally {
            setLoading(false);
        }
    }

    if (!currentUser?.root) return null;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">SMS Settings</h1>
                <p className="text-sm text-gray-500 mb-6">
                    Notifications and OTP verification codes are controlled separately — turning off
                    one never affects the other. Both still require the master switch below to be on.
                </p>

                <Formik initialValues={initialValues} onSubmit={handleUpdate} enableReinitialize>
                    {({ values, setFieldValue, handleSubmit }) => (
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Master switch */}
                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-gray-900">SMS (Master Switch)</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Off means nothing sends at all — Notifications and OTP below
                                                are ignored entirely while this is off. Requires{' '}
                                                <code className="text-xs bg-gray-100 px-1 rounded">SEMAPHORE_API_KEY</code> in
                                                the environment.
                                            </p>
                                        </div>
                                    </div>
                                    <Toggle checked={values.smsEnabled} onChange={(v) => setFieldValue('smsEnabled', v)} />
                                </div>

                                <div className="mt-4 pl-8">
                                    <label className="text-xs font-medium text-gray-500">Default Sender Name </label>
                                    <input
                                        type="text"
                                        value={values.smsSenderName}
                                        onChange={(e) => setFieldValue('smsSenderName', e.target.value)}
                                        placeholder="AmberCash"
                                        maxLength={11}
                                        className="mt-1 w-full max-w-xs border border-gray-200 rounded-lg text-sm px-3 py-2"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Max 11 characters, must be registered with Semaphore. Used by both
                                        Notifications and OTP below unless each overrides it separately.
                                    </p>
                                </div>
                            </div>

                            {/* Notifications — sibling to OTP, not nested under it */}
                            <SubPanel
                                icon={<Bell className="w-5 h-5 text-gray-400 mt-0.5" />}
                                title="SMS Notifications"
                                description="LAF submission, CI approval/decline, loan release, and mobile app access/eligibility notices."
                                enabled={values.smsNotificationsEnabled}
                                onToggle={(v) => setFieldValue('smsNotificationsEnabled', v)}
                                masterOn={values.smsEnabled}
                                senderName={values.smsNotificationsSenderName}
                                onSenderNameChange={(v) => setFieldValue('smsNotificationsSenderName', v)}
                                defaultSenderName={values.smsSenderName || 'AmberCash'}
                            />

                            {/* OTP — sibling to Notifications */}
                            <SubPanel
                                icon={<KeyRound className="w-5 h-5 text-gray-400 mt-0.5" />}
                                title="SMS OTP"
                                description="Mobile app login and enrollment verification codes. Authentication-critical — kept independent of Notifications above on purpose."
                                enabled={values.smsOtpEnabled}
                                onToggle={(v) => setFieldValue('smsOtpEnabled', v)}
                                masterOn={values.smsEnabled}
                                senderName={values.smsOtpSenderName}
                                onSenderNameChange={(v) => setFieldValue('smsOtpSenderName', v)}
                                defaultSenderName={values.smsSenderName || 'AmberCash'}
                            />

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

const SubPanel = ({ icon, title, description, enabled, onToggle, masterOn, senderName, onSenderNameChange, defaultSenderName }) => (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${!masterOn ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                {icon}
                <div>
                    <p className="font-semibold text-gray-900">{title}</p>
                    <p className="text-sm text-gray-500 mt-1">{description}</p>
                    {!masterOn && (
                        <p className="text-xs text-amber-600 mt-1">Master switch is off — this has no effect until it's on.</p>
                    )}
                </div>
            </div>
            <Toggle checked={enabled} onChange={onToggle} disabled={!masterOn} />
        </div>

        <div className="mt-4 pl-8">
            <label className="text-xs font-medium text-gray-500">Sender Name Override (optional) </label>
            <input
                type="text"
                value={senderName}
                onChange={(e) => onSenderNameChange(e.target.value)}
                placeholder={`Falls back to "${defaultSenderName}"`}
                maxLength={11}
                disabled={!masterOn}
                className="mt-1 w-full max-w-xs border border-gray-200 rounded-lg text-sm px-3 py-2 disabled:bg-gray-50"
            />
        </div>
    </div>
);

export default SmsSettingsPage;