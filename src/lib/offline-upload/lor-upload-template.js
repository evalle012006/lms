/**
 * src/lib/offline-upload/lor-upload-template.js
 *
 * Browser-side half of the LOR offline upload (works in node too, which is how it is tested):
 *   getUploadBlockers   why the buttons must be disabled on this page right now
 *   selectUploadableRows which page rows belong in the template (and why the others do not)
 *   buildTemplate       page rows -> .xlsx (ArrayBuffer)
 *   sha256Hex           hash of the file, sent to the commit endpoint
 *   parseTemplate       .xlsx -> items + errors
 *   applyTemplate       items + page rows + row engine -> preview results + the rows for commit.js
 *   toCommitRow         strips a page row down to cashCollections fields
 *
 * The template is built from the rows the page already loaded (never from unsaved edits: the caller
 * passes the freshly loaded rows). Excel protection is cosmetic: commit.js re-validates everything.
 */

import ExcelJS from 'exceljs';

export const TEMPLATE_VERSION = 'lor-offline-v1';

const SHEET = 'Collection';
const META = '_meta';
const LISTS = '_lists';
const HEADER_ROW = 6;
const FIRST_DATA_ROW = 7;

// column numbers
const C = { SLOT: 1, CLIENT: 2, CYCLE: 3, MCBU: 4, CSF: 5, BALANCE: 6, TARGET: 7,
    PAYMENT: 8, MCBU_COL: 9, CSF_COL: 10, REMARKS: 11, CLOSE: 12, LOAN_ID: 13, CLIENT_ID: 14 };

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ------------------------------------------------------------------------------------------------
// Fingerprint of what the user can type on the page (payment, MCBU, CSF, remarks).
// The page stores it right after a load; if the fingerprint of the live rows differs, the user has
// unsaved edits and the template must not be built from them.
// ------------------------------------------------------------------------------------------------
export const rowsSignature = (rows = []) => rows
    .filter(r => r && r.clientId && r.status !== 'totals' && r.status !== 'open')
    .map(r => [r.loanId, num(r.paymentCollection), num(r.mcbuCol), num(r.csfCollection), r.remarks?.value ?? ''].join('|'))
    .join(';');

// ------------------------------------------------------------------------------------------------
// Can the buttons be used right now?  (UX only. commit.js enforces all of this again.)
// ctx: { allowedRole, isFilterMode, isWeekend, isHoliday, branchLocked, groupClosed, prevDraft,
//        hasUnsavedEdits, mode, groupDay, dayName }
// ------------------------------------------------------------------------------------------------
export function getUploadBlockers(ctx) {
    const why = [];
    if (!ctx.allowedRole) why.push('Your role cannot use the offline upload.');
    if (ctx.isFilterMode) why.push('Uploads are only possible for today. Clear the date filter.');
    if (ctx.isWeekend) why.push('Collections are not allowed on weekends.');
    if (ctx.isHoliday) why.push('Collections are not allowed on holidays.');
    if (ctx.branchLocked) why.push('Transactions are locked for this branch.');
    if (ctx.groupClosed) why.push('The Group Summary is already closed for today.');
    if (ctx.prevDraft) why.push('There are unfinished drafts from a previous day. Submit those first.');
    // the template is built from what the page shows, so typed-but-unsaved edits would leak into it
    if (ctx.hasUnsavedEdits) why.push('You have unsaved changes on this page. Save a draft or reload first.');
    if (ctx.mode === 'weekly' && ctx.groupDay && ctx.dayName
        && String(ctx.groupDay).toLowerCase() !== String(ctx.dayName).toLowerCase()) {
        why.push('This weekly group does not meet today.');
    }
    return why;
}

// ------------------------------------------------------------------------------------------------
// Which rows go into the template?
// ------------------------------------------------------------------------------------------------
function ineligibleReason(cc) {
    if (cc.status !== 'active') return 'Not an active loan today (pending, completed, closed or for release).';
    if (cc.maturedPD) return 'Matured past due. Process online.';
    if (cc.qrSourced) return 'Has a QR entry waiting to be merged. Process online.';
    if (cc.transferStr && cc.transferStr !== '-') return 'Transfer row. Process online.';
    if (cc.reverted) return 'Reverted row. Process online.';
    if (cc._id && !cc.draft && cc.origin !== 'pre-save') return 'Already submitted.';
    if (num(cc.loanBalance) <= 0) return 'No loan balance.';
    return null;
}

