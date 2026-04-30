import React from 'react';
import PhotoCapture from '@/components/clients/PhotoCapture';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const LAFPhotoStep = ({ onPhotoReady, uploading }) => (
    <div className="space-y-5">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-semibold text-blue-800">
                    Identity photo required
                </p>
                <p className="text-xs text-blue-700 mt-1">
                    Please take a clear photo of yourself facing the camera. 
                    This photo will be used to verify your identity throughout 
                    the application process.
                </p>
            </div>
        </div>

        <PhotoCapture
            onFileReady={onPhotoReady}
            label="Take a photo of yourself"
            facingMode="user"
            maxMB={10}
        />

        {uploading && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading photo…
            </div>
        )}
    </div>
);

export default LAFPhotoStep;