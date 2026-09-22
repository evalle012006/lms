import moment from 'moment';
import bcrypt from 'bcryptjs';

import { clientApiHandler } from '@/services/client-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl } from '@/lib/graph/graph.util';
import { sendClientOTPSMS } from '@/lib/sms-service';
import { logEnrollmentAttempt } from '@/services/enrollment-attempt-log';
import { generateUUID } from '@/lib/utils';
import { normalizePhone } from '@/lib/phone-utils';

const graph = new GraphProvider();

// client_accounts is a new Postgres-native table — snake_case fields, and
// _id is app-generated text (see the schema file's header comment), not a
// DB-generated uuid.
const CLIENT_ACCOUNT_TYPE = createGraphType('client_accounts', `
  _id client_id contact_number status
`)('client_accounts');

// `client` is a legacy Mongo-migrated table — camelCase columns — but per
// codebase convention its query root is aliased to the plural 'clients'
// (see by-ids.js, close-account.js), so we follow that here too.
const CLIENT_LOOKUP_TYPE = createGraphType('client', `
  _id firstName lastName birthdate contactNumber status
`)('clients');

const OTP_TYPE = createGraphType('client_otp_codes', `
  _id contact_number purpose code_hash expires_at client_id created_at
`)('client_otp_codes');

const RESEND_COOLDOWN_SECONDS = 300;

export default clientApiHandler({
    post: requestOtp
});

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function issueOtp({ contactNumber, purpose, clientId = null }) {
    const code = generateCode();
    const codeHash = bcrypt.hashSync(code, bcrypt.genSaltSync(8));
    const expiresAt = moment().add(5, 'minutes').toISOString();

    await graph.mutation(
        insertQl(OTP_TYPE, {
            objects: [{ _id: generateUUID(), contact_number: contactNumber, purpose, code_hash: codeHash, expires_at: expiresAt, client_id: clientId }]
        })
    );

    const devLoggingEnabled = process.env.NODE_ENV !== 'production' && process.env.MOBILE_OTP_DEBUG_LOG === 'true';

    try {
        await sendClientOTPSMS({ contactNumber, code });
    } catch (err) {
        // Without a configured SMS account, this throws every time — that's
        // correct behavior in production (a real send failure should surface),
        // but it would silently block local testing entirely. Only swallow it
        // when the dev flag is explicitly on, and still warn so it's not
        // mistaken for a working send.
        if (!devLoggingEnabled) throw err;
        console.warn(`[DEV ONLY] SMS send failed, continuing since MOBILE_OTP_DEBUG_LOG=true: ${err.message}`);
    }

    if (devLoggingEnabled) {
        console.log(`[DEV ONLY] OTP for ${contactNumber}: ${code}`);
    }

    // Returned to the caller ONLY so the HTTP response can include it when
    // debug mode is on (see the two call sites below) — this is the ONE
    // moment the raw code exists anywhere outside the SMS itself; it's
    // bcrypt-hashed above and never stored in plaintext. Deliberately not
    // written to any table or cache: with 5 replica containers behind nginx
    // in staging, an in-memory or DB-lookup approach could easily be read
    // back from a different instance than the one that generated it, or
    // just linger longer than intended. Returning it synchronously in the
    // same request/response has neither problem — and it's still gated by
    // the exact same double condition (NODE_ENV + explicit env flag) as the
    // console.log above, so this can never fire in production.
    return { debugCode: devLoggingEnabled ? code : null };
}

