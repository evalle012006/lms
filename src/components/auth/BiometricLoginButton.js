import { toast } from 'react-toastify';
import { useState, useEffect, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBiometric, isBiometricSupported } from '@/hooks/useBiometric';
import { useSelector } from 'react-redux';

/**
 * BiometricLoginButton
 * Renders only when:
 *   1. Device has a platform authenticator (fingerprint/Face ID)
 *   2. The typed email has biometric registered in DB
 */
const BiometricLoginButton = ({ email, onSuccess, onFallback }) => {
    const { authenticateWithBiometric, loading } = useBiometric();
    const [platformSupported, setPlatformSupported] = useState(false);
    const [userId, setUserId]         = useState(null);
    const [hasBiometric, setHasBiometric] = useState(false);
    const [checking, setChecking]     = useState(false);
    const requireStaffBiometric = useSelector(
        s => s.systemSettings?.data?.requireStaffBiometric ?? true
    );

    // Detect if device has fingerprint/Face ID sensor
    useEffect(() => {
        if (!isBiometricSupported()) {
            console.log('[Biometric] WebAuthn not supported on this browser');
            return;
        }
        window.PublicKeyCredential
            .isUserVerifyingPlatformAuthenticatorAvailable()
            .then(available => {
                console.log('[Biometric] Platform authenticator available:', available);
                setPlatformSupported(available);
            })
            .catch(err => {
                console.warn('[Biometric] Platform check failed:', err);
                setPlatformSupported(false);
            });
    }, []);

    // Check if this email has biometric registered
    useEffect(() => {
        setUserId(null);
        setHasBiometric(false);
        if (!email || !email.includes('@') || !platformSupported) return;

        const timer = setTimeout(async () => {
            setChecking(true);
            try {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'users/biometric-check?' +
                    new URLSearchParams({ email })
                );
                console.log('[Biometric] Check result:', res);
                if (res.success && res.hasBiometric) {
                    setHasBiometric(true);
                    setUserId(res.userId);
                }
            } catch { /* ignore */ } finally { setChecking(false); }
        }, 600);
        return () => clearTimeout(timer);
    }, [email, platformSupported]);

    const handleBiometricLogin = useCallback(async () => {
        if (!userId) return;
        const result = await authenticateWithBiometric(userId);
        if (result.success) {
            onSuccess(result.user);
        } else if (result.fallback) {
            // Max attempts exceeded or device locked — redirect to password
            toast.error(result.error, { autoClose: 6000 });
            onFallback?.(); // signal parent to focus password field
        } else if (result.error) {
            toast.error(result.error, { autoClose: 5000 });
        }
        // If cancelled silently — do nothing, let user retry
    }, [userId, authenticateWithBiometric, onSuccess, onFallback]);

    // Only render if device supports it AND user has biometric
    if (!requireStaffBiometric) return null;
    if (!platformSupported || !hasBiometric || checking) return null;

    return (
        <div className="mt-3">
            <div className="relative flex items-center py-1.5">
                <div className="flex-grow border-t border-gray-200" />
                <span className="mx-3 text-xs text-gray-400 flex-shrink-0">or</span>
                <div className="flex-grow border-t border-gray-200" />
            </div>
            <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading || checking || !userId}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3
                    border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-600
                    hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700
                    active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-200 group"
            >
                {(loading || checking) ? (
                    <>
                        <svg className="w-4 h-4 animate-spin text-teal-500 flex-shrink-0"
                            fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        {loading ? 'Verifying...' : 'Checking...'}
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-500
                            flex-shrink-0 transition-colors"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                        </svg>
                        Sign in with Fingerprint
                    </>
                )}
            </button>
        </div>
    );
};

export default BiometricLoginButton;