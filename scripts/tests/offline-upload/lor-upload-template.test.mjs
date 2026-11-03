// Run:  node --no-warnings --test src/lib/offline-upload/lor-upload-template.test.mjs
// Builds a real .xlsx with ExcelJS, "fills it in" like a user would, parses it back and runs the rows
// through the row engine.

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createRowEngine } from '../../../src/lib/offline-upload/lor-row-engine.js';
import {
    applyTemplate, buildTemplate, checkTemplateAgainstPage, getUploadBlockers, parseTemplate, rowsSignature, selectUploadableRows, sha256Hex,
} from '../../../src/lib/offline-upload/lor-upload-template.js';

const safeNumber = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const REMARKS = [
    { label: 'Past Due', value: 'past due' },
    { label: 'Reloaner Cont/MCBU', value: 'reloaner-cont' },
    { label: 'Delinquent', value: 'delinquent' },
];
const CC_FIELDS = `
  _id
  loanId
  clientId
  slotNo
  paymentCollection
  mcbuCol
  mcbu
  loanBalance
  noOfPayments
  remarks
  prevData
  history
  closeRemarks
`;

const row = (slotNo, over = {}) => ({
    loanId: `loan-${slotNo}`, clientId: `client-${slotNo}`, slotNo, fullName: `Client ${slotNo}`,
    status: 'active', loanCycle: 2, loanTerms: 60, loanBalance: 1000, activeLoan: 100, targetCollection: 100,
    noOfPayments: 10, amountRelease: 1200, total: 0, excess: 0, pastDue: 0, advanceDays: 0,
    paymentCollection: 0, mcbuCol: 0, mcbu: 200, csf: 0, csfCollection: 0, csfIn: 0, remarks: '', history: null,
    mispayment: false, group: { weeklyScheduleType: 'standard' },
    prevData: { amountRelease: 1200, paymentCollection: 0, excess: 0, loanBalance: 1000, activeLoan: 100,
        noOfPayments: 10, total: 0, pastDue: 0, mcbu: 200, csf: 0, advanceDays: 0 },
    ...over,
});

const engine = createRowEngine({
    mode: 'daily', safeNumber, getMinMcbu: (r, n) => 10 * n, minCsfCollection: 10,
    csfEnabled: true, hasGroupLeader: true, isCsfCollectionAllowed: () => false,
});

const group = { _id: 'group-1', name: 'Group A' };
const DATE = '2026-11-02';

async function templateFor(rows) {
    return buildTemplate({
        rows, group, branchName: 'Naga', loName: 'LO 1', mode: 'daily', date: DATE,
        remarksOptions: REMARKS, isCsfCollectionAllowed: () => false, generatedBy: 'tester',
    });
}

async function fill(buffer, edits) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Collection');
    edits(ws);
    return wb.xlsx.writeBuffer();
}

const parseOpts = { remarksOptions: REMARKS, expected: { groupId: 'group-1', mode: 'daily', date: DATE } };

test('selectUploadableRows keeps active rows and explains the others', () => {
    const data = [
        row(1),
        row(2, { draft: true, _id: 'cc-2' }),
        row(3, { _id: 'cc-3' }),                                  // submitted
        row(4, { status: 'completed' }),
        row(5, { origin: 'pre-save', _id: 'cc-5' }),              // weekly pre-save placeholder: eligible
        row(6, { qrSourced: true }),
        { status: 'totals', slotNo: 100 },
    ];
    const { rows, excluded } = selectUploadableRows(data);
    assert.deepEqual(rows.map(r => r.slotNo), [1, 2, 5]);
    assert.deepEqual(excluded.map(e => e.slotNo), [3, 4, 6]);
});

test('getUploadBlockers', () => {
    assert.deepEqual(getUploadBlockers({ allowedRole: true, mode: 'daily' }), []);
    const why = getUploadBlockers({ allowedRole: true, isFilterMode: true, prevDraft: true, mode: 'weekly', groupDay: 'monday', dayName: 'tuesday' });
    assert.equal(why.length, 3);
    assert.equal(getUploadBlockers({ allowedRole: true, mode: 'daily', hasUnsavedEdits: true }).length, 1);
});

test('build -> fill -> parse -> apply', async () => {
    const { rows } = selectUploadableRows([row(1), row(2)]);
    const buffer = await templateFor(rows);

    const filled = await fill(buffer, (ws) => {
        ws.getCell('H7').value = 100;                      // slot 1 pays the target
        ws.getCell('H8').value = 0;                        // slot 2 does not pay ...
        ws.getCell('K8').value = 'Past Due';               // ... and is marked past due
    });

    const parsed = await parseTemplate(filled, parseOpts);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[1].remarks.value, 'past due');

    const out = applyTemplate({ items: parsed.items, pageRows: rows, engine, ccFieldsString: CC_FIELDS });
    assert.equal(out.summary.canCommit, true);
    assert.equal(out.commitRows.length, 2);

    const first = out.commitRows[0].row;
    assert.equal(first.loanBalance, 900);
    assert.equal(first.mcbuCol, 10);
    assert.equal(first.client, undefined);                 // stripped: not a cashCollections field
    const second = out.commitRows[1].row;
    assert.equal(second.paymentCollection, 0);
    assert.equal(second.remarks.value, 'past due');
});

