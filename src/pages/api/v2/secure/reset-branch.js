import { apiHandler } from "@/services/api-handler";
import fs from "fs";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, deleteQl, updateQl } from "@/lib/graph/graph.util";
import { findClients, findUsers } from "@/lib/graph.functions";

const graph = new GraphProvider();
const gType = (name) => createGraphType(name, '_id')();

export default apiHandler({
    post: reset
});

async function reset(req, res) {
    const { branchId } = req.body;
    
    // delete transactionals tables
    await graph.mutation(deleteQl(gType('cashCollections'), { branchId: { _eq: branchId } }));
    await graph.mutation(deleteQl(gType('groupCashCollections'), { branchId: { _eq: branchId } }));
    await graph.mutation(deleteQl(gType('loans'), { branchId: { _eq: branchId } }));
    await graph.mutation(deleteQl(gType('losTotals'), { branchId: { _eq: branchId } }));

    const clients = await findClients({ branchId: { _eq: branchId } });
    clients.map(async client => {
        const uid = client._id + '';
        if (fs.existsSync(`./public/images/clients/${uid}/`)) {
            fs.rmSync(`./public/images/clients/${uid}/`, { recursive: true, force: true });
        }
    });

    await graph.mutation(deleteQl(gType('client'), { branchId: { _eq: branchId } }));
    const los = await findUsers({
      role: { _contains: { rep: 4 } },
      designatedBranchId: { _eq: branchId },
    });

    los.map(async lo => {
        await db.collection('losTotals').deleteMany({ userId: lo._id + '' });
    });

    await graph.mutation(updateQl(gType('groups'), {
      where: { branchId: { _eq: branchId } },
      set: {
        status: 'available',
        noOfClients: 0,
        availableSlots: [
          1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
          21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40
        ]
      }
    }));

    res.send({success: true});
}