import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

// Minimal fields only — no nested relations, no heavy joins
const LOAN_TYPE = createGraphType('loans', `
    _id
    fullName
    slotNo
    status
    pnNumber
    coMaker
    coMakerId
    clientId
`)('loans');

export default apiHandler({
    get: checkCoMaker,
});

async function checkCoMaker(req, res) {
    const {
        groupId,
        coMakerId,
        clientId      = null,  // the loan applicant — cannot be their own co-maker
        excludeLoanId = null,
    } = req.query;

    if (!groupId || !coMakerId) {
        return res.status(200).json({
            success: false,
            message: 'groupId and coMakerId are required',
            loans:   [],
            count:   0,
        });
    }

    // Self co-maker check — immediate response, no DB query needed
    if (clientId && clientId === coMakerId) {
        return res.status(200).json({
            success:   true,
            selfCoMaker: true,
            count:     0,
            loans:     [],
        });
    }

    const where = {
        groupId:   { _eq: groupId },
        coMakerId: { _eq: coMakerId },
        status:    { _in: ['pending', 'active'] },
    };

    if (excludeLoanId) {
        where._id = { _neq: excludeLoanId };
    }

    const loans = await graph.query(
        queryQl(LOAN_TYPE, { where })
    ).then(r => r.data?.loans ?? []);

    return res.status(200).json({
        success:     true,
        selfCoMaker: false,
        count:       loans.length,
        loans:       loans.map(l => ({
            _id:      l._id,
            pnNumber: l.pnNumber,
            status:   l.status,
            fullName: l.fullName,
            slotNo:   l.slotNo,
        })),
    });
}