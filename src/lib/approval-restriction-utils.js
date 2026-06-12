import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Manila';

/**
 * Returns true if the approval action is currently blocked by the cutoff restriction.
 */
export function isApprovalBlocked(enabled, cutoffTime) {
    if (!enabled) return false;
    if (!cutoffTime) return false;

    const now = moment().tz(TIMEZONE);
    const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
    const cutoff = now.clone().startOf('day').add(cutoffHour, 'hours').add(cutoffMinute, 'minutes');

    return now.isAfter(cutoff);
}

/**
 * Returns a human-readable message for the banner.
 */
export function approvalBlockedMessage(type, cutoffTime) {
    return `${type} approval is no longer allowed after ${cutoffTime}. Please process approvals before the cutoff time.`;
}