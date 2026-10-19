// src/lib/qr-scan.js
// Turns whatever a QR scan produced into something the Loan Application filters
// understand. The two QR codes staff meet in this app are both URLs:
//
//   client collection QR   {origin}/transactions/cash-collection/qr-collect/{qrToken}
//                          (ClientQRIconPopover / ClientQRModal)
//   CI reference QR        {origin}/laf/{ciReferenceCode}
//                          (LAFSuccessScreen), code shape CI-{branch}-{date}-{suffix}
//
// A hardware scanner types the decoded text into the focused field; the camera
// scanner hands it over directly. Either way it arrives here.
//
// Pure and side-effect free: it never fetches, navigates or stores anything.
// Note a client QR's token is a credential for the collection flow, so callers
// should keep it out of query strings and logs (see resolve-client-qr.js).

const CLIENT_QR_PATH = /^\/transactions\/cash-collection\/qr-collect\/([^/]+)\/?$/i;
const CI_QR_PATH = /^\/laf\/([^/]+)\/?$/i;
const CI_CODE = /^CI-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i;

export const looksLikeUrl = (value) => /^https?:\/\//i.test(String(value ?? '').trim());

function safeDecode(part) {
    try {
        return decodeURIComponent(part);
    } catch (e) {
        return part;
    }
}

/**
 * @returns {{ type: 'client' | 'ci' | 'unknown', value: string }}
 *   client  -> value is the client's QR token
 *   ci      -> value is the CI reference code, upper-cased
 *   unknown -> value is the trimmed text (a plain name, or a plain code typed by hand)
 */
export function parseScannedCode(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return { type: 'unknown', value: '' };

    if (looksLikeUrl(text)) {
        let pathname;
        try {
            pathname = new URL(text).pathname;
        } catch (e) {
            return { type: 'unknown', value: text };
        }

        const client = CLIENT_QR_PATH.exec(pathname);
        if (client) return { type: 'client', value: safeDecode(client[1]) };

        const ci = CI_QR_PATH.exec(pathname);
        if (ci) {
            const code = safeDecode(ci[1]).toUpperCase();
            // A half-typed URL from a scanner ("…/laf/CI-B2") is not a code yet.
            if (CI_CODE.test(code)) return { type: 'ci', value: code };
        }
        return { type: 'unknown', value: text };
    }

    if (CI_CODE.test(text)) return { type: 'ci', value: text.toUpperCase() };
    return { type: 'unknown', value: text };
}

/**
 * What the user is looking for when a scan is driving the filters, for the empty
 * state: a scanned client, or a CI reference code. null when neither applies.
 */
export function describeScanFilter({ clientId, clientLabel, ciReference } = {}) {
    if (clientId) return { kind: 'client', label: clientLabel || 'This client' };
    const parsed = parseScannedCode(ciReference);
    return parsed.type === 'ci' ? { kind: 'ci', label: parsed.value } : null;
}

/**
 * The other counted tabs that hold at least one match, so an empty tab can point
 * to where the loan actually is. History is not counted (it is one month at a time).
 */
export function otherTabsWithMatches(tabs, tabCounts, activeTab) {
    return tabs
        .filter((t) => t.counted && t.key !== activeTab && (tabCounts?.[t.key]?.count ?? 0) > 0)
        .map((t) => ({ key: t.key, label: t.label, count: tabCounts[t.key].count }));
}