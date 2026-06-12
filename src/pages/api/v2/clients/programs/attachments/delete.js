// src/pages/api/v2/clients/programs/attachments/delete.js
// POST { _id } — soft-deletes by removing the DB row only.
// The DO Spaces object is intentionally NOT deleted to preserve audit trail.
// Use fetchWrapper.post per project convention (no HTTP DELETE).

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const ATTACHMENT_TYPE = createGraphType('client_program_attachments', '_id')('client_program_attachments');

export default apiHandler({ post: remove });

async function remove(req, res) {
    const { _id } = req.body;
    if (!_id) {
        return res.status(200).json({ success: false, message: '_id is required.' });
    }

    const result = await graph.mutation(
        deleteQl(ATTACHMENT_TYPE, { _id: { _eq: _id } })
    );

    if (result.errors?.length) {
        return res.status(200).json({ success: false, message: result.errors[0].message });
    }

    return res.status(200).json({ success: true });
}