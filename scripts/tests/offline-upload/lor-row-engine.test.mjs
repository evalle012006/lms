// Run:  node --test lor-row-engine.test.mjs
// These expectations are derived by reading the two LOR pages line by line. They prove the port is
// internally consistent and does not crash. They do NOT prove parity with the pages: that needs
// fixtures captured from the real pages on staging (see the capture helper in the PR notes).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRowEngine } from '../../../src/lib/offline-upload/lor-row-engine.js';

const safeNumber = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const engineFor = (mode, over = {}) => createRowEngine({
    mode,
    safeNumber,
    getMinMcbu: (row, n) => (mode === 'daily' ? 10 : 50) * n,
    minCsfCollection: 10,
    csfEnabled: true,
    hasGroupLeader: true,
    isCsfCollectionAllowed: () => true,
    ...over,
});

const baseRow = (over = {}) => ({
    status: 'active', slotNo: 3, loanCycle: 2, loanTerms: 60,
    loanBalance: 1000, activeLoan: 100, noOfPayments: 10, amountRelease: 1200,
    total: 0, excess: 0, pastDue: 0, advanceDays: 0, paymentCollection: 0, mcbuCol: 0,
    mcbu: 200, csf: 0, csfCollection: 0, csfIn: 0, remarks: '', history: null,
    targetCollection: 100, mispayment: false,
    prevData: {
        amountRelease: 1200, paymentCollection: 0, excess: 0, loanBalance: 1000, activeLoan: 100,
        noOfPayments: 10, total: 0, pastDue: 0, mcbu: 200, csf: 0, advanceDays: 0,
    },
    ...over,
});

const R = (value, label = value) => ({ value, label });

test('daily: payment equal to target', () => {
    const { row, errors } = engineFor('daily').applyPayment(baseRow(), 100);
    assert.deepEqual(errors, []);
    assert.equal(row.loanBalance, 900);
    assert.equal(row.noOfPayments, 11);
    assert.equal(row.mcbuCol, 10);
    assert.equal(row.mcbu, 210);
    assert.equal(row.excess, 0);
    assert.equal(row.mispayment, false);
    assert.equal(row.error, false);
    assert.equal(row.mcbuError, false);
    assert.equal(row.history.loanBalance, 1000);   // balance BEFORE the payment
    assert.equal(row.history.collection, 100);
});

test('daily: payment of three installments', () => {
    const { row } = engineFor('daily').applyPayment(baseRow(), 300);
    assert.equal(row.loanBalance, 700);
    assert.equal(row.excess, 200);
    assert.equal(row.noOfPayments, 13);
    assert.equal(row.mcbuCol, 30);
    assert.equal(row.mcbu, 230);
});

test('daily: payment above the balance is rejected', () => {
    const { row, errors } = engineFor('daily').applyPayment(baseRow(), 1500);
    assert.equal(row.error, true);
    assert.equal(row.paymentCollection, 0);
    assert.match(errors[0], /greater than the loan balance/);
});

test('daily: full payment moves amountRelease to fullPayment', () => {
    const { row } = engineFor('daily').applyPayment(baseRow(), 1000);
    assert.equal(row.loanBalance, 0);
    assert.equal(row.fullPayment, 1200);
    assert.equal(row.amountRelease, 0);
    assert.equal(row.excess, 900);
    assert.equal(row.mcbuCol, 100);
});

test('daily: payment below target stays an error until a remark resolves it', () => {
    const { row } = engineFor('daily').applyPayment(baseRow(), 50);
    assert.equal(row.error, true);
    assert.equal(row.mispayment, true);
});

test('daily: reloaner-cont on a full payment keeps mcbu = previous + minimum', () => {
    const e = engineFor('daily');
    let r = e.applyPayment(baseRow(), 1000).row;
    const out = e.applyRemarks(r, R('reloaner-cont'));
    assert.deepEqual(out.errors, []);
    assert.equal(out.row.mcbuCol, 100);
    assert.equal(out.row.mcbu, 300);
    assert.equal(out.row.remarks.value, 'reloaner-cont');
    assert.equal(out.row.history.remarks.value, 'reloaner-cont');
});

test('daily: offset after a full payment returns previous MCBU + CSF and asks for close remarks', () => {
    const e = engineFor('daily');
    const out = e.applyUploadRow(baseRow({ csf: 0 }), {
        paymentCollection: 1000, remarks: R('offset-full'), closeRemarks: 'Client no longer borrowing',
    });
    assert.deepEqual(out.errors, []);
    assert.equal(out.ok, true);
    assert.equal(out.effects.needsCloseRemarks, true);
    assert.equal(out.row.mcbuReturnAmt, 200);       // previous mcbu 200 + csf 0, the commit endpoint checks the same
    assert.equal(out.row.mcbu, 0);
    assert.equal(out.row.mcbuCol, 0);
    assert.equal(out.row.fullPayment, 1200);
    assert.equal(out.row.closeRemarks, 'Client no longer borrowing');
});

