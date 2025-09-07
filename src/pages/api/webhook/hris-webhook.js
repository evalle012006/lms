import { apiHandler } from "@/services/api-handler";
import { webhookHandlers } from "@/pages/api/webhook/hris-webhook-handlers";

export default apiHandler({
  post: async function (req, res) {
    console.log('Received webhook event:', req.body)

    const payload = req.body;
    const handler = webhookHandlers[payload.table.name]?.[payload.event.op];
    if (!handler) {
      return res.status(400).end({
        message: `No webhook handler found for table=${payload.table.name} and event=${payload.event.op}`
      });
    }

    try {
      await handler(payload.event.data.new);
      res.status(201).end();
    } catch (error) {
      console.error('Error processing webhook event:', error);
      throw error;
    }
  },
});
