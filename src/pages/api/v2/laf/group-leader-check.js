// src/pages/api/v2/laf/group-leader-check.js
// GET ?groupId=xxx&excludeClientId=xxx (optional, for reloan/pending/existing/balik
// where the client applying might already coincidentally be the current leader)
//
// Returns whether the group currently has an active/pending client with
// groupLeader=true, so CIReviewPanel can warn before letting a supervisor
// set a second one.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', '_id firstName lastName status groupLeader groupId')('clients');

export default apiHandler({ get: checkGroupLeader });

async function checkGroupLeader(req, res) {
    const { groupId, excludeClientId } = req.query;
    if (!groupId) {
        return res.status(200).json({ success: false, message: 'groupId required.' });
    }

    let where = {
        groupId:     { _eq: groupId },
        groupLeader: { _eq: true },
        status:      { _in: ['active', 'pending'] },
    };
    if (excludeClientId) {
        where._id = { _neq: excludeClientId };
    }

    const existingLeaders = await graph.query(
        queryQl(CLIENT_TYPE, { where })
    ).then(r => r.data?.clients ?? []);

    return res.status(200).json({
        success: true,
        hasExistingLeader: existingLeaders.length > 0,
        existingLeaders: existingLeaders.map(c => ({
            _id: c._id, firstName: c.firstName, lastName: c.lastName, status: c.status,
        })),
    });
}