test('daily: offset without the full balance is rejected', () => {
    const out = engineFor('daily').applyUploadRow(baseRow(), {
        paymentCollection: 100, remarks: R('offset-full'), closeRemarks: 'x yz',
    });
    assert.equal(out.ok, false);
    assert.ok(out.errors.some(m => /full balance/.test(m)));
});

test('daily: past due with no payment', () => {
    const e = engineFor('daily');
    const out = e.applyUploadRow(baseRow(), { paymentCollection: '', remarks: R('past due') });
    assert.equal(out.ok, true);
    assert.equal(out.row.pastDue, 100);
    assert.equal(out.row.excused, true);
    assert.equal(out.row.mispayment, false);
    assert.equal(out.row.mcbuCol, 0);
});

test('daily: partial payment resolved by a collection-* remark', () => {
    const e = engineFor('daily');
    const out = e.applyUploadRow(baseRow({
        loanBalance: 1050,
        prevData: { ...baseRow().prevData, loanBalance: 1050 },
    }), { paymentCollection: 150, remarks: R('collection-overstated') });
    assert.deepEqual(out.errors, []);
    assert.equal(out.row.loanBalance, 900);
    assert.equal(out.row.noOfPayments, 11);
    assert.equal(out.row.mcbuCol, 10);
    assert.equal(out.row.error, false);
});

test('daily: double payment sets CSF In for a group without a leader', () => {
    const e = engineFor('daily', { hasGroupLeader: false });
    const out = e.applyUploadRow(baseRow(), { paymentCollection: 200, remarks: R('double payment') });
    assert.equal(out.ok, true);
    assert.equal(out.row.csfIn, 20);
});

test('daily: double payment with the wrong amount is rejected', () => {
    const out = engineFor('daily').applyUploadRow(baseRow(), { paymentCollection: 300, remarks: R('double payment') });
    assert.equal(out.ok, false);
});

test('blocked remarks are refused', () => {
    for (const v of ['matured-past due', 'matured_past_due_collection', 'offset-matured-pd', 'reloaner-wd']) {
        const out = engineFor('daily').applyUploadRow(baseRow(), { paymentCollection: '', remarks: R(v) });
        assert.equal(out.ok, false, v);
    }
});

test('weekly: payment uses the weekly minimum and keeps explicit MCBU', () => {
    const e = engineFor('weekly');
    const out = e.applyUploadRow(baseRow(), { paymentCollection: 100, mcbuCol: 80 });
    assert.equal(out.ok, true);
    assert.equal(out.row.mcbuCol, 80);
    assert.equal(out.row.mcbu, 280);                 // previous 200 + 80
    assert.equal(out.row.mcbuError, false);
});

test('weekly: MCBU below the minimum is flagged', () => {
    const out = engineFor('weekly').applyUploadRow(baseRow(), { paymentCollection: 100, mcbuCol: 20 });
    assert.equal(out.row.mcbuError, true);
    assert.ok(out.warnings.length > 0);
});

test('weekly: reloaner uses the weekly name', () => {
    const e = engineFor('weekly');
    const out = e.applyUploadRow(baseRow(), { paymentCollection: 1000, remarks: R('reloaner') });
    assert.equal(out.ok, true);
    assert.equal(out.row.mcbuCol, 500);              // 50 * 10 installments
});

test('csf: rejected when the client is not allowed to pay CSF', () => {
    const e = engineFor('weekly', { isCsfCollectionAllowed: () => false });
    const out = e.applyUploadRow(baseRow(), { paymentCollection: 100, mcbuCol: 50, csfCollection: 20 });
    assert.equal(out.ok, false);
});

// The weekly page used to test the PREVIOUS remark here (temp.remarks?.value), so a payment survived a
// Delinquent remark. It was fixed to test the new remark like daily does, so both modes now agree.
test('delinquent after a payment: daily and weekly both clear it', () => {
    for (const mode of ['daily', 'weekly']) {
        const out = engineFor(mode).applyUploadRow(baseRow(), { paymentCollection: 100, remarks: R('delinquent') });
        assert.equal(out.row.paymentCollection, 0, mode);
        assert.equal(out.row.loanBalance, 1000, mode);
        assert.equal(out.row.noOfPayments, 10, mode);
        assert.equal(out.row.mispayment, true, mode);
        assert.equal(out.row.delinquent, true, mode);
    }
});

test('delinquent with no payment: both modes agree', () => {
    for (const mode of ['daily', 'weekly']) {
        const out = engineFor(mode).applyUploadRow(baseRow(), { paymentCollection: '', remarks: R('delinquent') });
        assert.equal(out.ok, true, mode);
        assert.equal(out.row.delinquent, true, mode);
        assert.equal(out.row.activeLoan, 0, mode);
        assert.equal(out.row.mispayment, true, mode);
    }
});
