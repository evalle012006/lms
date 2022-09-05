import { connectToDatabase } from "@/lib/mongodb";
import { google } from "googleapis";
import { generateConfig } from "./util";
import logger from "@/logger";
import axios from 'axios';

const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

export default async function handler (req, res) {
    try {
        const url = `https://gmail.googleapis.com/gmail/v1/users/hybridag@castledigital.com.au/messages`;
        const { token } = await oAuth2Client.getAccessToken();
        const config = generateConfig(url, token);
        const response = await axios(config);
        // res.json(response.data);

        // save to database
        logger.debug("SAVING MESSAGE ID TO DATABASE");
        if (response.data && response.data.messages) {
            const messages = response.data.messages;
            messages.map(msg => {
                save(msg.id);
            });
        }

        res.json({success: true, message: 'Done getting message from gmail.'})
    } catch (error) {
        logger.error(error);
        res.send(error);
    }
}

const save = async (msgId) => {
    let newMessageSaved = false;
    const { db } = await connectToDatabase();
    const messageDbId = await db.collection('emails').find({ messageId: msgId }).project({ _id: 0 }).toArray();
    
    if (messageDbId.length === 0) {
        const email = await db.collection('emails').insertOne({
            messageId: msgId,
            processed: false,
            dateAdded: new Date()
        });

        logger.debug(email);
        newMessageSaved = true;
    }

    return newMessageSaved;
}