// src/pages/api/v2/laf/ci/latest.js
// GET ?clientId=xxx
// Returns the most recent approved CI investigation for an existing client
// Used by AddLoanPage to warn if reloan client needs a new CI

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import moment from 'moment';

const graph = new GraphProvider();

const CI_TYPE = createGraphType('ciInvestigations', `
    _id ciReferenceCode decision findings
    investigatedAt syncedAt picUserName
    tempApplicationId
`)('ciInvestigations');

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status submittedAt
    firstName lastName branchId birthdate
    existingClientId promotedClientId
`)('temporaryLoanApplications');

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName ciName status branchId birthdate
    biometricCredentialId
`)('clients');

const APPROVED_STATUSES = ['ci_approved', 'promoted'];

export default apiHandler({ get: getLatestCI });

async function getLatestCI(req, res) {
    const { clientId } = req.query;
    if (typeof clientId !== 'string' || !clientId) {
        return res.status(200).json({ success: false, message: 'clientId required' });
    }

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    // 1. Exact link: applications created for / promoted into THIS client
    let tempApps = await graph.query(
        queryQl(TEMP_TYPE, {
            where: {
                _or: [
                    { existingClientId: { _eq: clientId } },
                    { promotedClientId: { _eq: clientId } },
                ],
                status: { _in: APPROVED_STATUSES },
            },
            order_by: [{ submittedAt: 'desc' }],
            limit: 10,
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    // 2. Legacy fallback for approvals that predate the client link: same name in the same
    //    branch, never an application linked to a different client, and not a known
    //    birthdate mismatch.
    if (tempApps.length === 0) {
        const nameMatches = await graph.query(
            queryQl(TEMP_TYPE, {
                where: {
                    firstName: { _eq: client.firstName },
                    lastName:  { _eq: client.lastName },
                    status:    { _in: APPROVED_STATUSES },
                    ...(client.branchId ? { branchId: { _eq: client.branchId } } : {}),
                },
                order_by: [{ submittedAt: 'desc' }],
                limit: 10,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        tempApps = nameMatches.filter(a =>
            !(a.existingClientId && a.existingClientId !== clientId) &&
            !(a.promotedClientId && a.promotedClientId !== clientId) &&
            (!a.birthdate || !client.birthdate || a.birthdate === client.birthdate)
        );
        if (tempApps.length > 0) {
            console.warn('[ci/latest] legacy name-match used', { clientId });
        }
    }

    if (tempApps.length === 0) {
        return res.status(200).json({
            success:  true,
            hasCI:    false,
            latestCI: null,
            message:  'No CI investigation found for this client.',
        });
    }

    const ciRefs = tempApps.map(a => a.ciReferenceCode).filter(Boolean);
    if (ciRefs.length === 0) {
        return res.status(200).json({ success: true, hasCI: false, latestCI: null });
    }

    const investigations = await graph.query(
        queryQl(CI_TYPE, {
            where: {
                ciReferenceCode: { _in: ciRefs },
                decision:        { _eq: 'approved' },
            },
            order_by: [{ investigatedAt: 'desc' }],
            limit: 1,
        })
    ).then(r => r.data?.ciInvestigations ?? []);

    const latestCI = investigations[0] || null;

    return res.status(200).json({
        success:  true,
        hasCI:    !!latestCI,
        latestCI: latestCI ? {
            ciReferenceCode: latestCI.ciReferenceCode,
            decision:        latestCI.decision,
            investigatedAt:  latestCI.investigatedAt,
            picUserName:     latestCI.picUserName,
            // Flag if CI is older than 6 months — may need renewal
            isOld:           moment().diff(moment(latestCI.investigatedAt), 'months') >= 6,
            monthsAgo:       moment().diff(moment(latestCI.investigatedAt), 'months'),
        } : null,
    });
}