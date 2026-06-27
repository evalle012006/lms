// src/pages/apply/[qrToken].js
// Public LAF page — no auth required.
// QR token now points to a GROUP (not a branch).
// Validates: token exists, not expired, group found.

import { GraphProvider }              from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }   from '@/lib/graph/graph.util';
import PublicLAFForm                  from '@/components/laf/PublicLAFForm';
import Head                           from 'next/head';
import moment                         from 'moment';
import { logAuditPublic }             from '@/lib/audit';

const graph = new GraphProvider();

const GROUP_TYPE = createGraphType('groups', `
    _id name status qrToken qrExpiresAt qrGeneratedAt qrGeneratedBy
    branchId loanOfficerId loanOfficerName availableSlots capacity
    occurence day dayNo time groupNo
    branch { _id name code }
`)('groups');

const SETTINGS_TYPE = createGraphType('settings', `
    requireClientBiometric
    requireGovernmentId
    requireSelfieWithId
    qrAllowedStartTime
    qrAllowedEndTime
`)('settings');

const USER_TYPE = createGraphType('users', `
    _id firstName lastName loNo designatedBranch designatedBranchId
`)('users');

export async function getServerSideProps({ req, params }) {
    const { qrToken } = params;

    // ── Find group by QR token ─────────────────────────────────────────
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, { where: { qrToken: { _eq: qrToken } } })
    ).then(r => r.data?.groups ?? []);

    // ── Token not found ────────────────────────────────────────────────
    if (!group) {
        return {
            props: {
                error:    'invalid',
                errorMsg: 'This QR code is not valid. Please ask your Loan Officer for the correct QR code.',
            },
        };
    }

    // ── Token expired ──────────────────────────────────────────────────
    if (group.qrExpiresAt && moment().isAfter(moment(group.qrExpiresAt))) {
        // Audit the expired access attempt
        logAuditPublic(req, {
            action:      'GROUP_QR_ACCESSED_EXPIRED',
            category:    'QR',
            severity:    'WARNING',
            entityType:  'group',
            entityId:    group._id,
            description: `Expired QR accessed for group "${group.name}"`,
            branchId:    group.branchId,
            branchName:  group.branch?.name,
            metadata:    { qrToken, expiredAt: group.qrExpiresAt },
        });

        return {
            props: {
                error:    'expired',
                errorMsg: `This QR code expired on ${moment(group.qrExpiresAt).format('MMMM D, YYYY')}. Please ask your Loan Officer to generate a new QR code.`,
            },
        };
    }

    // ── Fetch LO details for display ───────────────────────────────────
    let loName = group.loanOfficerName || '';
    if (group.loanOfficerId && !loName) {
        const [lo] = await graph.query(
            queryQl(USER_TYPE, { where: { _id: { _eq: group.loanOfficerId } } })
        ).then(r => r.data?.users ?? []);
        loName = lo ? `${lo.firstName} ${lo.lastName}` : '';
    }

    // ── Fetch system settings ──────────────────────────────────────────
    const [settings] = await graph.query(
        queryQl(SETTINGS_TYPE, { limit: 1 })
    ).then(r => r.data?.settings ?? []);

    // ── Time restriction check ──────────────────────────────────────────
    // Manila time — check if current time is within the allowed window
    const manilaTime = moment().utcOffset('+08:00');
    const startTime  = settings?.qrAllowedStartTime || '06:00';
    const endTime    = settings?.qrAllowedEndTime   || '22:00';
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH,   endM]   = endTime.split(':').map(Number);
    const nowMinutes   = manilaTime.hours() * 60 + manilaTime.minutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;
 
    if (nowMinutes < startMinutes || nowMinutes >= endMinutes) {
        return {
            props: {
                error:    'time_restricted',
                errorMsg: `Loan applications are only accepted between ${startTime} and ${endTime} (Manila time). Please come back during operating hours.`,
                allowedStart: startTime,
                allowedEnd:   endTime,
            },
        };
    }

    // ── Audit valid access ─────────────────────────────────────────────
    logAuditPublic(req, {
        action:      'GROUP_QR_ACCESSED',
        category:    'QR',
        severity:    'INFO',
        entityType:  'group',
        entityId:    group._id,
        description: `QR accessed for group "${group.name}" (${group.branch?.name})`,
        branchId:    group.branchId,
        branchName:  group.branch?.name,
        metadata:    { qrToken, expiresAt: group.qrExpiresAt },
    });

    return {
        props: {
            error: null,
            // Group context — auto-tagged on every submission
            groupId:    group._id,
            groupName:  group.name,
            groupNo:    group.groupNo || null,
            loId:       group.loanOfficerId,
            loName,
            branchId:   group.branchId,
            branchName: group.branch?.name  || '',
            branchCode: group.branch?.code  || '',
            qrToken,
            qrExpiresAt: group.qrExpiresAt,
            // Settings
            requireClientBiometric: settings?.requireClientBiometric ?? true,
            requireGovernmentId:    settings?.requireGovernmentId    ?? true,
            requireSelfieWithId:    settings?.requireSelfieWithId    ?? false,
        },
    };
}

// ── Error screens ─────────────────────────────────────────────────────────
const ErrorScreen = ({ type, message, allowedStart, allowedEnd }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                type === 'expired'          ? 'bg-amber-100' :
                type === 'time_restricted'  ? 'bg-blue-100'  : 'bg-red-100'
            }`}>
                <svg className={`w-8 h-8 ${type === 'expired' ? 'text-amber-600' : 'text-red-600'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
            </div>
            <h2 className={`text-lg font-bold mb-2 ${
                type === 'expired' ? 'text-amber-800' : 'text-red-800'
            }`}>
                {type === 'expired' ? 'QR Code Expired' : 'Invalid QR Code'}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
            {type === 'time_restricted' && allowedStart && allowedEnd && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                    <p className="font-semibold mb-1">Operating Hours</p>
                    <p>{allowedStart} — {allowedEnd} (Manila time)</p>
                </div>
            )}
            <p className="text-xs text-gray-400 mt-4">
                AmberCash PH Micro Lending Corp.
            </p>
        </div>
    </div>
);

export default function ApplyPage(props) {
    const {
        error, errorMsg,
        groupId, groupName, groupNo,
        loId, loName,
        branchId, branchName, branchCode,
        qrToken, qrExpiresAt,
        requireClientBiometric,
        requireGovernmentId,
        requireSelfieWithId,
    } = props;

    if (error) {
        return (
            <>
                <Head>
                    <title>
                        {error === 'expired' ? 'QR Expired' : 'Invalid QR'} — AmberCash
                    </title>
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <meta name="robots" content="noindex" />
                </Head>
                <ErrorScreen type={error} message={errorMsg}
                    allowedStart={props.allowedStart} allowedEnd={props.allowedEnd} />
            </>
        );
    }

    return (
        <>
            <Head>
                <title>Loan Application — {groupName} ({branchName})</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
            </Head>
            <PublicLAFForm
                groupId={groupId}
                groupName={groupName}
                groupNo={groupNo}
                loId={loId}
                loName={loName}
                branchId={branchId}
                branchName={branchName}
                branchCode={branchCode}
                qrToken={qrToken}
                qrExpiresAt={qrExpiresAt}
                requireClientBiometric={requireClientBiometric}
                requireGovernmentId={requireGovernmentId}
                requireSelfieWithId={requireSelfieWithId}
            />
        </>
    );
}