export function selectUploadableRows(data) {
    const rows = [];
    const excluded = [];
    (data || []).forEach(cc => {
        if (!cc || !cc.clientId || cc.status === 'totals' || cc.status === 'open') return;
        const reason = ineligibleReason(cc);
        if (reason) excluded.push({ slotNo: cc.slotNo, loanId: cc.loanId, reason });
        else rows.push(cc);
    });
    rows.sort((a, b) => num(a.slotNo) - num(b.slotNo));
    return { rows, excluded };
}

// ------------------------------------------------------------------------------------------------
// Build
//   rows            from selectUploadableRows
//   remarksOptions  LOR_DAILY_REMARKS | LOR_WEEKLY_REMARKS  ([{ label, value }])
//   isCsfCollectionAllowed(row)  the page's allowCSFCollection expression
// ------------------------------------------------------------------------------------------------
export async function buildTemplate({ rows, group, branchName, loName, mode, date, remarksOptions, isCsfCollectionAllowed, generatedBy }) {
    const isDaily = mode === 'daily';
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(SHEET, { views: [{ state: 'frozen', ySplit: HEADER_ROW }] });

    ws.getCell('A1').value = 'AMBERCASH PH MICRO LENDING CORP';
    ws.getCell('A1').font = { size: 14, bold: true };
    ws.getCell('A2').value = `Offline collection template (${mode.toUpperCase()}). Fill the yellow cells only. Enter 0 for no payment, never leave Actual Collection blank.`;
    ws.getCell('A3').value = `Group: ${group?.name || ''}   |   Date: ${date}`;
    ws.getCell('A4').value = `Branch: ${branchName || ''}   |   Loan Officer: ${loName || ''}`;

    const headers = ['Slot #', 'Client Name', 'Cycle #', 'MCBU', 'CSF', 'Loan Balance', 'Target Collection',
        'Actual Collection', isDaily ? 'MCBU Collection (auto)' : 'MCBU Collection', 'CSF Collection', 'Remarks', 'Close Remarks (offset only)',
        'loanId', 'clientId'];
    headers.forEach((h, i) => {
        const cell = ws.getCell(HEADER_ROW, i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(HEADER_ROW).height = 32;
    [8, 30, 8, 12, 12, 14, 14, 16, 18, 14, 34, 30, 12, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.getColumn(C.LOAN_ID).hidden = true;
    ws.getColumn(C.CLIENT_ID).hidden = true;

    // dropdown source on a hidden sheet
    const lists = wb.addWorksheet(LISTS, { state: 'veryHidden' });
    remarksOptions.forEach((o, i) => { lists.getCell(i + 1, 1).value = o.label; });
    const listRange = `'${LISTS}'!$A$1:$A$${Math.max(remarksOptions.length, 1)}`;

    const yellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    const grey = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
    const amountRule = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true,
        showErrorMessage: true, errorTitle: 'Invalid amount', error: 'Enter a number, 0 or higher.' };

    rows.forEach((cc, idx) => {
        const r = FIRST_DATA_ROW + idx;
        const draft = !!cc.draft;     // prefill only what a draft already holds; a fresh row stays blank on purpose
        const values = [
            cc.slotNo, cc.fullName, cc.loanCycle, num(cc.mcbu), num(cc.csf), num(cc.loanBalance), num(cc.targetCollection),
            draft ? num(cc.paymentCollection) : null,
            draft && !isDaily ? num(cc.mcbuCol) : null,
            draft ? num(cc.csfCollection) || null : null,
            draft && cc.remarks?.label ? cc.remarks.label : null,
            draft && cc.closeRemarks ? cc.closeRemarks : null,
            String(cc.loanId), String(cc.clientId),
        ];
        values.forEach((v, i) => { ws.getCell(r, i + 1).value = v; });

        for (let c = 1; c <= C.TARGET; c++) ws.getCell(r, c).fill = grey;

        const csfOk = !!isCsfCollectionAllowed?.(cc);
        const editable = [C.PAYMENT, C.REMARKS, C.CLOSE];
        if (!isDaily) editable.push(C.MCBU_COL);
        if (csfOk) editable.push(C.CSF_COL);

        [C.PAYMENT, C.MCBU_COL, C.CSF_COL, C.REMARKS, C.CLOSE].forEach(c => {
            const cell = ws.getCell(r, c);
            if (editable.includes(c)) { cell.fill = yellow; cell.protection = { locked: false }; }
            else { cell.fill = grey; }
        });
        [C.PAYMENT, C.MCBU_COL, C.CSF_COL].forEach(c => {
            if (editable.includes(c)) ws.getCell(r, c).dataValidation = amountRule;
            ws.getCell(r, c).numFmt = '#,##0.00';
        });
        ws.getCell(r, C.REMARKS).dataValidation = { type: 'list', allowBlank: true, formulae: [listRange],
            showErrorMessage: true, errorTitle: 'Invalid remarks', error: 'Pick a remark from the list.' };
    });

    const meta = wb.addWorksheet(META, { state: 'veryHidden' });
    [
        ['version', TEMPLATE_VERSION],
        ['groupId', String(group?._id || '')],
        ['groupName', group?.name || ''],
        ['occurence', mode],
        ['date', date],
        ['generatedBy', generatedBy || ''],
        ['generatedAt', new Date().toISOString()],
        ['templateLoanIds', JSON.stringify(rows.map(cc => String(cc.loanId)))],
    ].forEach(([k, v], i) => { meta.getCell(i + 1, 1).value = k; meta.getCell(i + 1, 2).value = v; });

    await ws.protect('lor-offline', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true });

    return wb.xlsx.writeBuffer();
}

// ------------------------------------------------------------------------------------------------
export async function sha256Hex(buffer) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------------------------------------
// Parse
// ------------------------------------------------------------------------------------------------
const cellText = (cell) => {
    let v = cell?.value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        if ('result' in v) v = v.result;                                   // formula
        else if (Array.isArray(v.richText)) v = v.richText.map(t => t.text).join('');
        else if ('text' in v) v = v.text;
    }
    return v === null || v === undefined ? '' : String(v).trim();
};

const parseAmount = (raw) => {
    if (raw === '') return { blank: true };
    const n = Number(String(raw).replace(/[₱,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) return { error: true };
    return { value: n };
};

export async function parseTemplate(arrayBuffer, { remarksOptions, expected }) {
    const errors = [];
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(arrayBuffer);
    } catch (e) {
        return { meta: null, items: [], errors: [{ message: 'This file could not be read as an Excel workbook.' }] };
    }

    const ws = wb.getWorksheet(SHEET);
    const metaWs = wb.getWorksheet(META);
    if (!ws || !metaWs) return { meta: null, items: [], errors: [{ message: 'This is not an offline collection template. Download a new one.' }] };

    const meta = {};
    metaWs.eachRow((row) => { meta[cellText(row.getCell(1))] = cellText(row.getCell(2)); });
    let templateLoanIds = [];
    try { templateLoanIds = JSON.parse(meta.templateLoanIds || '[]'); } catch (e) { /* handled below */ }

    if (meta.version !== TEMPLATE_VERSION) errors.push({ message: 'This template is from an older version. Download a new one.' });
    if (meta.groupId !== expected.groupId) errors.push({ message: 'This template belongs to a different group.' });
    if (meta.occurence !== expected.mode) errors.push({ message: `This is a ${meta.occurence} template, this page is ${expected.mode}.` });
    if (meta.date !== expected.date) errors.push({ message: `This template is for ${meta.date}, but today is ${expected.date}. Download a new one.` });
    if (errors.length > 0) return { meta, items: [], errors };

    const byLabel = new Map(remarksOptions.map(o => [o.label.trim().toLowerCase(), o]));
    const items = [];

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber < FIRST_DATA_ROW) return;
        const loanId = cellText(row.getCell(C.LOAN_ID));
        if (!loanId) return;                                    // trailing / decorative rows
        const slotNo = cellText(row.getCell(C.SLOT));
        const bad = (message) => errors.push({ row: rowNumber, slotNo, message });

        const pay = parseAmount(cellText(row.getCell(C.PAYMENT)));
        const mcbu = parseAmount(cellText(row.getCell(C.MCBU_COL)));
        const csf = parseAmount(cellText(row.getCell(C.CSF_COL)));

        if (pay.blank) bad('Actual Collection is blank. Enter 0 if the client did not pay.');
        else if (pay.error) bad('Actual Collection must be a number, 0 or higher.');
        if (mcbu.error) bad('MCBU Collection must be a number, 0 or higher.');
        if (csf.error) bad('CSF Collection must be a number, 0 or higher.');

        const remarksLabel = cellText(row.getCell(C.REMARKS));
        let remarks = null;
        if (remarksLabel) {
            remarks = byLabel.get(remarksLabel.toLowerCase()) || null;
            if (!remarks) bad(`Unknown remark "${remarksLabel}".`);
        }

        items.push({
            rowNumber, loanId, slotNo,
            paymentCollection: pay.value ?? null,
            mcbuCol: mcbu.blank ? null : (mcbu.value ?? null),
            csfCollection: csf.blank ? null : (csf.value ?? null),
            remarks,
            closeRemarks: cellText(row.getCell(C.CLOSE)),
        });
    });

    // rows must be exactly the ones the template was built with
    const found = new Set(items.map(i => i.loanId));
    const missing = templateLoanIds.filter(id => !found.has(id));
    if (missing.length > 0) errors.push({ message: `${missing.length} row(s) were removed from the template. Do not delete rows.` });
    if (items.length !== found.size) errors.push({ message: 'A row appears more than once.' });
    if (found.size !== templateLoanIds.length && missing.length === 0) errors.push({ message: 'Rows were added to the template. Do not add rows.' });

    return { meta: { ...meta, templateLoanIds }, items, errors };
}

