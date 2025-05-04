import { CLIENT_FIELDS } from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl } from "@/lib/graph/graph.util";
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from "@/services/api-handler";
import moment from 'moment';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
${CLIENT_FIELDS}
`)('clients');

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const clientData = req.body;


  let response = {};
  let statusCode = 200;

  // should check if the full name exist already
  const client = await graph.mutation(
    insertQl(CLIENT_TYPE, {
      objects: [{
        _id: generateUUID(),
        ... clientData,
        dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD'),
      }]
    })
  ).then(res => res.data?.clients?.returning?.[0]);

  response = {
    success: true,
    client: client
  };

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
