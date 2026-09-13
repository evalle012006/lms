// src/pages/api/v2/qr-cash-collection/submit.js
import { apiHandler }                          from '@/services/api-handler';
import { GraphProvider }                       from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, insertQl, updateQl } from '@/lib/graph/graph.util';
import { CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS, QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';
import { findUserById }                        from '@/lib/graph.functions';
import { generateUUID }                        from '@/lib/utils';
import { getSystemDate }                       from '@/lib/date-utils';
import { logAudit }                            from '@/lib/audit';
import { holidayType }                         from '@/pages/api/v2/settings/holidays/common';
import moment                                  from 'moment-timezone';
import crypto                                  from 'crypto';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    group { ${GROUP_FIELDS} }
    loans (where: { status: { _eq: "active" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
        ${LOAN_FIELDS}
    }
`)('clients');

const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', QR_CASH_COLLECTION_ENTRY_FIELDS)('qrEntries');

// Minimal check type — same pattern as saveV2.js's QR_CHECK_TYPE, kept
// consistent between the two endpoints deliberately: both need to answer
// the same question ("is there already a finalized, non-draft transaction
// for this client today?") using the same fields, so the point-of-entry
// check here and the point-of-save check there never disagree.
const CASH_COLLECTION_CHECK_TYPE = createGraphType('cashCollections', '_id draft origin')('cashCollectionCheck');

export default apiHandler({ post: submitQrCollection });

async function submitQrCollection(req, res) {
    const {
        qrToken,
        mcbuCol = 0,
        csfCollection = 0,
        paymentCollection = 0,
        mcbuWithdrawFlag = false,
        offsetTransFlag = false,
    } = req.body;

    if (!qrToken) {
        return res.status(200).json({ success: false, message: 'qrToken required.' });
    }

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

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

    // ── CSF gate: group leader only ──────────────────────────────────────
    if (parseFloat(csfCollection) > 0 && !client.groupLeader) {
        return res.status(200).json({
            success: false,
            code: 'CSF_NOT_ALLOWED',
            message: 'CSF collection can only be submitted for a group leader.',
        });
    }

    // ── Live status gate ──────────────────────────────────────────────
    if (client.status !== 'active') {
        return res.status(200).json({ success: false, code: 'CLIENT_INACTIVE', message: 'This client is no longer active.' });
    }

    const loan = client.loans?.[0];
    if (!loan || loan.status !== 'active') {
        return res.status(200).json({ success: false, code: 'NO_ACTIVE_LOAN', message: 'This client has no active loan.' });
    }

    const today    = moment(getSystemDate()).tz('Asia/Manila');
    const dayName  = today.format('dddd');
    const dateStr  = today.format('YYYY-MM-DD');
    const monthDay = today.format('MM-DD');

    const group     = client.group?.[0];
    const occurence = group?.occurence;

    // ── Day-validity ──────────────────────────────────────────────────
    if (occurence === 'daily') {
        const isWeekend = ['Saturday', 'Sunday'].includes(dayName);
        const holidays  = await graph.query(queryQl(holidayType, {})).then(r => r.data?.holidays ?? []);
        const isHoliday = holidays.some(h => h.date === monthDay);

        if (isWeekend) {
            return res.status(200).json({ success: false, code: 'DAY_NOT_VALID', message: 'Collections are not scheduled on weekends.' });
        }
        if (isHoliday) {
            return res.status(200).json({ success: false, code: 'DAY_NOT_VALID', message: 'Collections are not scheduled on holidays.' });
        }
    }

    const isOffDay = occurence === 'weekly' && group.day && group.day !== dayName;

    if (isOffDay && !mcbuWithdrawFlag && !offsetTransFlag) {
        return res.status(200).json({
            success: false,
            code: 'REGULAR_COLLECTION_NOT_ALLOWED',
            message: 'Regular collection is only allowed on this group\'s scheduled day. Only flagged transaction types are permitted today.',
        });
    }

    // ── NEW: check the REAL cashCollections table, not just our own staging
    // table. A pre-save placeholder (origin: 'pre-save') or an office-started
    // draft (draft: true) doesn't block submission — but a real finalized
    // entry does, and this needs to be caught here, at the point the LO is
    // actually submitting, not silently discovered later when saveV2.js
    // rejects it after the fact.
    const [existingRealRow] = await graph.query(
        queryQl(CASH_COLLECTION_CHECK_TYPE, {
            where: { clientId: { _eq: client._id }, dateAdded: { _eq: dateStr } },
            limit: 1,
        })
    ).then(r => r.data?.cashCollectionCheck ?? []);

    if (existingRealRow && existingRealRow.draft !== true && existingRealRow.origin !== 'pre-save') {
        return res.status(200).json({
            success: false,
            code: 'ALREADY_PROCESSED',
            message: 'This client\'s collection for today has already been recorded by the office.',
        });
    }

    // ── Already-processed / existing-draft check (our own staging table) ──
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
        });
    }

    const payload = {
        mcbuCol: parseFloat(mcbuCol) || 0,
        csfCollection: parseFloat(csfCollection) || 0,
        paymentCollection: parseFloat(paymentCollection) || 0,
        mcbuWithdrawFlag: !!mcbuWithdrawFlag,
        offsetTransFlag: !!offsetTransFlag,
    };

    let referenceCode = existingEntry?.referenceCode;
    let isAmendment = false;

    if (existingEntry && existingEntry.status === 'pending') {
        isAmendment = true;
        await graph.mutation(
            updateQl(QR_ENTRY_TYPE, {
                where: { _id: { _eq: existingEntry._id } },
                set: {
                    payload,
                    scannedBy: currentUser._id,
                    scannedAt: moment().toISOString(),
                    qrTokenUsed: qrToken,
                    updatedDateTime: moment().toISOString(),
                },
            })
        );
    } else {
        const branchCode = client.branchId?.slice(-4).toUpperCase() || 'XXXX';
        const dateCode    = today.format('MMDDYY');
        const suffix      = crypto.randomBytes(3).toString('hex').toUpperCase();
        referenceCode     = `QR-${branchCode}-${dateCode}-${suffix}`;

        await graph.mutation(
            insertQl(QR_ENTRY_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    clientId: client._id,
                    groupId: client.groupId,
                    branchId: client.branchId,
                    loanId: loan._id,
                    collectionDate: dateStr,
                    payload,
                    referenceCode,
                    status: 'pending',
                    scannedBy: currentUser._id,
                    scannedAt: moment().toISOString(),
                    qrTokenUsed: qrToken,
                    insertedDateTime: moment().toISOString(),
                    updatedDateTime: moment().toISOString(),
                }],
            })
        );
    }

    await logAudit(req, {
        action:      isAmendment ? 'QR_DRAFT_AMENDED' : 'QR_DRAFT_SUBMITTED',
        category:    'QR',
        severity:    'INFO',
        entityType:  'client',
        entityId:    client._id,
        description: `QR collection ${isAmendment ? 'amended' : 'submitted'} for "${client.fullName}" by ${currentUser.firstName} ${currentUser.lastName}`,
        afterData:   { referenceCode, payload },
        branchId:    client.branchId,
        branchName:  client.branchName,
    });

    return res.status(200).json({
        success: true,
        referenceCode,
        message: isAmendment ? 'Collection updated.' : 'Collection submitted successfully.',
    });
}