// ------------------------------------------------------------------------------------------------
// The file was valid when it was downloaded. Is it still valid for the page as it is NOW?
// (a row may have been submitted since, or a new row may have become uploadable)
// ------------------------------------------------------------------------------------------------
export function checkTemplateAgainstPage(items, pageRows) {
    const { rows: eligible, excluded } = selectUploadableRows(pageRows);
    const eligibleIds = new Set(eligible.map(r => String(r.loanId)));
    const reasonById = new Map(excluded.map(e => [String(e.loanId), e.reason]));
    const itemIds = new Set(items.map(i => i.loanId));
    const SUBMITTED = 'Already submitted.';

    if (items.length > 0 && items.every(i => reasonById.get(i.loanId) === SUBMITTED)) {
        return { errors: [{ message: "This group's collection for today was already submitted. There is nothing to upload." }] };
    }

    const errors = [];
    items.forEach(i => {
        if (!eligibleIds.has(i.loanId)) {
            errors.push({ row: i.rowNumber, slotNo: i.slotNo, message: reasonById.get(i.loanId) || 'This row is no longer on the page. Download a new template.' });
        }
    });
    const added = eligible.filter(r => !itemIds.has(String(r.loanId)));
    if (added.length > 0) {
        errors.push({ message: `${added.length} row(s) became uploadable after this template was downloaded. Download a new template.` });
    }
    return { errors };
}

