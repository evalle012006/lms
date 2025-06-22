
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    get: getFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');


async function getFundTransfer(req, res) {
    const { _id } = req.query;

    const [data] = await graph.query(
        queryQl(FUND_TRANSFER_TYPE, {
            where: {
                _id: { _eq: _id ?? null }
            }
        })
    ).then(res => res.data.results);

    res.send({
        success: true,
        data,
    });
}

