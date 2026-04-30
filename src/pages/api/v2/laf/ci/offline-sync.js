import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CI_INVESTIGATION_FIELDS, TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import moment from 'moment';

const graph = new GraphProvider();
const CI_TYPE   = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: syncOfflineDrafts });

async function syncOfflineDrafts(req, res) {
    const currentUser = req.auth;
    const { drafts } = req.body;

    if (!Array.isArray(drafts) || drafts.length === 0) {
        return res.status(200).json({ success: false, message: 'No drafts provided.' });
    }

    const user = await findUserById(currentUser.sub);

    const results = [];

    for (const draft of drafts) {
        try {
            const {
                ciReferenceCode, tempApplicationId,
                findings, businessVerified, addressVerified,
                decision, declineReason, selfieKey,
            } = draft;

            if (decision === 'approved' && !selfieKey) {
                results.push({
                    ciReferenceCode,
                    success: false,
                    error: 'Selfie required for approval — skipped.',
                });
                continue;
            }

            await graph.mutation(
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
                        picUserId:     decision === 'approved' ? currentUser.sub : null,
                        picUserName: decision === 'approved'
                            ? `${user?.firstName} ${user?.lastName}` : null,
                        offlinePayload: draft,
                        syncedAt:        new Date().toISOString(),
                        investigatedAt:  draft.investigatedAt || new Date().toISOString(),
                        dateAdded:       moment().format('YYYY-MM-DD'),
                        insertedBy:      currentUser.sub,
                    }],
                    on_conflict: {
                        constraint: 'ix_ciInv__ciRef_unique',
                        update_columns: [
                            'findings', 'businessVerified', 'addressVerified',
                            'decision', 'declineReason', 'selfieKey',
                            'picUserId', 'picUserName', 'syncedAt', 'investigatedAt',
                            'offlinePayload',
                        ],
                    }
                })
            );

            const newStatus = decision === 'approved' ? 'ci_approved' : 'ci_declined';
            await graph.mutation(
                updateQl(TEMP_TYPE, {
                    set: { status: newStatus },
                    where: { ciReferenceCode: { _eq: ciReferenceCode } },
                })
            );

            results.push({ ciReferenceCode, success: true });
        } catch (err) {
            results.push({
                ciReferenceCode: draft.ciReferenceCode,
                success: false,
                error: err.message,
            });
        }
    }

    res.status(200).json({ success: true, results });
}