test('a blank Actual Collection is an error, 0 is not', async () => {
    const { rows } = selectUploadableRows([row(1), row(2)]);
    const buffer = await templateFor(rows);
    const filled = await fill(buffer, (ws) => { ws.getCell('H8').value = 0; });
    const parsed = await parseTemplate(filled, parseOpts);
    assert.equal(parsed.errors.length, 1);
    assert.match(parsed.errors[0].message, /blank/);
    assert.equal(parsed.errors[0].slotNo, '1');
});

test('wrong date, wrong group and removed rows are rejected', async () => {
    const { rows } = selectUploadableRows([row(1), row(2)]);
    const buffer = await templateFor(rows);

    const stale = await parseTemplate(buffer, { ...parseOpts, expected: { ...parseOpts.expected, date: '2026-11-03' } });
    assert.match(stale.errors[0].message, /for 2026-11-02/);

    const other = await parseTemplate(buffer, { ...parseOpts, expected: { ...parseOpts.expected, groupId: 'other' } });
    assert.match(other.errors[0].message, /different group/);

    const removed = await fill(buffer, (ws) => {
        ws.getCell('H7').value = 100; ws.getCell('H8').value = 0;
        ws.spliceRows(8, 1);
    });
    const parsed = await parseTemplate(removed, parseOpts);
    assert.ok(parsed.errors.some(e => /removed/.test(e.message)));
});

test('an unknown remark and a negative amount are reported with the slot', async () => {
    const { rows } = selectUploadableRows([row(1)]);
    const buffer = await templateFor(rows);
    const filled = await fill(buffer, (ws) => { ws.getCell('H7').value = -5; ws.getCell('K7').value = 'Nonsense'; });
    const parsed = await parseTemplate(filled, parseOpts);
    assert.equal(parsed.errors.length, 2);
    assert.ok(parsed.errors.every(e => e.slotNo === '1'));
});

test('an engine error blocks the whole upload (the commit needs every row)', async () => {
    const { rows } = selectUploadableRows([row(1), row(2)]);
    const buffer = await templateFor(rows);
    const filled = await fill(buffer, (ws) => { ws.getCell('H7').value = 100; ws.getCell('H8').value = 5000; });
    const parsed = await parseTemplate(filled, parseOpts);
    const out = applyTemplate({ items: parsed.items, pageRows: rows, engine, ccFieldsString: CC_FIELDS });
    assert.equal(out.summary.canCommit, false);
    assert.equal(out.summary.failed, 1);
    assert.match(out.results[1].errors[0], /greater than the loan balance/);
});

test('a manual draft is prefilled, a fresh row is not', async () => {
    const { rows } = selectUploadableRows([row(1), row(2, { draft: true, paymentCollection: 100, remarks: { label: 'Past Due', value: 'past due' } })]);
    const buffer = await templateFor(rows);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('Collection');
    assert.equal(ws.getCell('H7').value, null);
    assert.equal(ws.getCell('H8').value, 100);
    assert.equal(ws.getCell('K8').value, 'Past Due');
});

test('sha256Hex', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('abc'));
    assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('rowsSignature changes when something typeable changes, and ignores blank/totals rows', () => {
    const base = [row(1), row(2), { status: 'totals', slotNo: 100 }, { status: 'open', slotNo: 3 }];
    const sig = rowsSignature(base);
    assert.equal(rowsSignature([row(1), row(2)]), sig);                              // totals / blank rows ignored
    assert.notEqual(rowsSignature([row(1, { paymentCollection: 100 }), row(2)]), sig);
    assert.notEqual(rowsSignature([row(1), row(2, { remarks: { value: 'past due' } })]), sig);
    assert.notEqual(rowsSignature([row(1), row(2, { mcbuCol: 10 })]), sig);
    assert.equal(rowsSignature([row(1, { loanBalance: 5 }), row(2)]), sig);          // not a typeable field
});

test('checkTemplateAgainstPage: still valid when the page still offers the same rows', () => {
    const items = [{ loanId: 'loan-1', slotNo: '1', rowNumber: 7 }, { loanId: 'loan-2', slotNo: '2', rowNumber: 8 }];
    assert.deepEqual(checkTemplateAgainstPage(items, [row(1), row(2)]).errors, []);
    // a saved offline draft is still uploadable (an edited file may replace it)
    assert.deepEqual(checkTemplateAgainstPage(items, [row(1, { draft: true, _id: 'a', origin: 'offline' }), row(2)]).errors, []);
});

test('checkTemplateAgainstPage: after the collection was submitted there is one clear message', () => {
    const items = [{ loanId: 'loan-1', slotNo: '1', rowNumber: 7 }, { loanId: 'loan-2', slotNo: '2', rowNumber: 8 }];
    const submitted = [row(1, { _id: 'a', origin: 'offline' }), row(2, { _id: 'b', origin: 'offline' })];
    const { errors } = checkTemplateAgainstPage(items, submitted);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /already submitted/);
});

test('checkTemplateAgainstPage: a row that changed or a new row makes the template stale', () => {
    const items = [{ loanId: 'loan-1', slotNo: '1', rowNumber: 7 }, { loanId: 'loan-2', slotNo: '2', rowNumber: 8 }];

    const oneSubmitted = checkTemplateAgainstPage(items, [row(1), row(2, { _id: 'b', origin: 'offline' })]);
    assert.equal(oneSubmitted.errors.length, 1);
    assert.equal(oneSubmitted.errors[0].slotNo, '2');

    const extraRow = checkTemplateAgainstPage(items, [row(1), row(2), row(3)]);
    assert.equal(extraRow.errors.length, 1);
    assert.match(extraRow.errors[0].message, /became uploadable/);
});