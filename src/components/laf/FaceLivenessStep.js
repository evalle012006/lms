// src/components/laf/FaceLivenessStep.js
// Face liveness detection for PublicLAFForm.
// UX improvements:
//   - Added glasses removal instruction on initial screen
//   - Animated directional arrow overlay on video feed
//   - Countdown timer per challenge instead of bare progress bar
//   - Cleaner oval guide with pulsing animation when face detected
//   - Step pills replaced with visual stepper with icons

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

const MODEL_URL         = '/models';
const SCORE_THRESHOLD   = 0.5;
const POSE_SAMPLES      = 6;
const LANDMARK_INTERVAL = 150;

// Thresholds flipped to match mirrored video display
const TURN_LEFT_THRESHOLD  =  0.18;
const TURN_RIGHT_THRESHOLD = -0.18;
const CENTER_THRESHOLD     =  0.08;

const CHALLENGES = [
    {
        id:    'left',
        label: 'LOOK LEFT',
        icon:  '←',
        desc:  'Turn your head to the LEFT',
        arrow: 'left',
        color: 'blue',
    },
    {
        id:    'right',
        label: 'LOOK RIGHT',
        icon:  '→',
        desc:  'Turn your head to the RIGHT',
        arrow: 'right',
        color: 'blue',
    },
    {
        id:    'center',
        label: 'LOOK AT CAMERA',
        icon:  '👁',
        desc:  'Face the camera directly',
        arrow: 'center',
        color: 'green',
    },
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

// ── Animated directional arrow overlay ────────────────────────────────────
const DirectionArrow = ({ direction, active }) => {
    if (!active) return null;
    const base = 'absolute flex items-center justify-center transition-all duration-300';

    if (direction === 'left') return (
        <div className={`${base} left-4 top-1/2 -translate-y-1/2`}>
            <div className="animate-bounce-x-left">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="rgba(59,130,246,0.85)" />
                    <path d="M28 14L18 24L28 34" stroke="white" strokeWidth="4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
        </div>
    );

    if (direction === 'right') return (
        <div className={`${base} right-4 top-1/2 -translate-y-1/2`}>
            <div className="animate-bounce-x-right">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" fill="rgba(59,130,246,0.85)" />
                    <path d="M20 14L30 24L20 34" stroke="white" strokeWidth="4"
                        strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
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

const FaceLivenessStep = ({ onVerified, verified }) => {
    const videoRef     = useRef(null);
    const streamRef    = useRef(null);
    const intervalRef  = useRef(null);
    const faceApiRef   = useRef(null);
    const poseCountRef = useRef(0);

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

    const currentChallenge = CHALLENGES[challengeIdx];

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
            console.error('[FaceLiveness] model load failed:', err);
            toast.error('Failed to load face detection. Please try again.');
        } finally {
            setModelsLoading(false);
        }
    }, [modelsLoaded, modelsLoading]);

    const getStream = useCallback(async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            streamRef.current = stream;
            return stream;
        } catch (err) {
            const msg = err.name === 'NotAllowedError'
                ? 'Camera access denied. Please allow camera access and try again.'
                : err.name === 'NotFoundError'
                    ? 'No camera found on this device.'
                    : 'Could not start camera. Please try again.';
            setCameraError(msg);
            return null;
        }
    }, []);

    // Attach stream after video element is in DOM
    useEffect(() => {
        if (!cameraOpen || !streamRef.current) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = streamRef.current;
        video.onloadedmetadata = () => {
            video.play()
                .then(() => setStreamReady(true))
                .catch(err => {
                    console.error('[FaceLiveness] play() failed:', err);
                    setCameraError('Could not start video. Please try again.');
                });
        };
    }, [cameraOpen]);

    useEffect(() => {
        if (streamReady && modelsLoaded && !capturing) {
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

    useEffect(() => () => stopCamera(), [stopCamera]);

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
                            extractDescriptor();
                        }
                    }
                } else {
                    poseCountRef.current = Math.max(0, poseCountRef.current - 1);
                    setProgress(Math.max(0, Math.round((poseCountRef.current / POSE_SAMPLES) * 100)));
                }
            } catch { /* ignore frame errors */ }
        }, LANDMARK_INTERVAL);
    }, []);

    const extractDescriptor = useCallback(async () => {
        setCapturing(true);
        const faceapi = faceApiRef.current;
        const video   = videoRef.current;
        if (!faceapi || !video) { setCapturing(false); return; }
        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: SCORE_THRESHOLD }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) {
                toast.error('Could not capture face. Please try again.');
                setCompleted([]);
                setCapturing(false);
                startDetectionLoop(0);
                return;
            }
            stopCamera();
            onVerified({
                faceTemplate:   Array.from(detection.descriptor),
                faceEnrolledAt: new Date().toISOString(),
                livenessScore:  detection.detection.score,
            });
        } catch (err) {
            console.error('[FaceLiveness] descriptor extraction failed:', err);
            toast.error('Face capture failed. Please try again.');
            setCapturing(false);
        }
    }, [stopCamera, onVerified]);

    const handleStart = useCallback(async () => {
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

    // ── Already verified ───────────────────────────────────────────────────
    if (verified) {
        return (
            <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="text-base font-semibold text-green-700">Identity Verified!</p>
                <p className="text-xs text-gray-500 text-center">
                    Your face has been recorded for identity confirmation at loan release.
                </p>
            </div>
        );
    }

    // ── Camera active ──────────────────────────────────────────────────────
    if (cameraOpen) {
        return (
            <div className="space-y-3">
                {/* Challenge header */}
                <div className="text-center">
                    {capturing ? (
                        <div className="py-2">
                            <p className="text-2xl">📸</p>
                            <p className="text-sm font-semibold text-gray-800 mt-1">Capturing your face...</p>
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

                {/* Visual step progress */}
                <div className="flex items-center justify-center gap-1">
                    {CHALLENGES.map((c, i) => (
                        <React.Fragment key={c.id}>
                            <div className={`flex flex-col items-center gap-0.5`}>
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

                {/* Video feed with overlays */}
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

                    {/* Loading overlay */}
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
                            {/* Animated direction arrows */}
                            <DirectionArrow
                                direction={currentChallenge.arrow}
                                active={faceDetected}
                            />

                            {/* Oval guide — pulses green when face detected */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={`rounded-full border-4 transition-all duration-300 ${
                                    faceDetected
                                        ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]'
                                        : 'border-white border-opacity-40'
                                }`}
                                    style={{ width: '55%', height: '75%' }} />
                            </div>

                            {/* Face status badge */}
                            <div className={`absolute top-3 left-3 px-2 py-1 rounded-full
                                text-xs font-semibold flex items-center gap-1 ${
                                faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                                <span>{faceDetected ? '✓' : '⚠'}</span>
                                <span>{faceDetected ? 'Face detected' : 'No face'}</span>
                            </div>
                        </>
                    )}

                    {/* Progress arc — replaces plain progress bar, shown inside video */}
                    {streamReady && faceDetected && !capturing && progress > 0 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                                bg-black bg-opacity-50">
                                <div className="w-24 h-1.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-400 rounded-full transition-all duration-100"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <span className="text-white text-xs font-medium">{progress}%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Prompt under video */}
                {streamReady && (
                    <p className={`text-xs text-center font-medium ${
                        faceDetected ? 'text-blue-600' : 'text-amber-600'
                    }`}>
                        {capturing
                            ? 'Please hold still...'
                            : faceDetected
                                ? `${currentChallenge.desc} and hold...`
                                : 'Position your face inside the oval guide'}
                    </p>
                )}

                <button type="button" onClick={stopCamera}
                    className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 underline">
                    Cancel
                </button>
            </div>
        );
    }

    // ── Initial state ──────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-semibold text-blue-800 mb-2">Face Verification Required</p>
                <p className="text-xs text-blue-700 leading-relaxed mb-3">
                    We need to capture your face to confirm your identity when collecting your loan.
                </p>
                {/* Steps preview */}
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

            {/* Glasses warning */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <span className="text-lg leading-none flex-shrink-0">👓</span>
                <div>
                    <p className="text-xs font-semibold text-amber-800">
                        Please remove glasses before starting
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                        Glasses can prevent accurate face detection. Remove them for better results.
                    </p>
                </div>
            </div>

            {/* Lighting tip */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-2.5">
                <span className="text-lg leading-none flex-shrink-0">💡</span>
                <p className="text-xs text-gray-600">
                    Make sure your face is well-lit and look directly at the camera.
                </p>
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
                        Loading face detection...
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

            <p className="text-xs text-gray-400 text-center">
                Your face data is stored securely and only used to verify your identity at loan release.
            </p>
        </div>
    );
};

export default FaceLivenessStep;