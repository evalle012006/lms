import { connectToDatabase } from "@/lib/mongodb";
import logger from "@/logger";
import { getApiBaseUrl } from '@/lib/constants';

export default async function handler (req, res) {
    const { message } = req.body;
    logger.debug(req.body);
    
    fetch (getApiBaseUrl() + "email-automation");

    logger.debug('Google Pub/Sub: There are new emails received.');
    const response = {
        response: 'connected successfully!'
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
}
