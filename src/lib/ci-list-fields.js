// src/lib/ci-list-fields.js
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';

const toFieldList = f => (Array.isArray(f) ? f : String(f).split(/\s+/).filter(Boolean));

const BIOMETRIC_FIELDS = [
    'faceTemplate', 'biometricCredentialId', 'biometricPublicKey',
    'biometricCounter', 'biometricRegisteredAt', 'biometricDeviceName',
];

const build = (hidden) => {
    const h = new Set(hidden);
    return toFieldList(TEMP_LOAN_APP_FIELDS).filter(f => !h.has(f)).join(' ');
};

// CI applications list: no biometrics, no ID number
export const TEMP_LOAN_APP_LIST_FIELDS  = build([...BIOMETRIC_FIELDS, 'governmentIdNumber']);
// Duplicate queue: no biometrics, ID number kept for the reviewer
export const TEMP_LOAN_APP_QUEUE_FIELDS = build(BIOMETRIC_FIELDS);