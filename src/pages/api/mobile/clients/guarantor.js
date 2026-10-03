import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { GUARANTOR_MOBILE_FIELDS } from '@/lib/mobile-graph.fields';

const graph = new GraphProvider();

const LAF_TYPE = createGraphType('temporaryLoanApplications', `
  ${GUARANTOR_MOBILE_FIELDS}
`)('temporaryLoanApplications');

const CI_TYPE = createGraphType('ciInvestigations', `_id tempApplicationId investigatedAt`)('ciInvestigations');

export default clientApiHandler({ get: getGuarantor });

async function getGuarantor(req, res) {
    try {
        const { clientId } = req.auth;

        const applications = await graph.query(
            queryQl(LAF_TYPE, {
                where: { _or: [{ existingClientId: { _eq: clientId } }, { promotedClientId: { _eq: clientId } }] },
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        if (!applications.length) {
            return res.status(200).json({ success: true, data: null });
        }

        const applicationIds = applications.map(a => a._id);

        const [latestApproved] = await graph.query(
            queryQl(CI_TYPE, {
                where: { tempApplicationId: { _in: applicationIds }, decision: { _eq: 'approved' } },
                order_by: [{ investigatedAt: 'desc' }],
                limit: 1,
            })
        ).then(r => r.data?.ciInvestigations ?? []);

        if (!latestApproved) {
            return res.status(200).json({ success: true, data: null });
        }

        const linkedApplication = applications.find(a => a._id === latestApproved.tempApplicationId);

        if (!linkedApplication?.guarantorFirstName) {
            return res.status(200).json({ success: true, data: null });
        }

        return res.status(200).json({
            success: true,
            data: {
                firstName: linkedApplication.guarantorFirstName,
                lastName: linkedApplication.guarantorLastName,
                relationship: linkedApplication.guarantorRelationship,
            },
        });

    } catch (error) {
        console.error('mobile guarantor error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load guarantor info' });
    }
}