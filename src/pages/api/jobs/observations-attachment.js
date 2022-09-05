import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    post: updateObservation
});

async function updateObservation(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = { upload: true, success: false };
    const ObjectId = require('mongodb').ObjectId;

    const form = new formidable.IncomingForm({ multiples: true, keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            const commentId = ObjectId();
            let observationData = await db.collection('observations').find({ _id: ObjectId(fields._id) }).toArray();

            let filesUrl = [];
            for (let i = 0; i < Object.keys(files).length; i++) {
                filesUrl.push(await saveFile(files['attachment-' + i], commentId.toString()));
            }

            if (err) {
                resolve({ formError: true })
            }
            const observationId = fields._id;
            const attachments = filesUrl ? filesUrl : [];
            fields.attachments = attachments;
            fields._id = commentId;
            let updatedComments = observationData[0].comments ? observationData[0].comments : [];
            updatedComments.push(fields);
            observationData[0].comments = updatedComments;

            const observationResponse = await db
                .collection('observations')
                .updateMany(
                    { _id: ObjectId(observationId) },
                    {
                        $set: {
                            comments: updatedComments
                        }
                    }
                );

            resolve({ success: true, observation: observationData[0] });
        });
    });

    response = { ...response, success: true, promise};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const saveFile = async (file, uid) => {
    if (file) {
        const data = fs.readFileSync(file.filepath);

        if (!fs.existsSync(`./public/attachments/observations/`)) {
            fs.mkdirSync(`./public/attachments/observations/`, { recursive: true });
        }

        if (fs.existsSync(`./public/attachments/observations/${uid}/`)) {
            // check if file exists 
            fs.existsSync(`./public/attachments/observations/${uid}/${file.originalFilename}`) && fs.unlinkSync(`./public/attachments/observations/${uid}/${file.originalFilename}`);
        } else {
            fs.mkdirSync(`./public/attachments/observations/${uid}/`);
        }

        fs.writeFileSync(`./public/attachments/observations/${uid}/${file.originalFilename}`, data);
        await fs.unlinkSync(file.filepath);

        return {
            path: uid + '/' + file.originalFilename,
            size: file.size,
            type: file.mimetype
        };
    } else {
        return false;
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
}