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

    try {
        // Match by last name (required) + first name (optional fuzzy) + birthdate (if given)
        const where = {
            lastName:  { _ilike: `%${lastName.trim().toUpperCase()}%` },
            firstName: { _ilike: `%${firstName.trim().toUpperCase()}%` },
            status:    { _neq: 'archived' },
        };

        if (birthdate) {
            where.birthdate = { _eq: birthdate };
        }

        const clients = await graph.query(
            queryQl(CLIENT_TYPE, { where, limit: 5 })
        ).then(r => r.data?.clients ?? []);

        return res.status(200).json({
            success:    true,
            duplicates: clients.map(c => ({
                _id:        c._id,
                firstName:  c.firstName,
                lastName:   c.lastName,
                middleName: c.middleName,
                birthdate:  c.birthdate,
                branchName: c.branchName,
                status:     c.status,
            })),
        });
    } catch (err) {
        console.error('[check-duplicate]', err);
        return res.status(200).json({ success: true, duplicates: [] }); // fail open
    }
}