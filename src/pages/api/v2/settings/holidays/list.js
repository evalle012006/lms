import { apiHandler } from "@/services/api-handler";

import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl } from "@/lib/graph/graph.util";
import { holidayType } from '@/pages/api/v2/settings/holidays/common';

const graph = new GraphProvider();

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { data } = await graph.query(queryQl(holidayType));
    res.send({ success: true, holidays: data?.holidays ?? {} });
}
