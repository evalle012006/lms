import React, { useRef, useState } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Reusable photo capture component.
 * Props:
 *   onFileReady(file)  — called when user selects/captures a valid file
 *   label              — instruction text shown above the capture area
 *   maxMB              — max file size in MB (default 10)
 *   facingMode         — 'user' (selfie) | 'environment' (rear camera, default)
 *   preview            — controlled preview URL (optional)
 */
const PhotoCapture = ({
    onFileReady,
    label = 'Tap to capture or upload a photo',
    maxMB = 10,
    facingMode = 'environment',
    preview: controlledPreview = null,
}) => {
    const inputRef = useRef();
    const [localPreview, setLocalPreview] = useState(null);

    const preview = controlledPreview || localPreview;

    const handleChange = (e) => {
        const file = e.target.files?.[0];
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
        if (inputRef.current) inputRef.current.value = '';
        onFileReady?.(null);
    };

    return (
        <div className="w-full">
            {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                        src={preview}
                        alt="Captured photo"
                        className="w-full max-h-72 object-contain" 
                        style={{ display: 'block' }}
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="bg-white rounded-full p-1.5 shadow border 
                                border-gray-200 text-gray-600 hover:bg-gray-50"
                            title="Retake"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="bg-white rounded-full p-1.5 shadow border 
                                border-red-200 text-red-500 hover:bg-red-50"
                            title="Remove"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl 
                        min-h-48 flex flex-col items-center justify-center gap-3 cursor-pointer 
                        hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                    <div className="flex gap-6 text-gray-400">
                        <div className="flex flex-col items-center gap-1">
                            <Camera className="w-8 h-8" />
                            <span className="text-xs">Camera</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <Upload className="w-8 h-8" />
                            <span className="text-xs">Upload</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 px-4 text-center">{label}</p>
                </button>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture={facingMode}
                className="hidden"
                onChange={handleChange}
            />
        </div>
    );
};

export default PhotoCapture;