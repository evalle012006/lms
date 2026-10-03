// src/lib/validation-utils.js
//
// A truthiness check (`if (!value)`) only catches null/undefined/empty
// string — it does NOT catch placeholder garbage like "NA", "N/A", "-",
// "none", or "TBD" that some legacy records have in place of real data.
// That gap is exactly what let a client with contactNumber === "NA" get
// mobile access activated with a broken, unusable login identifier.

const PLACEHOLDER_VALUES = new Set([
    'na', 'n/a', 'none', 'nil', 'n.a', 'n.a.', '-', '--', 'tbd', 'pending', 'unknown', '.',
]);

export function isPlaceholderValue(raw) {
    if (raw == null) return true;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized.length === 0) return true;
    return PLACEHOLDER_VALUES.has(normalized);
}

// Government ID numbers vary too much in format by ID type (UMID, PhilID,
// driver's license, etc.) to validate a specific pattern — this only
// catches placeholder garbage and unreasonably short values, not a real
// format check.
export function isValidGovernmentId(raw) {
    if (isPlaceholderValue(raw)) return false;
    return String(raw).trim().length >= 4;
}