import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import logo from '/public/images/logo.png';

// ── WebAuthn helpers ──────────────────────────────────────────────────────
function base64urlToUint8Array(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
}

function arrayBufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    bytes.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * /biometric-verify/[loanId]
 *
 * Public page — accessed via QR code on the client's phone.
 * Client scans fingerprint/Face ID to confirm they are physically present
 * at loan disbursement.
 *
 * Flow:
 * 1. Page loads → fetches loan + client biometric credential
 * 2. If client has no biometric → show error (must have registered during LAF)
 * 3. Client taps button → WebAuthn authentication prompt
 * 4. On success → POST to /api/public/laf/client-biometric-verify
 * 5. Server marks loan as clientBiometricVerified: true
 * 6. DisbursementPhotoModal polls for this status
 */
const ClientBiometricVerifyPage = () => {
    const router  = useRouter();
    const { loanId } = router.query;

    const [status, setStatus]   = useState('loading'); // loading | ready | verifying | success | error | no-biometric
    const [message, setMessage] = useState('');
    const [loanInfo, setLoanInfo] = useState(null);
    const verifyingRef = useRef(false);

    // Load loan + check client biometric
    useEffect(() => {
        if (!loanId) return;

        fetch(`/api/public/laf/client-biometric-challenge?loanId=${loanId}`)
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    if (data.noBiometric) {
                        setStatus('no-biometric');
                        setMessage(data.message || 'No biometric registered for this client.');
                    } else if (data.alreadyVerified) {
                        setStatus('success');
                        setMessage('Identity already verified.');
                    } else {
                        setStatus('error');
                        setMessage(data.message || 'Failed to load verification.');
                    }
                    return;
                }
                setLoanInfo(data.loanInfo);
                setStatus('ready');
            })
            .catch(() => {
                setStatus('error');
                setMessage('Failed to connect. Please check your internet connection.');
            });
    }, [loanId]);

    const handleVerify = async () => {
        if (verifyingRef.current || !loanId) return;
        verifyingRef.current = true;
        setStatus('verifying');

        try {
            // Step 1 — Get challenge
            const challengeRes = await fetch(
                `/api/public/laf/client-biometric-challenge?loanId=${loanId}`
            ).then(r => r.json());

            if (!challengeRes.success) {
                setStatus('error');
                setMessage(challengeRes.message || 'Failed to get challenge.');
                return;
            }

            const { options, challengeToken } = challengeRes;

            // Step 2 — Browser triggers fingerprint/Face ID
            const credential = await navigator.credentials.get({
                publicKey: {
                    ...options,
                    challenge:          base64urlToUint8Array(options.challenge),
                    allowCredentials:   (options.allowCredentials || []).map(c => ({
                        ...c,
                        id: base64urlToUint8Array(c.id),
                    })),
                },
            });

            if (!credential) throw new Error('Biometric was cancelled.');

            // Step 3 — Encode response
            const credentialForServer = {
                id:    credential.id,
                rawId: arrayBufferToBase64url(credential.rawId),
                type:  credential.type,
                response: {
                    clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                    authenticatorData: arrayBufferToBase64url(credential.response.authenticatorData),
                    signature:         arrayBufferToBase64url(credential.response.signature),
                    userHandle:        credential.response.userHandle
                        ? arrayBufferToBase64url(credential.response.userHandle) : null,
                },
            };

            // Step 4 — Verify on server
            const verifyRes = await fetch('/api/public/laf/client-biometric-verify', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ loanId, credential: credentialForServer, challengeToken }),
            }).then(r => r.json());

            if (verifyRes.success) {
                setStatus('success');
                setMessage('Identity verified! You may return the phone to the branch officer.');
            } else {
                setStatus('error');
                setMessage(verifyRes.message || 'Verification failed. Please try again.');
            }
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setStatus('ready');
                setMessage('Biometric was cancelled. Please try again.');
            } else {
                setStatus('error');
                setMessage(err.message || 'Verification failed.');
            }
        } finally {
            verifyingRef.current = false;
        }
    };

    return (
        <>
            <Head>
                <title>Identity Verification — AmberCash</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </Head>
            <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50
                flex flex-col items-center justify-center px-4 py-8">

                <div className="w-full max-w-sm">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <Image src={logo} alt="AmberCash" width={56} height={56}
                            className="rounded-2xl shadow-md" />
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">

                        {/* Loading */}
                        {status === 'loading' && (
                            <div className="flex flex-col items-center py-8 gap-3">
                                <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                <p className="text-sm text-gray-400">Loading verification...</p>
                            </div>
                        )}

                        {/* Ready to verify */}
                        {status === 'ready' && (
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center
                                        justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-teal-600" fill="none"
                                            stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Identity Verification
                                    </h2>
                                    {loanInfo && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            {loanInfo.clientName} · {loanInfo.pnNumber}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                        Please verify your identity to confirm you are
                                        receiving the loan disbursement.
                                    </p>
                                </div>

                                {message && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200
                                        rounded-xl text-xs text-amber-700 text-center">
                                        {message}
                                    </div>
                                )}

                                <button type="button" onClick={handleVerify}
                                    className="w-full py-4 bg-teal-600 text-white text-sm font-semibold
                                        rounded-2xl hover:bg-teal-700 active:scale-95
                                        transition-all flex items-center justify-center gap-2
                                        shadow-lg shadow-teal-200">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                    </svg>
                                    Scan Fingerprint / Face ID
                                </button>
                            </>
                        )}

                        {/* Verifying */}
                        {status === 'verifying' && (
                            <div className="flex flex-col items-center py-8 gap-3">
                                <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                <p className="text-sm text-gray-500">Verifying your identity...</p>
                            </div>
                        )}

                        {/* Success */}
                        {status === 'success' && (
                            <div className="flex flex-col items-center py-6 gap-3 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-green-600" fill="none"
                                        stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-green-800">Verified!</h2>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {message || 'Your identity has been confirmed. You may return the phone to the branch officer.'}
                                </p>
                            </div>
                        )}

                        {/* No biometric */}
                        {status === 'no-biometric' && (
                            <div className="flex flex-col items-center py-6 gap-3 text-center">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-amber-600" fill="none"
                                        stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                    </svg>
                                </div>
                                <h2 className="text-base font-bold text-amber-800">Biometric Not Found</h2>
                                <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
                                <p className="text-xs text-gray-400">
                                    Please inform the branch officer.
                                </p>
                            </div>
                        )}

                        {/* Error */}
                        {status === 'error' && (
                            <div className="flex flex-col items-center py-6 gap-3 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-red-600" fill="none"
                                        stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                            strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                </div>
                                <h2 className="text-base font-bold text-red-800">Verification Failed</h2>
                                <p className="text-sm text-gray-500">{message}</p>
                                <button type="button" onClick={() => { setStatus('ready'); setMessage(''); }}
                                    className="mt-2 px-6 py-2.5 bg-teal-600 text-white text-sm
                                        font-medium rounded-xl hover:bg-teal-700 transition-colors">
                                    Try Again
                                </button>
                            </div>
                        )}

                    </div>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        AmberCash PH Micro Lending Corp.
                    </p>
                </div>
            </div>
        </>
    );
};

// No Layout — this is a standalone public page
ClientBiometricVerifyPage.getLayout = (page) => page;

export default ClientBiometricVerifyPage;