import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";

export default apiHandler({
  post: deleteUser,
});

async function deleteUser(req, res) {
  const { clientId } = req.body;
  const ObjectId = require('mongodb').ObjectId;
  const { db } = await connectToDatabase();

  let statusCode = 200;
  let response = {};

  const clients = await db.collection("client").find({ _id: ObjectId(clientId) }).toArray();

  if (clients.length > 0) {
    await db
        .collection('client')
        .deleteOne({ _id: ObjectId(clientId) });

    response = {
      success: true,
    };
  } else {
    response = {
      error: true,
      fields: ["id"],
      message: `Client with the id "${clientId}" not exists`,
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
