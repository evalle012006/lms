import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

export default apiHandler({
    get: getSystemCurrentDate
});

async function getSystemCurrentDate(req, res) {
    let statusCode = 200;
    let response = {};
    let currentDate = new Date().toLocaleDateString({}, { timeZone: 'Asia/Manila' });

    response = {
        success: true,
        currentDate: moment(currentDate).format('YYYY-MM-DD')
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}