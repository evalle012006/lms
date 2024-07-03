import { apiHandler } from "@/services/api-handler";
import { findCashCollections } from "@/lib/graph.functions";

export default apiHandler({
  get: getLOStatus,
});

async function getLOStatus(req, res) {
    const { loId, currentDate } = req.query;

    const cashCollections = await findCashCollections({
      loId: { _eq: loId },
      dateAdded: { _eq: currentDate },
    });

    let status = 'closed';
    if (cashCollections.length === 0) {
        status = 'open';
    } else {
        const pendingCC = cashCollections.filter(cc => cc.status === 'pending');
        if (pendingCC.length > 0) {
            status = 'open';
        }
    }

    res.send({ success: true, status: status });
}