// src/components/dashboard/CompanyActivitiesSlider.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Upload, Trash2, Info } from 'lucide-react';

export const ACTIVITY_SLIDES = [
    { src: 'https://picsum.photos/seed/amber1/900/400',  caption: 'Pre-Service Orientation' },
    { src: 'https://picsum.photos/seed/amber2/900/400',  caption: 'Train New Deployed Staff' },
    { src: 'https://picsum.photos/seed/amber3/900/400',  caption: 'Workshop for Higher Position' },
    { src: 'https://picsum.photos/seed/amber4/900/400',  caption: 'Getting to Know Each Other' },
    { src: 'https://picsum.photos/seed/amber5/900/400',  caption: 'Teach Staff to Achieve Higher Goals' },
    { src: 'https://picsum.photos/seed/amber6/900/400',  caption: 'Train Staff to Be Bolder and Better' },
    { src: 'https://picsum.photos/seed/amber7/900/400',  caption: 'Be Bold, Be Amber' },
    { src: 'https://picsum.photos/seed/amber8/900/400',  caption: 'Awards Night' },
    { src: 'https://picsum.photos/seed/amber9/900/400',  caption: 'Community Outreach Program' },
    { src: 'https://picsum.photos/seed/amber10/900/400', caption: 'Regional Summit 2025' },
];

/**
 * CompanyActivitiesSlider
 *
 * Props:
 *  slides          – array of { src, caption, key? }.
 *                    Falls back to ACTIVITY_SLIDES when empty.
 *  isAdmin         – show Upload / Delete controls (role.rep === 1 only)
 *  onUploadClick   – opens the hidden <input type="file" multiple>
 *  uploading       – disables the Upload button and shows "Uploading…"
 *  onDeleteCurrent – (key: string) => void — called with the Spaces key of the
 *                    current slide when the admin confirms deletion
 *  deleting        – disables the Delete button while the API request is in flight
 */
const CompanyActivitiesSlider = ({
    slides          = ACTIVITY_SLIDES,
    isAdmin         = false,
    onUploadClick,
    uploading       = false,
    onDeleteCurrent,
    deleting        = false,
}) => {
    const activeSlides = slides.length > 0 ? slides : ACTIVITY_SLIDES;
    const isDefaultSlides = slides.length === 0; // placeholder images have no key

    const [current,       setCurrent]       = useState(0);
    const [fading,        setFading]         = useState(false);
    const [confirmDelete, setConfirmDelete]  = useState(false);
    const [showGuide,     setShowGuide]      = useState(false);
    const timerRef        = useRef(null);
    const confirmTimeout  = useRef(null);

    // Reset to first slide when slide list changes (e.g. after upload / delete)
    useEffect(() => { setCurrent(0); }, [activeSlides.length]);

    const goTo = useCallback((index) => {
        setFading(true);
        setTimeout(() => {
            setCurrent((index + activeSlides.length) % activeSlides.length);
            setFading(false);
        }, 300);
    }, [activeSlides.length]);

    const next = useCallback(() => goTo(current + 1), [current, goTo]);
    const prev = useCallback(() => goTo(current - 1), [current, goTo]);

    useEffect(() => {
        timerRef.current = setInterval(next, 5000);
        return () => clearInterval(timerRef.current);
    }, [next]);

    // Cleanup confirm timeout on unmount
    useEffect(() => () => clearTimeout(confirmTimeout.current), []);

    const resetTimer = () => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(next, 5000);
    };

    // ── Two-step delete ────────────────────────────────────────────────────────
    const handleDeleteClick = () => {
        if (confirmDelete) {
            clearTimeout(confirmTimeout.current);
            setConfirmDelete(false);
            const currentKey = activeSlides[current]?.key;
            if (currentKey && onDeleteCurrent) onDeleteCurrent(currentKey);
        } else {
            setConfirmDelete(true);
            // Auto-cancel confirmation after 3 s
            confirmTimeout.current = setTimeout(() => setConfirmDelete(false), 3000);
        }
    };

    const activeSlide = activeSlides[current] ?? {};
    const canDelete   = isAdmin && !isDefaultSlides && !!activeSlide.key;

    return (
        <div
            className="relative w-full rounded-xl overflow-hidden bg-gray-900 select-none"
            style={{ height: '320px' }}
        >
            {/* Slide image */}
            <img
                src={activeSlide.src}
                alt={activeSlide.caption || ''}
                className="w-full h-full object-cover transition-opacity duration-300"
                style={{ opacity: fading ? 0 : 1 }}
                onError={(e) => {
                    e.target.src = `https://placehold.co/900x400/27c1d3/ffffff?text=${encodeURIComponent(
                        activeSlide.caption || 'AmberCash'
                    )}`;
                }}
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* ── Top-left: slide counter ── */}
            <div className="absolute top-3 left-3 bg-black/40 text-white text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm">
                {current + 1} / {activeSlides.length}
            </div>

            {/* ── Top-right: admin controls ── */}
            {isAdmin && (
                <div className="absolute top-3 right-3 flex items-center gap-2">

                    {/* Delete button (only for uploaded images, not defaults) */}
                    {canDelete && (
                        <button
                            onClick={handleDeleteClick}
                            disabled={deleting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg backdrop-blur-sm shadow transition-all ${
                                confirmDelete
                                    ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                    : 'bg-red-500/80 hover:bg-red-600'
                            } disabled:opacity-60`}
                        >
                            <Trash2 size={13} />
                            {deleting
                                ? 'Deleting…'
                                : confirmDelete
                                ? 'Confirm Delete?'
                                : 'Delete'}
                        </button>
                    )}

                    {/* Upload button + guide popover */}
                    <div className="relative">
                        <button
                            onClick={onUploadClick}
                            disabled={uploading}
                            onMouseEnter={() => setShowGuide(true)}
                            onMouseLeave={() => setShowGuide(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg backdrop-blur-sm shadow transition-all"
                        >
                            <Upload size={13} />
                            {uploading ? 'Uploading…' : 'Upload Images'}
                        </button>

                        {/* Upload guide tooltip */}
                        {showGuide && !uploading && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 text-left">
                                {/* Arrow */}
                                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />

                                <div className="flex items-center gap-1.5 mb-2">
                                    <Info size={13} className="text-blue-500 shrink-0" />
                                    <span className="text-xs font-bold text-gray-700">Upload Guide</span>
                                </div>

                                <ul className="space-y-1.5 text-xs text-gray-600">
                                    <li className="flex items-start gap-1.5">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span><strong>Recommended size:</strong> 900 × 400 px (landscape)</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span><strong>Max file size:</strong> 5 MB per image</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span><strong>Formats:</strong> JPG, PNG, WebP</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span>Multiple images can be selected at once</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span>New uploads <strong>add to</strong> existing slides</span>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Caption */}
            {activeSlide.caption && (
                <div className="absolute bottom-8 left-0 right-0 px-4">
                    <p className="text-white text-sm font-bold drop-shadow">{activeSlide.caption}</p>
                </div>
            )}

            {/* Prev */}
            <button
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-all"
                onClick={() => { prev(); resetTimer(); }}
            >
                <ChevronLeft size={16} />
            </button>

            {/* Next */}
            <button
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-all"
                onClick={() => { next(); resetTimer(); }}
            >
                <ChevronRight size={16} />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {activeSlides.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => { goTo(i); resetTimer(); }}
                        className={`rounded-full transition-all duration-300 ${
                            i === current
                                ? 'bg-white w-4 h-2'
                                : 'bg-white/50 w-2 h-2 hover:bg-white/70'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default CompanyActivitiesSlider;