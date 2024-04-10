import { createGraphType } from "@/lib/graph/graph.util";
import { BAD_DEBT_COLLECTIONS_FIELDS } from "@/lib/graph.fields";

export const badDebtCollectionsType = createGraphType(
  "badDebtCollections",
  BAD_DEBT_COLLECTIONS_FIELDS
)();