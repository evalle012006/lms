// src/components/transactions/loan-application/FaceVerifyStep.js
// Face verification at LDF disbursement — same UX improvements as FaceLivenessStep.
// FIX: mirrored display + flipped pose thresholds + improved UX overlays.
// Supports: first-time enrollment (no template), verification, and supervisor-approved
// re-enrollment ("recapture") of the reference face after repeated mismatches.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import {
    captureBestFrame,
    isTooDark,
    canvasToDebugThumbnail,
} from '@/lib/face-capture-utils';
import { openCameraStream } from '@/lib/camera-stream';
import {
    FACE_MATCH_THRESHOLD,
    MIN_MISMATCHES_FOR_RECAPTURE,
    MIN_RECAPTURE_REASON_LENGTH,
    RECAPTURE_REASON_PRESETS,
    getRecaptureState,
} from '@/lib/face-recapture-utils';

const MODEL_URL         = '/models';
const SCORE_THRESHOLD   = 0.5;
const MATCH_THRESHOLD   = FACE_MATCH_THRESHOLD;
const POSE_SAMPLES      = 6;
const LANDMARK_INTERVAL = 150;

// Thresholds flipped to match mirrored video display
const TURN_LEFT_THRESHOLD  =  0.18;
const TURN_RIGHT_THRESHOLD = -0.18;
const CENTER_THRESHOLD     =  0.08;

const CHALLENGES = [
    { id: 'left',   label: 'LOOK LEFT',      icon: '←', desc: 'Turn your head to the LEFT',    arrow: 'left'   },
    { id: 'right',  label: 'LOOK RIGHT',     icon: '→', desc: 'Turn your head to the RIGHT',   arrow: 'right'  },
    { id: 'center', label: 'LOOK AT CAMERA', icon: '👁', desc: 'Face the camera directly',      arrow: 'center' },
];

function getNoseOffset(landmarks) {
    const pts      = landmarks.positions;
    const leftEye  = pts[36];
    const rightEye = pts[45];
    const noseTip  = pts[30];
    const eyeMidX  = (leftEye.x + rightEye.x) / 2;
    const eyeSpanX = Math.abs(rightEye.x - leftEye.x);
    if (eyeSpanX < 1) return 0;
    return (noseTip.x - eyeMidX) / eyeSpanX;
}

function euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 1;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
}

const DirectionArrow = ({ direction, active }) => {
    if (!active) return null;
    const base = 'absolute flex items-center justify-center transition-all duration-300';
    if (direction === 'left') return (
        <div className={`${base} left-4 top-1/2 -translate-y-1/2`}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="rgba(59,130,246,0.85)" />
                <path d="M28 14L18 24L28 34" stroke="white" strokeWidth="4"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
    );
    if (direction === 'right') return (
        <div className={`${base} right-4 top-1/2 -translate-y-1/2`}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="rgba(59,130,246,0.85)" />
                <path d="M20 14L30 24L20 34" stroke="white" strokeWidth="4"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
    );
    if (direction === 'center') return (
        <div className={`${base} inset-0 flex items-end justify-center pb-4`}>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                bg-green-500 bg-opacity-90 animate-pulse">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M2 12C2 12 5 6 12 6s10 6 10 6-3 6-10 6S2 12 2 12z"/>
                </svg>
                <span className="text-white text-xs font-semibold">Look here</span>
            </div>
        </div>
    );
    return null;
};

