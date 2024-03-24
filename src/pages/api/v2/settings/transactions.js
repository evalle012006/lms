import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { TRANSACTION_SETTINGS_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();
const txnSettingsType = createGraphType('transactionSettings', TRANSACTION_SETTINGS_FIELDS)('txn_settings');

export default apiHandler({
    post: updateTransactionsSettings,
    get: getTransactionsSettings
});

async function getTransactionsSettings(req, res) {
    const { data } = await graph.query(queryQl(txnSettingsType));
    res.send({ success: true, transactions: data?.txn_settings?.[0] });
}

async function updateTransactionsSettings(req, res) {
    const { _id, ...transactions } = req.body;
    const { data } = await graph.mutation(
      updateQl(txnSettingsType, {
        set: transactions,
        where: { _id: { _eq: _id } },
      })
    );

    res.send({
      success: true,
      transactions: data?.txn_settings?.returning?.[0],
    });
}