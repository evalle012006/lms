import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

export default apiHandler({
    get: getSystemCurrentDate
});

async function getSystemCurrentDate(req, res) {
    const currentDate = new Date().toLocaleDateString({}, { timeZone: 'Asia/Manila' });
    const currentTime = new Date().toLocaleTimeString({}, { timeZone: 'Asia/Manila' });
    const response = {
        success: true,
        currentDate: moment(currentDate).format('YYYY-MM-DD'),
        currentTime: currentTime
    }

    res.send(response);
}