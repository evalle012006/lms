import { apiHandler } from "@/services/api-handler";
import { generateUUID, getCurrentDate } from "@/lib/utils";
import moment from "moment";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { insertQl } from "@/lib/graph/graph.util";
import { holidayType } from "@/pages/api/v2/settings/holidays/common";

const graph = new GraphProvider();

export default apiHandler({
    post: save
});

async function save(req, res) {
    const holidayData = {
        ...req.body,
        _id: generateUUID(),
        dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
    };

    let data, errors;
    try {
        ({data, errors} = await graph.mutation(insertQl(holidayType, {objects: [holidayData]})))
    } catch (e) {
        errors = [e];
    }

    let response;
    if (errors?.length) {
        response = { error: true, fields: ['date'], message: `Holiday with date "${holidayData.date}" already exists.`};
    } else {
        response = { success: true, holiday: data?.holidays?.returning?.[0] };
    }

    res.send(response);
}