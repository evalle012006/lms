import { apiHandler } from "@/services/api-handler";
import { connectToDatabase } from "@/lib/mongodb";

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const { name, propertyName, propertyAddress, contact, number, email } = req.body;

  const { db } = await connectToDatabase();

  const clients = await db
    .collection("client")
    .find({ email: email })
    .toArray();

  const companies = await db
      .collection('client')
      .aggregate([
          { $project: { name: { $toLower: "$name" }}},
          { $match: { name: `${name.toLowerCase()}` }},
          { $group: { _id: "$name" }}
      ])
      .toArray();

  let response = {};
  let statusCode = 200;

  if (clients.length) {
    response = {
      error: true,
      fields: ["email"],
      message: `Client with the email "${email}" already exists`,
    };
  }
  else if (companies.length) {
    response = {
      error: true,
      fields: ["name"],
      message: `Company "${name}" already exists`,
    };
  } else {
    const client = await db.collection("client").insertOne({
      name,
      propertyName,
      propertyAddress,
      contact,
      number,
      email,
      dateAdded: new Date(),
    });

    response = {
      success: true,
      client,
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
