// src/pages/api/v2/support/update.js
// POST { entity, id, changes, expected, reason, ticketRef?, acknowledgeWarnings? }
// Server-side enforcement is the source of truth: the same validation runs here, hard errors can never be saved,
// warnings need an explicit acknowledgement, and every save writes a support_edits row in the SAME transaction.
import { apiHandler } from '@/services/api-handler';
import { MIN_REASON_LENGTH } from '@/lib/support-edit-config';
import { requireSupportUser, prepareEdit, applyEdit, fail } from '@/lib/support-edit-service';

export default apiHandler({ post: update });

async function update(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const { entity, id, changes, expected, ticketRef, acknowledgeWarnings } = req.body ?? {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < MIN_REASON_LENGTH) return fail(res, `A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
    if (ticketRef != null && (typeof ticketRef !== 'string' || ticketRef.length > 100)) return fail(res, 'Ticket reference is invalid.');

    const prepared = await prepareEdit({ entity, id, proposed: changes, expected });
    if (prepared.error) return fail(res, prepared.error, prepared.stale ? { stale: true } : {});

    const { errors, warnings } = prepared.validation;
    if (errors.length) return fail(res, 'Fix the errors before saving.', { errors, warnings });
    if (warnings.length && acknowledgeWarnings !== true) return fail(res, 'Review and acknowledge the warnings to continue.', { errors, warnings, needsAcknowledgement: true });

    const { editId, record } = await applyEdit({
        req, user, entity, id, prepared, reason, ticketRef: ticketRef?.trim() || null,
        acknowledgedWarnings: warnings.length > 0,
    });
    return res.status(200).json({ success: true, editId, record, changes: prepared.changes });
}
