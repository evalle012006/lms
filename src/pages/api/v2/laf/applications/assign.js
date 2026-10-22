// src/pages/api/v2/laf/applications/assign.js
// POST { applicationIds: [], action: 'claim' | 'release' }
// Claim: marks selected pending apps as assigned to current user (role + branch scoped)
// Release: clears assignment (called after sync completes)

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { canClaimCI, resolveBranchWhere, branchWhereAllows } from '@/lib/ci-scope';
import moment from 'moment';

const graph = new GraphProvider();

const BATCH_LIMIT   = 30;
const CLAIM_TTL_MS  = 24 * 60 * 60 * 1000; // same TTL as list.js / PrepareForFieldModal

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status branchId assignedTo assignedAt assignedByName
`)('temporaryLoanApplications');

const BRANCH_TYPE = createGraphType('branches', '_id code name')('branches');

const CACHE_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status
    firstName lastName middleName birthdate contactNumber
    addressStreetNo addressBarangayDistrict addressMunicipalityCity
    addressProvince addressZipCode address
    loanAmount loanPurpose
    guarantorFirstName guarantorLastName guarantorRelationship guarantorContactNumber
    lafPhotoKey branchId submittedAt assignedTo assignedAt assignedByName
`)('temporaryLoanApplications');

export default apiHandler({ post: assignApplications });

async function assignApplications(req, res) {
    const { applicationIds, action } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(200).json({ success: false, message: 'applicationIds required.' });
    }
    if (!['claim', 'release'].includes(action)) {
        return res.status(200).json({ success: false, message: 'action must be claim or release.' });
    }

    const ids = [...new Set(applicationIds.filter(id => typeof id === 'string' && id))];
    if (ids.length === 0) {
        return res.status(200).json({ success: false, message: 'applicationIds required.' });
    }
    if (action === 'claim' && ids.length > BATCH_LIMIT) {
        return res.status(200).json({
            success: false,
            message: `Maximum ${BATCH_LIMIT} applications per field batch.`,
        });
    }

    const currentUser = await findUserById(req.auth?.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    if (action === 'claim') {
        if (!canClaimCI(currentUser)) {
            return res.status(200).json({ success: false, message: 'You are not allowed to claim CI applications.' });
        }
        const branchWhere = await resolveBranchWhere(currentUser);
        if (branchWhere === null) {
            return res.status(200).json({ success: false, message: 'You do not have access to these applications.' });
        }

        const found = await graph.query(
            queryQl(TEMP_TYPE, { where: { _id: { _in: ids } } })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        // Missing and out-of-scope are indistinguishable to the caller
        const usable = found.filter(a => branchWhereAllows(branchWhere, a.branchId));
        if (usable.length !== ids.length) {
            return res.status(200).json({ success: false, message: 'Some applications were not found.' });
        }

        const notPending = usable.filter(a => a.status !== 'pending');
        if (notPending.length > 0) {
            return res.status(200).json({
                success: false,
                message: `${notPending.length} application(s) are no longer pending.`,
                conflicting: notPending.map(a => a.ciReferenceCode),
            });
        }

        // A claim older than the TTL is treated as unclaimed (matches list.js + the modal)
        const now = Date.now();
        const hasLiveClaim = a => !!a.assignedTo &&
            (!a.assignedAt || (now - new Date(a.assignedAt).getTime()) <= CLAIM_TTL_MS);

        const claimedByOthers = usable.filter(a => hasLiveClaim(a) && a.assignedTo !== currentUser._id);
        if (claimedByOthers.length > 0) {
            return res.status(200).json({
                success: false,
                message: `${claimedByOthers.length} application(s) are already claimed by another investigator.`,
                conflicting: claimedByOthers.map(a => a.ciReferenceCode),
            });
        }

        // Conditional update: a concurrent claim between the check above and here
        // simply doesn't match, instead of being silently overwritten.
        const cutoff = new Date(now - CLAIM_TTL_MS).toISOString();
        const claimed = await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: {
                    _id:    { _in: ids },
                    status: { _eq: 'pending' },
                    _or: [
                        { assignedTo: { _is_null: true } },
                        { assignedTo: { _eq: currentUser._id } },
                        { assignedAt: { _lt: cutoff } },
                    ],
                },
                set: {
                    assignedTo:     currentUser._id,
                    assignedAt:     moment().toISOString(),
                    assignedByName: `${currentUser.firstName} ${currentUser.lastName}`,
                },
            })
        ).then(r => r.data?.temporaryLoanApplications?.returning ?? []);

        if (claimed.length !== ids.length) {
            // Lost a race: undo only what this request newly claimed
            const mineBefore = new Set(
                usable.filter(a => a.assignedTo === currentUser._id && hasLiveClaim(a)).map(a => a._id)
            );
            const toRelease = claimed.map(a => a._id).filter(id => !mineBefore.has(id));
            if (toRelease.length > 0) {
                await graph.mutation(
                    updateQl(TEMP_TYPE, {
                        where: { _id: { _in: toRelease }, assignedTo: { _eq: currentUser._id } },
                        set:   { assignedTo: null, assignedAt: null, assignedByName: null },
                    })
                );
            }
            return res.status(200).json({
                success: false,
                message: 'Another investigator claimed one of these while you were selecting. Refresh and try again.',
            });
        }

        // Branch info for offline display (branch ids come from the rows we already verified)
        const branchIds = [...new Set(usable.map(a => a.branchId).filter(Boolean))];
        const branchMap = {};
        if (branchIds.length > 0) {
            const branches = await graph.query(
                queryQl(BRANCH_TYPE, { where: { _id: { _in: branchIds } } })
            ).then(r => r.data?.branches ?? []);
            branches.forEach(b => { branchMap[b._id] = b; });
        }

        const applications = await graph.query(
            queryQl(CACHE_TYPE, { where: { _id: { _in: ids } } })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        const enriched = applications.map(a => ({
            ...a,
            branchCode: branchMap[a.branchId]?.code || '',
            branchName: branchMap[a.branchId]?.name || '',
        }));

        return res.status(200).json({
            success:      true,
            applications: enriched,
            message:      `${enriched.length} application(s) claimed successfully.`,
        });
    }

    // Release: clears the current user's own claims only
    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: {
                _id:        { _in: ids },
                assignedTo: { _eq: currentUser._id },
            },
            set: { assignedTo: null, assignedAt: null, assignedByName: null },
        })
    );

    return res.status(200).json({ success: true, message: 'Claims released.' });
}