async function requestOtp(req, res) {
    try {
        const { contactNumber, lastName, birthdate } = req.body;

        if (!contactNumber) {
            return res.status(400).json({ success: false, message: 'contactNumber is required' });
        }

        const normalized = normalizePhone(contactNumber);

        // Rate limit resends, regardless of purpose or outcome — this is
        // also the main defense against someone bypassing the 3-attempt
        // lockout in verify-otp.js by just requesting a fresh code (a new
        // OTP row starts its own attempt_count at 0).
        const [lastOtp] = await graph.query(
            queryQl(OTP_TYPE, {
                where: { contact_number: { _eq: normalized } },
                order_by: [{ created_at: 'desc' }],
                limit: 1,
            })
        ).then(r => r.data?.client_otp_codes ?? []);

        if (lastOtp) {
            const secondsSinceLastSend = moment().diff(moment(lastOtp.created_at), 'seconds');
            if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
                const retryAfterSeconds = RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
                return res.status(429).json({
                    success: false,
                    code: 'COOLDOWN_ACTIVE',
                    retryAfterSeconds,
                    message: `Please wait before requesting a new code.`,
                });
            }
        }

        // 1. Returning user: an active client_accounts row already exists
        //    for this number → plain login OTP, no identity resolution needed.
        const [existingAccount] = await graph.query(
            queryQl(CLIENT_ACCOUNT_TYPE, {
                where: { contact_number: { _eq: normalized }, status: { _eq: 'active' } }
            })
        ).then(r => r.data?.client_accounts ?? []);

        if (existingAccount) {
            const { debugCode } = await issueOtp({ contactNumber: normalized, purpose: 'login' });
            return res.status(200).json({ success: true, flow: 'login', ...(debugCode && { debugCode }) });
        }

        // 2. No account yet — see how many active `client` records share this number.
        const matches = await graph.query(
            queryQl(CLIENT_LOOKUP_TYPE, {
                where: { contactNumber: { _eq: normalized }, status: { _eq: 'active' } }
            })
        ).then(r => r.data?.clients ?? []);

        if (matches.length === 0) {
            // Not an existing client contact number at all — this device
            // needs the self-registration + ID verification path instead.
            await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'no_client_found', contactNumber: normalized });
            return res.status(404).json({ success: false, code: 'NO_CLIENT_FOUND', message: 'No account found for this number. Use self-registration.' });
        }

        let target = matches[0];

        if (matches.length > 1) {
            // Shared household number — contactNumber alone can't disambiguate.
            // Require lastName + birthdate as a second factor before we'll pick one.
            if (!lastName || !birthdate) {
                await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'disambiguation_required', contactNumber: normalized, detail: `${matches.length} matching client records` });
                return res.status(409).json({
                    success: false,
                    code: 'DISAMBIGUATION_REQUIRED',
                    message: 'Multiple accounts use this number. Provide last name and birthdate.'
                });
            }

            const filtered = matches.filter(c =>
                c.lastName?.toLowerCase() === String(lastName).toLowerCase() &&
                moment(c.birthdate).isSame(moment(birthdate), 'day')
            );

            if (filtered.length !== 1) {
                // Still ambiguous (or no match) even with the second factor —
                // do not guess. Route to a human.
                await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'staff_required', contactNumber: normalized, detail: `Disambiguation matched ${filtered.length} records, expected 1` });
                return res.status(409).json({
                    success: false,
                    code: 'STAFF_ACTIVATION_REQUIRED',
                    message: 'We could not verify your identity automatically. Please visit your branch to activate mobile access.'
                });
            }

            target = filtered[0];
        }

        // Exactly one client identified — proceed with auto-enrollment OTP.
        // The client_accounts row itself is only created on successful
        // verify-otp, not here (see verify-otp.js). target._id travels with
        // the OTP row so verify-otp doesn't have to (and can't) re-derive it.
        const { debugCode } = await issueOtp({ contactNumber: normalized, purpose: 'enrollment', clientId: target._id });
        await logEnrollmentAttempt({ method: 'auto_contact_match', outcome: 'otp_sent', contactNumber: normalized, clientId: target._id });
        return res.status(200).json({ success: true, flow: 'enrollment', ...(debugCode && { debugCode }) });

    } catch (error) {
        console.error('request-otp error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send verification code' });
    }
}