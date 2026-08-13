// src/components/clients/PhotoCapture.js
//
// Smart photo capture with camera detection:
//   - hasCamera=true  → opens camera by default, no upload button shown
//   - hasCamera=false → upload only
//   - allowUpload=true → always shows upload option alongside camera (for DisbursementPhotoModal)
//   - cameraOnly=true → hides upload even if allowUpload not set (legacy compat)
//
// Camera strategy:
//   - Mobile (userAgent): native camera via capture attr (best UX, has flash/zoom)
//   - Desktop with camera (enumerateDevices): getUserMedia inline stream
//   - Desktop no camera: upload only

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Upload, X, SwitchCamera, ImagePlus, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { compressImageOrThrow } from '@/lib/image-compress';

const PhotoCapture = ({
    onFileReady,
    label            = 'Take a photo',
    maxMB            = 10,
    facingMode       = 'environment',
    preview: controlledPreview = null,
    existingPhotoKey = null,
    cameraOnly       = false,   // legacy: hides upload
    allowUpload      = false,   // always show upload alongside camera
}) => {
    const cameraInputRef = useRef();
    const fileInputRef   = useRef();
    const videoRef       = useRef();
    const canvasRef      = useRef();
    const streamRef      = useRef(null);

    const [localPreview, setLocalPreview] = useState(null);
    const [isMobile,     setIsMobile]     = useState(null);
    const [hasCamera,    setHasCamera]    = useState(null); // null=detecting
    const [cameraOpen,   setCameraOpen]   = useState(false);
    const [cameraError,  setCameraError]  = useState(null);
    const [activeFacing, setActiveFacing] = useState(facingMode);
    const [capturing,    setCapturing]    = useState(false);

    const preview      = controlledPreview || localPreview;
    const showUpload   = allowUpload && !cameraOnly;

    // ── Detection ─────────────────────────────────────────────────────────
    useEffect(() => {
        const ua     = navigator.userAgent || '';
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        setIsMobile(mobile);
        if (!mobile && navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices()
                .then(devices => setHasCamera(devices.some(d => d.kind === 'videoinput')))
                .catch(() => setHasCamera(false));
        } else if (mobile) {
            setHasCamera(true); // mobile always treated as having camera
        } else {
            setHasCamera(false);
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

    // ── Open desktop camera ───────────────────────────────────────────────
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
                    ? 'Camera permission denied. Please allow camera access and try again.'
                    : 'Could not open camera. Try uploading a file instead.'
            );
        }
    }, [activeFacing, stopStream]);

    const switchCamera = useCallback(() => {
        const next = activeFacing === 'environment' ? 'user' : 'environment';
        setActiveFacing(next);
        openDesktopCamera(next);
    }, [activeFacing, openDesktopCamera]);

    const closeCamera = useCallback(() => {
        stopStream();
        setCameraOpen(false);
        setCameraError(null);
    }, [stopStream]);

    // ── Capture from desktop video ────────────────────────────────────────
    const captureFromVideo = useCallback(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        setCapturing(true);
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(-1, 0, 0, 1, canvas.width, 0); // mirror to match preview
        ctx.drawImage(video, 0, 0);
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

    // ── File input ────────────────────────────────────────────────────────
    const processFile = async (file) => {
        if (!file) return;
        let compressed;
        try {
            compressed = await compressImageOrThrow(file, { maxMB });
        } catch (err) {
            toast.error(err.message);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setLocalPreview(reader.result);
        reader.readAsDataURL(compressed);
        onFileReady?.(compressed);
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
            <div className="w-full rounded-2xl overflow-hidden bg-gray-950 shadow-lg">
                {cameraError ? (
                    <div className="p-6 text-center space-y-4 bg-gray-950">
                        <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center
                            justify-center mx-auto">
                            <Camera className="w-6 h-6 text-red-400" />
                        </div>
                        <p className="text-sm text-gray-300">{cameraError}</p>
                        <div className="flex gap-2 justify-center">
                            <button type="button" onClick={() => openDesktopCamera()}
                                className="px-4 py-2 text-xs font-medium bg-white/10 text-white
                                    rounded-lg hover:bg-white/20 transition-colors">
                                Try Again
                            </button>
                            <button type="button" onClick={closeCamera}
                                className="px-4 py-2 text-xs font-medium text-gray-400
                                    rounded-lg hover:bg-white/5 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <video ref={videoRef} autoPlay playsInline muted
                                style={{ transform: 'scaleX(-1)' }}
                                className="w-full max-h-72 object-cover" />
                            {/* Switch camera */}
                            <button type="button" onClick={switchCamera}
                                className="absolute top-3 right-3 p-2 rounded-full
                                    bg-black/50 text-white hover:bg-black/70 transition-colors
                                    backdrop-blur-sm">
                                <SwitchCamera className="w-4 h-4" />
                            </button>
                            {/* Viewfinder corner guides */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-4 left-4 w-6 h-6
                                    border-t-2 border-l-2 border-white/60 rounded-tl" />
                                <div className="absolute top-4 right-4 w-6 h-6
                                    border-t-2 border-r-2 border-white/60 rounded-tr" />
                                <div className="absolute bottom-16 left-4 w-6 h-6
                                    border-b-2 border-l-2 border-white/60 rounded-bl" />
                                <div className="absolute bottom-16 right-4 w-6 h-6
                                    border-b-2 border-r-2 border-white/60 rounded-br" />
                            </div>
                        </div>
                        {/* Controls */}
                        <div className="flex items-center justify-between px-5 py-4 bg-gray-950">
                            <button type="button" onClick={closeCamera}
                                className="flex items-center gap-1.5 text-xs text-gray-400
                                    hover:text-white transition-colors px-3 py-2 rounded-lg
                                    hover:bg-white/10">
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            {/* Shutter button */}
                            <button type="button" onClick={captureFromVideo}
                                disabled={capturing}
                                className="relative w-16 h-16 rounded-full flex items-center
                                    justify-center disabled:opacity-50 transition-all
                                    active:scale-95 group">
                                {/* Outer ring */}
                                <span className="absolute inset-0 rounded-full border-2
                                    border-white group-hover:border-teal-400
                                    transition-colors" />
                                {/* Inner circle */}
                                <span className={`w-12 h-12 rounded-full transition-all ${
                                    capturing
                                        ? 'bg-teal-400 scale-90'
                                        : 'bg-white group-hover:bg-teal-50'
                                }`} />
                            </button>
                            {/* Upload fallback if allowed */}
                            {showUpload ? (
                                <button type="button"
                                    onClick={() => { closeCamera(); fileInputRef.current?.click(); }}
                                    className="flex items-center gap-1.5 text-xs text-gray-400
                                        hover:text-white transition-colors px-3 py-2 rounded-lg
                                        hover:bg-white/10">
                                    <Upload className="w-4 h-4" />
                                    Upload
                                </button>
                            ) : (
                                <div className="w-20" /> // spacer
                            )}
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
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 shadow-sm
                    ring-1 ring-gray-200">
                    <img src={preview} alt="Captured"
                        className="w-full max-h-56 object-cover" />
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60
                        via-transparent to-transparent flex items-end p-3 gap-2">
                        {/* Retake */}
                        {hasCamera && (
                            <button type="button"
                                onClick={() => isMobile
                                    ? cameraInputRef.current?.click()
                                    : openDesktopCamera()}
                                className="flex items-center gap-1.5 px-3 py-1.5
                                    text-xs font-medium bg-white/90 text-gray-800
                                    rounded-lg hover:bg-white transition-colors shadow-sm">
                                <RefreshCw className="w-3 h-3" />
                                Retake
                            </button>
                        )}
                        {/* Upload replacement — if allowed */}
                        {showUpload && (
                            <button type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5
                                    text-xs font-medium bg-white/90 text-gray-800
                                    rounded-lg hover:bg-white transition-colors shadow-sm">
                                <ImagePlus className="w-3 h-3" />
                                Replace
                            </button>
                        )}
                        {/* Remove */}
                        <button type="button" onClick={handleReset}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5
                                text-xs font-medium bg-red-500/80 text-white
                                rounded-lg hover:bg-red-600 transition-colors">
                            <X className="w-3 h-3" />
                            Remove
                        </button>
                    </div>
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
            {hasCamera === null || isMobile === null ? (
                // Detecting — clean placeholder
                <div className="w-full h-36 rounded-2xl border-2 border-dashed
                    border-gray-200 flex flex-col items-center justify-center gap-2
                    bg-gray-50 animate-pulse">
                    <Camera className="w-6 h-6 text-gray-300" />
                    <p className="text-xs text-gray-300">Checking camera…</p>
                </div>
            ) : hasCamera ? (
                // Has camera — single prominent "Open Camera" button
                <div className="w-full space-y-2">
                    <button type="button"
                        onClick={() => isMobile
                            ? cameraInputRef.current?.click()
                            : openDesktopCamera()}
                        className="w-full group relative overflow-hidden rounded-2xl
                            bg-gradient-to-br from-teal-500 to-teal-600
                            hover:from-teal-400 hover:to-teal-500
                            active:scale-[0.98] transition-all duration-150
                            shadow-sm hover:shadow-md">
                        <div className="flex flex-col items-center justify-center
                            gap-2 py-8 px-4">
                            <div className="w-12 h-12 rounded-full bg-white/20
                                flex items-center justify-center
                                group-hover:bg-white/30 transition-colors">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-white">
                                    Open Camera
                                </p>
                                <p className="text-xs text-teal-100 mt-0.5">
                                    {facingMode === 'user'
                                        ? 'Take a selfie'
                                        : 'Take a photo'}
                                </p>
                            </div>
                        </div>
                    </button>
                    {/* Upload option — only when allowed */}
                    {showUpload && (
                        <button type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2
                                py-2.5 px-4 rounded-xl border border-gray-200
                                text-gray-500 text-xs font-medium
                                hover:border-gray-300 hover:bg-gray-50
                                hover:text-gray-700 transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            Upload from gallery
                        </button>
                    )}
                    <p className="text-xs text-center text-gray-400">
                        JPG, PNG · Max {maxMB}MB
                    </p>
                </div>
            ) : (
                // No camera — upload only
                <div className="w-full space-y-2">
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full group rounded-2xl border-2 border-dashed
                            border-gray-200 hover:border-teal-400
                            hover:bg-teal-50/50 active:scale-[0.98]
                            transition-all duration-150">
                        <div className="flex flex-col items-center justify-center
                            gap-2 py-8 px-4">
                            <div className="w-12 h-12 rounded-full bg-gray-100
                                flex items-center justify-center
                                group-hover:bg-teal-100 transition-colors">
                                <Upload className="w-6 h-6 text-gray-400
                                    group-hover:text-teal-600 transition-colors" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-600
                                    group-hover:text-teal-700 transition-colors">
                                    Upload Photo
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    JPG, PNG · Max {maxMB}MB
                                </p>
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {/* Inputs */}
            <input ref={cameraInputRef} type="file" accept="image/*"
                capture={facingMode} className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />
            <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />
        </div>
    );
};

export default PhotoCapture;