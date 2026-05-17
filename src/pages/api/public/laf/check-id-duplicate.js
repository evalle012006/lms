// src/pages/api/public/laf/check-id-duplicate.js
// GET ?idType=xxx&idNumber=xxx
// Checks if a government ID number is already registered to an existing client.
// Public — protected by x-laf-api-key.
// Called during the ID step before allowing Next.

import { publicApiHandler }          from '@/services/public-api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName status branchName
`)('clients');

export default publicApiHandler({ get: checkIdDuplicate });

async function checkIdDuplicate(req, res) {
    const { idType, idNumber } = req.query;

    if (!idType || !idNumber?.trim()) {
        return res.status(200).json({ success: true, isDuplicate: false });
    }

    try {
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    governmentIdType:   { _eq: idType },
                    governmentIdNumber: { _ilike: idNumber.trim() },
                    status:             { _neq: 'archived' },
                },
                limit: 3,
            })
        ).then(r => r.data?.clients ?? []);

        if (clients.length === 0) {
            return res.status(200).json({ success: true, isDuplicate: false });
        }

        return res.status(200).json({
            success:     true,
            isDuplicate: true,
            matches:     clients.map(c => ({
                name:       `${c.lastName}, ${c.firstName}`,
                branch:     c.branchName || '—',
                status:     c.status,
            })),
        });
    } catch (err) {
        console.error('[check-id-duplicate]', err);
        // Fail open — don't block submission on check error
        return res.status(200).json({ success: true, isDuplicate: false });
    }
}