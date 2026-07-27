// src/components/clients/PhotoCapture.js
// Smart photo input that adapts to device camera availability.
//
// Detection: enumerateDevices() to find actual videoinput devices.
// This correctly detects MacBook FaceTime camera, USB webcams, etc.
// — unlike userAgent which classifies all desktops as "no camera".
//
// Camera mechanism: native file input with capture attribute.
// - Mobile: opens native camera app (best UX — familiar, has flash/zoom)
// - Desktop: opens browser camera picker or file dialog (browser-dependent)
// - No camera: upload only

import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

const PhotoCapture = ({
    onFileReady,
    label            = 'Capture or upload a photo',
    maxMB            = 10,
    facingMode       = 'environment',
    preview: controlledPreview = null,
    existingPhotoKey = null,   // accepted for API compatibility — used by parent for signed URLs
}) => {
    const cameraInputRef = useRef();
    const fileInputRef   = useRef();
    const [localPreview, setLocalPreview] = useState(null);
    const [hasCamera,    setHasCamera]    = useState(null); // null = still detecting

    // ── Detect camera via enumerateDevices ────────────────────────────────
    // More reliable than userAgent — correctly finds MacBook FaceTime,
    // USB webcams, and any videoinput device regardless of OS.
    useEffect(() => {
        if (
            typeof navigator === 'undefined' ||
            !navigator.mediaDevices?.enumerateDevices
        ) {
            setHasCamera(false);
            return;
        }
        navigator.mediaDevices
            .enumerateDevices()
            .then(devices => {
                setHasCamera(devices.some(d => d.kind === 'videoinput'));
            })
            .catch(() => setHasCamera(false));
    }, []);

    const preview = controlledPreview || localPreview;

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

    // ── Preview state ─────────────────────────────────────────────────────
    if (preview) {
        return (
            <div className="w-full">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={preview} alt="Captured"
                        className="w-full max-h-52 object-contain" />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                    {/* Retake — only if camera available */}
                    {hasCamera && (
                        <button type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs
                                border border-gray-200 text-gray-600 rounded-lg
                                hover:bg-gray-50 transition-colors">
                            <Camera className="w-3.5 h-3.5" />
                            {hasCamera ? 'Retake' : 'Take Again'}
                        </button>
                    )}
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs
                            border border-gray-200 text-gray-600 rounded-lg
                            hover:bg-gray-50 transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        Replace with file
                    </button>
                    <button type="button"
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs
                            border border-red-100 text-red-500 rounded-lg
                            hover:bg-red-50 transition-colors ml-auto">
                        <X className="w-3.5 h-3.5" />
                        Remove
                    </button>
                </div>

                {/* Hidden inputs */}
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
            {hasCamera === null ? (
                // Detecting — show neutral placeholder
                <div className="w-full h-28 border-2 border-dashed border-gray-200
                    rounded-xl flex items-center justify-center">
                    <p className="text-xs text-gray-400">Checking camera…</p>
                </div>
            ) : hasCamera ? (
                // Camera detected — Take Photo (primary) + Upload (secondary)
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
                    <p className="text-xs text-center text-gray-400">
                        JPG, PNG · Max {maxMB}MB
                    </p>
                </div>
            ) : (
                // No camera — upload only
                <div className="flex flex-col gap-2">
                    <button type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 py-3 px-4
                            bg-teal-600 text-white text-sm font-semibold rounded-xl
                            hover:bg-teal-700 active:scale-95 transition-all">
                        <Upload className="w-4 h-4" />
                        Upload Photo
                    </button>
                    <p className="text-xs text-center text-gray-400">
                        JPG, PNG · Max {maxMB}MB
                    </p>
                </div>
            )}

            {/* Camera input — capture opens native camera on mobile */}
            <input ref={cameraInputRef} type="file" accept="image/*"
                capture={facingMode} className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />

            {/* File input — no capture, opens gallery / file picker */}
            <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />
        </div>
    );
};

export default PhotoCapture;