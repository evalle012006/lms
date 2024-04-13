import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { GraphProvider } from '@/lib/graph/graph.provider'
import { queryQl } from '@/lib/graph/graph.util'
import {
  createBadDebtCollectionsType,
  fieldsForList,
  toDto
} from '@/pages/api/v2/other-transactions/badDebtCollection/common'

const graph = new GraphProvider();

export default apiHandler({
    get: list
});

async function list(req, res) {
    let graphRes;
    const { loId, branchId, currentUserId } = req.query;

    if (loId) {
      graphRes = await graph.query(
        queryQl(createBadDebtCollectionsType(fieldsForList), {
          where: { loId: { _eq: loId } },
        })
      );
    } else {
        if (branchId) {
          graphRes = await graph.query(
            queryQl(createBadDebtCollectionsType(fieldsForList), {
              where: { branchId: { _eq: branchId } },
            })
          );
        } else {
            if (currentUserId) {
                const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
                if (user.length > 0) {
                    let branchIds = [];
                    if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                        const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                        const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                        const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                        branchIds = branches.map(branch => branch._id.toString());
                    }

                    const data = [];
                    const promise = await new Promise(async (resolve) => {
                        const response = await Promise.all(branchIds.map(async (branchId) => {
                            data.push.apply(data, await getByBranch(branchId));
                        }));

                        resolve(response);
                    });

                    if (promise) {
                        graphRes = data;
                    }
                }
            } else {
              graphRes = await graph.query(
                queryQl(createBadDebtCollectionsType(fieldsForList), {
                  where: { branch: { _id: { _is_null: false } } },
                })
              );
            }
        }
    }
    
    res.send({ success: true, data: graphRes?.data?.badDebtCollections?.map(toDto) });
}