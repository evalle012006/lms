// src/lib/phone-utils.js
//
// Every place that reads or writes a phone number against client_accounts,
// client_otp_codes, or client_enrollment_requests MUST normalize through
// this first. Two different raw formats for the same real number (e.g.
// "09171234567" vs "+639171234567") look identical to a human but fail an
// exact-match SQL lookup silently — that's what caused "No account found"
// after staff activation, because approve.js stored client.contactNumber
// verbatim instead of normalizing it the same way request-otp.js does.

export function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('63')) return `+${digits}`;
    if (digits.startsWith('09')) return `+63${digits.slice(1)}`;
    return `+${digits}`;
}