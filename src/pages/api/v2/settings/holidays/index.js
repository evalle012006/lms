import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl, updateQl } from "@/lib/graph/graph.util";
import { holidayType } from "@/pages/api/v2/settings/holidays/common";

const graph = new GraphProvider();

export default apiHandler({
    get: getHoliday,
    post: updateHoliday
});

async function getHoliday(req, res) {
    const { _id } = req.query;

    const { data } = await graph.query(
      queryQl(holidayType, { where: { _id: { _eq: _id } } })
    );

    res.send({ success: true, holiday: data?.holidays?.[0] });
}

async function updateHoliday(req, res) {
    const { _id, ...holiday } = req.body;
    let response;

    try {
        const {data} = await graph.mutation(updateQl(
            holidayType,
            {
                set: holiday,
                where: {_id: {_eq: _id}},
            }
        ));
        response = { success: true, holiday: data?.holidays?.returning?.[0] };
    } catch (e) {
        response = { error: true, fields: ['date'], message: `Holiday with date "${holiday.date}" already exists.`};
    }

    res.send(response);
}