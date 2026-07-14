// src/lib/closing-documents.constants.js

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