// src/lib/clients/save-client-partial.js
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

/**
 * Safely apply a PARTIAL update to a client record.
 *
 * Why this exists: `clients/` PUT does not reliably merge partial payloads
 * with the existing DB record — ClientQuickEditModal.js sent only
 * { _id, duplicate, groupLeader } on the assumption the backend would
 * fetch-and-merge, and it instead nulled out firstName/lastName/loId/
 * groupId/branchId on both offset AND prospect clients. Until the
 * `clients/` endpoint itself is confirmed and fixed to merge properly,
 * every "just update this one field" call must go through here instead
 * of calling fetchWrapper.sendData('clients/', partialObject) directly.
 *
 * This fetches the CURRENT full record server-side, merges `changes` on
 * top of it, and sends the complete object — so missing fields can never
 * be silently dropped, regardless of how the backend handles the request.
 *
 * NOTE: this only prevents FUTURE nulling. Records already corrupted by
 * the bug (firstName/lastName already null in the DB) need a separate
 * data-repair pass — this utility can't recover data that's already gone.
 */
export async function saveClientPartial(clientId, changes) {
    if (!clientId) {
        return { success: false, message: 'clientId is required.' };
    }

    // ASSUMPTION FLAGGED: I don't have confirmed knowledge of a single-client
    // GET-by-id route. I'm assuming `clients?_id=X` based on the pattern used
    // for users (`settings/users/[uuid].js` uses `users?` + `_id`). If clients
    // doesn't expose an equivalent single-record GET, tell me the correct
    // endpoint (or point me at the routes file) and I'll fix this one call.
    const existingRes = await fetchWrapper.get(
        getApiBaseUrl() + 'clients?' + new URLSearchParams({ _id: clientId })
    );

    if (!existingRes.success || !existingRes.client) {
        return { success: false, message: existingRes.message || 'Could not load current client record before saving.' };
    }

    const existing = { ...existingRes.client };
    // Strip relational fields the update endpoint doesn't expect back as
    // input — same fields every existing caller already knew to delete.
    delete existing.group;
    delete existing.loans;
    delete existing.lo;

    const merged = { ...existing, ...changes, _id: clientId };

    return fetchWrapper.sendData(getApiBaseUrl() + 'clients/', merged);
}