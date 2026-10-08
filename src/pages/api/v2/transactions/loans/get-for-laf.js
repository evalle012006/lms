// src/pages/api/v2/transactions/loans/get-for-laf.js
// GET ?loanId= — one loan in the shape the existing LAFModal expects
// (loan fields + client + branch as a 1-item ARRAY + group + loanOfficer),
// i.e. what loans/list.js's row mapper produces for the classic page.
//
// Read-only. Scope-checked: the loan must be inside the caller's branch scope
// (and, for loan officers, be their own) — a bare loanId is not enough.
// Biometric material is stripped; the LAF print doesn't need it.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { BRANCH_FIELDS, CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';

const graph = new GraphProvider();

const LOAN_TYPE = createGraphType('loans', `
    ${LOAN_FIELDS}
    client { ${CLIENT_FIELDS} }
    branch { ${BRANCH_FIELDS} }
    group { ${GROUP_FIELDS} }
    loanOfficer { _id firstName lastName loNo }
`)('loans');

export default apiHandler({ get: getForLaf });

async function getForLaf(req, res) {
    try {
        const currentUser = await findUserById(req.auth.sub);
        if (!currentUser) {
            return res.status(200).json({ success: false, message: 'User not found.' });
        }

        const loanId = Array.isArray(req.query.loanId) ? req.query.loanId[0] : req.query.loanId;
        if (!loanId) {
            return res.status(200).json({ success: false, message: 'loanId is required.' });
        }

        const { branchIds } = await resolveLoanBranchScope(currentUser);
        if (branchIds && branchIds.length === 0) {
            return res.status(200).json({ success: false, message: 'Loan not found.' });
        }

        const and = [{ _id: { _eq: loanId } }];
        if (branchIds) and.push({ branchId: { _in: branchIds } });
        const isAdminLevel = currentUser.root === true || currentUser.role?.rep === 1;
        if (currentUser.role?.rep === 4 && !isAdminLevel) and.push({ loId: { _eq: currentUser._id } });

        const [loan] = await graph
            .query(queryQl(LOAN_TYPE, { where: { _and: and }, limit: 1 }))
            .then((r) => r.data?.loans ?? []);

        if (!loan) {
            return res.status(200).json({ success: false, message: 'Loan not found.' });
        }

        // eslint-disable-next-line no-unused-vars
        const { faceTemplate, biometricPublicKey, ...safeClient } = loan.client ?? {};

        return res.status(200).json({
            success: true,
            loan: {
                ...loan,
                client: loan.client ? safeClient : loan.client,
                branch: loan.branch ? [loan.branch] : [],
            },
        });
    } catch (e) {
        console.error('[loans/get-for-laf] failed', e);
        return res.status(200).json({ success: false, message: 'Failed to load loan.' });
    }
}