// ------------------------------------------------------------------------------------------------
// Apply through the row engine
// ------------------------------------------------------------------------------------------------
export function toCommitRow(row, ccFieldsString) {
    const allowed = new Set(ccFieldsString.split('\n').map(f => f.trim()).filter(Boolean));
    const out = {};
    Object.keys(row).forEach(k => { if (allowed.has(k)) out[k] = row[k]; });
    return out;
}

export function applyTemplate({ items, pageRows, engine, ccFieldsString }) {
    const byLoan = new Map(pageRows.map(r => [String(r.loanId), r]));
    const results = [];
    const commitRows = [];

    items.forEach(item => {
        const base = byLoan.get(item.loanId);
        if (!base) {
            results.push({ slotNo: item.slotNo, loanId: item.loanId, ok: false, errors: ['This row no longer exists on the page. Reload and download a new template.'], warnings: [] });
            return;
        }
        const out = engine.applyUploadRow(base, {
            paymentCollection: item.paymentCollection,
            mcbuCol: item.mcbuCol,
            csfCollection: item.csfCollection,
            remarks: item.remarks,
            closeRemarks: item.closeRemarks,
        });
        results.push({
            slotNo: base.slotNo, loanId: item.loanId, ok: out.ok, errors: out.errors, warnings: out.warnings,
            payment: out.row.paymentCollection, mcbuCol: out.row.mcbuCol, loanBalance: out.row.loanBalance,
            remarks: out.row.remarks?.label || '',
        });
        if (out.ok) {
            commitRows.push({
                loanId: String(base.loanId), clientId: String(base.clientId), slotNo: base.slotNo,
                row: { ...toCommitRow(out.row, ccFieldsString), closeRemarks: out.row.closeRemarks },
            });
        }
    });

    const failed = results.filter(r => !r.ok).length;
    return {
        results, commitRows,
        summary: {
            total: results.length, failed, withWarnings: results.filter(r => r.ok && r.warnings.length).length,
            // commit.js needs every template row: a partial upload would leave clients out of the finalize
            canCommit: failed === 0 && commitRows.length === items.length,
        },
    };
}