// src/pages/api/v2/qr-cash-collection/scan-info.js
// GET ?qrToken=xxx
// Called the moment the QR page loads (before rendering the form). Validates
// everything the design requires and returns just enough read-only context
// (name, group, branch, loan balance/active-loan/target — for display only,
// never editable) plus whether this is a fresh entry or an amendment of an
// existing pending one.
//
// Auth: protected automatically by the existing jwtMiddleware (not in its
// whitelist) — if there's no valid session token, this 401s before even
// reaching this handler. The "ask to log in if not logged in" requirement
// from the original spec is enforced at the page level (redirect to /login
// with a return URL) plus this middleware as the real backstop.

import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }           from '@/lib/graph/graph.util';
import { CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { findUserById, loadSettingsSystemDate } from '@/lib/graph.functions';

import moment                                 from 'moment-timezone';
import { resolveWeeklyMcbuMinimum }           from '@/lib/mcbu-target-utils';
import { holidayType } from '../settings/holidays/common';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    branch { name }
    lo { firstName lastName }
    group { ${GROUP_FIELDS} }
    loans (where: { status: { _eq: "active" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
        ${LOAN_FIELDS}
    }
`)('clients');

const SETTINGS_TYPE = createGraphType('transactionSettings', 'minDailyMcbuCollection minWeeklyMcbuCollection minWeeklyMcbuCollectionAccelerated minCsfCollection')('txSettings');

const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', QR_CASH_COLLECTION_ENTRY_FIELDS)('qrEntries');

const HOLIDAYS_TYPE = createGraphType('settings', 'holidays')('settings'); // adjust if holidays live elsewhere — see flag below

export default apiHandler({ get: getScanInfo });

async function getScanInfo(req, res) {
    const { qrToken } = req.query;
    if (!qrToken) {
        return res.status(200).json({ success: false, message: 'qrToken required.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    // ── Locate client by QR token ────────────────────────────────────────
    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, { where: { qrToken: { _eq: qrToken } } })
    ).then(r => r.data?.clients ?? []);

    if (!client) {
        return res.status(200).json({ success: false, code: 'INVALID_QR', message: 'This QR code is not valid.' });
    }

    // ── Auth: LO (exact) or BM (branch match) only ──────────────────────
    if (currentUser.role.rep === 4 && client.loId !== currentUser._id) {
        return res.status(200).json({ success: false, code: 'FORBIDDEN', message: 'You are not the assigned Loan Officer for this client.' });
    }
    if (currentUser.role.rep === 3 && client.branchId !== currentUser.designatedBranchId) {
        return res.status(200).json({ success: false, code: 'FORBIDDEN', message: 'This client is not in your branch.' });
    }
    if (![3, 4].includes(currentUser.role.rep)) {
        return res.status(200).json({ success: false, code: 'FORBIDDEN', message: 'Only Loan Officers and Branch Managers can use this feature.' });
    }

    // ── Live status gate (primary validity check — no stored expiry) ────
    if (client.status !== 'active') {
        return res.status(200).json({ success: false, code: 'CLIENT_INACTIVE', message: 'This client is no longer active.' });
    }

    const loan = client.loans?.[0];
    if (!loan || loan.status !== 'active') {
        return res.status(200).json({ success: false, code: 'NO_ACTIVE_LOAN', message: 'This client has no active loan.' });
    }

    // ── Secondary hard-ceiling check (term-based failsafe) ───────────────
    // NOT fetched/verified here — flagged below, see note.

    const today    = moment(await loadSettingsSystemDate()).tz('Asia/Manila');
    const dayName  = today.format('dddd'); // 'Monday', etc.
    const dateStr  = today.format('YYYY-MM-DD');

    const group    = client.group;
    const occurence = group?.occurence; // 'daily' | 'weekly'

    let dayValidity = { allowed: true, restrictedToFlaggedTypes: false };

    if (occurence === 'daily') {
        const isWeekend = ['Saturday', 'Sunday'].includes(dayName);

        const holidays = await graph.query(queryQl(holidayType, {})).then(r => r.data?.holidays ?? []);
        const monthDay = today.format('MM-DD');
        const isHoliday = holidays.some(h => h.date === monthDay);

        if (isWeekend) {
            dayValidity = { allowed: false, reason: 'Collections are not scheduled on weekends.' };
        } else if (isHoliday) {
            dayValidity = { allowed: false, reason: 'Collections are not scheduled on holidays.' };
        }
    } else if (occurence === 'weekly') {
        if (group.day && group.day !== dayName) {
            // Off-day: only flagged transaction types allowed, not a regular collection.
            dayValidity = { allowed: true, restrictedToFlaggedTypes: true };
        }
    }

    if (!dayValidity.allowed) {
        return res.status(200).json({ success: false, code: 'DAY_NOT_VALID', message: dayValidity.reason });
    }

    // ── Already-processed / existing-draft check ─────────────────────────
    const [existingEntry] = await graph.query(
        queryQl(QR_ENTRY_TYPE, {
            where: { clientId: { _eq: client._id }, collectionDate: { _eq: dateStr } },
            order_by: [{ insertedDateTime: 'desc' }],
            limit: 1,
        })
    ).then(r => r.data?.qrEntries ?? []);

    if (existingEntry && existingEntry.status === 'merged') {
        return res.status(200).json({
            success: false,
            code: 'ALREADY_PROCESSED',
            message: 'This client\'s collection for today has already been recorded by the office.',
            existingPayload: existingEntry.payload,
        });
    }

    const [settings] = await graph.query(queryQl(SETTINGS_TYPE, { limit: 1 })).then(r => r.data?.txSettings ?? []);

    // NOTE: minMcbuCollection returned here is the BASE per-installment rate
    // only (daily flat rate, or weekly standard/accelerated rate depending
    // on the group's weeklyScheduleType) — it is NOT multiplied by
    // noPaymentsToday, since that depends on paymentCollection, which the
    // person hasn't entered yet at scan-info time. The frontend hint should
    // say "minimum ~X per installment", and the REAL enforced minimum
    // (proportional, computed the same way submit.js computes it) only gets
    // checked once they actually submit. Don't treat this value as the
    // final answer — it's a starting-point hint, submit.js is authoritative.
    const baseMcbuMin = occurence === 'weekly'
        ? resolveWeeklyMcbuMinimum(settings, group?.weeklyScheduleType)
        : (settings?.minDailyMcbuCollection ?? 0);

    return res.status(200).json({
        success: true,
        client: {
            _id: client._id,
            fullName: client.fullName || `${client.lastName}, ${client.firstName}`,
            branchName: client.branch?.name || client.branchName,
            loName: client.lo ? `${client.lo.firstName} ${client.lo.lastName}` : null,
            groupName: group?.name || client.groupName,
            occurence: occurence || null,
            groupLeader: !!client.groupLeader,
            profile: client.profile || null, // raw storage key — frontend resolves via useSignedUrl, same as everywhere else
        },
        loan: {
            status: loan.status,
            amountRelease: loan.amountRelease,
            activeLoan: loan.activeLoan,
            loanBalance: loan.loanBalance,
            mcbu: loan.mcbu,
            csf: client.groupLeader ? loan.csf : null, // never expose CSF to a non-group-leader's screen at all
            targetCollection: loan.activeLoan,
        },
        limits: {
            minMcbuCollectionPerInstallment: baseMcbuMin,
            minCsfCollection: settings?.minCsfCollection ?? 0,
        },
        dayValidity,
        collectionDate: dateStr,
        // If a pending entry already exists, the form opens pre-filled for
        // amendment rather than starting blank.
        existingDraft: existingEntry && existingEntry.status === 'pending' ? existingEntry.payload : null,
        // Audit snapshot of who created/last touched this draft — shown on
        // the page so a BM/LO can see who originally scanned it and who (if
        // anyone) amended it since.
        existingEntryMeta: existingEntry && existingEntry.status === 'pending' ? {
            scannedBy: existingEntry.scannedBy,
            scannedByName: existingEntry.scannedByName,
            scannedAt: existingEntry.scannedAt,
            lastEditBy: existingEntry.lastEditBy || null,
            lastEditedByName: existingEntry.lastEditedByName || null,
            updatedDateTime: existingEntry.updatedDateTime,
        } : null,
    });
}