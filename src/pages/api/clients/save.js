import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const clientData = req.body;

  const { db } = await connectToDatabase();

  let response = {};
  let statusCode = 200;

  
    const client = await db.collection("client").insertOne({
      ...clientData,
      dateAdded: new Date(),
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
