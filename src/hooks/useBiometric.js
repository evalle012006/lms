import { useState, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

/**
 * useBiometric — WebAuthn registration and authentication hook
 *
 * Registration flow:
 *   1. Call registerBiometric(userId, deviceName)
 *   2. Fetches challenge from server
 *   3. Browser calls navigator.credentials.create() → device captures fingerprint/face
 *   4. Sends credential to server for verification and storage
 *
 * Authentication flow:
 *   1. Call authenticateWithBiometric(userId)
 *   2. Fetches challenge from server
 *   3. Browser calls navigator.credentials.get() → device verifies fingerprint/face
 *   4. Sends response to server → server returns JWT
 */

// Converts base64url string to Uint8Array (required by WebAuthn browser API)
function base64urlToUint8Array(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// Converts ArrayBuffer to base64url string for sending to server
function arrayBufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Checks if WebAuthn is supported on this device/browser
export function isBiometricSupported() {
    return typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential === 'function';
}

export function useBiometric() {
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);

    // ── Registration ────────────────────────────────────────────────────────
    const registerBiometric = useCallback(async (userId, deviceName = 'My Device') => {
        setLoading(true);
        setError(null);

        try {
            if (!isBiometricSupported()) {
                throw new Error('Biometric authentication is not supported on this device.');
            }

            // Step 1 — Get registration challenge + signed JWT token from server
            const challengeRes = await fetchWrapper.get(
                getApiBaseUrl() + 'users/biometric-register-challenge?' +
                new URLSearchParams({ userId })
            );
            if (!challengeRes.success) throw new Error(challengeRes.message);

            const options        = challengeRes.options;
            const challengeToken = challengeRes.challengeToken; // JWT holding the challenge

            // Step 2 — Decode challenge and user ID for browser API
            const publicKeyOptions = {
                ...options,
                challenge: base64urlToUint8Array(options.challenge),
                user: {
                    ...options.user,
                    id: base64urlToUint8Array(options.user.id),
                },
                excludeCredentials: (options.excludeCredentials || []).map(c => ({
                    ...c,
                    id:         base64urlToUint8Array(c.id),
                    transports: ['internal'],
                })),
                // Force platform authenticator — Touch ID, Windows Hello, Android fingerprint
                // Prevents iCloud Keychain / passkey picker from appearing
                authenticatorSelection: {
                    ...options.authenticatorSelection,
                    authenticatorAttachment: 'platform',
                    userVerification:        'required',
                    residentKey:             'preferred',
                },
            };

            // Step 3 — Browser triggers Touch ID / Windows Hello
            const credential = await navigator.credentials.create({
                publicKey: publicKeyOptions,
            });

            if (!credential) throw new Error('Biometric capture was cancelled.');

            // Step 4 — Encode response for server
            const credentialForServer = {
                id:   credential.id,
                rawId: arrayBufferToBase64url(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                    attestationObject: arrayBufferToBase64url(credential.response.attestationObject),
                },
            };

            // Step 5 — Verify and store on server (send challengeToken back)
            const verifyRes = await fetchWrapper.post(
                getApiBaseUrl() + 'users/biometric-register-verify',
                { userId, credential: credentialForServer, deviceName, challengeToken }
            );

            if (!verifyRes.success) throw new Error(verifyRes.message);

            setLoading(false);
            return { success: true };
        } catch (err) {
            // User cancelled = NotAllowedError — not a real error
            if (err.name === 'NotAllowedError') {
                setLoading(false);
                return { success: false, cancelled: true };
            }
            setError(err.message);
            setLoading(false);
            return { success: false, error: err.message };
        }
    }, []);

    // ── Authentication ──────────────────────────────────────────────────────
    const authenticateWithBiometric = useCallback(async (userId) => {
        setLoading(true);
        setError(null);

        try {
            if (!isBiometricSupported()) {
                throw new Error('Biometric authentication is not supported on this device.');
            }

            // Verify platform authenticator (Touch ID / Windows Hello) is available
            // before attempting — avoids the confusing iCloud Passkey picker on Mac
            const platformAvailable = await window.PublicKeyCredential
                .isUserVerifyingPlatformAuthenticatorAvailable()
                .catch(() => false);

            if (!platformAvailable) {
                throw new Error('No fingerprint reader detected on this device. Please use your password to sign in.');
            }

            // Step 1 — Get authentication challenge + signed JWT token
            const challengeRes = await fetchWrapper.get(
                getApiBaseUrl() + 'users/biometric-auth?' +
                new URLSearchParams({ userId })
            );
            if (!challengeRes.success) throw new Error(challengeRes.message);

            const options        = challengeRes.options;
            const challengeToken = challengeRes.challengeToken;

            // Step 2 — Decode for browser API
            const publicKeyOptions = {
                ...options,
                challenge: base64urlToUint8Array(options.challenge),
                allowCredentials: (options.allowCredentials || []).map(c => ({
                    ...c,
                    id:   base64urlToUint8Array(c.id),
                    // Force platform authenticator (Touch ID / Windows Hello)
                    // instead of security keys or iCloud Keychain passkeys
                    transports: ['internal'],
                })),
                // 'required' forces platform auth — no passkey/iCloud picker
                userVerification: 'required',
            };

            // Step 3 — Browser triggers Touch ID / Windows Hello directly
            const credential = await navigator.credentials.get({
                publicKey: publicKeyOptions,
                // 'optional' allows silent if already authenticated, prompts if not
                mediation: 'optional',
            });

            if (!credential) throw new Error('Biometric authentication was cancelled.');

            // Step 4 — Encode response
            const credentialForServer = {
                id:   credential.id,
                rawId: arrayBufferToBase64url(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON:    arrayBufferToBase64url(credential.response.clientDataJSON),
                    authenticatorData: arrayBufferToBase64url(credential.response.authenticatorData),
                    signature:         arrayBufferToBase64url(credential.response.signature),
                    userHandle:        credential.response.userHandle
                        ? arrayBufferToBase64url(credential.response.userHandle)
                        : null,
                },
            };

            // Step 5 — Verify on server → get session JWT (send challengeToken back)
            const verifyRes = await fetchWrapper.post(
                getApiBaseUrl() + 'users/biometric-auth',
                { userId, credential: credentialForServer, challengeToken }
            );

            if (!verifyRes.success) throw new Error(verifyRes.message);

            setLoading(false);
            return { success: true, user: verifyRes.user };
        } catch (err) {
            setLoading(false);
            registeringRef.current = false;
            if (err.name === 'NotAllowedError') {
                return { success: false, cancelled: true };
            }
            setError(err.message);
            return { success: false, error: err.message };
        }
    }, []);

    return {
        loading,
        error,
        registerBiometric,
        authenticateWithBiometric,
        isBiometricSupported,
    };
}