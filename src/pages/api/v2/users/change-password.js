import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const bcrypt = require('bcryptjs');

const graph = new GraphProvider();

// Needs `password` explicitly appended — USER_FIELDS doesn't include it by
// default (same pattern already used in pages/api/v2/verify-password.js).
const USER_TYPE_WITH_PASSWORD = createGraphType('users', `
${USER_FIELDS}
password
`)('users');

const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: changePassword
});

// This is the user-initiated "I know my current password and want to set
// my own" flow — distinct from:
//   - pages/api/v2/users/reset-password.js  (admin-triggered, issues a new
//     temp password, doesn't need the old one, also clears biometrics)
//   - pages/api/v2/reset-password.js        (token/link-based "forgot
//     password" flow, doesn't verify a current password either)
// This is the only one of the three that requires proving you know the
// existing password before changing it — appropriate here since it's used
// right after a normal login with a temp password, not as an account-
// recovery mechanism.
async function changePassword(req, res) {
    let statusCode = 200;
    let response = {};

    const { _id, currentPassword, newPassword } = req.body;

    if (!_id || !currentPassword || !newPassword) {
        response = { error: true, message: 'Missing required fields.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    if (String(newPassword).length < 8) {
        response = { error: true, message: 'New password must be at least 8 characters.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    const [user] = await graph.query(
        queryQl(USER_TYPE_WITH_PASSWORD, { where: { _id: { _eq: _id } } })
    ).then(r => r.data.users);

    if (!user) {
        response = { error: true, message: 'User not found.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    if (!user.password || !bcrypt.compareSync(currentPassword, user.password)) {
        response = { error: true, message: 'Current password is incorrect.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    if (bcrypt.compareSync(newPassword, user.password)) {
        response = { error: true, message: 'New password must be different from your current password.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    const hashedPassword = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(8), null);

    const [updated] = await graph.mutation(
        updateQl(USER_TYPE, {
            set: {
                password: hashedPassword,
                mustChangePassword: false,
            },
            where: { _id: { _eq: _id } }
        })
    ).then(r => r.data.users.returning);

    if (!updated) {
        response = { error: true, message: 'Failed to update password.' };
        return res.status(statusCode).setHeader('Content-Type', 'application/json').end(JSON.stringify(response));
    }

    delete updated.password;
    response = { success: true, user: updated };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}