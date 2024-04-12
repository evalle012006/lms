import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import logger from '@/logger';
import { apiHandler } from '@/services/api-handler';
import fs from "fs";

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: deleteUser
});

async function deleteUser(req, res) {

    const { email = 'null' } = req.body;

    let statusCode = 200;
    let response = {};

    const user = await graph.query(
        queryQl(USER_TYPE, {
            email: { _eq: email },

        })
    ).then(res => res.data.users);

    if (user.length > 0) {
        await graph.mutation(
            deleteQl(USER_TYPE, {
                email: { _eq: email }
            })
        );

        user[0].profile && removeFile.removeFile(user[0].profile);

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


const removeFile = async (fileName) => {
    if (fileName) {
        const dir = `./public/images/profiles/${fileName}`;
        fs.rmdirSync(dir, { recursive: true });
        logger.debug(`User file ${fileName} deleted!`);
    } else {
        return false;
    }
}