// src/pages/api/public/laf/check-id-duplicate.js
// GET ?idType=xxx&idNumber=xxx[&existingClientId=xxx]
//
// Checks government ID uniqueness across TWO tables:
//   1. clients          — already promoted/existing clients
//   2. temporaryLoanApplications — active pipeline (pending, ci_approved, pending_validation)
//
// existingClientId is passed for reloan/pending/balik — excludes their own record
// from both checks so their re-submission doesn't self-block.
//
// Public — protected by x-laf-api-key.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// Minimal fields — just enough to show a meaningful conflict message
const CLIENT_TYPE = createGraphType('client', `
    _id status branchName
`)('clients');

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id status
`)('temporaryLoanApplications');

// Statuses that mean the LAF is still active in the pipeline
const ACTIVE_LAF_STATUSES = ['pending', 'ci_approved', 'pending_validation'];

export default publicApiHandler({ get: checkIdDuplicate });

async function checkIdDuplicate(req, res) {
    const { idType, idNumber, existingClientId } = req.query;

    if (!idType || !idNumber?.trim()) {
        return res.status(200).json({ success: true, isDuplicate: false });
    }

    const cleanId     = idNumber.trim();
    // Use a sentinel that will never match a real _id when no existingClientId
    const excludeId   = existingClientId?.trim() || '__none__';

    try {
        const [clientMatches, lafMatches] = await Promise.all([

            // ── 1. Check clients table ──────────────────────────────────────
            graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   idType    },
                        governmentIdNumber: { _ilike: cleanId  },
                        status:             { _neq:  'archived' },
                        _id:                { _neq:  excludeId }, // exclude self (reloan)
                    },
                    limit: 3,
                })
            ).then(r => r.data?.clients ?? []),

            // ── 2. Check active pipeline in temporaryLoanApplications ───────
            graph.query(
                queryQl(TEMP_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   idType    },
                        governmentIdNumber: { _ilike: cleanId  },
                        status:             { _in:   ACTIVE_LAF_STATUSES },
                        existingClientId:   { _neq:  excludeId }, // exclude self (reloan re-apply)
                    },
                    limit: 3,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []),

        ]);

        const isDuplicate = clientMatches.length > 0 || lafMatches.length > 0;

        if (!isDuplicate) {
            return res.status(200).json({ success: true, isDuplicate: false });
        }

        const conflicts = [
            ...clientMatches.map(c => ({
                source: 'client',
                branch: c.branchName || '—',
                status: c.status,
            })),
            ...lafMatches.map(l => ({
                source: 'application',
                branch: '—',
                status: l.status,
            })),
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
        // Fail open — don't block submission on check error
        return res.status(200).json({ success: true, isDuplicate: false });
    }
}