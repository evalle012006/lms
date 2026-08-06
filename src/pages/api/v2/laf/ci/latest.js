// src/pages/api/v2/laf/ci/latest.js
// GET ?clientId=xxx
// Returns the most recent CI investigation for an existing client
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

// Also check temporaryLoanApplications to find the client's CI ref code
const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status submittedAt
    firstName lastName
`)('temporaryLoanApplications');

// Check clients table for ciReferenceCode link
const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName ciName status
    biometricCredentialId
`)('clients');

export default apiHandler({ get: getLatestCI });

async function getLatestCI(req, res) {
    const { clientId } = req.query;
    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required' });
    }

    // Get client info
    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    // Find all temporaryLoanApplications for this client
    // Match by name since clientId may not be stored on temp apps directly
    const tempApps = await graph.query(
        queryQl(TEMP_TYPE, {
            where: {
                firstName: { _eq: client.firstName },
                lastName:  { _eq: client.lastName },
                status:    { _in: ['ci_approved', 'promoted'] },
            },
            order_by: [{ submittedAt: 'desc' }],
            limit: 10,
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (tempApps.length === 0) {
        return res.status(200).json({
            success:   true,
            hasCI:     false,
            latestCI:  null,
            message:   'No CI investigation found for this client.',
        });
    }

    // Get the most recent approved CI investigation
    const ciRefs = tempApps.map(a => a.ciReferenceCode).filter(Boolean);
    if (ciRefs.length === 0) {
        return res.status(200).json({
            success:  true,
            hasCI:    false,
            latestCI: null,
        });
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
        success:    true,
        hasCI:      !!latestCI,
        latestCI:   latestCI ? {
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