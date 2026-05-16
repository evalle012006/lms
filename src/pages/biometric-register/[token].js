// src/pages/biometric-register/[token].js
// Public page — no login required.
// Client opens this on their own device after scanning the QR code
// shown by BM during LDF disbursement.
// Registers fingerprint / Face ID and saves to clients table.

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Shield, CheckCircle, XCircle, Fingerprint } from 'lucide-react';

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

// ── States ────────────────────────────────────────────────────────────────
const SCREEN = {
    LOADING:   'loading',
    READY:     'ready',
    SCANNING:  'scanning',
    SUCCESS:   'success',
    ERROR:     'error',
    USED:      'used',
    EXPIRED:   'expired',
    NO_SUPPORT:'no_support',
};

export default function BiometricRegisterPage({ token, valid, error: serverError, clientName }) {
    const [screen,  setScreen]  = useState(valid ? SCREEN.READY : SCREEN.ERROR);
    const [message, setMessage] = useState(serverError || '');
    const scanRef = useRef(false);

    useEffect(() => {
        if (!window.PublicKeyCredential) {
            setScreen(SCREEN.NO_SUPPORT);
        }
    }, []);

    const handleRegister = async () => {
        if (scanRef.current) return;
        scanRef.current = true;
        setScreen(SCREEN.SCANNING);

        try {
            // Get WebAuthn challenge from server
            const challengeRes = await fetch(`/api/public/biometric/register-challenge?token=${encodeURIComponent(token)}`);
            const challengeData = await challengeRes.json();

            if (!challengeData.success) {
                setMessage(challengeData.message || 'Failed to get challenge.');
                setScreen(challengeData.message?.includes('already used') ? SCREEN.USED :
                          challengeData.message?.includes('expired') ? SCREEN.EXPIRED : SCREEN.ERROR);
                return;
            }

            const { options } = challengeData;

            // Trigger platform biometric
            const credential = await navigator.credentials.create({
                publicKey: {
                    ...options,
                    challenge:  base64urlToUint8Array(options.challenge),
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

            if (!credential) {
                setMessage('Scan was cancelled. Please try again.');
                setScreen(SCREEN.READY);
                scanRef.current = false;
                return;
            }

            // Send credential to server
            const saveRes = await fetch('/api/public/biometric/register-complete', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    credential: {
                        id:    credential.id,
                        rawId: arrayBufferToBase64url(credential.rawId),
                        type:  credential.type,
                        response: {
                            clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                            attestationObject: arrayBufferToBase64url(credential.response.attestationObject),
                        },
                    },
                    deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone'
                        : navigator.userAgent.includes('iPad') ? 'iPad'
                        : navigator.userAgent.includes('Android') ? 'Android'
                        : 'Mobile Device',
                }),
            });

            const saveData = await saveRes.json();

            if (saveData.success) {
                setScreen(SCREEN.SUCCESS);
            } else {
                setMessage(saveData.message || 'Registration failed.');
                setScreen(SCREEN.ERROR);
            }
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setMessage('Scan was cancelled or denied. Please try again.');
                setScreen(SCREEN.READY);
            } else {
                setMessage(err.message || 'An error occurred.');
                setScreen(SCREEN.ERROR);
            }
        } finally {
            scanRef.current = false;
        }
    };

    return (
        <>
            <Head>
                <title>Biometric Registration — AmberCash</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
            </Head>
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100
                    max-w-sm w-full p-8 text-center">

                    {/* AmberCash header */}
                    <p className="text-xs text-gray-400 mb-6 font-medium tracking-wide uppercase">
                        AmberCash PH · Biometric Registration
                    </p>

                    {screen === SCREEN.LOADING && (
                        <div className="flex justify-center py-8">
                            <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                        </div>
                    )}

                    {screen === SCREEN.READY && (
                        <>
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center
                                justify-center mx-auto mb-5">
                                <Fingerprint className="w-10 h-10 text-blue-600" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-1">
                                Register Your Biometric
                            </h1>
                            {clientName && (
                                <p className="text-sm text-gray-600 mb-1">
                                    Hi, <strong>{clientName}</strong>
                                </p>
                            )}
                            <p className="text-sm text-gray-500 mb-6">
                                Your Branch Manager needs to verify your identity.
                                Tap the button below to register your fingerprint or Face ID.
                            </p>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl
                                text-xs text-amber-700 mb-6 text-left">
                                <p className="font-semibold mb-1">Before you scan:</p>
                                <ul className="space-y-1 list-disc list-inside">
                                    <li>Use your fingerprint or Face ID</li>
                                    <li>This is a one-time registration</li>
                                    <li>Your biometric stays on your device</li>
                                </ul>
                            </div>
                            <button type="button" onClick={handleRegister}
                                className="w-full py-4 bg-blue-600 text-white text-base font-bold
                                    rounded-2xl hover:bg-blue-700 active:bg-blue-800 transition-colors
                                    flex items-center justify-center gap-3">
                                <Fingerprint className="w-6 h-6" />
                                Scan Fingerprint / Face ID
                            </button>
                        </>
                    )}

                    {screen === SCREEN.SCANNING && (
                        <>
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center
                                justify-center mx-auto mb-5 animate-pulse">
                                <Fingerprint className="w-10 h-10 text-blue-600" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">Scanning...</h1>
                            <p className="text-sm text-gray-500">
                                Follow the prompt on your device to complete the scan.
                            </p>
                        </>
                    )}

                    {screen === SCREEN.SUCCESS && (
                        <>
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center
                                justify-center mx-auto mb-5">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">
                                Biometric Registered!
                            </h1>
                            <p className="text-sm text-gray-500 mb-4">
                                Your fingerprint has been registered successfully.
                                You can close this page now.
                            </p>
                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl
                                text-xs text-green-700">
                                Please return your phone to the Branch Manager to continue
                                the loan disbursement process.
                            </div>
                        </>
                    )}

                    {(screen === SCREEN.ERROR || screen === SCREEN.USED || screen === SCREEN.EXPIRED) && (
                        <>
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center
                                justify-center mx-auto mb-5">
                                <XCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">
                                {screen === SCREEN.USED    ? 'Already Used'   :
                                 screen === SCREEN.EXPIRED ? 'Link Expired'   : 'Error'}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {message ||
                                 (screen === SCREEN.USED    ? 'This registration link has already been used.' :
                                  screen === SCREEN.EXPIRED ? 'This link has expired. Please ask your Branch Manager for a new QR code.' :
                                  'Something went wrong. Please try again or contact your Branch Manager.')}
                            </p>
                        </>
                    )}

                    {screen === SCREEN.NO_SUPPORT && (
                        <>
                            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center
                                justify-center mx-auto mb-5">
                                <Shield className="w-10 h-10 text-amber-600" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 mb-2">
                                Device Not Supported
                            </h1>
                            <p className="text-sm text-gray-500">
                                Your device does not support biometric authentication.
                                Please contact your Branch Manager for assistance.
                            </p>
                        </>
                    )}

                    <p className="mt-6 text-xs text-gray-300">
                        AmberCash PH Micro Lending Corp.
                    </p>
                </div>
            </div>
        </>
    );
}

