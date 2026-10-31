// src/lib/laf/id-mask.js

// Mask preserves length (so isValidGovernmentId still passes) and shows the last 4
// only for longer IDs; short IDs reveal nothing.
export const ID_MASK_CHAR = '•';

export function maskGovernmentId(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const visible = s.length > 8 ? 4 : 0;
    return ID_MASK_CHAR.repeat(s.length - visible) + (visible ? s.slice(-visible) : '');
}

export const isMaskedId = (v) => typeof v === 'string' && v.includes(ID_MASK_CHAR);