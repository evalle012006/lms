// src/pages/api/v2/transactions/loans/reinstate.js
// POST { loanId, reason } — put a REJECTED loan back to pending.
//
// Admin and supervisors only (canReinstateRejectedLoans), inside their branch scope.
// Branch managers and loan officers can LOOK at rejected loans, never change them, so
// this is enforced here and not just by hiding the button.
//
// The loan goes back to PENDING, never active: it re-enters the normal approval flow
// (see loan-reinstate.js for the rules). The loan and its group slot change in ONE
// mutation, so either both happen or neither does. Every call is audited.
//
// Always HTTP 200 with { success }: a 403 would trigger the client-side logout.

import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { GROUP_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { filterGraphFields, findGroups, findLoans } from '@/lib/graph.functions';
import { requireApprover } from '@/lib/api/loanApprovalGates';
import { canReinstateRejectedLoans } from '@/lib/loan-application-v2-gate';
import { planReinstate, REINSTATE_REASON_MAX } from '@/lib/loan-reinstate';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();
const loanType = createGraphType('loans', LOAN_FIELDS);
const groupType = createGraphType('groups', GROUP_FIELDS);

const OTHER_LOAN_FIELDS = '_id status loanCycle groupId groupName insertedDateTime dateAdded';
const BEFORE_KEYS = ['status', 'loanCycle', 'rejectReason', 'ldfApproved', 'ldfApprovedDate', 'closedDate', 'fullPaymentDate'];

const fail = (res, message) => res.status(200).json({ success: false, message });
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? null]));

export default apiHandler({ post: reinstate });

async function reinstate(req, res) {
    try {
        const loanId = typeof req.body?.loanId === 'string' ? req.body.loanId.trim() : '';
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
        if (!loanId) return fail(res, 'Loan id is required.');
        if (!reason) return fail(res, 'A reason is required to reinstate a loan.');
        if (reason.length > REINSTATE_REASON_MAX) return fail(res, 'The reason is too long.');

        const caller = await requireApprover(req);
        if (caller.error) return fail(res, caller.error);
        if (!canReinstateRejectedLoans(caller.user)) {
            return fail(res, 'Only an administrator or supervisor can reinstate a rejected loan.');
        }

        // Scope: null branchIds = every branch (root / admin), otherwise only these.
        const and = [{ _id: { _eq: loanId } }];
        if (caller.scope.branchIds) and.push({ branchId: { _in: caller.scope.branchIds } });
        const [loan] = await findLoans({ _and: and });
        if (!loan) return fail(res, 'Loan not found, or it is outside your branches.');

        const [group] = await findGroups({ _id: { _eq: loan.groupId } });
        const otherLoans = await findLoans(
            { clientId: { _eq: loan.clientId }, _id: { _neq: loan._id } },
            OTHER_LOAN_FIELDS
        );

        const now = new Date().toISOString();
        const plan = planReinstate({ loan, group, otherLoans, now });
        if (!plan.ok) return fail(res, plan.message);

        await graph.mutation(
            // status = 'reject' in the where: a second click or a parallel request cannot apply twice.
            updateQl(loanType('reinstate_loan'), {
                where: { _id: { _eq: loanId }, status: { _eq: 'reject' } },
                set: filterGraphFields(LOAN_FIELDS, plan.loanPatch),
            }),
            updateQl(groupType('reinstate_group'), {
                where: { _id: { _eq: loan.groupId } },
                set: plan.groupPatch,
            })
        );

        const user = caller.user;
        logAudit(req, {
            action: 'LOAN_REINSTATED',
            category: 'LOAN',
            severity: 'WARNING',
            entityType: 'loan',
            entityId: loanId,
            clientId: loan.clientId,
            branchId: loan.branchId,
            userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
            userRole: user.role?.shortCode || null,
            description: `Rejected loan reinstated to pending (cycle ${plan.loanCycle}): ${reason}`,
            beforeData: { ...pick(loan, BEFORE_KEYS), slotNo: loan.slotNo, groupId: loan.groupId },
            afterData: { ...pick(plan.loanPatch, BEFORE_KEYS), slotNo: loan.slotNo, groupId: loan.groupId },
            metadata: { reason, groupBefore: pick(group, ['availableSlots', 'noOfClients', 'status']), groupAfter: plan.groupPatch },
        });

        return res.status(200).json({ success: true, loanCycle: plan.loanCycle });
    } catch (e) {
        logger.error({ page: 'Reinstate loan', error: e.message });
        return fail(res, 'The loan could not be reinstated. Please try again.');
    }
}
