// src/pages/api/public/laf/check-duplicate.js
// GET ?firstName=xxx&lastName=xxx&birthdate=xxx
// Public — no auth. Called during Prospect personal info step.
// Returns potential duplicate matches. Non-blocking — UI shows warning.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate branchName status
`)('clients');

export default publicApiHandler({ get: checkDuplicate });

async function checkDuplicate(req, res) {
    const { firstName, lastName, birthdate } = req.query;

    if (!firstName || !lastName) {
        return res.status(200).json({ success: true, duplicates: [] });
    }

    const firstUpper = firstName.trim().toUpperCase();
    const lastUpper  = lastName.trim().toUpperCase();

    try {
        // FIX: use _eq (exact match) for both names at DB level — not _ilike with wildcards.
        // The previous _ilike '%MARILOU%' matched any name CONTAINING the substring,
        // causing false positives like BANDOL, VILANDO, CANDOLE (all contain "ANDO").
        // Exact match at DB level, then similarity scoring narrows further after.
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    firstName: { _eq: firstUpper },
                    lastName:  { _eq: lastUpper  },
                    status:    { _neq: 'archived' },
                },
                limit: 10,
            })
        ).then(r => r.data?.clients ?? []);

        // Score — birthdate used only as a boost/penalty, never as a filter.
        // Clients with no birthdate on record must still be flagged on name alone.
        const scored = clients
            .map(c => {
                // Both names are exact matches at this point (from DB query)
                // so base score starts at 1.0
                let score = 1.0;

                if (birthdate && c.birthdate) {
                    if (birthdate === c.birthdate) {
                        score = 1.0;  // confirmed — same name + same birthdate
                    } else {
                        score = 0.8;  // same name, different birthdate — still flag but lower confidence
                    }
                }
                // No birthdate on either side → score stays 1.0 — name match is enough

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
            })),
        });
    } catch (err) {
        console.error('[check-duplicate]', err);
        return res.status(200).json({ success: true, duplicates: [] }); // fail open
    }
}