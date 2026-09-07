// src/pages/api/v2/laf/ci/investigate.js
// FIX: guard against re-saving a CI decision once the application has
//   already been promoted. Previously, insertQl's on_conflict upsert would
//   silently accept a new decision and overwrite temporaryLoanApplications.status
//   (ci_approved <-> ci_declined) even after promote/[refCode].js had already
//   claimed the row and created a client — leaving contradictory records where
//   status says "ci_declined" but promotedClientId/promotedAt are still populated
//   from the earlier approval. Now rejected outright before any write happens.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { CI_INVESTIGATION_FIELDS, TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions'; // ← ADD THIS
import moment from 'moment';
import { sendCIApprovedSMS, sendCIDeclinedSMS } from '@/lib/sms-service';
import { getCurrentDateV2, getSystemDate } from '@/lib/date-utils';

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
        decision, declineReason, selfieKey, ciAnswers,
        groupLeader,
    } = req.body;

    if (decision === 'approved' && !selfieKey) {
        return res.status(200).json({
            success: false,
            message: 'A selfie photo is required when approving an application.'
        });
    }

    // ── FIX: block re-investigation of an already-promoted application ─────
    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }

    if (application.status === 'promoted') {
        return res.status(200).json({
            success: false,
            message: 'This application has already been promoted to a client record. ' +
                'The investigation decision cannot be changed. Contact an administrator ' +
                'if this client record needs correction.',
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
                investigatedAt: getSystemDate().toISOString(),
                ciAnswers: Array.isArray(req.body.ciAnswers) ? req.body.ciAnswers : [],
                dateAdded:      getCurrentDateV2(),
                insertedBy:     userId,
            }],
            on_conflict: {
                constraint: 'ix_ciInv__ciRef_unique',
                update_columns: [
                    'findings', 'businessVerified', 'addressVerified',
                    'decision', 'declineReason', 'selfieKey',
                    'picUserId', 'picUserName', 'investigatedAt',
                    'ciAnswers',
                ],
            }
        })
    ).then(r => r.data?.ciInvestigations?.returning ?? []);

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            set: {
                status: decision === 'approved' ? 'ci_approved' : 'ci_declined',
                groupLeader: !!groupLeader,
            },
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
        })
    );

    // Send SMS notification — non-blocking
    try {
        const appData = await graph.query(
            queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
        ).then(r => r.data?.temporaryLoanApplications?.[0]);

        if (appData?.contactNumber) {
            const smsFn = decision === 'approved' ? sendCIApprovedSMS : sendCIDeclinedSMS;
            await smsFn({
                contactNumber:   appData.contactNumber,
                firstName:       appData.firstName,
                ciReferenceCode: ciReferenceCode,
                branchName:      appData.branchName || 'our branch',
                reason:          decision === 'declined' ? declineReason : undefined,
            });
        }
    } catch (smsErr) {
        console.error('[CI investigate] SMS error:', smsErr.message);
    }

    res.status(200).json({ success: true, investigation: saved });
}