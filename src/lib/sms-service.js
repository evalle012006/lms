// src/lib/sms-service.js
// SMS notifications via Semaphore (https://semaphore.co) — Philippine SMS provider.
//
// Three-tier settings, all in the DB `settings` table (Settings > SMS panel):
//   smsEnabled          — MASTER switch. Off means nothing sends, full stop,
//                          regardless of the two switches below.
//   smsNotificationsEnabled / smsOtpEnabled
//                        — sub-switches, each only meaningful when the master
//                          is on. This split exists because OTP is
//                          authentication-critical (mobile app login) while
//                          notifications (LAF/CI/loan-release texts) are
//                          informational — turning off one must never turn
//                          off the other. Before this split, a single
//                          smsEnabled flag gated both, so disabling
//                          notification noise would have silently broken
//                          mobile login too.
//
// Sender name resolves per category with fallback:
//   smsNotificationsSenderName / smsOtpSenderName (if set)
//     → smsSenderName (the shared default, if set)
//     → SEMAPHORE_SENDER_NAME env var
//     → 'AmberCash'
//
// Env vars still required:
//   SEMAPHORE_API_KEY=your_api_key
//   SEMAPHORE_SENDER_NAME=AmberCash   (fallback default; the DB settings above take priority)
//   SMS_ENABLED=true                 (fallback if the DB is unreachable — see isSMSEnabled)
//
// All functions are non-blocking — failures never crash the calling API.
// Always wrap call sites in try/catch and log errors without rethrowing.

const SEMAPHORE_URL = process.env.SMS_API_URL || 'https://api.semaphore.co/api/v4/messages';

// Cached for 60s to avoid a DB hit on every SMS — one cache entry covers
// the master flag, both sub-flags, and all three sender names together,
// since they're always fetched in the same query.
let _settingsCache = null;
let _settingsAt    = 0;

async function getSMSSettings() {
    if (_settingsCache !== null && Date.now() - _settingsAt < 60_000) {
        return _settingsCache;
    }
    try {
        const { GraphProvider }            = await import('@/lib/graph/graph.provider');
        const { createGraphType, queryQl } = await import('@/lib/graph/graph.util');
        const graph = new GraphProvider();
        const TYPE  = createGraphType('settings', `
            smsEnabled
            smsSenderName
            smsNotificationsEnabled
            smsNotificationsSenderName
            smsOtpEnabled
            smsOtpSenderName
        `)('settings');
        const settings = await graph.query(queryQl(TYPE, {})).then(r => r.data?.settings?.[0]);

        _settingsCache = {
            enabled:                    settings?.smsEnabled === true,
            senderName:                 settings?.smsSenderName || null,
            notificationsEnabled:       settings?.smsNotificationsEnabled !== false, // defaults true
            notificationsSenderName:    settings?.smsNotificationsSenderName || null,
            otpEnabled:                 settings?.smsOtpEnabled !== false, // defaults true
            otpSenderName:              settings?.smsOtpSenderName || null,
        };
        _settingsAt = Date.now();
    } catch {
        // DB unreachable — fall back to the env var kill-switch only, both
        // sub-categories open (matches historical single-flag behavior),
        // no per-category sender name overrides available in this path.
        _settingsCache = {
            enabled: process.env.SMS_ENABLED === 'true',
            senderName: null,
            notificationsEnabled: true,
            notificationsSenderName: null,
            otpEnabled: true,
            otpSenderName: null,
        };
        _settingsAt = Date.now();
    }
    return _settingsCache;
}

// Kept for any external code still importing this directly — now just the
// master-switch view of getSMSSettings().
async function isSMSEnabled() {
    if (process.env.SMS_ENABLED === 'false') return false; // env kill-switch always wins
    const settings = await getSMSSettings();
    return settings.enabled;
}

async function isCategoryEnabled(category) {
    if (process.env.SMS_ENABLED === 'false') return false;
    const settings = await getSMSSettings();
    if (!settings.enabled) return false;
    return category === 'otp' ? settings.otpEnabled : settings.notificationsEnabled;
}

async function resolveSenderName(category) {
    const settings = await getSMSSettings();
    const categoryOverride = category === 'otp' ? settings.otpSenderName : settings.notificationsSenderName;
    return categoryOverride || settings.senderName || process.env.SEMAPHORE_SENDER_NAME || 'AmberCash';
}

/**
 * Send a single SMS via Semaphore.
 * @param {string} to       - Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)
 * @param {string} body     - Message body (max 160 chars per segment)
 * @param {'notification'|'otp'} category - which enablement/sender-name pair governs this send
 * @returns {Promise<boolean>} true if sent, false on failure
 */
