// src/pages/change-password.js
//
// Shown immediately after login when user.mustChangePassword is true (see
// login.js patch — checked before the existing biometric-setup redirect).
// Requires the current password (the admin-issued temp one) plus a new
// password + confirmation, per the request: this is deliberately NOT the
// same as either existing reset-password flow — see the comment header in
// pages/api/v2/users/change-password.js for how the three password-change
// paths in this app differ.
//
// NOTE ON ENFORCEMENT: this page is reached via a redirect at login time.
// It does not currently stop someone from typing a different URL directly
// into the address bar afterward — there's no route guard checking
// mustChangePassword on every navigation, only at the login redirect. If
// that matters (i.e. you want this to be genuinely unskippable, not just
// the default next screen), it needs a check in whatever wraps every
// authenticated page (_app.js or a layout component) — I don't have
// visibility into that file, so I didn't guess at editing it.

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { setUser } from '@/redux/actions/userActions';
import { userService } from '@/services/user-service';

const PasswordField = ({ label, value, onChange, show, onToggleShow, autoFocus }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm
                    focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
            <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
            >
                {show ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
        </div>
    </div>
);

const ChangePasswordPage = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }
        if (newPassword === currentPassword) {
            setError('New password must be different from your current password.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetchWrapper.post(getApiBaseUrl() + 'users/change-password', {
                _id: currentUser._id,
                currentPassword,
                newPassword,
            });

            if (response.success) {
                // Must update all three places RouteGuard can read from —
                // Redux, the userService BehaviorSubject, and localStorage —
                // same pattern biometric-setup.js uses for biometricCredentialId,
                // and for the same reason: RouteGuard falls back to localStorage
                // as the source of truth after a reload, so updating Redux alone
                // would leave the guard still seeing mustChangePassword=true and
                // bouncing the user right back to this page.
                try {
                    const stored = JSON.parse(localStorage.getItem('acuser') || '{}');
                    stored.mustChangePassword = false;
                    localStorage.setItem('acuser', JSON.stringify(stored));
                    userService.update(stored);
                } catch { /* ignore */ }

                dispatch(setUser({ ...currentUser, mustChangePassword: false }));
                toast.success('Password updated.');

                // Same post-login routing the login page itself uses —
                // biometric setup next, unless already registered or root.
                const hasBiometric = !!currentUser?.biometricCredentialId;
                const isRoot = currentUser?.root === true;
                if (!hasBiometric && !isRoot) {
                    router.push('/biometric-setup');
                } else {
                    router.push('/');
                }
            } else {
                setError(response.message || 'Failed to update password.');
            }
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <LockClosedIcon className="w-5 h-5 text-teal-600" />
                    </div>
                    <h1 className="text-lg font-semibold text-gray-900">Set a New Password</h1>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    You're using a temporary password. Set your own before continuing.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <PasswordField
                        label="Current (Temporary) Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        show={showCurrent}
                        onToggleShow={() => setShowCurrent(s => !s)}
                        autoFocus
                    />
                    <PasswordField
                        label="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        show={showNew}
                        onToggleShow={() => setShowNew(s => !s)}
                    />
                    <PasswordField
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        show={showNew}
                        onToggleShow={() => setShowNew(s => !s)}
                    />

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-4 py-2.5 rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Updating…' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;