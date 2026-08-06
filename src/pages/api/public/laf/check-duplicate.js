// src/pages/api/public/laf/check-duplicate.js
// GET ?firstName=xxx&lastName=xxx&birthdate=xxx[&middleName=xxx][&contactNumber=xxx]
//
// Checks for duplicate clients using three parallel strategies:
//
//   Query A (always):        firstName + lastName exact match in `clients`       → score 0.8
//   Query B (middleName):    firstName + lastName + middleName match in `clients` → score 1.0
//   Query C (contactNumber): firstName + lastName + contactNumber in `clients`    → score 1.0
//   Query D (always):        firstName + lastName in `temporaryLoanApplications`
//                            with active status — "Pending Application" duplicates
//
// Results merged by _id. Highest score wins per record.
// LAF duplicates returned separately so UI can show different messaging.
//
// Public — protected by x-laf-api-key.
// Non-blocking — UI shows a warning but does not hard-stop submission.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate branchName status contactNumber
`)('clients');

// Minimal LAF type — enough to show a "Pending Application" warning
// FIX: check-duplicate was only checking clients table for prospects.
// Added this check so the UI can warn about same name already in pipeline.
const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id firstName lastName middleName status branchId ciReferenceCode
`)('temporaryLoanApplications');

// Statuses that mean a LAF is still active in the pipeline
const ACTIVE_LAF_STATUSES = ['pending', 'ci_approved', 'pending_validation'];

export default publicApiHandler({ get: checkDuplicate });

async function checkDuplicate(req, res) {
    const { firstName, lastName, birthdate, middleName, contactNumber } = req.query;

    if (!firstName || !lastName) {
        return res.status(200).json({ success: true, duplicates: [] });
    }

    const firstUpper   = firstName.trim().toUpperCase();
    const lastUpper    = lastName.trim().toUpperCase();
    const middleUpper  = middleName?.trim().toUpperCase() || null;
    const contactClean = contactNumber?.trim() || null;

    try {
        // ── Build parallel queries ────────────────────────────────────────

        // Query A: always — firstName + lastName exact match in clients
        const queryA = graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    firstName: { _eq: firstUpper },
                    lastName:  { _eq: lastUpper  },
                    status:    { _neq: 'archived' },
                },
                limit: 10,
            })
        ).then(r => (r.data?.clients ?? []).map(c => ({ ...c, _matchSource: 'name' })));

        // Query B: firstName + lastName + middleName (only when middleName provided)
        const queryB = middleUpper
            ? graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        firstName:  { _eq: firstUpper  },
                        lastName:   { _eq: lastUpper   },
                        middleName: { _eq: middleUpper },
                        status:     { _neq: 'archived' },
                    },
                    limit: 10,
                })
            ).then(r => (r.data?.clients ?? []).map(c => ({ ...c, _matchSource: 'fullName' })))
            : Promise.resolve([]);

        // Query C: firstName + lastName + contactNumber (only when contactNumber provided)
        const queryC = contactClean
            ? graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        firstName:     { _eq: firstUpper   },
                        lastName:      { _eq: lastUpper    },
                        contactNumber: { _eq: contactClean },
                        status:        { _neq: 'archived'  },
                    },
                    limit: 10,
                })
            ).then(r => (r.data?.clients ?? []).map(c => ({ ...c, _matchSource: 'nameContact' })))
            : Promise.resolve([]);

        // Query D: same name already in active LAF pipeline (prospect-specific)
        // Returns these separately — UI shows "Pending Application" not "Existing Client"
        const queryD = graph.query(
            queryQl(TEMP_TYPE, {
                where: {
                    firstName: { _eq: firstUpper },
                    lastName:  { _eq: lastUpper  },
                    status:    { _in: ACTIVE_LAF_STATUSES },
                },
                limit: 5,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        const [nameMatches, fullNameMatches, nameContactMatches, lafMatches] =
            await Promise.all([queryA, queryB, queryC, queryD]);

        // ── Merge client results by _id — highest score wins ─────────────
        const scoreMap = new Map();
        for (const c of nameMatches) {
            scoreMap.set(c._id, { ...c, _baseScore: 0.8 });
        }
        for (const c of [...fullNameMatches, ...nameContactMatches]) {
            const existing = scoreMap.get(c._id);
            if (!existing || existing._baseScore < 1.0) {
                scoreMap.set(c._id, { ...c, _baseScore: 1.0 });
            }
        }

        // ── Apply birthdate as secondary adjustment ───────────────────────
        const scoredClients = Array.from(scoreMap.values())
            .map(c => {
                let score = c._baseScore;
                if (birthdate && c.birthdate) {
                    if (birthdate === c.birthdate) {
                        score = 1.0;
                    } else if (score < 1.0) {
                        score = Math.max(score - 0.1, 0.7);
                    }
                }
                return { ...c, similarityScore: score };
            })
            .sort((a, b) => b.similarityScore - a.similarityScore);

        // ── Build unified duplicates array ────────────────────────────────
        // Client matches: source='client', status from clients table
        // LAF matches:    source='application', status shows pipeline stage
        const duplicates = [
            ...scoredClients.map(c => ({
                _id:             c._id,
                firstName:       c.firstName,
                lastName:        c.lastName,
                middleName:      c.middleName,
                birthdate:       c.birthdate,
                branchName:      c.branchName,
                status:          c.status,
                similarityScore: c.similarityScore,
                matchSource:     c._matchSource,
                source:          'client',  // existing promoted client
            })),
            ...lafMatches.map(l => ({
                _id:             l._id,
                firstName:       l.firstName,
                lastName:        l.lastName,
                middleName:      l.middleName,
                birthdate:       null,
                branchName:      null,       // not stored on temporaryLoanApplications
                status:          l.status,   // 'pending' | 'ci_approved' | 'pending_validation'
                similarityScore: 1.0,        // exact name match
                matchSource:     'name',
                source:          'application', // still in LAF pipeline
            })),
        ];

        return res.status(200).json({
            success:    true,
            duplicates,
        });

    } catch (err) {
        console.error('[check-duplicate]', err);
        return res.status(200).json({ success: true, duplicates: [] }); // fail open
    }
}