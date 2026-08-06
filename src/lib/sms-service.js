// src/lib/sms-service.js
// SMS notifications via Semaphore (https://semaphore.co) — Philippine SMS provider.
// Set in .env:
//   SEMAPHORE_API_KEY=your_api_key
//   SEMAPHORE_SENDER_NAME=AmberCash   (max 11 chars, alphanumeric, registered with Semaphore)
//   SMS_ENABLED=true
//
// All functions are non-blocking — failures never crash the calling API.
// Always wrap call sites in try/catch and log errors without rethrowing.

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages';

/**
 * Send a single SMS via Semaphore.
 * @param {string} to   - Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX)
 * @param {string} body - Message body (max 160 chars per segment)
 * @returns {Promise<boolean>} true if sent, false on failure
 */
// SMS enabled check — reads from DB settings (same pattern as isNotificationEnabled)
// Cached for 60s to avoid a DB hit on every SMS
let _smsEnabledCache = null;
let _smsEnabledAt    = 0;
async function isSMSEnabled() {
    // Always respect the env var kill-switch first (fastest check, no DB)
    if (process.env.SMS_ENABLED === 'false') return false;

    // Cache the DB result for 60 seconds
    if (_smsEnabledCache !== null && Date.now() - _smsEnabledAt < 60_000) {
        return _smsEnabledCache;
    }
    try {
        const { GraphProvider }          = await import('@/lib/graph/graph.provider');
        const { createGraphType, queryQl } = await import('@/lib/graph/graph.util');
        const graph    = new GraphProvider();
        const TYPE     = createGraphType('settings', 'smsEnabled')('settings');
        const settings = await graph.query(queryQl(TYPE, {}))
            .then(r => r.data?.settings?.[0]);
        _smsEnabledCache = settings?.smsEnabled === true;
        _smsEnabledAt    = Date.now();
    } catch {
        // Fallback to env var if DB unreachable
        _smsEnabledCache = process.env.SMS_ENABLED === 'true';
        _smsEnabledAt    = Date.now();
    }
    return _smsEnabledCache;
}

async function sendSMS(to, body) {
    const apiKey     = process.env.SEMAPHORE_API_KEY;
    const senderName = process.env.SEMAPHORE_SENDER_NAME || 'AmberCash';
    const enabled    = await isSMSEnabled();

    if (!enabled) {
        console.log('[SMS] Disabled. Would have sent to:', to, '|', body);
        return false;
    }
    if (!apiKey) {
        console.error('[SMS] SEMAPHORE_API_KEY not set.');
        return false;
    }

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
            console.log('[SMS] Queued to:', normalized, 'id:', data[0].message_id);
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

// ── Message templates ─────────────────────────────────────────────────────

/**
 * SMS on LAF form submission (sent to applicant)
 */
export async function sendLAFSubmittedSMS({ contactNumber, firstName, ciReferenceCode, branchName }) {
    const msg =
        `Hello ${firstName}! Your loan application at AmberCash ${branchName} has been received. ` +
        `Reference code: ${ciReferenceCode}. We will contact you after the credit investigation. ` +
        `Thank you!`;
    return sendSMS(contactNumber, msg);
}

/**
 * SMS on CI approved
 */
export async function sendCIApprovedSMS({ contactNumber, firstName, ciReferenceCode, branchName }) {
    const msg =
        `Hello ${firstName}! Your loan application (${ciReferenceCode}) at AmberCash ${branchName} ` +
        `has been APPROVED by our credit team. Your Loan Officer will contact you for the next steps. ` +
        `Thank you!`;
    return sendSMS(contactNumber, msg);
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
    return sendSMS(contactNumber, msg);
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
    return sendSMS(contactNumber, msg);
}