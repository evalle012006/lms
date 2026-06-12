// src/pages/api/v2/clients/programs/list.js
// GET ?clientId=xxx
// Returns all programs (with attachments) for a client.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { CLIENT_PROGRAM_FIELDS, CLIENT_PROGRAM_ATTACHMENT_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();

const PROGRAM_TYPE = createGraphType('client_programs', `
    ${CLIENT_PROGRAM_FIELDS}
    client_program_attachments {
        ${CLIENT_PROGRAM_ATTACHMENT_FIELDS}
    }
`)('client_programs');

export default apiHandler({ get: list });

async function list(req, res) {
    const { clientId } = req.query;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId is required.' });
    }

    const programs = await graph.query(
        queryQl(PROGRAM_TYPE, {
            where: { client_id: { _eq: clientId } },
        })
    ).then(r => r.data?.client_programs ?? []);

    return res.status(200).json({ success: true, programs });
}