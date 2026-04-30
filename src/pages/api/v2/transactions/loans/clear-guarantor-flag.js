import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

// Minimal type — mutation only needs _id for the where clause
const LOAN_TYPE = createGraphType('loans', `_id guarantorDuplicate guarantorDuplicateReason status`)('loans');

export default apiHandler({
    post: handleGuarantorFlag,
});

async function handleGuarantorFlag(req, res) {
    const user_id = req?.auth?.sub;
    const { loanId, action, reason } = req.body;

    if (!loanId || !action) {
        return res.status(200).json({ success: false, message: 'loanId and action are required' });
    }

    if (!['flag', 'clear', 'reject'].includes(action)) {
        return res.status(200).json({ success: false, message: 'action must be "flag", "clear", or "reject"' });
    }

    if (action === 'reject' && !reason?.trim()) {
        return res.status(200).json({ success: false, message: 'Reason is required when rejecting' });
    }

    let set;
    if (action === 'flag') {
        set = { guarantorDuplicate: true, modifiedBy: user_id };
    } else if (action === 'clear') {
        set = { guarantorDuplicate: false, guarantorDuplicateReason: null, modifiedBy: user_id };
    } else {
        set = {
            guarantorDuplicate:       false,
            guarantorDuplicateReason: reason.trim(),
            status:                   'reject',
            modifiedBy:               user_id,
        };
    }

    await graph.mutation(
        updateQl(LOAN_TYPE, {
            set,
            where: { _id: { _eq: loanId } },
        })
    );

    return res.status(200).json({ success: true, action });
}