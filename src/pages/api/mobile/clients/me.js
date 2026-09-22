import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { CLIENT_PROFILE_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

// NOTE: 'client' is the real table/query-root name (singular), but every
// existing usage in this codebase aliases it to 'clients' and reads the
// response back under that plural key — matching that convention here
// rather than introducing a one-off 'client' key that would be inconsistent
// with the rest of the codebase (see by-ids.js, close-account.js).
const CLIENT_TYPE = createGraphType('client', `
  ${CLIENT_PROFILE_MOBILE_FIELDS}
`)('clients');

export default clientApiHandler({
    get: getProfile
});

async function getProfile(req, res) {
    try {
        // req.auth.clientId comes from the verified JWT (client-jwt-middleware.js).
        // Never read an id from req.query here — this is the exact pattern the
        // staff get-payment-history.js endpoint gets wrong.
        const { clientId } = req.auth;

        const [client] = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients ?? []);

        if (!client) {
            return res.status(404).json({ success: false, message: 'Client record not found' });
        }

        return res.status(200).json({ success: true, data: client });

    } catch (error) {
        console.error('mobile client profile error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
}