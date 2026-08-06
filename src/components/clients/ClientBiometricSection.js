// src/components/clients/ClientBiometricSection.js
// Add this section inside AddUpdateClientPage for existing active clients
// without biometric, and for biometric update requests.

import React, { useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

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
 * ClientBiometricSection
 *
 * Shown inside AddUpdateClientPage when:
 * - mode === 'edit' (existing client)
 * - client status === 'active' OR client is pending (has no biometric yet)
 *
 * Props:
 *   client        — full client object from DB
 *   onUpdated     — callback after successful biometric save (reloads client)
 */
const ClientBiometricSection = ({ client, onUpdated }) => {
    const currentUser = useSelector(s => s.user.data);
    const [scanning,  setScanning]  = useState(false);
    const [requesting, setRequesting] = useState(false);
    const scanRef = useRef(false);

    const hasBiometric = !!client?.biometricCredentialId;

    // ── Register biometric (for clients with no biometric) ───────────────
    const handleRegister = useCallback(async () => {
        if (scanRef.current) return;
        if (!window.PublicKeyCredential) {
            toast.error('Biometric not supported on this device.');
            return;
        }
        scanRef.current = true;
        setScanning(true);
        try {
            // Get challenge from server
            const challengeRes = await fetchWrapper.get(
                getApiBaseUrl() + `clients/biometric/challenge?clientId=${client._id}`
            );
            if (!challengeRes.success) throw new Error(challengeRes.message);

            const { options, challengeToken } = challengeRes;

            // Trigger fingerprint/Face ID
            const credential = await navigator.credentials.create({
                publicKey: {
                    ...options,
                    challenge: base64urlToUint8Array(options.challenge),
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

            if (!credential) throw new Error('Biometric scan cancelled.');

            const credentialForServer = {
                id:    credential.id,
                rawId: arrayBufferToBase64url(credential.rawId),
                type:  credential.type,
                response: {
                    clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                    attestationObject: arrayBufferToBase64url(credential.response.attestationObject),
                },
            };

            // Save biometric to client record
            const saveRes = await fetchWrapper.post(
                getApiBaseUrl() + 'clients/biometric/register',
                {
                    clientId:       client._id,
                    credential:     credentialForServer,
                    challengeToken,
                    deviceName:     navigator.userAgent.includes('iPhone') ? 'iPhone'
                        : navigator.userAgent.includes('Android') ? 'Android'
                        : 'Device',
                }
            );

            if (!saveRes.success) throw new Error(saveRes.message);
            toast.success('Biometric registered successfully.');
            onUpdated?.();
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                toast.error('Biometric scan was cancelled.');
            } else {
                toast.error(err.message || 'Biometric registration failed.');
            }
        } finally {
            setScanning(false);
            scanRef.current = false;
        }
    }, [client, onUpdated]);

    // ── Request biometric update (for clients with existing biometric) ────
    // This submits a request that requires rep <= 2 approval
    const handleRequestUpdate = useCallback(async () => {
        setRequesting(true);
        try {
            const res = await fetchWrapper.post(
                getApiBaseUrl() + 'clients/biometric/request-update',
                { clientId: client._id }
            );
            if (!res.success) throw new Error(res.message);
            toast.success('Biometric update request submitted. Awaiting approval from Area+ or Admin.');
            onUpdated?.();
        } catch (err) {
            toast.error(err.message || 'Failed to submit request.');
        } finally {
            setRequesting(false);
        }
    }, [client, onUpdated]);

    return (
        <div className="space-y-4">
            {/* Current biometric status */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                hasBiometric
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
            }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    hasBiometric ? 'bg-green-100' : 'bg-amber-100'
                }`}>
                    <svg className={`w-4 h-4 ${hasBiometric ? 'text-green-600' : 'text-amber-600'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className={`text-sm font-semibold ${hasBiometric ? 'text-green-800' : 'text-amber-800'}`}>
                        {hasBiometric ? 'Biometric Registered' : 'No Biometric Registered'}
                    </p>
                    {hasBiometric ? (
                        <p className="text-xs text-green-600 mt-0.5">
                            Device: {client.biometricDeviceName || 'Unknown'} ·
                            Registered: {client.biometricRegisteredAt
                                ? new Date(client.biometricRegisteredAt).toLocaleDateString('en-PH')
                                : '—'}
                        </p>
                    ) : (
                        <p className="text-xs text-amber-600 mt-0.5">
                            This client needs to register their fingerprint or Face ID.
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            {!hasBiometric ? (
                /* Register new biometric */
                <button
                    type="button"
                    onClick={handleRegister}
                    disabled={scanning}
                    className="w-full flex items-center justify-center gap-2 py-3
                        bg-blue-600 text-white text-sm font-semibold rounded-xl
                        hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors"
                >
                    {scanning ? (
                        <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Waiting for scan...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                            </svg>
                            Register Fingerprint / Face ID
                        </>
                    )}
                </button>
            ) : (
                /* Request update — needs approval */
                <div className="space-y-2">
                    {client.biometricUpdateRequestedAt && !client.biometricUpdateApprovedAt ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-sm font-semibold text-blue-800">
                                Update Request Pending
                            </p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                A biometric update was requested on{' '}
                                {new Date(client.biometricUpdateRequestedAt).toLocaleDateString('en-PH')}.
                                Awaiting approval from Area Admin or above.
                            </p>
                        </div>
                    ) : client.biometricUpdateApprovedAt ? (
                        /* Approved — allow re-registration */
                        <button
                            type="button"
                            onClick={handleRegister}
                            disabled={scanning}
                            className="w-full flex items-center justify-center gap-2 py-3
                                bg-teal-600 text-white text-sm font-semibold rounded-xl
                                hover:bg-teal-700 disabled:opacity-50 transition-colors"
                        >
                            {scanning ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10"
                                            stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    Waiting for scan...
                                </>
                            ) : 'Scan New Fingerprint / Face ID'}
                        </button>
                    ) : (
                        /* No pending request — allow requesting update */
                        <button
                            type="button"
                            onClick={handleRequestUpdate}
                            disabled={requesting}
                            className="w-full flex items-center justify-center gap-2 py-3
                                border-2 border-amber-400 text-amber-700 text-sm font-semibold
                                rounded-xl hover:bg-amber-50 disabled:opacity-50 transition-colors"
                        >
                            {requesting ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10"
                                            stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    Submitting...
                                </>
                            ) : 'Request Biometric Update (Requires Approval)'}
                        </button>
                    )}
                    <p className="text-xs text-gray-400 text-center">
                        Biometric updates require approval from Area Admin or Administrator.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ClientBiometricSection;