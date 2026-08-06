// src/components/ci/CILAFPhotoCard.js
import React, { useState } from 'react';

const CILAFPhotoCard = ({ lafPhotoUrl }) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    if (!lafPhotoUrl) return null;
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Client Photo — Application (LAF)
            </h3>
            <div className="flex justify-center">
                <button type="button" onClick={() => setPreviewOpen(true)}
                    className="relative group rounded-xl overflow-hidden border border-gray-200
                        hover:border-blue-400 transition-colors">
                    <img src={lafPhotoUrl} alt="Client LAF photo"
                        className="w-40 h-40 object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0
                        group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100
                            transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                    </div>
                </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">Click to view full image</p>
            {previewOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center
                    justify-center p-4" onClick={() => setPreviewOpen(false)}>
                    <button onClick={() => setPreviewOpen(false)}
                        className="absolute top-4 right-4 p-2 text-white bg-white bg-opacity-10
                            rounded-full hover:bg-opacity-20 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img src={lafPhotoUrl} alt="full view"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()} />
                    <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs
                        opacity-50">Tap anywhere outside to close</p>
                </div>
            )}
        </div>
    );
};

export default CILAFPhotoCard;