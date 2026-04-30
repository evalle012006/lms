import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CI_INVESTIGATION_FIELDS, TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions'; // ← ADD THIS
import moment from 'moment';

const graph = new GraphProvider();
const CI_TYPE   = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: saveInvestigation });

async function saveInvestigation(req, res) {
    const userId = req.auth.sub; // ← only sub is available from JWT

    // ── Fetch actual user record to get firstName/lastName ────────────────
    const user = await findUserById(userId);
    if (!user) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    const {
        ciReferenceCode, tempApplicationId,
        findings, businessVerified, addressVerified,
        decision, declineReason, selfieKey,
    } = req.body;

    if (decision === 'approved' && !selfieKey) {
        return res.status(200).json({
            success: false,
            message: 'A selfie photo is required when approving an application.'
        });
    }

    const picUserName = `${user.firstName} ${user.lastName}`;

    const [saved] = await graph.mutation(
        insertQl(CI_TYPE, {
            objects: [{
                _id: generateUUID(),
                ciReferenceCode,
                tempApplicationId,
                findings,
                businessVerified: !!businessVerified,
                addressVerified:  !!addressVerified,
                decision,
                declineReason: decision === 'declined' ? declineReason : null,
                selfieKey:     decision === 'approved' ? selfieKey : null,
                picUserId:     decision === 'approved' ? userId : null,
                picUserName:   decision === 'approved' ? picUserName : null, // ← real name
                investigatedAt: new Date().toISOString(),
                dateAdded:      moment().format('YYYY-MM-DD'),
                insertedBy:     userId,
            }],
            on_conflict: {
                constraint: 'ix_ciInv__ciRef_unique',
                update_columns: [
                    'findings', 'businessVerified', 'addressVerified',
                    'decision', 'declineReason', 'selfieKey',
                    'picUserId', 'picUserName', 'investigatedAt',
                ],
            }
        })
    ).then(r => r.data?.ciInvestigations?.returning ?? []);

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            set: { status: decision === 'approved' ? 'ci_approved' : 'ci_declined' },
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
        })
    );

    res.status(200).json({ success: true, investigation: saved });
}