// src/pages/api/public/laf/check-duplicate.js
// GET ?firstName=xxx&lastName=xxx&birthdate=xxx[&middleName=xxx][&contactNumber=xxx]
//
// Checks for duplicate clients in the `clients` table using three parallel strategies:
//
//   Query A (always):       firstName + lastName exact match            → score 0.8
//   Query B (middleName):   firstName + lastName + middleName match     → score 1.0
//   Query C (contactNumber): firstName + lastName + contactNumber match → score 1.0
//
// Results are merged by _id. If a record appears in multiple queries, it keeps
// the highest score. birthdate is still used as a secondary score boost/penalty
// after deduplication.
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

        // Query A: always — firstName + lastName exact match
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
        // All three must match — contactNumber is not a standalone trigger
        const queryC = contactClean
            ? graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        firstName:     { _eq: firstUpper  },
                        lastName:      { _eq: lastUpper   },
                        contactNumber: { _eq: contactClean },
                        status:        { _neq: 'archived' },
                    },
                    limit: 10,
                })
            ).then(r => (r.data?.clients ?? []).map(c => ({ ...c, _matchSource: 'nameContact' })))
            : Promise.resolve([]);

        const [nameMatches, fullNameMatches, nameContactMatches] = await Promise.all([
            queryA, queryB, queryC,
        ]);

        // ── Merge by _id — highest score wins ────────────────────────────
        // Score assignment before birthdate adjustment:
        //   name only          → 0.8
        //   fullName (+ middle) → 1.0
        //   name + contact     → 1.0
        const scoreMap = new Map();

        for (const c of nameMatches) {
            scoreMap.set(c._id, { ...c, _baseScore: 0.8 });
        }
        // fullName and nameContact both score 1.0 — overwrite or insert
        for (const c of [...fullNameMatches, ...nameContactMatches]) {
            const existing = scoreMap.get(c._id);
            if (!existing || existing._baseScore < 1.0) {
                scoreMap.set(c._id, { ...c, _baseScore: 1.0 });
            }
        }

        if (scoreMap.size === 0) {
            return res.status(200).json({ success: true, duplicates: [] });
        }

        // ── Apply birthdate as secondary adjustment ───────────────────────
        // birthdate never filters — only adjusts confidence slightly.
        // A name-only match with no birthdate context stays at its base score.
        const scored = Array.from(scoreMap.values())
            .map(c => {
                let score = c._baseScore;

                if (birthdate && c.birthdate) {
                    if (birthdate === c.birthdate) {
                        score = 1.0;               // confirmed — birthdate matches
                    } else if (score < 1.0) {
                        score = Math.max(score - 0.1, 0.7); // slight penalty for mismatch
                    }
                    // If score is already 1.0 from fullName/contact match, birthdate
                    // mismatch does not downgrade — the other signals are stronger
                }

                return { ...c, similarityScore: score };
            })
            .sort((a, b) => b.similarityScore - a.similarityScore);

        return res.status(200).json({
            success:    true,
            duplicates: scored.map(c => ({
                _id:             c._id,
                firstName:       c.firstName,
                lastName:        c.lastName,
                middleName:      c.middleName,
                birthdate:       c.birthdate,
                branchName:      c.branchName,
                status:          c.status,
                similarityScore: c.similarityScore,
                matchSource:     c._matchSource, // useful for UI to show confidence hint
            })),
        });

    } catch (err) {
        console.error('[check-duplicate]', err);
        return res.status(200).json({ success: true, duplicates: [] }); // fail open
    }
}