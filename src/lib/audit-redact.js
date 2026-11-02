// Keeps biometric templates and huge base64 blobs out of audit_logs (before/after/metadata).
// Photo KEYS are kept — they are the useful part of a snapshot and are not biometric data.
export const REDACTED = '[redacted]';
const BIOMETRIC_KEYS = new Set(['faceTemplate', 'face_template', 'biometricPublicKey']);
const MAX_STRING = 5000;
const MAX_DEPTH = 8;

export function redactBiometrics(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        return value.length > MAX_STRING ? `[truncated ${value.length} chars]` : value;
    }
    if (typeof value !== 'object' || value instanceof Date) return value;
    if (depth > MAX_DEPTH) return '[max depth]';
    if (Array.isArray(value)) return value.map((v) => redactBiometrics(v, depth + 1));
    return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
            k,
            BIOMETRIC_KEYS.has(k) && v != null ? REDACTED : redactBiometrics(v, depth + 1),
        ])
    );
}