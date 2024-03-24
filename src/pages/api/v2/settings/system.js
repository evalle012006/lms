import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { SETTINGS_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();
const settingsType = createGraphType('settings', SETTINGS_FIELDS)();

export default apiHandler({
    post: updateSystemSettings,
    get: getSystemSettings
});

async function getSystemSettings(req, res) {
    const { data } = await graph.query(queryQl(settingsType));
    res.send({ success: true, system: data?.settings?.[0] });
}

async function updateSystemSettings(req, res) {
    const { _id, ...system } = req.body;
    const { data } = await graph.mutation(
      updateQl(settingsType, {
        set: system,
        where: { _id: { _eq: _id } },
      })
    );
    res.send({ success: true, system: data?.settings?.returning?.[0] });
}