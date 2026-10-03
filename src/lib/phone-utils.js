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

// A genuine PH mobile number, post-normalization: +63 followed by 9, then 9
// more digits (12 digits total after the +). This is the check that was
// missing everywhere normalizePhone() got called on unvalidated data — a
// placeholder value like "NA" has no digits at all, normalizes to the
// garbage value "+", and nothing before this ever caught that. Always
// validate the RAW input, not the normalized output — normalizing garbage
// first can make it look closer to valid than it is.
export function isValidPhilippineMobile(raw) {
    const normalized = normalizePhone(raw);
    return /^\+639\d{9}$/.test(normalized);
}