// src/pages/api/v2/clients/by-ids.js
// POST { ids: string[], ciReferenceCode: string }
// Returns minimal client records for the duplicate candidates of ONE application.
// Used by CIDuplicatePanel. Only IDs listed on that application's
// duplicateCandidateIds are returned, and only to roles that can validate
// duplicates, for applications within their scope.

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById }             from '@/lib/graph.functions';
import { canDecideCI, resolveBranchWhere, branchWhereAllows } from '@/lib/ci-scope';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate
    branchName status profile groupLeader
    governmentIdType governmentIdNumber
`)('clients');

const APP_TYPE = createGraphType(
    'temporaryLoanApplications', '_id branchId duplicateCandidateIds existingClientId promotedClientId'
)('temporaryLoanApplications');

export default apiHandler({ post: getByIds });

async function getByIds(req, res) {
    const { ids, ciReferenceCode } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(200).json({ success: true, clients: [] });
    }
    if (typeof ciReferenceCode !== 'string' || !ciReferenceCode) {
        return res.status(200).json({ success: false, message: 'ciReferenceCode is required.' });
    }

    const user = await findUserById(req.auth?.sub);
    if (!user) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    if (!canDecideCI(user)) {
        return res.status(200).json({ success: false, message: 'Not allowed.' });
    }

    const [application] = await graph.query(
        queryQl(APP_TYPE, { where: { ciReferenceCode: { _eq: ciReferenceCode } }, limit: 1 })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    const branchWhere = await resolveBranchWhere(user);
    if (!application || !branchWhereAllows(branchWhere, application.branchId)) {
        return res.status(200).json({ success: true, clients: [] });
    }

    // The application's duplicate candidates, plus the application's own client
    // (CIReviewPanel reads the existing client's groupLeader/status)
    const candidateSet = new Set([
        ...(Array.isArray(application.duplicateCandidateIds) ? application.duplicateCandidateIds : []),
        application.existingClientId,
        application.promotedClientId,
    ].filter(Boolean));
    const wanted = [...new Set(ids)].filter(id => candidateSet.has(id)).slice(0, 20);
    if (wanted.length === 0) {
        return res.status(200).json({ success: true, clients: [] });
    }

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, { where: { _id: { _in: wanted } } })
    ).then(r => r.data?.clients ?? []);

    return res.status(200).json({ success: true, clients });
}