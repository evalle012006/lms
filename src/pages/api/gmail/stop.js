import { google } from "googleapis";
import { generateConfig } from "./util";
import axios from 'axios';
import logger from "@/logger";

const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

export default async function handler (req, res) {
    try {
        const url = 'https://gmail.googleapis.com/gmail/v1/users/hybridag@castledigital.com.au/stop';
        const { token } = await oAuth2Client.getAccessToken();
        const config = generateConfig(url, token, "post");
        const response = await axios(config);
        logger.debug(response.data);
        res.json(response.data);
    } catch (error) {
        logger.error(error);
        res.send(error);
    }
}