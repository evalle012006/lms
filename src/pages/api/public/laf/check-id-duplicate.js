// src/pages/api/public/laf/check-id-duplicate.js
// GET ?idType=xxx&idNumber=xxx&qrToken=xxx&groupId=xxx[&existingClientId=xxx]
// Checks government ID uniqueness in clients and the active LAF pipeline.
// Public (x-laf-api-key) AND requires the group's current QR token.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';
import { resolveGroupFromQr }        from '@/lib/laf/qr-gate';
import { escapeLike }                from '@/lib/validation-utils';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `_id status`)('clients');
const TEMP_TYPE   = createGraphType('temporaryLoanApplications', `_id status`)('temporaryLoanApplications');

const ACTIVE_LAF_STATUSES = ['pending', 'ci_approved', 'pending_validation'];

export default publicApiHandler({ get: checkIdDuplicate });

async function checkIdDuplicate(req, res) {
    const { idType, idNumber, existingClientId, qrToken, groupId } = req.query;

    if (typeof idType !== 'string' || typeof idNumber !== 'string' || !idType || !idNumber.trim()) {
        return res.status(200).json({ success: true, isDuplicate: false });
    }

    // Only a holder of a valid group QR may ask "is this ID registered?"; submit.js re-checks
    // on the server regardless, so an empty answer for a bad token is safe.
    if (!(await resolveGroupFromQr(qrToken, groupId))) {
        return res.status(200).json({ success: true, isDuplicate: false });
    }

    const cleanId   = escapeLike(idNumber.trim());
    const excludeId = (typeof existingClientId === 'string' && existingClientId.trim()) || '__none__';

    try {
        const [clientMatches, lafMatches] = await Promise.all([
            graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   idType    },
                        governmentIdNumber: { _ilike: cleanId  },
                        status:             { _neq:  'archived' },
                        _id:                { _neq:  excludeId },
                    },
                    limit: 3,
                })
            ).then(r => r.data?.clients ?? []),

            graph.query(
                queryQl(TEMP_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   idType    },
                        governmentIdNumber: { _ilike: cleanId  },
                        status:             { _in:   ACTIVE_LAF_STATUSES },
                        existingClientId:   { _neq:  excludeId },
                    },
                    limit: 3,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []),
        ]);

        if (clientMatches.length === 0 && lafMatches.length === 0) {
            return res.status(200).json({ success: true, isDuplicate: false });
        }

        // No branch names: this answer must not tell a stranger where an ID is registered
        const conflicts = [
            ...clientMatches.map(c => ({ source: 'client',      branch: '—', status: c.status })),
            ...lafMatches.map(l =>    ({ source: 'application', branch: '—', status: l.status })),
        ];

        return res.status(200).json({
            success:     true,
            isDuplicate: true,
            conflicts,
            message: clientMatches.length > 0
                ? 'This ID number is already registered to an existing client record.'
                : 'This ID number is already associated with an active application.',
        });
    } catch (err) {
        console.error('[check-id-duplicate]', err);
        return res.status(200).json({ success: true, isDuplicate: false }); // fail open
    }
}