import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

// Minimal fields only — no client join, no heavy nested queries
const LOAN_TYPE = createGraphType('loans', `
    _id
    fullName
    pnNumber
    status
    groupName
    slotNo
    loId
    guarantorFirstName
    guarantorLastName
    branchId
`)('loans');

export default apiHandler({
    get: checkGuarantor,
});

async function checkGuarantor(req, res) {
    const {
        branchId,
        guarantorFirstName,
        guarantorLastName,
        excludeLoanId = null,
    } = req.query;

    if (!branchId || !guarantorFirstName || !guarantorLastName) {
        return res.status(200).json({ success: false, message: 'Missing required params', loans: [], count: 0 });
    }

    const where = {
        branchId:           { _eq: branchId },
        guarantorFirstName: { _ilike: guarantorFirstName.trim() },
        guarantorLastName:  { _ilike: guarantorLastName.trim() },
        status:             { _in: ['pending', 'active'] },
    };

    if (excludeLoanId) {
        where._id = { _neq: excludeLoanId };
    }

    const loans = await graph.query(
        queryQl(LOAN_TYPE, { where })
    ).then(r => r.data?.loans ?? []);

    return res.status(200).json({
        success: true,
        count:   loans.length,
        loans:   loans.map(l => ({
            _id:               l._id,
            pnNumber:          l.pnNumber,
            status:            l.status,
            clientFullName:    l.fullName || '—',
            groupName:         l.groupName,
            slotNo:            l.slotNo,
            guarantorFirstName: l.guarantorFirstName,
            guarantorLastName:  l.guarantorLastName,
        })),
    });
}