import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const clientData = req.body;

  const { db } = await connectToDatabase();

  let response = {};
  let statusCode = 200;

  // should check if the full name exist already
    const client = await db.collection("client").insertOne({
      ...clientData,
      dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
    });

    response = {
      success: true,
      client: client
    };

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
