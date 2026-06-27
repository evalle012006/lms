// src/pages/api/public/laf/check-duplicate.js
// GET ?firstName=xxx&lastName=xxx&birthdate=xxx
// Public — no auth. Called during Prospect personal info step.
// Returns potential duplicate matches from BOTH clients AND pending LAFs.
//
// Checks two tables:
//   1. clients — promoted clients. If matched, submit.js will flag as duplicate
//      and route to pending_validation for admin review.
//   2. temporaryLoanApplications — pending LAFs. If matched, submit.js will
//      HARD BLOCK the submission (not flag — just reject with a clear message).
//
// This API is client-side only — it powers the warning panel in PublicLAFForm
// so the user can see WHY they're being blocked and choose Reloan/Pending instead.
// The actual enforcement happens server-side in submit.js.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate branchName status
`)('clients');

// FIX: also check pending LAFs in temporaryLoanApplications
const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id firstName lastName middleName birthdate branchId status ciReferenceCode clientType
`)('temporaryLoanApplications');

const ACTIVE_LAF_STATUSES = ['pending', 'pending_validation', 'ci_approved'];

export default publicApiHandler({ get: checkDuplicate });

async function checkDuplicate(req, res) {
    const { firstName, lastName, birthdate } = req.query;

    if (!firstName || !lastName) {
        return res.status(200).json({ success: true, duplicates: [] });
    }

    const firstUpper = firstName.trim().toUpperCase();
    const lastUpper  = lastName.trim().toUpperCase();

    try {
        // Run both queries in parallel — no extra latency
        const [clients, pendingLAFs] = await Promise.all([
            // Check promoted client records
            graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        firstName: { _eq: firstUpper },
                        lastName:  { _eq: lastUpper  },
                        status:    { _nin: ['archived', 'merged'] },
                    },
                    limit: 10,
                })
            ).then(r => r.data?.clients ?? []),

            // FIX: also check active/pending LAFs that haven't been promoted yet.
            // These are people who submitted a LAF but CI hasn't happened yet.
            // Without this check, submitting a second LAF for the same person
            // won't be flagged as a duplicate.
            graph.query(
                queryQl(TEMP_TYPE, {
                    where: {
                        firstName: { _eq: firstUpper },
                        lastName:  { _eq: lastUpper  },
                        status:    { _in: ACTIVE_LAF_STATUSES },
                    },
                    limit: 10,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []),
        ]);

        // Score function — birthdate is a boost/penalty, never a hard filter.
        // Clients with no birthdate on record must still be flagged on name alone.
        const scoreCandidate = (c, inputBirthdate) => {
            // Both names are exact matches at DB level — base score starts at 1.0
            let score = 1.0;
            if (inputBirthdate && c.birthdate) {
                if (inputBirthdate === c.birthdate) {
                    score = 1.0; // same name + same birthdate — confirmed
                } else {
                    score = 0.8; // same name, different birthdate — still flag, lower confidence
                }
            }
            // No birthdate on either side → score stays 1.0 — name match is enough
            return score;
        };

        // Normalize pending LAFs to look like client records in the warning UI
        const lafResults = pendingLAFs.map(laf => ({
            _id:             laf._id,
            firstName:       laf.firstName,
            lastName:        laf.lastName,
            middleName:      laf.middleName,
            birthdate:       laf.birthdate,
            // branchName is not stored on temporaryLoanApplications — use branchId
            // The warning UI already handles missing branchName gracefully
            branchName:      laf.branchId || '',
            // Show status so warning panel explains this is a pending application
            status:          `Pending Application`,
            ciReferenceCode: laf.ciReferenceCode,
            similarityScore: scoreCandidate(laf, birthdate),
        }));

        const clientResults = clients.map(c => ({
            _id:             c._id,
            firstName:       c.firstName,
            lastName:        c.lastName,
            middleName:      c.middleName,
            birthdate:       c.birthdate,
            branchName:      c.branchName || '',
            status:          c.status,
            similarityScore: scoreCandidate(c, birthdate),
        }));

        // Merge, deduplicate by _id, sort by score desc
        const seen = new Set();
        const merged = [...clientResults, ...lafResults]
            .filter(c => {
                if (seen.has(c._id)) return false;
                seen.add(c._id);
                return true;
            })
            .sort((a, b) => b.similarityScore - a.similarityScore);

        return res.status(200).json({
            success:    true,
            duplicates: merged,
        });

    } catch (err) {
        console.error('[check-duplicate]', err);
        return res.status(200).json({ success: true, duplicates: [] }); // fail open
    }
}