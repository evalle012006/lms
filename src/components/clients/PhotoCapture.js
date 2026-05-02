import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * PhotoCapture
 *
 * Smart photo input that adapts to the device:
 * - Mobile: shows "Take Photo" (native camera) + "Upload File" (gallery)
 * - Desktop: shows "Upload Photo" only (capture attr is useless on desktop)
 *
 * Detection: uses userAgent to determine mobile vs desktop.
 * enumerateDevices alone is unreliable — desktops with webcams would
 * incorrectly show "Take Photo" which just opens a file picker anyway.
 */
const PhotoCapture = ({
    onFileReady,
    label = 'Capture or upload a photo',
    maxMB = 10,
    facingMode = 'environment',
    preview: controlledPreview = null,
}) => {
    const cameraInputRef = useRef();
    const fileInputRef   = useRef();
    const [localPreview, setLocalPreview] = useState(null);
    const [isMobile, setIsMobile]         = useState(null); // null = not yet determined

    // Detect mobile via userAgent — most reliable for camera capture support
    useEffect(() => {
        const ua = navigator.userAgent || '';
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        setIsMobile(mobile);
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
        if (fileInputRef.current) fileInputRef.current.value = '';
        onFileReady?.(null);
    };

    return (
        <div className="w-full">
            {preview ? (
                /* Preview with retake / remove */
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={preview} alt="Captured photo"
                        className="w-full max-h-72 object-contain" style={{ display: 'block' }} />
                    <div className="absolute top-2 right-2 flex gap-2">
                        {isMobile && (
                            <button type="button" onClick={() => cameraInputRef.current?.click()}
                                className="bg-white rounded-full p-1.5 shadow border border-gray-200
                                    text-gray-600 hover:bg-gray-50" title="Retake photo">
                                <Camera className="w-4 h-4" />
                            </button>
                        )}
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="bg-white rounded-full p-1.5 shadow border border-gray-200
                                text-gray-600 hover:bg-gray-50" title="Upload different file">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={handleReset}
                            className="bg-white rounded-full p-1.5 shadow border border-red-200
                                text-red-500 hover:bg-red-50" title="Remove">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                /* No preview — show buttons */
                <div className="w-full border-2 border-dashed border-gray-300 rounded-xl
                    min-h-48 flex flex-col items-center justify-center gap-4 p-6">

                    <p className="text-sm text-gray-500 text-center">{label}</p>

                    {/* Still detecting */}
                    {isMobile === null && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                    stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            Loading...
                        </div>
                    )}

                    {/* Mobile — camera + upload */}
                    {isMobile === true && (
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button type="button" onClick={() => cameraInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2
                                    py-3 px-4 bg-blue-600 text-white text-sm font-semibold
                                    rounded-xl hover:bg-blue-700 active:scale-95 transition-all">
                                <Camera className="w-4 h-4" />
                                Take Photo
                            </button>
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2
                                    py-3 px-4 border-2 border-gray-200 text-gray-600 text-sm
                                    font-semibold rounded-xl hover:border-blue-400 hover:bg-blue-50
                                    active:scale-95 transition-all">
                                <Upload className="w-4 h-4" />
                                Upload File
                            </button>
                        </div>
                    )}

                    {/* Desktop — upload only */}
                    {isMobile === false && (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center gap-2
                                py-3 px-6 bg-blue-600 text-white text-sm font-semibold
                                rounded-xl hover:bg-blue-700 active:scale-95 transition-all">
                            <Upload className="w-4 h-4" />
                            Upload Photo
                        </button>
                    )}

                    <p className="text-xs text-gray-400">JPG, PNG · Max {maxMB}MB</p>
                </div>
            )}

            {/* Camera input — capture triggers native camera on mobile only */}
            <input ref={cameraInputRef} type="file" accept="image/*"
                capture={facingMode} className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />

            {/* File input — no capture, opens gallery/file picker */}
            <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden"
                onChange={e => processFile(e.target.files?.[0])} />
        </div>
    );
};

export default PhotoCapture;