const VerifyResult = ({
    matched, score, onRetry, onConfirm, canSkip, onSkip,
    recaptureState, mismatchCount, onStartRecapture,
}) => (
    <div className="space-y-4">
        <div className={`p-5 rounded-2xl border-2 text-center ${
            matched ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
        }`}>
            <p className="text-4xl mb-2">{matched ? '✅' : '❌'}</p>
            <p className={`text-base font-bold ${matched ? 'text-green-800' : 'text-red-800'}`}>
                {matched ? 'Identity Confirmed' : 'Face Does Not Match'}
            </p>
            <p className={`text-xs mt-1 ${matched ? 'text-green-600' : 'text-red-600'}`}>
                {matched
                    ? 'This person matches the enrolled client record.'
                    : 'The person in front of the camera does not match the client record.'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
                Match confidence: {(score * 100).toFixed(0)}%
            </p>
        </div>
        {matched ? (
            <button type="button" onClick={onConfirm}
                className="w-full py-3 bg-green-600 text-white text-sm font-semibold
                    rounded-xl hover:bg-green-700 transition-colors">
                Confirm & Proceed
            </button>
        ) : (
            <div className="space-y-2">
                <button type="button" onClick={onRetry}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold
                        rounded-xl hover:bg-blue-700 transition-colors">
                    Try Again
                </button>

                {recaptureState === 'available' && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-amber-800">
                            Still not matching after {mismatchCount} attempts
                        </p>
                        <p className="text-xs text-amber-700 leading-snug">
                            If this is the right person but the saved face is poor or outdated, you can
                            re-enroll it. The old record and all attempts are kept in the client's history.
                        </p>
                        <button type="button" onClick={onStartRecapture}
                            className="w-full py-2 bg-amber-600 text-white text-sm font-semibold
                                rounded-xl hover:bg-amber-700 transition-colors">
                            Re-enroll Reference Face…
                        </button>
                    </div>
                )}
                {recaptureState === 'locked' && (
                    <p className="text-[11px] text-center text-gray-400">
                        Re-enrollment unlocks after {MIN_MISMATCHES_FOR_RECAPTURE} failed attempts
                        ({Math.min(mismatchCount, MIN_MISMATCHES_FOR_RECAPTURE)}/{MIN_MISMATCHES_FOR_RECAPTURE}).
                    </p>
                )}
                {recaptureState === 'no_permission' && (
                    <p className="text-[11px] text-center text-amber-600">
                        Re-enrollment needs a branch manager, area admin, regional manager,
                        deputy director or admin signed in.
                    </p>
                )}

                {canSkip && (
                    <button type="button" onClick={onSkip}
                        className="w-full py-2.5 border border-gray-300 text-gray-600
                            text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                        Override — Proceed Anyway (Admin only)
                    </button>
                )}
                <p className="text-xs text-center text-gray-400">
                    Do not proceed without supervisor approval if verification fails.
                </p>
            </div>
        )}
    </div>
);

