// src/pages/api/v2/clients/laf-ci-history.js
// GET ?clientId=xxx
// Returns every LAF application linked to this client, with its CI decision
// (if investigated) attached.
//
// "Linked" means either:
//   - existingClientId === clientId  → this client was matched/linked as the
//     applicant on a reloan/pending/balik application, OR
//   - promotedClientId === clientId  → this application was a new prospect
//     that got promoted INTO this client record.
// A client can appear on both sides across different loan cycles, so both
// are checked with _or, not just one.
//
// NOTE: does not currently include applications where this client was only
// the GUARANTOR (guarantorFirstName/guarantorLastName match, not an _id
// relationship) — temporaryLoanApplications has no guarantorClientId column,
// only loans does. If guarantor-side history is wanted here too, that needs
// a separate name-based lookup against loans.guarantorClientId, which is a
// different (fuzzier) query. Flagging rather than silently including it.

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status submittedAt dateAdded
    existingClientId promotedClientId clientType
`)('temporaryLoanApplications');

const CI_TYPE = createGraphType('ciInvestigations', `
    ciReferenceCode decision investigatedAt
`)('ciInvestigations');

export default apiHandler({ get: getLafCiHistory });

async function getLafCiHistory(req, res) {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const applications = await graph.query(
        queryQl(TEMP_TYPE, {
            where: {
                _or: [
                    { existingClientId: { _eq: clientId } },
                    { promotedClientId: { _eq: clientId } },
                ],
            },
            order_by: [{ dateAdded: 'desc' }],
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (applications.length === 0) {
        return res.status(200).json({ success: true, applications: [] });
    }

    // Batch-fetch CI decisions for every ref code in one query rather than
    // one query per application.
    const refCodes = applications.map(a => a.ciReferenceCode).filter(Boolean);

    const investigations = refCodes.length > 0
        ? await graph.query(
            queryQl(CI_TYPE, { where: { ciReferenceCode: { _in: refCodes } } })
          ).then(r => r.data?.ciInvestigations ?? [])
        : [];

    const ciByRefCode = {};
    investigations.forEach(ci => { ciByRefCode[ci.ciReferenceCode] = ci; });

    const result = applications.map(app => ({
        _id:             app._id,
        ciReferenceCode: app.ciReferenceCode,
        status:          app.status,
        clientType:      app.clientType,
        submittedAt:     app.submittedAt || app.dateAdded,
        decision:        ciByRefCode[app.ciReferenceCode]?.decision || null,
        investigatedAt:  ciByRefCode[app.ciReferenceCode]?.investigatedAt || null,
    }));

    return res.status(200).json({ success: true, applications: result });
}