async function sendSMS(to, body, category = 'notification') {
    const apiKey  = process.env.SEMAPHORE_API_KEY;
    const enabled = await isCategoryEnabled(category);

    if (!enabled) {
        console.log(`[SMS:${category}] Disabled. Would have sent to:`, to, '|', body);
        return false;
    }
    if (!apiKey) {
        console.error('[SMS] SEMAPHORE_API_KEY not set.');
        return false;
    }

    const senderName = await resolveSenderName(category);

    // Normalize PH number — Semaphore accepts 09XXXXXXXXX or +639XXXXXXXXX
    const normalized = normalizePhone(to);
    if (!normalized) {
        console.error('[SMS] Invalid phone number:', to);
        return false;
    }

    try {
        const res = await fetch(SEMAPHORE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                apikey:      apiKey,
                number:      normalized,
                message:     body.slice(0, 480),  // max 3 segments
                sendername:  senderName,
            }).toString(),
        });

        const data = await res.json();
        if (data?.[0]?.status === 'Queued' || data?.[0]?.status === 'Sent') {
            console.log(`[SMS:${category}] Queued to:`, normalized, 'id:', data[0].message_id);
            return true;
        }
        console.warn('[SMS] Unexpected response:', JSON.stringify(data));
        return false;
    } catch (err) {
        console.error('[SMS] Send failed:', err.message);
        return false;
    }
}

/**
 * Normalize Philippine mobile numbers.
 * Accepts: 09171234567, +639171234567, 9171234567
 * Returns: 09171234567 (Semaphore format) or null if invalid
 */
function normalizePhone(raw) {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('639') && digits.length === 12) return '0' + digits.slice(2);
    if (digits.startsWith('09')  && digits.length === 11) return digits;
    if (digits.startsWith('9')   && digits.length === 10) return '0' + digits;
    return null;
}

// ── Message templates — notification category ─────────────────────────────

/**
 * SMS on LAF form submission (sent to applicant)
 */
export async function sendLAFSubmittedSMS({ contactNumber, firstName, ciReferenceCode, branchName }) {
    const msg =
        `Hello ${firstName}! Your loan application at AmberCash ${branchName} has been received. ` +
        `Reference code: ${ciReferenceCode}. We will contact you after the credit investigation. ` +
        `Thank you!`;
    return sendSMS(contactNumber, msg, 'notification');
}

/**
 * SMS on CI approved
 */
export async function sendCIApprovedSMS({ contactNumber, firstName, ciReferenceCode, branchName }) {
    const msg =
        `Hello ${firstName}! Your loan application (${ciReferenceCode}) at AmberCash ${branchName} ` +
        `has been APPROVED by our credit team. Your Loan Officer will contact you for the next steps. ` +
        `Thank you!`;
    return sendSMS(contactNumber, msg, 'notification');
}

/**
 * SMS on CI declined
 */
export async function sendCIDeclinedSMS({ contactNumber, firstName, ciReferenceCode, branchName, reason }) {
    const msg =
        `Hello ${firstName}. We regret to inform you that your loan application (${ciReferenceCode}) ` +
        `at AmberCash ${branchName} has been DECLINED. ` +
        (reason ? `Reason: ${reason}. ` : '') +
        `For questions, please visit your branch. Thank you.`;
    return sendSMS(contactNumber, msg, 'notification');
}

/**
 * SMS on loan disbursement / LDF approval (sent to client)
 */
export async function sendLoanReleasedSMS({ contactNumber, firstName, amountRelease, loanCycle, branchName }) {
    const amount = Number(amountRelease || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    const msg =
        `Hello ${firstName}! Your AmberCash ${branchName} loan of ₱${amount} ` +
        `(Cycle ${loanCycle}) has been released. ` +
        `Please check your passbook for details. Thank you for trusting AmberCash!`;
    return sendSMS(contactNumber, msg, 'notification');
}

/**
 * SMS when staff directly activates mobile app access, or a self-registration
 * gets approved. Informational, not a verification code — notification category.
 */
export async function sendMobileAccessActivatedSMS({ contactNumber, firstName }) {
    return sendSMS(contactNumber, `Hi ${firstName}, your AmberCash mobile app access is now active. Download the app and log in using this number to view your account.`, 'notification');
}

/**
 * SMS when a client becomes newly eligible for mobile self-enrollment
 * (loan approved). Informational, not a verification code — notification category.
 */
export async function sendMobileAppEligibleSMS({ contactNumber, firstName }) {
    return sendSMS(contactNumber, `Hi ${firstName}, congratulations on your approved loan! You can now download the AmberCash app and log in with this number to view your account, loans, and payment history.`, 'notification');
}

// ── Message templates — OTP category ───────────────────────────────────────

/**
 * The actual mobile app login/enrollment verification code. Kept on its own
 * category specifically so it can never be disabled as a side effect of
 * someone turning off general notification SMS.
 */
export async function sendClientOTPSMS({ contactNumber, code }) {
    return sendSMS(contactNumber, `Your AmberCash app verification code is ${code}. It expires in 5 minutes. Do not share this code with anyone.`, 'otp');
}