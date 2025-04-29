import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'node_modules/moment/moment';

export default apiHandler({
    post: testOnly
});

async function testOnly(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    const spaceUrl = "https://ambercashph.sgp1.digitaloceanspaces.com";

    // Update all users in the database
    // await db.collection('users').updateMany(
    //   { profile: { $exists: true, $ne: "" } },
    //   [
    //     {
    //       $set: {
    //         profile: {
    //           $concat: [
    //             spaceUrl,
    //             "/lms/profiles/",
    //             { $toString: "$_id" },
    //             "/profile-00.jpg"
    //           ]
    //         }
    //       }
    //     }
    //   ]
    // );

    await db.collection('client').updateMany(
      { profile: { $exists: true, $ne: "" }, updatedProfile: { $exists: false, $ne: true } },
      [
        {
          $set: {
            profile: {
              $concat: [
                spaceUrl,
                "/lms/clients/",
                { $toString: "$_id" },
                "/profile-00.jpg"
              ]
            },
            updatedProfile: true
          }
        }
      ]
    );

    const result = await db.collection('users').find({ profile: { $regex: `^${spaceUrl}` } })
      .limit(5)

    response = { success: true, data: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