// onRetry — optional callback to parent when user clicks Try Again
// Parent (DisbursementPhotoModal) uses this to bump a key and remount this component,
// clearing all state cleanly. Without this, internal state can get stuck after a mismatch.
//
// Re-enrollment props (omit onRecapture to disable the feature entirely):
//   onMismatch     — called each time a verification attempt does not match (parent counts them)
//   onRecapture    — async ({ faceTemplate, photoKey, livenessScore, reason }) => void
//   mismatchCount  — failed attempts so far this session (UX gate; the server re-checks)
//   canRecapture   — whether the signed-in user may approve a re-enrollment
const FaceVerifyStep = ({
    faceTemplate, onVerified, onEnroll, onSkip, onRetry, canSkip = false,
    clientId, loanId, branchId, ciReferenceCode,
    onMismatch, onRecapture, mismatchCount = 0, canRecapture = false,
}) => {
    const videoRef     = useRef(null);
    const streamRef    = useRef(null);
    const intervalRef  = useRef(null);
    const faceApiRef   = useRef(null);
    const poseCountRef = useRef(0);
    const mountedRef   = useRef(true);

    const [modelsLoaded,  setModelsLoaded]  = useState(false);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [cameraOpen,    setCameraOpen]    = useState(false);
    const [cameraError,   setCameraError]   = useState(null);
    const [challengeIdx,  setChallengeIdx]  = useState(0);
    const [completed,     setCompleted]     = useState([]);
    const [capturing,     setCapturing]     = useState(false);
    const [faceDetected,  setFaceDetected]  = useState(false);
    const [progress,      setProgress]      = useState(0);
    const [streamReady,   setStreamReady]   = useState(false);
    const [result,        setResult]        = useState(null);

    // Re-enrollment (recapture) flow
    const [recaptureStage,      setRecaptureStage]      = useState(null);   // null | 'reason'
    const [recaptureReason,     setRecaptureReason]     = useState('');
    const [recaptureActive,     setRecaptureActive]     = useState(false);  // render flag
    const recaptureActiveRef = useRef(false);                                // read inside extractAndMatch (no stale closure)
    const [submittingRecapture, setSubmittingRecapture] = useState(false);

    const currentChallenge = CHALLENGES[challengeIdx];
    const noTemplate = !faceTemplate || !Array.isArray(faceTemplate) || faceTemplate.length !== 128;
    const recaptureState = getRecaptureState({ enabled: !!onRecapture, mismatchCount, canRecapture });

    async function uploadDebugThumbnail(blob, clientId) {
        if (!blob) return null;
        try {
            const formData = new FormData();
            formData.append('file', blob, 'face-verify-debug.jpg');
            formData.append('origin', 'face-verify-debug');
            formData.append('uuid', `faceverify-${clientId || 'unknown'}-${Date.now()}`);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) return null;
            const data = await res.json();
            return data.fileKey || null;
        } catch {
            return null;
        }
    }

    async function logFaceVerifyAttempt({ clientId, loanId, branchId, ciReferenceCode, distance, confidence, matched, photoKey }) {
        try {
            await fetchWrapper.post(getApiBaseUrl() + 'face-verify-attempts/log', {
                client_id: clientId,
                loan_id: loanId ?? null,
                branch_id: branchId ?? null,
                ci_reference_code: ciReferenceCode ?? null,
                distance,
                confidence,
                matched,
                match_threshold: MATCH_THRESHOLD,
                photo_key: photoKey,
                user_agent: navigator.userAgent,
            });
        } catch {
            // best-effort — never let logging failure affect the verify flow
        }
    }

    const loadModels = useCallback(async () => {
        if (modelsLoaded || modelsLoading) return;
        setModelsLoading(true);
        try {
            const faceapi = await import('face-api.js');
            faceApiRef.current = faceapi;
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            setModelsLoaded(true);
        } catch (err) {
            console.error('[FaceVerify] model load failed:', err);
            toast.error('Failed to load face detection. Please try again.');
        } finally {
            setModelsLoading(false);
        }
    }, [modelsLoaded, modelsLoading]);

    const getStream = useCallback(async () => {
        setCameraError(null);
        try {
            // null when we unmounted mid-open — the helper already released the stream
            return await openCameraStream({
                streamRef,
                isActive: () => mountedRef.current,
                constraints: {
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                },
            });
        } catch (err) {
            const msg = err.name === 'NotAllowedError'
                ? 'Camera access denied. Please allow camera access.'
                : 'Could not start camera. Please try again.';
            setCameraError(msg);
            return null;
        }
    }, []);

    useEffect(() => {
        if (!cameraOpen || !streamRef.current) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = streamRef.current;
        video.onloadedmetadata = () => {
            video.play()
                .then(() => setStreamReady(true))
                .catch(err => {
                    console.error('[FaceVerify] play() failed:', err);
                    setCameraError('Could not start video. Please try again.');
                });
        };
    }, [cameraOpen]);

    useEffect(() => {
        if (streamReady && modelsLoaded && !result && !capturing) {
            startDetectionLoop(0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamReady, modelsLoaded]);

    const stopCamera = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraOpen(false);
        setStreamReady(false);
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; stopCamera(); };
    }, [stopCamera]);

    const extractAndMatch = useCallback(async () => {
        setCapturing(true);
        const faceapi = faceApiRef.current;
        const video   = videoRef.current;
        if (!faceapi || !video) { setCapturing(false); return; }
        try {
            // Sample several frames, keep the sharpest, and run detection +
            // thumbnail off that ONE frozen canvas — not the live video —
            // so the two can never drift apart the way they did before.
            const bestCanvas = await captureBestFrame(video);

            if (isTooDark(bestCanvas)) {
                toast.error('Lighting is too dark for an accurate scan. Please move somewhere brighter and try again.');
                setCapturing(false);
                startDetectionLoop(0);
                return;
            }

            const detection = await faceapi
                .detectSingleFace(bestCanvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: SCORE_THRESHOLD }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) {
                toast.error('Could not capture face. Please try again.');
                setCompleted([]);
                setCapturing(false);
                startDetectionLoop(0);
                return;
            }
            const thumbnailBlob = await canvasToDebugThumbnail(bestCanvas);
            stopCamera();
            const capturedDescriptor = Array.from(detection.descriptor);

            // ── Enrollment path — first enrollment (no template) OR supervisor re-enrollment ──
            // The upload is awaited so the photo key travels with the enrollment.
            const isRecapture = recaptureActiveRef.current;
            if (noTemplate || isRecapture) {
                const photoKey = await uploadDebugThumbnail(thumbnailBlob, clientId);
                logFaceVerifyAttempt({
                    clientId, loanId, branchId, ciReferenceCode, distance: null, confidence: null,
                    matched: null, photoKey,
                });
                if (!mountedRef.current) return;
                setResult({
                    enrolled: true,
                    recapture: isRecapture,
                    template: capturedDescriptor,
                    photoKey,
                    livenessScore: detection.detection?.score ?? null,
                });
                setCapturing(false);
                return;
            }

            // ── Existing verification path ──
            const distance   = euclideanDistance(capturedDescriptor, faceTemplate);
            const confidence = Math.max(0, Math.min(100, ((MATCH_THRESHOLD - distance) / MATCH_THRESHOLD) * 100));
            const matched    = distance < MATCH_THRESHOLD;
            setResult({ matched, score: confidence / 100, distance });
            setCapturing(false);
            if (!matched) onMismatch?.();

            uploadDebugThumbnail(thumbnailBlob, clientId).then((photoKey) => {
                logFaceVerifyAttempt({ clientId, loanId, branchId, ciReferenceCode, distance, confidence, matched, photoKey });
            });

            if (matched) {
                onVerified({ matched: true, score: confidence / 100, faceMatchScore: distance });
            }
        } catch (err) {
            console.error('[FaceVerify] match failed:', err);
            toast.error('Face verification failed. Please try again.');
            setCapturing(false);
        }
    }, [faceTemplate, stopCamera, onVerified, onMismatch, noTemplate, clientId, loanId, branchId, ciReferenceCode]);

    const startDetectionLoop = useCallback((challengeIndex) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        poseCountRef.current = 0;
        setProgress(0);
        setChallengeIdx(challengeIndex);

        intervalRef.current = setInterval(async () => {
            const faceapi = faceApiRef.current;
            const video   = videoRef.current;
            if (!faceapi || !video) return;
            if (video.readyState < 2) return;
            if (video.videoWidth === 0 || video.videoHeight === 0) return;
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: SCORE_THRESHOLD }))
                    .withFaceLandmarks();
                if (!detection) {
                    setFaceDetected(false);
                    poseCountRef.current = 0;
                    setProgress(0);
                    return;
                }
                setFaceDetected(true);
                const offset  = getNoseOffset(detection.landmarks);
                const chal    = CHALLENGES[challengeIndex];
                let poseMatch = false;
                if (chal.id === 'left'   && offset >  TURN_LEFT_THRESHOLD)       poseMatch = true;
                if (chal.id === 'right'  && offset <  TURN_RIGHT_THRESHOLD)       poseMatch = true;
                if (chal.id === 'center' && Math.abs(offset) < CENTER_THRESHOLD)  poseMatch = true;
                if (poseMatch) {
                    poseCountRef.current += 1;
                    setProgress(Math.min(100, Math.round((poseCountRef.current / POSE_SAMPLES) * 100)));
                    if (poseCountRef.current >= POSE_SAMPLES) {
                        clearInterval(intervalRef.current);
                        const nextIdx = challengeIndex + 1;
                        setCompleted(prev => [...prev, chal.id]);
                        poseCountRef.current = 0;
                        setProgress(0);
                        if (nextIdx < CHALLENGES.length) {
                            setTimeout(() => startDetectionLoop(nextIdx), 600);
                        } else {
                            extractAndMatch();
                        }
                    }
                } else {
                    poseCountRef.current = Math.max(0, poseCountRef.current - 1);
                    setProgress(Math.max(0, Math.round((poseCountRef.current / POSE_SAMPLES) * 100)));
                }
            } catch { /* ignore */ }
        }, LANDMARK_INTERVAL);
    }, [extractAndMatch]);

    const handleStart = useCallback(async () => {
        setResult(null);
        setCapturing(false);   // a previous scan leaves this true; a re-start on the same instance would hang on "Matching face…"
        setChallengeIdx(0);
        setCompleted([]);
        setFaceDetected(false);
        setStreamReady(false);
        poseCountRef.current = 0;
        setProgress(0);
        if (!modelsLoaded) await loadModels();
        const stream = await getStream();
        if (!stream) return;
        setCameraOpen(true);
    }, [modelsLoaded, loadModels, getStream]);

    const handleRetry = useCallback(() => {
        setResult(null);
        // The parent remounts us via key on retry. Starting the camera on this
        // about-to-unmount instance would leak the stream, so only self-start
        // when there is no parent to remount us.
        if (onRetry) { onRetry(); return; }
        handleStart();
    }, [handleStart, onRetry]);

    // ── Re-enrollment handlers ───────────────────────────────────────────
    const beginRecaptureCapture = () => {
        recaptureActiveRef.current = true;
        setRecaptureActive(true);
        setRecaptureStage(null);
        handleStart();
    };

    // Abandon re-enrollment: remount to a clean start screen (also releases the camera).
    const cancelRecapture = () => {
        stopCamera();
        recaptureActiveRef.current = false;
        setRecaptureActive(false);
        setRecaptureStage(null);
        setRecaptureReason('');
        if (onRetry) onRetry(); else setResult(null);
    };

    const confirmRecapture = async () => {
        if (!result?.photoKey || submittingRecapture) return;
        setSubmittingRecapture(true);
        try {
            await onRecapture?.({
                faceTemplate: result.template,
                photoKey: result.photoKey,
                livenessScore: result.livenessScore,
                reason: recaptureReason.trim(),
            });
        } finally {
            setSubmittingRecapture(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────

    // Re-enrollment: reason
    if (recaptureStage === 'reason') {
        const reasonLen = recaptureReason.trim().length;
        const reasonOk = reasonLen >= MIN_RECAPTURE_REASON_LENGTH;
        const missing = MIN_RECAPTURE_REASON_LENGTH - reasonLen;
        return (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-amber-800">Re-enroll Reference Face</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                    This replaces the face this client is verified against. The old record and every
                    attempt so far stay in the client's history. Compare the client with the LAF photo,
                    government ID and selfie at the top of this window first — only continue if this is
                    the same person.
                </p>

                <div>
                    <p className="text-xs font-medium text-amber-800 mb-1.5">Tap a reason, or write your own:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {RECAPTURE_REASON_PRESETS.map((preset) => (
                            <button key={preset} type="button"
                                onClick={() => setRecaptureReason((prev) => (prev.trim() ? `${prev.trim()}; ${preset}` : preset))}
                                className="px-2.5 py-1 text-[11px] text-left rounded-full border border-amber-300
                                    bg-white text-amber-800 hover:bg-amber-100">
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                <textarea
                    value={recaptureReason}
                    onChange={(e) => setRecaptureReason(e.target.value)}
                    rows={3}
                    placeholder="Why is the saved face not matching? (required)"
                    className="w-full border border-amber-300 rounded-lg text-sm px-3 py-2
                        focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
                <p className={`text-xs font-medium ${reasonOk ? 'text-green-700' : 'text-red-600'}`}>
                    {reasonOk
                        ? '✓ Reason is long enough'
                        : `${missing} more character${missing === 1 ? '' : 's'} needed (minimum ${MIN_RECAPTURE_REASON_LENGTH}) — say why the saved face does not match`}
                </p>
                <div className="flex gap-2">
                    <button type="button"
                        onClick={() => { setRecaptureStage(null); setRecaptureReason(''); }}
                        className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                        Back
                    </button>
                    <button type="button" onClick={beginRecaptureCapture} disabled={!reasonOk}
                        className="flex-1 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-amber-700 disabled:bg-gray-300 disabled:text-gray-500
                            disabled:hover:bg-gray-300 disabled:cursor-not-allowed">
                        Continue to Capture
                    </button>
                </div>
            </div>
        );
    }

    if (noTemplate && !cameraOpen && !result && !capturing) {
        return (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-amber-800">⚠ No Face Template on Record</p>
                <p className="text-xs text-amber-700">
                    This client's face was never captured — likely submitted while offline.
                    You can enroll it now using the camera, or an admin can override.
                </p>
                <button type="button" onClick={handleStart}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold
                        rounded-xl hover:bg-blue-700 transition-colors">
                    Capture Face & Enroll
                </button>
                {canSkip && (
                    <button type="button" onClick={onSkip}
                        className="w-full py-2.5 border border-amber-400 text-amber-700
                            text-sm font-medium rounded-xl hover:bg-amber-100 transition-colors">
                        Proceed Without Face Verification (Admin override)
                    </button>
                )}
            </div>
        );
    }

    // Re-enrollment: camera starting
    if (recaptureActive && !cameraOpen && !result && !capturing) {
        return (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-center space-y-2">
                <p className="text-sm text-amber-800">{cameraError || 'Preparing camera…'}</p>
                <button type="button" onClick={cancelRecapture}
                    className="text-xs text-gray-500 underline">Cancel</button>
            </div>
        );
    }

    // Saving a capture (enrollment upload in flight)
    if (capturing && !cameraOpen && !result) {
        return (
            <div className="p-4 text-center text-sm text-gray-500">Saving capture…</div>
        );
    }

    if (result?.enrolled) {
        const isRecapture = !!result.recapture;
        return (
            <div className="space-y-4">
                <div className={`p-5 rounded-2xl border-2 text-center ${
                    isRecapture ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'
                }`}>
                    <p className="text-4xl mb-2">{isRecapture ? '🔁' : '✅'}</p>
                    <p className={`text-base font-bold ${isRecapture ? 'text-amber-800' : 'text-green-800'}`}>
                        {isRecapture ? 'New Face Captured' : 'Face Captured'}
                    </p>
                    <p className={`text-xs mt-1 ${isRecapture ? 'text-amber-700' : 'text-green-600'}`}>
                        {isRecapture
                            ? 'This will replace the saved reference face. The old one is kept in history.'
                            : "This will be enrolled as the client's face record and disbursement can proceed."}
                    </p>
                    {isRecapture && !result.photoKey && (
                        <p className="text-xs text-red-600 mt-2">
                            The capture photo did not upload. Cancel and capture again.
                        </p>
                    )}
                </div>
                {isRecapture ? (
                    <div className="space-y-2">
                        <button type="button" onClick={confirmRecapture}
                            disabled={submittingRecapture || !result.photoKey}
                            className="w-full py-3 bg-amber-600 text-white text-sm font-semibold
                                rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors">
                            {submittingRecapture ? 'Saving…' : 'Confirm & Replace Reference'}
                        </button>
                        <button type="button" onClick={cancelRecapture} disabled={submittingRecapture}
                            className="w-full py-2 text-xs text-gray-500 underline">
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button type="button"
                        onClick={() => onEnroll?.({
                            faceTemplate: result.template,
                            faceEnrolledAt: new Date().toISOString(),
                            photoKey: result.photoKey ?? null,
                            livenessScore: result.livenessScore ?? null,
                        })}
                        className="w-full py-3 bg-green-600 text-white text-sm font-semibold
                            rounded-xl hover:bg-green-700 transition-colors">
                        Confirm & Enroll
                    </button>
                )}
            </div>
        );
    }

    if (result) {
        return (
            <VerifyResult
                matched={result.matched}
                score={result.score}
                onRetry={handleRetry}
                onConfirm={() => onVerified({ matched: true, score: result.score, faceMatchScore: result.distance })}
                canSkip={canSkip}
                onSkip={() => onSkip?.()}
                recaptureState={recaptureState}
                mismatchCount={mismatchCount}
                onStartRecapture={() => setRecaptureStage('reason')}
            />
        );
    }

    if (cameraOpen) {
        return (
            <div className="space-y-3">
                <div className="text-center">
                    {capturing ? (
                        <div className="py-2">
                            <p className="text-2xl">🔍</p>
                            <p className="text-sm font-semibold text-gray-800 mt-1">Matching face...</p>
                        </div>
                    ) : (
                        <div className={`py-2 px-4 rounded-xl inline-block ${
                            faceDetected ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                        }`}>
                            <p className="text-3xl leading-none mb-1">{currentChallenge.icon}</p>
                            <p className="text-base font-bold text-gray-900">{currentChallenge.label}</p>
                            <p className="text-xs text-gray-500">{currentChallenge.desc}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center gap-1">
                    {CHALLENGES.map((c, i) => (
                        <React.Fragment key={c.id}>
                            <div className="flex flex-col items-center gap-0.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                    completed.includes(c.id)
                                        ? 'bg-green-500 text-white scale-110'
                                        : i === challengeIdx && !capturing
                                            ? 'bg-blue-500 text-white animate-pulse'
                                            : 'bg-gray-200 text-gray-400'
                                }`}>
                                    {completed.includes(c.id) ? '✓' : c.icon}
                                </div>
                                <span className={`text-[9px] font-medium ${
                                    completed.includes(c.id) ? 'text-green-600' :
                                    i === challengeIdx ? 'text-blue-600' : 'text-gray-400'
                                }`}>{c.label}</span>
                            </div>
                            {i < CHALLENGES.length - 1 && (
                                <div className={`h-0.5 w-8 mb-3 transition-colors ${
                                    completed.includes(c.id) ? 'bg-green-400' : 'bg-gray-200'
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-gray-900 border-2 transition-colors"
                    style={{
                        aspectRatio: '4/3',
                        borderColor: faceDetected && !capturing ? '#3b82f6' : '#e5e7eb',
                    }}>
                    <video
                        ref={videoRef}
                        autoPlay playsInline muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />

                    {!streamReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center text-white">
                                <svg className="w-8 h-8 animate-spin mx-auto mb-2 opacity-70"
                                    fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                                <p className="text-xs opacity-50">Starting camera...</p>
                            </div>
                        </div>
                    )}

                    {streamReady && !capturing && (
                        <>
                            <DirectionArrow direction={currentChallenge.arrow} active={faceDetected} />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={`rounded-full border-4 transition-all duration-300 ${
                                    faceDetected
                                        ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]'
                                        : 'border-white border-opacity-40'
                                }`} style={{ width: '55%', height: '75%' }} />
                            </div>
                            <div className={`absolute top-3 left-3 px-2 py-1 rounded-full
                                text-xs font-semibold flex items-center gap-1 ${
                                faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                                <span>{faceDetected ? '✓' : '⚠'}</span>
                                <span>{faceDetected ? 'Face detected' : 'No face'}</span>
                            </div>
                        </>
                    )}

                    {streamReady && faceDetected && !capturing && progress > 0 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                                bg-black bg-opacity-50">
                                <div className="w-24 h-1.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 rounded-full transition-all duration-100"
                                        style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-white text-xs font-medium">{progress}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {streamReady && (
                    <p className={`text-xs text-center font-medium ${
                        faceDetected ? 'text-blue-600' : 'text-amber-600'
                    }`}>
                        {capturing
                            ? 'Please hold still...'
                            : faceDetected
                                ? `${currentChallenge.desc} and hold...`
                                : "Position the client's face inside the oval guide"}
                    </p>
                )}

                <button type="button" onClick={recaptureActive ? cancelRecapture : stopCamera}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-2">Client Face Verification</p>
                <p className="text-xs text-blue-700 leading-relaxed mb-3">
                    Ask the client to face the camera. They will look left, right, then at the camera.
                    Their face will be matched against their loan application record.
                </p>
                <div className="flex items-center gap-2 text-xs text-blue-700">
                    <span className="px-2 py-0.5 bg-blue-100 rounded-full font-medium">1</span>
                    <span>Look LEFT</span>
                    <span className="text-blue-300">→</span>
                    <span className="px-2 py-0.5 bg-blue-100 rounded-full font-medium">2</span>
                    <span>Look RIGHT</span>
                    <span className="text-blue-300">→</span>
                    <span className="px-2 py-0.5 bg-blue-100 rounded-full font-medium">3</span>
                    <span>Face camera</span>
                </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <span className="text-lg leading-none flex-shrink-0">👓</span>
                <div>
                    <p className="text-xs font-semibold text-amber-800">Ask client to remove glasses</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                        Glasses can prevent accurate face matching. Remove them for best results.
                    </p>
                </div>
            </div>

            {cameraError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {cameraError}
                </div>
            )}

            <button type="button" onClick={handleStart} disabled={modelsLoading}
                className="w-full py-3 bg-blue-600 text-white text-sm font-semibold
                    rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors
                    flex items-center justify-center gap-2">
                {modelsLoading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Start Face Verification
                    </>
                )}
            </button>
        </div>
    );
};

export default FaceVerifyStep;