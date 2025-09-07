import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";

const graph = new GraphProvider();

export function insertRegion(region) {
  console.log(`Inserting region ${region.id} ${region.name}`);
  return graph.mutation(
    insertQl(createGraphType("regions", "_id")(), {
      objects: [
        {
          _id: region.id,
          areaIds: [], // TODO: check if still needed
          dateAdded: region.create_date,
          dateModified: region.modify_date,
          managerIds: [], // TODO:
          name: region.name,
          divisionId: region.division_id,
          hrisId: region.id,
        },
      ],
    })
  );
}

export function updateRegion(region) {
  console.log(`Updating region ${region.id} ${region.name}`);
  return graph.mutation(
    updateQl(createGraphType("regions", "_id")(), {
      set: {
        areaIds: [], // TODO: check if still needed
        managerIds: [], // TODO:
        name: region.name,
        divisionId: region.division_id,
        dateModified: region.modify_date,
      },
      where: { hrisId: region.id },
    })
  );
}
