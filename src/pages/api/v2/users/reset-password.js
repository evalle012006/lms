import { USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { generateTempPassword } from '@/lib/generate-password';

const bcrypt = require('bcryptjs');

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

export default apiHandler({
    post: resetUserPassword
});

// CHANGED (this round): resetting now generates a real temporary password
// instead of blanking it to "". Previously an empty password meant the
// NO_PASS login branch accepted literally any input as the password on the
// next attempt — convenient, but "reset" didn't actually lock anything
// down until the user chose a new password themselves. Now the admin gets
// a specific value to hand to the user, and that value is what's required
// to log in — the plaintext is returned once in this response for the
// admin to relay; it is never stored or logged anywhere in plaintext.
//
// CHANGED (last round, kept): also clears biometric registration — see
// prior comment history. A password reset should not leave fingerprint
// login intact.
async function resetUserPassword(req, res) {
    let statusCode = 200;
    let response = {};

    const user = req.body;
    const userId = user._id;

    const tempPassword = generateTempPassword();
    const hashedPassword = bcrypt.hashSync(tempPassword, bcrypt.genSaltSync(8), null);

    const [userResp] = await graph.mutation(
        updateQl(USER_TYPE, {
            set: {
                password: hashedPassword,
                biometricCredentialId: null,
                biometricPublicKey:    null,
                biometricCounter:      0,
                biometricRegisteredAt: null,
                biometricDeviceName:   null,
            },
            where: {
                _id: { _eq: userId }
            }
        })
    ).then(res => res.data.users.returning);

    if (!userResp) {
        response = { error: true, message: 'User not found.' };
    } else {
        delete userResp.password; // never echo the hash back
        response = { success: true, user: userResp, tempPassword };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}