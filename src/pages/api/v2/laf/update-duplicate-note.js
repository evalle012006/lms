// src/pages/api/v2/laf/update-duplicate-note.js
// POST { ciReferenceCode, note }
// Allows BM to add/update a remark on a pending_validation application.
// Only updates the note — does not change status.

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';

const graph    = new GraphProvider();
const TEMP_TYPE = createGraphType('temporaryLoanApplications', '_id status')('temporaryLoanApplications');

export default apiHandler({ post: updateNote });

async function updateNote(req, res) {
    const { ciReferenceCode, note } = req.body;

    if (!ciReferenceCode) {
        return res.status(200).json({ success: false, message: 'ciReferenceCode required.' });
    }

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }

    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: ciReferenceCode } },
            set:   { duplicateValidationNote: note || null },
        })
    );

    return res.status(200).json({ success: true });
}