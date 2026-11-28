// src/pages/api/v2/support/validate.js
// POST { entity, id, changes: { field: value }, expected? }  — DRY RUN. Writes nothing.
// Returns the field diff + hard errors + soft warnings so the page can show them before the editor saves.
import { apiHandler } from '@/services/api-handler';
import { requireSupportUser, prepareEdit, fail } from '@/lib/support-edit-service';

export default apiHandler({ post: validate });

async function validate(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const { entity, id, changes, expected } = req.body ?? {};
    const p = await prepareEdit({ entity, id, proposed: changes, expected });
    if (p.error) return fail(res, p.error, p.stale ? { stale: true } : {});
    return res.status(200).json({ success: true, changes: p.changes, errors: p.validation.errors, warnings: p.validation.warnings });
}
