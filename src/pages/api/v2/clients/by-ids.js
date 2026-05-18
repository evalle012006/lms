// src/pages/api/v2/clients/by-ids.js
// POST { ids: string[] }
// Returns minimal client records for a list of IDs.
// Used by CIDuplicatePanel to load duplicate candidate records.

import { apiHandler }                      from '@/services/api-handler';
import { GraphProvider }                   from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }        from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate
    branchName status profile
    governmentIdType governmentIdNumber
`)('clients');

export default apiHandler({ post: getByIds });

async function getByIds(req, res) {
    const { ids } = req.body;

    if (!ids?.length) {
        return res.status(200).json({ success: true, clients: [] });
    }

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: { _id: { _in: ids.slice(0, 20) } }, // cap at 20
        })
    ).then(r => r.data?.clients ?? []);

    return res.status(200).json({ success: true, clients });
}