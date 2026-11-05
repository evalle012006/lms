// Shared by client and server. Offline mode is ON only while the flag is set AND its expiry is in the
// future. No expiry = treated as expired (fail closed), so it can never stay on indefinitely.
export const OFFLINE_MODE_DEFAULT_DAYS = 7;
export const OFFLINE_MODE_MAX_DAYS = 30;

export function isOfflineModeActive(branch, now = new Date()) {
    if (branch?.skipClientFaceVerify !== true) return false;
    const until = branch.skipClientFaceVerifyUntil;
    if (!until) return false;
    const t = Date.parse(until);
    return Number.isFinite(t) && t > now.getTime();
}