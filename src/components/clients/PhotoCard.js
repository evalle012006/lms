// src/components/clients/PhotoCard.js
import React, { useState } from 'react';
import { MagnifyingGlassPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import placeholder from '/public/images/image-placeholder.png';

/**
 * Self-contained photo tile: label + optional sublabel + signed url.
 * Manages its own zoom/preview state (matches CILAFPhotoCard.js / PhotoTile
 * in CIDuplicatePanel.js) rather than relying on page-level preview state.
 *
 * Props:
 *  - label:    string, required. Title shown under the image.
 *  - sublabel: string|null, optional. Secondary line (e.g. capture date, ID type).
 *  - url:      string|null. Signed URL. If falsy, shows a placeholder and
 *              disables the zoom interaction (nothing to zoom into).
 *  - loading:  boolean, optional. If true, shows a skeleton instead of the
 *              image/placeholder — pass the `loading` value from useSignedUrl
 *              if the caller wants to distinguish "still fetching" from
 *              "confirmed missing".
 */
const PhotoCard = ({ label, sublabel, url, loading = false }) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const hasImage = Boolean(url);

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                onClick={() => hasImage && setPreviewOpen(true)}
                disabled={!hasImage}
                className="relative group w-full aspect-square rounded-xl overflow-hidden
                    border border-gray-200 bg-gray-100 flex items-center justify-center
                    disabled:cursor-default hover:border-primary-2 transition-colors"
            >
                {loading ? (
                    <div className="w-full h-full animate-pulse bg-gray-200" />
                ) : (
                    <>
                        <img
                            src={hasImage ? url : placeholder.src}
                            alt={label}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = placeholder.src; }}
                        />
                        {hasImage && (
                            <div className="absolute inset-0 bg-black bg-opacity-0
                                group-hover:bg-opacity-30 transition-all flex items-center
                                justify-center">
                                <MagnifyingGlassPlusIcon className="w-6 h-6 text-white opacity-0
                                    group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </>
                )}
            </button>

            <div className="text-center">
                <p className="text-xs font-medium text-gray-700">{label}</p>
                {sublabel && (
                    <p className="text-[11px] text-gray-400 leading-tight">{sublabel}</p>
                )}
            </div>

            {previewOpen && hasImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center
                        justify-center p-4"
                    onClick={() => setPreviewOpen(false)}
                >
                    <button
                        onClick={() => setPreviewOpen(false)}
                        className="absolute top-4 right-4 p-2 text-white bg-white bg-opacity-10
                            rounded-full hover:bg-opacity-20 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                    <img
                        src={url}
                        alt={label}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs
                        opacity-50">
                        Tap anywhere outside to close
                    </p>
                </div>
            )}
        </div>
    );
};

export default PhotoCard;