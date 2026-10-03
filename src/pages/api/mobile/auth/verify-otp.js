import getConfig from 'next/config';
import moment from 'moment';
import bcrypt from 'bcryptjs';

const jwt = require('jsonwebtoken');

import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { issueRefreshToken } from '@/services/refresh-token-service';
import { logEnrollmentAttempt } from '@/services/enrollment-attempt-log';
import { generateUUID } from '@/lib/utils';
import { normalizePhone } from '@/lib/phone-utils';

const { serverRuntimeConfig } = getConfig();
const graph = new GraphProvider();

const MAX_ATTEMPTS = 3;

const OTP_TYPE = createGraphType('client_otp_codes', `
  _id contact_number purpose code_hash expires_at consumed_at attempt_count client_id
`)('client_otp_codes');

// _id is app-generated text — see the naming note in request-otp.js.
const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id contact_number status
`)('client_accounts');

// Checked live at every login — not just at enrollment time. A client whose
// underlying record moves out of 'active' (loan closed, account archived,
// etc.) after they already registered for the app shouldn't keep silent
// access just because their client_accounts row is still marked active.
const CLIENT_STATUS_TYPE = createGraphType('client', `_id status`)('clients');

async function isClientActive(clientId) {
    const [client] = await graph.query(
        queryQl(CLIENT_STATUS_TYPE, { where: { _id: { _eq: clientId } } })
    ).then(r => r.data?.clients ?? []);
    return client?.status === 'active';
}

export default clientApiHandler({
    post: verifyOtp
});

async function verifyOtp(req, res) {
    try {
        const { contactNumber, code } = req.body;

        if (!contactNumber || !code) {
            return res.status(400).json({ success: false, message: 'contactNumber and code are required' });
        }

        const normalized = normalizePhone(contactNumber);

        const [otp] = await graph.query(
            queryQl(OTP_TYPE, {
                where: {
                    contact_number: { _eq: normalized },
                    consumed_at:    { _is_null: true },
                },
                order_by: [{ created_at: 'desc' }],
                limit: 1,
            })
        ).then(r => r.data?.client_otp_codes ?? []);

        if (!otp) {
            return res.status(400).json({ success: false, message: 'No pending verification code for this number. Request a new one.' });
        }

        if (moment().isAfter(moment(otp.expires_at))) {
            if (otp.purpose === 'enrollment') {
                await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'otp_failed', contactNumber: normalized, clientId: otp.client_id, detail: 'Code expired' });
            }
            return res.status(400).json({ success: false, code: 'EXPIRED', message: 'Code expired. Request a new one.' });
        }

        if (otp.attempt_count >= MAX_ATTEMPTS) {
            return res.status(403).json({
                success: false,
                code: otp.purpose === 'login' ? 'ACCOUNT_LOCKED' : 'ENROLLMENT_LOCKED',
                message: otp.purpose === 'login'
                    ? 'Too many incorrect attempts. Your account has been locked. Please contact your branch or an administrator to reactivate it.'
                    : 'Too many incorrect attempts. Please visit your branch to activate mobile access.'
            });
        }

        const matches = bcrypt.compareSync(code, otp.code_hash);

        if (!matches) {
            const newAttemptCount = otp.attempt_count + 1;

            await graph.mutation(
                updateQl(OTP_TYPE, {
                    set: { attempt_count: newAttemptCount },
                    where: { _id: { _eq: otp._id } }
                })
            );

            if (newAttemptCount >= MAX_ATTEMPTS) {
                if (otp.purpose === 'login') {
                    // Lock the account itself, not just this OTP code — a fresh
                    // code from a new request-otp call would otherwise reset
                    // attempt_count to 0 on a brand-new row and let someone
                    // just keep trying indefinitely. Suspending the account
                    // means every subsequent login attempt is blocked
                    // (verify-otp/refresh both already require status='active')
                    // until staff manually reactivates it.
                    await graph.mutation(
                        updateQl(CLIENT_ACCOUNT_TYPE, {
                            set: { status: 'suspended', failed_otp_attempts: newAttemptCount },
                            where: { contact_number: { _eq: normalized }, status: { _eq: 'active' } }
                        })
                    );
                    return res.status(403).json({
                        success: false,
                        code: 'ACCOUNT_LOCKED',
                        message: 'Too many incorrect attempts. Your account has been locked. Please contact your branch or an administrator to reactivate it.'
                    });
                }

                // purpose === 'enrollment' — there's no account to lock yet
                // (it's only created on success), so point at staff activation
                // instead, same as the disambiguation-failure path in request-otp.js.
                await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'otp_failed', contactNumber: normalized, clientId: otp.client_id, detail: 'Too many incorrect attempts' });
                return res.status(403).json({
                    success: false,
                    code: 'ENROLLMENT_LOCKED',
                    message: 'Too many incorrect attempts. Please visit your branch to activate mobile access.'
                });
            }

            const remaining = MAX_ATTEMPTS - newAttemptCount;
            return res.status(400).json({ success: false, code: 'INCORRECT', message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
        }

        // Correct code — consume it immediately so it can't be replayed.
        await graph.mutation(
            updateQl(OTP_TYPE, {
                set: { consumed_at: moment().toISOString() },
                where: { _id: { _eq: otp._id } }
            })
        );

        let account;

        if (otp.purpose === 'login') {
            [account] = await graph.query(
                queryQl(CLIENT_ACCOUNT_TYPE, {
                    where: { contact_number: { _eq: normalized }, status: { _eq: 'active' } }
                })
            ).then(r => r.data?.client_accounts ?? []);

            if (!account) {
                // Account was deactivated/suspended between request and verify.
                return res.status(403).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This account is not active. Contact your branch.' });
            }

            if (!(await isClientActive(account.client_id))) {
                return res.status(403).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This account is not active. Contact your branch.' });
            }

            await graph.mutation(
                updateQl(CLIENT_ACCOUNT_TYPE, {
                    set: { last_login_at: moment().toISOString(), failed_otp_attempts: 0, otp_locked_until: null },
                    where: { _id: { _eq: account._id } }
                })
            );

        } else {
            // purpose === 'enrollment' — first successful verification creates the account.
            // client_id was resolved and pinned at request-otp time (see that file's
            // comment on why verify-otp must not re-derive it).
            const newAccountId = generateUUID();

            await graph.mutation(
                insertQl(CLIENT_ACCOUNT_TYPE, {
                    objects: [{
                        _id: newAccountId,
                        client_id: otp.client_id,
                        contact_number: normalized,
                        status: 'active',
                        enrollment_method: 'auto_contact_match',
                        verified_at: moment().toISOString(),
                        last_login_at: moment().toISOString(),
                    }]
                })
            );

            account = { _id: newAccountId, client_id: otp.client_id };

            await logEnrollmentAttempt({
                method: 'auto_contact_match',
                outcome: 'success',
                contactNumber: normalized,
                clientId: account.client_id,
            });
        }

        const refreshToken = await issueRefreshToken(account._id);

        const token = jwt.sign(
            { typ: 'client', clientAccountId: account._id, clientId: account.client_id },
            serverRuntimeConfig.clientSecret,
            { expiresIn: '30m' }
        );

        return res.status(200).json({ success: true, token, refreshToken, clientId: account.client_id });

    } catch (error) {
        console.error('verify-otp error:', error);
        return res.status(500).json({ success: false, message: 'Verification failed' });
    }
}