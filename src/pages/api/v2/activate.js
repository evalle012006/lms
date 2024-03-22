import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    post: activate
});


const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', '_id email password status')('users');

async function activate(req, res) {
    const { email } = req.body;
    await graph.mutation(
        updateQl(USER_TYPE, {
            set: {
                status: 'active',
                dateModified: 'now()'
            },
            where: {
                email: { _eq: email }
            }
        })
    )

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            email,
            status: 'active'
        }));
}