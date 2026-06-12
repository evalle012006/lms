// src/pages/api/v2/clients/programs/attachments/save.js
// POST — insert a new attachment record for a client program.
// Body: { program_id, file_name, file_key, file_type? }
// The actual file upload happens via the existing /api/upload route first;
// this route only persists the metadata into client_program_attachments.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { CLIENT_PROGRAM_ATTACHMENT_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();

const ATTACHMENT_TYPE = createGraphType(
    'client_program_attachments',
    CLIENT_PROGRAM_ATTACHMENT_FIELDS
)('client_program_attachments');

export default apiHandler({ post: save });

async function save(req, res) {
    const userId = req.auth.sub;
    const { program_id, file_name, file_key, file_type } = req.body;

    if (!program_id || !file_name || !file_key) {
        return res.status(200).json({
            success: false,
            message: 'program_id, file_name, and file_key are required.',
        });
    }

    const result = await graph.mutation(
        insertQl(ATTACHMENT_TYPE, {
            objects: [{
                _id: generateUUID(),
                program_id,
                file_name,
                file_key,
                file_type: file_type ?? null,
                uploaded_by: userId,
                uploaded_at: new Date().toISOString(),
            }],
        })
    );

    if (result.errors?.length) {
        return res.status(200).json({ success: false, message: result.errors[0].message });
    }

    const attachment = result.data?.client_program_attachments?.returning?.[0];
    return res.status(200).json({ success: true, attachment });
}