import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';

// ── Helpers ───────────────────────────────────────────────────────────────
function base64urlToUint8Array(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function arrayBufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary  = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Safe JSON parse — guards against Nginx returning HTML on proxy errors
async function safeJson(res) {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        throw new Error(
            res.status === 413 ? 'Request too large.'
            : res.status === 502 || res.status === 504 ? 'Server temporarily unavailable. Please try again.'
            : `Server error (${res.status}). Please try again.`
        );
    }
    return res.json();
}

const LAFBiometricStep = ({ onVerified, verified }) => {
    const [loading, setLoading]     = useState(false);
    const [supported, setSupported] = useState(null);
    const registeringRef            = useRef(false);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            setSupported(false);
            return;
        }
        window.PublicKeyCredential
            .isUserVerifyingPlatformAuthenticatorAvailable()
            .then(v  => setSupported(v))
            .catch(() => setSupported(false));
    }, []);

    const handleScan = useCallback(async () => {
        if (registeringRef.current || verified) return;
        registeringRef.current = true;
        setLoading(true);

        try {
            const sessionId = `laf-${Date.now()}-${Math.random().toString(36).slice(2)}`;

            // Step 1 — Get challenge
            const challengeRes = await fetch(
                `/api/public/laf/biometric-challenge?sessionId=${encodeURIComponent(sessionId)}`
            ).then(safeJson);

            if (!challengeRes.success) throw new Error(challengeRes.message || 'Failed to get challenge');

            const { options, challengeToken } = challengeRes;

            // Step 2 — Trigger fingerprint / Face ID
            const credential = await navigator.credentials.create({
                publicKey: {
                    ...options,
                    challenge:          base64urlToUint8Array(options.challenge),
                    user: {
                        ...options.user,
                        id: base64urlToUint8Array(options.user.id),
                    },
                    excludeCredentials: (options.excludeCredentials || []).map(c => ({
                        ...c,
                        id: base64urlToUint8Array(c.id),
                    })),
                },
            });

            if (!credential) throw new Error('Biometric capture was cancelled.');

            // Step 3 — Encode for server
            const credentialForServer = {
                id:    credential.id,
                rawId: arrayBufferToBase64url(credential.rawId),
                type:  credential.type,
                response: {
                    clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                    attestationObject: arrayBufferToBase64url(credential.response.attestationObject),
                },
            };

            // Step 4 — Verify
            const verifyRes = await fetch('/api/public/laf/biometric-verify', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ sessionId, credential: credentialForServer, challengeToken }),
            }).then(safeJson);

            if (!verifyRes.success) throw new Error(verifyRes.message || 'Verification failed');

            onVerified({
                biometricCredentialId: verifyRes.biometricCredentialId,
                biometricPublicKey:    verifyRes.biometricPublicKey,
                biometricCounter:      verifyRes.biometricCounter,
                biometricDeviceName:   verifyRes.biometricDeviceName,
                biometricRegisteredAt: new Date().toISOString(),
            });

            toast.success('Identity verified successfully!');
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                toast.error('Biometric scan was cancelled. Please try again.');
            } else {
                toast.error(err.message || 'Biometric scan failed. Please try again.');
            }
        } finally {
            setLoading(false);
            registeringRef.current = false;
        }
    }, [verified, onVerified]);

    return (
        <div className="space-y-5">
            {/* Info banner */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                <div>
                    <p className="text-sm font-semibold text-blue-800">Biometric Verification Required</p>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        Please verify your identity using your fingerprint or Face ID.
                        This is required to complete your loan application.
                        If your device does not support this, please ask a staff member for assistance.
                    </p>
                </div>
            </div>

            {verified ? (
                <div className="flex flex-col items-center py-6 gap-3">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-base font-semibold text-green-700">Identity Verified!</p>
                    <p className="text-xs text-gray-400 text-center">
                        You can now submit your loan application.
                    </p>
                </div>
            ) : supported === false ? (
                <div className="flex flex-col items-center py-6 gap-3">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-600" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p className="text-sm font-semibold text-amber-700 text-center">
                        Biometric Not Supported
                    </p>
                    <p className="text-xs text-gray-500 text-center leading-relaxed px-4">
                        This device does not support fingerprint login.
                        Please ask a staff member to provide a supported device to complete this step.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center py-4 gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400" fill="none"
                            stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                        </svg>
                    </div>

                    <button
                        type="button"
                        onClick={handleScan}
                        disabled={loading || supported === null}
                        className="w-full py-4 bg-blue-600 text-white text-sm font-semibold
                            rounded-2xl hover:bg-blue-700 active:scale-95
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all flex items-center justify-center gap-2
                            shadow-lg shadow-blue-200"
                    >
                        {loading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                Waiting for biometric...
                            </>
                        ) : supported === null ? (
                            'Checking device...'
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                </svg>
                                Scan Fingerprint / Face ID
                            </>
                        )}
                    </button>

                    <p className="text-xs text-gray-400 text-center">
                        Your biometric never leaves this device.
                    </p>
                </div>
            )}
        </div>
    );
};

export default LAFBiometricStep;