// src/lib/closing-documents.constants.js

const MAX_LISTED_LOS = 5;

export const CLOSING_DOC_TYPES = [
    { key: 'bms', label: 'BMS', maxMB: 3 },
    { key: 'dcs', label: 'DCS', maxMB: 8 },
    { key: 'cashbook', label: 'Cashbook', maxMB: 8 },
    { key: 'mcbu_withdrawals_return', label: 'MCBU Withdrawals & MCBU Return', maxMB: 5 },
    { key: 'coh_certification', label: 'COH Certification', maxMB: 3 },
    { key: 'ld', label: 'LD', maxMB: 5 },
];

export const CLOSING_DOC_KEYS = CLOSING_DOC_TYPES.map(d => d.key);

export const getClosingDocMaxBytes = (docType) => {
    const entry = CLOSING_DOC_TYPES.find(d => d.key === docType);
    return (entry?.maxMB || 5) * 1024 * 1024;
};

/**
 * One-sentence summary for toasts. Returns null when nothing is open, so
 * callers can fall back to their generic message.
 */
export const formatUnclosedLoMessage = (summary = [], emptyGroups = []) => {
    if (!summary?.length && !emptyGroups?.length) return null;

    const parts = [];
    if (summary?.length) {
        const shown = summary.slice(0, MAX_LISTED_LOS).map(lo =>
            `${lo.loName || 'Unknown LO'} (${lo.groups.map(g => g.groupName).join(', ')})`
        );
        const rest = summary.length - MAX_LISTED_LOS;
        parts.push(`Close these Loan Officers' transactions first: ${shown.join('; ')}${rest > 0 ? ` and ${rest} more` : ''}.`);
    }
    if (emptyGroups?.length) {
        const names = [...new Set(emptyGroups.map(g => g.groupName))].slice(0, MAX_LISTED_LOS).join(', ');
        parts.push(`Also still open with no active clients (ask an admin): ${names}.`);
    }
    return parts.join(' ');
};