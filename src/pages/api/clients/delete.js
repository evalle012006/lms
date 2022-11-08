import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";

export default apiHandler({
  post: deleteUser,
});

async function deleteUser(req, res) {
  const { _id } = req.body;
  const ObjectId = require('mongodb').ObjectId;
  const { db } = await connectToDatabase();

  let statusCode = 200;
  let response = {};

  const clients = await db.collection("client").find({ _id: ObjectId(_id) }).toArray();

  if (clients.length > 0) {
    await db
        .collection('client')
        .deleteOne({ _id: ObjectId(_id) });

    response = {
      success: true,
    };
  } else {
    response = {
      error: true,
      fields: ["id"],
      message: `Client with the id "${_id}" not exists`,
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
