import { createGraphType, insertQl, updateQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";

const graph = new GraphProvider();

export function insertDivision(division) {
  console.log(`Inserting division ${division.id} ${division.name}`);
  return graph.mutation(
    insertQl(createGraphType("divisions", "_id")(), {
      objects: [
        {
          _id: division.id,
          name: division.name,
          managerIds: [], // TODO:
          regionIds: [], // TODO:
          dateAdded: division.create_date,
          dateModified: division.modify_date,
          hrisId: division.id,
        },
      ],
    })
  );
}

export function updateDivision(division) {
  console.log(`Updating region ${division.id} ${division.name}`);
  return graph.mutation(
    updateQl(createGraphType("regions", "_id")(), {
      set: {
        name: division.name,
        managerIds: [], // TODO:
        regionIds: [], // TODO:
        dateModified: division.modify_date,
      },
      where: { hrisId: division.id },
    })
  );
}
