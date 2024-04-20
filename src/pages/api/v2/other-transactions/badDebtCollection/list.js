import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl } from "@/lib/graph/graph.util";
import {
  createBadDebtCollectionsType,
  fieldsForList,
  toDto,
} from "@/pages/api/v2/other-transactions/badDebtCollection/common";
import { findUserById } from "@/lib/graph.functions";

const graph = new GraphProvider();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  const { loId, branchId, currentUserId } = req.query;
  let filter;

  if (loId) {
    filter = { loId: { _eq: loId } };
  } else if (branchId) {
    filter = { branchId: { _eq: branchId } };
  } else if (currentUserId) {
    const user = await findUserById(currentUserId);
    if (user) {
      if (user.areaId && user.role.shortCode === "area_admin") {
        filter = { branch: { areaId: { _eq: user.areaId } } };
      } else if (user.regionId && user.role.shortCode === "regional_manager") {
        filter = { branch: { regionId: { _eq: user.regionId } } };
      } else if (user.divisionId && user.role.shortCode === "deputy_director") {
        filter = { branch: { divisionId: { _eq: user.divisionId } } };
      }
    }
  } else {
    filter = { branch: { _id: { _is_null: false } } };
  }

  let graphRes;
  if (filter) {
    graphRes = await graph.query(
      queryQl(createBadDebtCollectionsType(fieldsForList), {
        where: filter,
      })
    );
  }

  res.send({
    success: true,
    data: graphRes?.data?.badDebtCollections?.map(toDto) ?? [],
  });
}
