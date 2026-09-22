import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { LAF_MOBILE_FIELDS, CI_INVESTIGATION_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const LAF_TYPE = createGraphType('temporaryLoanApplications', `
  ${LAF_MOBILE_FIELDS}
`)('temporaryLoanApplications');

// ciInvestigations links to a LAF application via tempApplicationId, not
// directly to a client — there is no client_id on this table at all.
const CI_TYPE = createGraphType('ciInvestigations', `
  ${CI_INVESTIGATION_MOBILE_FIELDS}
`)('ciInvestigations');

export default clientApiHandler({
    get: listLaf
});

async function listLaf(req, res) {
    try {
        const { clientId } = req.auth;

        // existingClientId links a re-loan application submitted by someone
        // who already had a client record; promotedClientId links a
        // first-time/prospect application, set once that application is
        // approved and promoted into a real client record. An authenticated
        // client could match either depending on which they were when they
        // applied, so check both.
        const applications = await graph.query(
            queryQl(LAF_TYPE, {
                where: { _or: [{ existingClientId: { _eq: clientId } }, { promotedClientId: { _eq: clientId } }] },
                order_by: [{ submittedAt: 'desc' }],
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        const applicationIds = applications.map(a => a._id);

        const investigations = applicationIds.length
            ? await graph.query(
                queryQl(CI_TYPE, {
                    where: { tempApplicationId: { _in: applicationIds } },
                    order_by: [{ investigatedAt: 'desc' }],
                })
              ).then(r => r.data?.ciInvestigations ?? [])
            : [];

        return res.status(200).json({ success: true, data: applications, investigations });

    } catch (error) {
        console.error('mobile LAF status error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load application status' });
    }
}