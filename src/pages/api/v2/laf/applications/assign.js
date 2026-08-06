// src/pages/api/v2/laf/applications/assign.js
// POST { applicationIds: [], action: 'claim' | 'release' }
// Claim: marks selected pending apps as assigned to current user
// Release: clears assignment (called after sync completes)

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status assignedTo assignedAt assignedByName
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

    const BATCH_LIMIT = 30;
    if (action === 'claim' && applicationIds.length > BATCH_LIMIT) {
        return res.status(200).json({
            success: false,
            message: `Maximum ${BATCH_LIMIT} applications per field batch.`,
        });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    if (action === 'claim') {
        // Verify none are already claimed by someone else
        const existing = await graph.query(
            queryQl(TEMP_TYPE, {
                where: {
                    _id:    { _in: applicationIds },
                    status: { _eq: 'pending' },
                    assignedTo: { _is_null: false },
                }
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        const claimedByOthers = existing.filter(a => a.assignedTo !== currentUser._id);
        if (claimedByOthers.length > 0) {
            return res.status(200).json({
                success: false,
                message: `${claimedByOthers.length} application(s) are already claimed by another investigator.`,
                conflicting: claimedByOthers.map(a => a.ciReferenceCode),
            });
        }

        // Claim all
        await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: { _id: { _in: applicationIds } },
                set: {
                    assignedTo:      currentUser._id,
                    assignedAt:      moment().toISOString(),
                    assignedByName: `${currentUser.firstName} ${currentUser.lastName}`,
                },
            })
        );

        // Return full application data for caching
        // Fetch branch info to include branchCode and branchName in cache
        const BRANCH_FIELDS = createGraphType('branches', '_id code name')('branches');
        const tempApps      = await graph.query(
            queryQl(
                createGraphType('temporaryLoanApplications', '_id branchId')('temporaryLoanApplications'),
                { where: { _id: { _in: applicationIds } } }
            )
        ).then(r => r.data?.temporaryLoanApplications ?? []);
        const allBranchIds  = [...new Set(tempApps.map(a => a.branchId))];

        const branchMap = {};
        if (allBranchIds.length > 0) {
            const branches = await graph.query(
                queryQl(BRANCH_FIELDS, { where: { _id: { _in: allBranchIds } } })
            ).then(r => r.data?.branches ?? []);
            branches.forEach(b => { branchMap[b._id] = b; });
        }

        const applications = await graph.query(
            queryQl(
                createGraphType('temporaryLoanApplications', `
                    _id ciReferenceCode status
                    firstName lastName middleName birthdate contactNumber
                    addressStreetNo addressBarangayDistrict addressMunicipalityCity
                    addressProvince addressZipCode address
                    loanAmount loanPurpose
                    guarantorFirstName guarantorLastName guarantorRelationship guarantorContactNumber
                    lafPhotoKey branchId submittedAt assignedTo assignedAt assignedByName
                `)('temporaryLoanApplications'),
                { where: { _id: { _in: applicationIds } } }
            )
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        // Enrich with branch info for offline display
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

    // Release — clear assignment for current user's claims only
    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: {
                _id:        { _in: applicationIds },
                assignedTo: { _eq: currentUser._id }, // only release own claims
            },
            set: {
                assignedTo:      null,
                assignedAt:      null,
                assignedByName: null,
            },
        })
    );

    return res.status(200).json({ success: true, message: 'Claims released.' });
}