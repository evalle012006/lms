// src/lib/avatarV2.js
// v2 — Tailwind-driven, gradient fallbacks, explicit loading/error states,
// optional status indicator. Kept as a new file (not a rewrite of the
// original `avatar.js`) since other call sites (lib/table.js's AvatarCell,
// anything else already depending on the v1 prop shape) aren't part of this
// change — swapping the export in place would silently alter their rendering.
import React, { useState, useEffect } from 'react';

const GRADIENTS = [
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-red-500',
    'from-cyan-400 to-teal-500',
    'from-slate-500 to-slate-700',
    'from-fuchsia-400 to-pink-500',
];

const STATUS_STYLES = {
    online:     'bg-emerald-500',
    offline:    'bg-gray-300',
    delinquent: 'bg-red-500',
    warning:    'bg-amber-500',
};

const SIZE_TEXT_RATIO = 0.4;

function sumChars(str) {
    return str.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function getInitials(name) {
    if (!name) return '';
    const clean = name.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    const parts = clean.split(' ');
    if (parts.length === 1) return clean.substring(0, 2).toUpperCase();
    return parts.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 2);
}

function gradientFor(name) {
    return GRADIENTS[sumChars(name || '') % GRADIENTS.length];
}

/**
 * AvatarV2 — modern avatar with gradient-initial fallback, skeleton loading
 * state, graceful image-error fallback, and an optional status dot.
 *
 * @param {string}  name              required — used for initials + alt text + gradient seed
 * @param {string}  [src]             signed image URL; omit or pass falsy to show initials
 * @param {number}  [size=40]         pixel size, square
 * @param {'circle'|'square'} [shape='circle']
 * @param {boolean} [ring=false]      adds a subtle ring (useful for active/selected states)
 * @param {string}  [ringColorClass]  Tailwind ring color class, e.g. 'ring-teal-500'
 * @param {'online'|'offline'|'delinquent'|'warning'|null} [status]  small corner dot
 * @param {string}  [className]
 */
export default function AvatarV2({
    name,
    src,
    size = 40,
    shape = 'circle',
    ring = false,
    ringColorClass = 'ring-teal-500',
    status = null,
    className = '',
}) {
    const [loaded, setLoaded]   = useState(false);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        setLoaded(false);
        setErrored(false);
    }, [src]);

    if (!name) {
        // Fail loud in dev, not with a cryptic downstream error — same
        // discipline as v1, just via console.error instead of returning null
        // silently into a broken layout.
        console.error('AvatarV2: `name` is required');
        return null;
    }

    const initials     = getInitials(name);
    const showImage     = !!src && !errored;
    const shapeClass    = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
    const dimensionStyle = { width: size, height: size };
    const fontSize      = Math.max(10, Math.floor(size * SIZE_TEXT_RATIO));

    return (
        <div
            className={`relative inline-flex flex-shrink-0 ${shapeClass} ${className}`}
            style={dimensionStyle}
            role="img"
            aria-label={`${name}'s avatar`}
            title={name}
        >
            {showImage ? (
                <>
                    {/* Skeleton shown until the image actually finishes loading —
                        prevents a flash of broken/empty state on slower connections */}
                    {!loaded && (
                        <div className={`absolute inset-0 ${shapeClass} bg-gray-200 animate-pulse`} />
                    )}
                    <img
                        src={src}
                        alt={`${name}'s photo`}
                        style={dimensionStyle}
                        className={`${shapeClass} object-cover w-full h-full transition-opacity duration-200
                            ${loaded ? 'opacity-100' : 'opacity-0'}
                            ${ring ? `ring-2 ring-offset-2 ${ringColorClass}` : ''}`}
                        onLoad={() => setLoaded(true)}
                        onError={() => setErrored(true)}
                        draggable={false}
                        loading="lazy"
                    />
                </>
            ) : (
                <div
                    style={{ ...dimensionStyle, fontSize }}
                    className={`flex items-center justify-center w-full h-full ${shapeClass}
                        bg-gradient-to-br ${gradientFor(name)} text-white font-semibold tracking-wide
                        ${ring ? `ring-2 ring-offset-2 ${ringColorClass}` : ''}`}
                >
                    {initials}
                </div>
            )}

            {status && (
                <span
                    className={`absolute bottom-0 right-0 block rounded-full border-2 border-white
                        ${STATUS_STYLES[status] || STATUS_STYLES.offline}`}
                    style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
                    aria-label={`status: ${status}`}
                />
            )}
        </div>
    );
}