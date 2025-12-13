import { getSettingsSystemDate } from '@/lib/graph.functions';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

export default apiHandler({
    get: getSystemCurrentDate
});

async function getSystemCurrentDate(req, res) {
    const dt = await getSettingsSystemDate();

    let statusCode = 200;
    let response = {};
    let currentDate = dt.toLocaleDateString({}, { timeZone: 'Asia/Manila' });
    let currentTime = dt.toLocaleTimeString({}, { timeZone: 'Asia/Manila' });

    response = {
        success: true,
        currentDate: moment(currentDate).format('YYYY-MM-DD'),
        currentTime: currentTime
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}