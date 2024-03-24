import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { deleteQl } from "@/lib/graph/graph.util";
import { holidayType } from "@/pages/api/v2/settings/holidays/common";

const graph = new GraphProvider();

export default apiHandler({
    post: deleteHoliday
});

async function deleteHoliday(req, res) {
    const { _id } = req.body;
    const { data } = await graph.mutation(
      deleteQl(holidayType, { _id: { _eq: _id } })
    );

    let response;
    if (!data?.holidays?.returning?.length) {
        response = {
          error: true,
          message: `Holiday with id: "${_id}" not exists`,
        };
    } else {
        response = { success: true }
    }

    res.send(response);
}
