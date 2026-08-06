import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useBiometric, isBiometricSupported } from '@/hooks/useBiometric';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import moment from 'moment';

/**
 * BiometricSetup
 * Drop this into the user profile/settings page.
 * Shows registration or removal UI based on whether biometric is already set up.
 */
const BiometricSetup = ({ user, onUpdate }) => {
    const currentUser = useSelector(s => s.user.data);
    const { registerBiometric, loading } = useBiometric();
    const [deviceName, setDeviceName]   = useState('');
    const [removing, setRemoving]       = useState(false);
    const [showNameInput, setShowNameInput] = useState(false);

    const targetUser  = user || currentUser;
    const hasRegistered = !!(targetUser?.biometricCredentialId);

    if (!isBiometricSupported()) {
        return (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-700">Fingerprint Login Unavailable</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Your browser or device does not support biometric authentication.
                        Try Chrome or Edge on a device with a fingerprint reader.
                    </p>
                </div>
            </div>
        );
    }

    const handleRegister = async () => {
        const name = deviceName.trim() || detectDeviceName();
        const result = await registerBiometric(targetUser._id, name);

        if (result.success) {
            toast.success('Fingerprint registered. You can now sign in with your fingerprint.');
            setShowNameInput(false);
            setDeviceName('');
            onUpdate?.({ biometricCredentialId: 'registered', biometricDeviceName: name });
        } else if (!result.cancelled) {
            toast.error(result.error || 'Registration failed. Please try again.');
        }
    };

    const handleRemove = async () => {
        if (!confirm('Remove fingerprint login? You can re-register at any time.')) return;
        setRemoving(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'users/biometric-remove',
                { userId: targetUser._id }
            );
            if (res.success) {
                toast.success('Fingerprint login removed.');
                onUpdate?.({ biometricCredentialId: null, biometricDeviceName: null });
            } else {
                toast.error('Failed to remove fingerprint.');
            }
        } catch {
            toast.error('An error occurred.');
        } finally {
            setRemoving(false);
        }
    };

    const detectDeviceName = () => {
        const ua = navigator.userAgent;
        if (/iPhone/.test(ua))  return 'iPhone';
        if (/iPad/.test(ua))    return 'iPad';
        if (/Android/.test(ua)) return 'Android Device';
        if (/Mac/.test(ua))     return 'Mac';
        if (/Windows/.test(ua)) return 'Windows PC';
        return 'My Device';
    };

    return (
        <div className="p-5 bg-white rounded-xl border border-gray-200 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    hasRegistered ? 'bg-teal-100' : 'bg-gray-100'
                }`}>
                    <svg className={`w-5 h-5 ${hasRegistered ? 'text-teal-600' : 'text-gray-400'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-900">Fingerprint Login</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {hasRegistered
                            ? `Registered${targetUser.biometricDeviceName ? ` on ${targetUser.biometricDeviceName}` : ''}${targetUser.biometricRegisteredAt ? ` · ${moment(targetUser.biometricRegisteredAt).format('MMM D, YYYY')}` : ''}`
                            : 'Sign in faster with your fingerprint or Face ID'
                        }
                    </p>
                </div>
                {hasRegistered && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                        text-xs font-medium bg-teal-100 text-teal-700">
                        ✓ Active
                    </span>
                )}
            </div>

            {/* Actions */}
            {hasRegistered ? (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowNameInput(true)}
                        disabled={loading}
                        className="flex-1 py-2 px-4 text-sm font-medium rounded-lg border border-teal-300
                            text-teal-700 hover:bg-teal-50 disabled:opacity-50 transition-colors"
                    >
                        Re-register Fingerprint
                    </button>
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={removing}
                        className="py-2 px-4 text-sm font-medium rounded-lg border border-red-200
                            text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                        {removing ? 'Removing...' : 'Remove'}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowNameInput(true)}
                    disabled={loading}
                    className="w-full py-2.5 px-4 text-sm font-medium rounded-xl
                        bg-teal-600 text-white hover:bg-teal-700
                        disabled:opacity-50 transition-colors"
                >
                    {loading ? 'Setting up...' : 'Set Up Fingerprint Login'}
                </button>
            )}

            {/* Device name input + confirm */}
            {showNameInput && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">
                            Device name (optional)
                        </label>
                        <input
                            type="text"
                            value={deviceName}
                            onChange={e => setDeviceName(e.target.value)}
                            placeholder={detectDeviceName()}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Helps you identify which device this fingerprint belongs to.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setShowNameInput(false); setDeviceName(''); }}
                            className="flex-1 py-2 text-sm border border-gray-200 rounded-lg
                                text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleRegister}
                            disabled={loading}
                            className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg
                                hover:bg-teal-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Scanning...' : 'Scan Fingerprint'}
                        </button>
                    </div>
                </div>
            )}

            <p className="text-xs text-gray-300">
                Your fingerprint never leaves this device. Only a secure key is stored.
            </p>
        </div>
    );
};

export default BiometricSetup;