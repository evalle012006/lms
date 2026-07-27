// src/components/clients/PhotoCapture.js
// 
// Strategy:
// - Mobile (userAgent): capture attr → native camera app (best UX)
// - Desktop with camera (enumerateDevices): getUserMedia → in-browser stream
// - Desktop no camera: upload only
//
// Why split strategy:
// - capture attr on desktop = ignored by all browsers → just file picker
// - getUserMedia on mobile = works but worse UX than native camera
// - So: userAgent for mobile detection, enumerateDevices for desktop camera

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, X, SwitchCamera } from 'lucide-react';
import { toast } from 'react-toastify';

const PhotoCapture = ({
    onFileReady,
    label            = 'Capture or upload a photo',
    maxMB            = 10,
    facingMode       = 'environment',
    preview: controlledPreview = null,
    existingPhotoKey = null,
}) => {
    const cameraInputRef = useRef(); // mobile native camera
    const fileInputRef   = useRef(); // file picker
    const videoRef       = useRef(); // desktop live stream
    const canvasRef      = useRef(); // desktop capture
    const streamRef      = useRef(null);

    const [localPreview, setLocalPreview] = useState(null);
    const [isMobile,     setIsMobile]     = useState(null); // null = detecting
    const [hasCamera,    setHasCamera]    = useState(false);
    const [cameraOpen,   setCameraOpen]   = useState(false);
    const [cameraError,  setCameraError]  = useState(null);
    const [activeFacing, setActiveFacing] = useState(facingMode);
    const [capturing,    setCapturing]    = useState(false);

    const preview = controlledPreview || localPreview;

    // ── Detection ─────────────────────────────────────────────────────────
    useEffect(() => {
        const ua = navigator.userAgent || '';
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        setIsMobile(mobile);

        // Only check enumerateDevices for desktop — no need on mobile
        if (!mobile && navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices()
                .then(devices => setHasCamera(devices.some(d => d.kind === 'videoinput')))
                .catch(() => setHasCamera(false));
        }
    }, []);

    // ── Stream cleanup ────────────────────────────────────────────────────
    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => () => stopStream(), [stopStream]);

    // ── Open desktop camera via getUserMedia ──────────────────────────────
    const openDesktopCamera = useCallback(async (facing = activeFacing) => {
        setCameraError(null);
        setCapturing(false);
        setCameraOpen(true);
        stopStream();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            setCameraError(
                err.name === 'NotAllowedError'
                    ? 'Camera permission denied. Allow camera access in your browser and try again.'
                    : err.name === 'NotFoundError'
                    ? 'No camera found.'
                    : 'Could not open camera. Try uploading a file instead.'
            );
        }
    }, [activeFacing, stopStream]);

    const switchCamera = useCallback(() => {
        const next = activeFacing === 'environment' ? 'user' : 'environment';
        setActiveFacing(next);
        openDesktopCamera(next);
    }, [activeFacing, openDesktopCamera]);

    const closeDesktopCamera = useCallback(() => {
        stopStream();
        setCameraOpen(false);
        setCameraError(null);
    }, [stopStream]);

    // ── Capture frame from video ──────────────────────────────────────────
    const captureFromVideo = useCallback(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        setCapturing(true);
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(blob => {
            if (!blob) { setCapturing(false); return; }
            if (blob.size > maxMB * 1024 * 1024) {
                toast.error(`Photo too large. Max ${maxMB}MB.`);
                setCapturing(false);
                return;
            }
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url  = URL.createObjectURL(blob);
            setLocalPreview(url);
            onFileReady?.(file);
            stopStream();
            setCameraOpen(false);
            setCapturing(false);
        }, 'image/jpeg', 0.92);
    }, [maxMB, onFileReady, stopStream]);

    // ── File input handler ────────────────────────────────────────────────
    const processFile = (file) => {
        if (!file) return;
        if (file.size > maxMB * 1024 * 1024) {
            toast.error(`File too large. Maximum size is ${maxMB}MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setLocalPreview(reader.result);
        reader.readAsDataURL(file);
        onFileReady?.(file);
    };

    const handleReset = () => {
        setLocalPreview(null);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (fileInputRef.current)   fileInputRef.current.value   = '';
        onFileReady?.(null);
    };

    // ── Desktop camera view ───────────────────────────────────────────────
    if (cameraOpen) {
        return (
            <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-black">
                {cameraError ? (
                    <div className="p-5 bg-white text-center space-y-3">
                        <p className="text-sm text-red-500">{cameraError}</p>
                        <div className="flex gap-2 justify-center">
                            <button type="button" onClick={() => openDesktopCamera()}
                                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700">
                                Try Again
                            </button>
                            <button type="button" onClick={closeDesktopCamera}
                                className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <video ref={videoRef} autoPlay playsInline muted
                                className="w-full max-h-72 object-cover" />
                            <button type="button" onClick={switchCamera}
                                title="Switch camera"
                                className="absolute top-2 right-2 p-2 bg-black bg-opacity-50
                                    text-white rounded-full hover:bg-opacity-70 transition">
                                <SwitchCamera className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-black">
                            <button type="button" onClick={closeDesktopCamera}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm
                                    text-gray-400 hover:text-white transition">
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            {/* Shutter */}
                            <button type="button" onClick={captureFromVideo}
                                disabled={capturing}
                                className="w-14 h-14 rounded-full bg-white border-4 border-gray-300
                                    hover:bg-gray-100 disabled:opacity-50 transition
                                    flex items-center justify-center">
                                {capturing ? (
                                    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                                )}
                            </button>
                            <button type="button"
                                onClick={() => { closeDesktopCamera(); fileInputRef.current?.click(); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm
                                    text-gray-400 hover:text-white transition">
                                <Upload className="w-4 h-4" />
                                Upload
                            </button>
                        </div>
                    </>
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        );
    }

    // ── Preview state ─────────────────────────────────────────────────────
    if (preview) {
        return (
            <div className="w-full">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={preview} alt="Captured" className="w-full max-h-52 object-contain" />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                    {/* Retake — mobile uses capture attr, desktop uses getUserMedia */}
                    {(isMobile || hasCamera) && (
                        <button type="button"
                            onClick={() => isMobile
                                ? cameraInputRef.current?.click()
                                : openDesktopCamera()}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs
                                border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                            <Camera className="w-3.5 h-3.5" />
                            Retake
                        </button>
                    )}
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs
                            border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                        <Upload className="w-3.5 h-3.5" />
                        Replace with file
                    </button>
                    <button type="button" onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs
                            border border-red-100 text-red-500 rounded-lg
                            hover:bg-red-50 ml-auto">
                        <X className="w-3.5 h-3.5" />
                        Remove
                    </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*"
                    capture={facingMode} className="hidden"
                    onChange={e => processFile(e.target.files?.[0])} />
                <input ref={fileInputRef} type="file" accept="image/*"
                    className="hidden"
                    onChange={e => processFile(e.target.files?.[0])} />
            </div>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────
    return (
        <div className="w-full">
            {isMobile === null ? (
                <div className="w-full h-28 border-2 border-dashed border-gray-200
                    rounded-xl flex items-center justify-center">
                    <p className="text-xs text-gray-400">Checking camera…</p>
                </div>
            ) : isMobile ? (
                // Mobile — native camera via capture attr + file upload
                <div className="flex flex-col gap-2">
                    <button type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-3 px-4
                            bg-teal-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-teal-700 active:scale-95 transition-all">
                        <Camera className="w-4 h-4" />
                        Take Photo
                    </button>
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-2.5 px-4
                            border-2 border-gray-200 text-gray-600 text-sm font-medium
                            rounded-xl hover:border-teal-400 hover:bg-teal-50
                            active:scale-95 transition-all">
                        <Upload className="w-4 h-4" />
                        Upload File
                    </button>
                    <p className="text-xs text-center text-gray-400">JPG, PNG · Max {maxMB}MB</p>
                </div>
            ) : hasCamera ? (
                // Desktop with camera — getUserMedia + file upload
                <div className="flex flex-col gap-2">
                    <button type="button"
                        onClick={() => openDesktopCamera()}
                        className="flex items-center justify-center gap-2 py-3 px-4
                            bg-teal-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-teal-700 active:scale-95 transition-all">
                        <Camera className="w-4 h-4" />
                        Take Photo
                    </button>
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-2.5 px-4
                            border-2 border-gray-200 text-gray-600 text-sm font-medium
                            rounded-xl hover:border-teal-400 hover:bg-teal-50
                            active:scale-95 transition-all">
                        <Upload className="w-4 h-4" />
                        Upload File
                    </button>
                    <p className="text-xs text-center text-gray-400">JPG, PNG · Max {maxMB}MB</p>
                </div>
            ) : (
                // Desktop no camera — upload only
                <div className="flex flex-col gap-2">
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-3 px-4
                            bg-teal-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-teal-700 active:scale-95 transition-all">
                        <Upload className="w-4 h-4" />
                        Upload Photo
                    </button>
                    <p className="text-xs text-center text-gray-400">JPG, PNG · Max {maxMB}MB</p>
                </div>
            )}

            {/* Mobile camera input — capture attr triggers native camera */}
            <input ref={cameraInputRef} type="file" accept="image/*"
                capture={facingMode} className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />

            {/* File input — no capture, always opens file picker / gallery */}
            <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />
        </div>
    );
};

export default PhotoCapture;