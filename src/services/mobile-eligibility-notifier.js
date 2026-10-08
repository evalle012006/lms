// src/services/mobile-eligibility-notifier.js
//
// Import this in approve-by-batch.js:
//   import { notifyMobileAppEligibility } from '@/services/mobile-eligibility-notifier';

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { sendMobileAppEligibleSMS } from '@/lib/sms-service';

const graph = new GraphProvider();

const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `_id status`)('client_accounts');

export async function notifyMobileAppEligibility({ clientId, contactNumber, firstName }) {
    // Don't notify someone who already registered (or is already pending/
    // suspended) — this is specifically for clients who have never touched
    // mobile access at all.
    const [existing] = await graph.query(
        queryQl(CLIENT_ACCOUNT_TYPE, { where: { client_id: { _eq: clientId } } })
    ).then(r => r.data?.client_accounts ?? []);

    if (existing) return;

    await sendMobileAppEligibleSMS({ contactNumber, firstName: firstName || 'there' });
}