// src/components/shared/PhotoComparisonOverlay.js
// EXTRACTED from src/pages/settings/face-verify-attempts/index.js's
// ComparisonZoomOverlay — pulled out so DisbursementPhotoModal (and any
// future caller) renders the exact same enrolled-vs-captured comparison
// instead of a re-implemented copy that can drift from this one.
// Behavior is unchanged: full-screen dark overlay, tap-outside-to-close,
// side-by-side images with a VS divider.
import React from 'react';
import { X, User } from 'lucide-react';

const PhotoComparisonOverlay = ({
    leftUrl,
    rightUrl,
    leftLabel = 'Enrolled',
    rightLabel = 'Captured',
    title,
    onClose,
}) => (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col"
        onClick={onClose}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-semibold">{title}</p>
            <button type="button" onClick={onClose}
                className="p-2 bg-white bg-opacity-10 rounded-full text-white
                    hover:bg-opacity-20 transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>
        <div className="flex flex-1 items-center justify-center gap-6 px-6 pb-6 min-h-0"
            onClick={e => e.stopPropagation()}>
            <ComparisonSide url={leftUrl} label={leftLabel} />
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-px h-20 bg-white bg-opacity-20" />
                <span className="text-white text-xs font-bold opacity-50">VS</span>
                <div className="w-px h-20 bg-white bg-opacity-20" />
            </div>
            <ComparisonSide url={rightUrl} label={rightLabel} />
        </div>
        <p className="text-center text-white text-xs opacity-30 pb-4 flex-shrink-0">
            Tap anywhere outside to close
        </p>
    </div>
);

const ComparisonSide = ({ url, label }) => (
    <div className="flex flex-col items-center gap-3 flex-1 min-w-0 max-w-sm h-full">
        <span className="text-white text-xs font-semibold uppercase tracking-widest
            bg-white bg-opacity-10 px-3 py-1 rounded-full">{label}</span>
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
            {url ? (
                <img src={url} alt={label}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            ) : (
                <div className="w-48 h-48 rounded-2xl bg-white bg-opacity-10
                    flex items-center justify-center">
                    <User className="w-16 h-16 text-white opacity-30" />
                </div>
            )}
        </div>
    </div>
);

// Small thumbnail pair, used inline in list rows / panels to trigger the overlay above.
export const PhotoThumb = ({ url, label, onClick }) => (
    <div className="text-center">
        {url ? (
            <img src={url} alt={label} onClick={onClick}
                className="w-14 h-14 rounded-lg object-cover border border-gray-200 cursor-pointer" />
        ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-300" />
            </div>
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
    </div>
);

export default PhotoComparisonOverlay;