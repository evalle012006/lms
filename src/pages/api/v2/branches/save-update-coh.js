import { BRANCH_COH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { findUserById } from '@/lib/graph.functions'; // CONFIRM this import path for findUserById
import { resolveCohEditPermission } from '@/lib/coh-permissions';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const BRANCH_COH_TYPE = createGraphType('branchCOH',`${BRANCH_COH_FIELDS}`)('results');

export default apiHandler({
    post: save
});

async function save(req, res) {
    const data = req.body;

    // Server-side is the authoritative gate for "at least 0" — the client's
    // cohValid check is UX only and can be bypassed by a direct API call.
    const numericAmount = Number(data.amount);
    if (data.amount === null || data.amount === undefined || data.amount === '' || isNaN(numericAmount) || numericAmount < 0) {
        return res.status(200).json({
            success: false,
            message: 'A valid Cash on Hand amount (0 or greater) is required.'
        });
    }

    if (!data.branchId || !data.dateAdded) {
        return res.status(200).json({
            success: false,
            message: 'branchId and dateAdded are required.'
        });
    }

    // ADDED: authoritative role / date / branch-status gate. Never 403 (that
    // triggers client-side logout) — 200 with success:false.
    const user = await findUserById(req.auth?.sub);
    const permission = await resolveCohEditPermission(user, data.branchId, data.dateAdded);
    if (!permission.canEdit) {
        return res.status(200).json({
            success: false,
            message: permission.reason
        });
    }

    const branchCOH = await graph.query(
        queryQl(BRANCH_COH_TYPE, {
            where: { branchId: { _eq: data.branchId },  dateAdded: { _eq: data.dateAdded } }
        })
    ).then(res => res.data.results);

    let response = {};
    let statusCode = 200;

    let updatedData;
    const previousAmount = branchCOH[0]?.amount ?? null;

    // breakdown is optional — `amount` is the directly-typed, authoritative
    // total. breakdown is supporting detail only, never validated against
    // amount, and can be null/empty.
    const breakdown = Array.isArray(data.breakdown) ? data.breakdown : null;

    if (branchCOH.length > 0) {
        const cohId = branchCOH[0]._id;

        [updatedData] = await graph.mutation(
            updateQl(BRANCH_COH_TYPE, {
                set: {
                    amount: numericAmount,
                    breakdown,
                    // CHANGED: from the verified token, not the request body
                    modifiedBy: user._id,
                    modifiedDateTime: new Date(),
                },
                where: { _id: { _eq: cohId } },
            })
        ).then(res => res.data.results.returning);
    } else {
        [updatedData] = await graph.mutation(
            insertQl(BRANCH_COH_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    amount: numericAmount,
                    breakdown,
                    branchId: data.branchId,
                    // CHANGED: from the verified token, not the request body
                    insertedBy: user._id,
                    // FIXED: was moment(getCurrentDate()) — a past-date insert
                    // silently landed on today's date instead of the requested one.
                    dateAdded: data.dateAdded,
                }]
            })
        ).then(res => res.data.results.returning);
    }

    // Audit trail for COH changes. Swap/extend with logAudit() once its
    // signature is confirmed.
    logger.info({
        page: 'save-update-coh',
        userId: user._id,
        role: user.role?.shortCode,
        branchId: data.branchId,
        dateAdded: data.dateAdded,
        previousAmount,
        newAmount: numericAmount,
    });

    response = {
        success: true,
        data: updatedData
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}