// ── SSR: validate token before page loads ─────────────────────────────────
export async function getServerSideProps({ params }) {
    const { token } = params;
    if (!token) {
        return { props: { token: null, valid: false, error: 'No token provided.', clientName: null } };
    }

    try {
        const getConfig  = (await import('next/config')).default;
        const jwt        = await import('jsonwebtoken');
        const { serverRuntimeConfig } = getConfig();

        const decoded = jwt.default.verify(token, serverRuntimeConfig.secret);

        if (decoded.type !== 'biometric_registration') {
            return { props: { token, valid: false, error: 'Invalid token type.', clientName: null } };
        }

        // Check token in DB (single-use enforcement)
        const { GraphProvider }             = await import('@/lib/graph/graph.provider');
        const { createGraphType, queryQl }  = await import('@/lib/graph/graph.util');

        const graph = new GraphProvider();
        const TOKEN_TYPE = createGraphType('biometricRegistrationTokens', `
            _id usedAt expiresAt clientId
        `)('biometricRegistrationTokens');

        const CLIENT_TYPE = createGraphType('client', `
            _id firstName lastName
        `)('clients');

        const [tokenRecord] = await graph.query(
            queryQl(TOKEN_TYPE, { where: { _id: { _eq: decoded.tokenId } } })
        ).then(r => r.data?.biometricRegistrationTokens ?? []);

        if (!tokenRecord) {
            return { props: { token, valid: false, error: 'Token not found.', clientName: null } };
        }
        if (tokenRecord.usedAt) {
            return { props: { token, valid: false, error: 'This link has already been used.', clientName: null } };
        }

        // Fetch client name for greeting
        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: tokenRecord.clientId } } })
        ).then(r => r.data?.clients ?? []);

        return {
            props: {
                token,
                valid:      true,
                error:      null,
                clientName: client ? `${client.firstName} ${client.lastName}` : null,
            },
        };
    } catch (err) {
        const isExpired = err.name === 'TokenExpiredError';
        return {
            props: {
                token,
                valid:      false,
                error:      isExpired ? 'This link has expired. Please ask your Branch Manager for a new QR code.' : 'Invalid registration link.',
                clientName: null,
            },
        };
    }
}