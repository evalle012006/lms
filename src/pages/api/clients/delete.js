import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";

export default apiHandler({
  post: deleteUser,
});

async function deleteUser(req, res) {
  const { email } = req.body;

  const { db } = await connectToDatabase();

  let statusCode = 200;
  let response = {};

  const clients = await db.collection("client").find({ email: email }).toArray();

  if (clients.length > 0) {
    await db
        .collection('client')
        .updateOne(
            { email: email },
            {
                $set: { deleted: true },
                $currentDate: { dateModified: true }
            }
        );

    response = {
      success: true,
    };
  } else {
    response = {
      error: true,
      fields: ["email"],
      message: `Client with the email "${email}" not exists`,
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
