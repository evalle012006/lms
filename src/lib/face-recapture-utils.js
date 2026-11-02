// Shared by client and server (imports only the pure ci-roles helpers).
import { canDecideCI } from '@/lib/ci-roles';

// admin, deputy_director, regional_manager, area_admin, branch_manager (role.shortCode) — same set as CI decisions
export const canApproveFaceRecapture = canDecideCI;

export const MIN_MISMATCHES_FOR_RECAPTURE = 2;   // logged mismatches before re-enroll unlocks
export const MAX_RECAPTURES_PER_LOAN      = 2;
export const MIN_RECAPTURE_REASON_LENGTH  = 10;
export const FACE_MATCH_THRESHOLD         = 0.5; // keep in sync with FaceVerifyStep

// UI gate for the "Re-enroll" button (FaceVerifyStep) — lives here so it is unit-testable
export const getRecaptureState = ({ enabled, mismatchCount = 0, canRecapture = false }) => {
    if (!enabled) return null;
    if (mismatchCount < MIN_MISMATCHES_FOR_RECAPTURE) return 'locked';
    if (!canRecapture) return 'no_permission';
    return 'available';
};

// Untrusted client values -> safe DB values
export const sanitizeLiveness = (v) =>
    (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

// ISO timestamps within ±1 day of the server clock are kept; anything else becomes server "now"
export const sanitizeEnrolledAt = (value, nowMs = Date.now()) => {
    const fallback = new Date(nowMs).toISOString();
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return fallback;
    const t = Date.parse(value);
    if (!Number.isFinite(t) || Math.abs(t - nowMs) > 24 * 60 * 60 * 1000) return fallback;
    return new Date(t).toISOString();
};