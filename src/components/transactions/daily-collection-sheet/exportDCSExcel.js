/**
 * exportDCSExcel.js
 * Standalone Excel-export utility for the Daily Collection Sheet.
 * Call: await exportDCSExcel({ data, branchData, totals, summaryData, selectedDate, getBranchName, isAdmin, selectedBranch, currentBranch })
 */

import ExcelJS from 'exceljs';
import moment  from 'moment';
import { toast } from 'react-toastify';

// ─── shared style helpers ─────────────────────────────────────────────────────
const bold      = { bold: true };
const centerXS  = { horizontal: 'center', vertical: 'middle' };
const rightXS   = { horizontal: 'right',  vertical: 'middle' };
const leftXS    = { horizontal: 'left',   vertical: 'middle' };
const hdrFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
const totFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
const negFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
const bbFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
const currFmt   = '#,##0.00';
const intFmt    = '#,##0';

// ─── DCS sheet ────────────────────────────────────────────────────────────────
function buildDCSSheet(workbook, { exportRows, totals, selectedDate, getBranchName }) {
    const monthName = moment(selectedDate).format('MMM').toUpperCase();
    const ws = workbook.addWorksheet(`DCS - ${monthName}`);

    ws.columns = [
        { width: 5  }, { width: 22 }, { width: 18 },   // A–C
        { width: 11 }, { width: 11 },                   // D–E  MCBU
        { width: 11 },                                   // F  CSF Collection
        { width: 11 }, { width: 11 }, { width: 11 },   // G–I  Regular Loan
        { width: 11 }, { width: 11 }, { width: 11 },   // J–L  Other Loan
        { width: 7  }, { width: 11 },                   // M–N  Admission
        { width: 11 },                                   // O  LRF
        { width: 7  }, { width: 11 },                   // P–Q  CBHB
        { width: 11 },                                   // R  Add Hospi
        { width: 11 },                                   // S  Other Income
        { width: 12 },                                   // T  Total
        { width: 11 }, { width: 7  }, { width: 11 },   // U–W  MCBU WD/Ret
        { width: 11 }, { width: 7  }, { width: 11 },   // X–Z  CSF WD/Ret
        { width: 12 },                                   // AA  NET
        { width: 7  }, { width: 11 },                   // AB–AC  Renewal
        { width: 7  }, { width: 11 },                   // AD–AE  Offset
        { width: 7  },                                   // AF  Clients
    ];

    // Title rows
    ws.mergeCells('A1:AF1');
    ws.getCell('A1').value     = 'AmberCash PH Micro Lending Corp.';
    ws.getCell('A1').font      = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getRow(1).height = 20;

    ws.mergeCells('A2:AF2');
    ws.getCell('A2').value     = 'DAILY COLLECTION SHEET';
    ws.getCell('A2').font      = { bold: true, size: 12 };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.getCell('A3').value  = 'Name of Branch:';
    ws.getCell('B3').value  = getBranchName();
    ws.getCell('U3').value  = 'DATE:';
    ws.getCell('V3').value  = moment(selectedDate).format('MMMM D, YYYY');
    ws.getCell('Y3').value  = 'DAY:';
    ws.getCell('Z3').value  = moment(selectedDate).format('dddd');

    // Header row 4
    const h4 = [
        ['A4:A6', 'No.'],
        ['B4:B6', 'Name of LO'],
        ['C4:C6', 'Name of Group'],
        ['D4:E4', 'MCBU Collection'],
        ['F4:F6', 'CSF Collection'],
        ['G4:L4', "CLIENT'S LOAN COLLECTION"],
        ['M4:N4', 'Admission Fee'],
        ['O4:O6', 'LRF'],
        ['P4:Q4', 'C.B.H.B'],
        ['R4:R6', "Addt'l Hosp."],
        ['S4:S6', 'Other Income (Passbook/Picture)'],
        ['T4:T6', 'TOTAL COLLECTION'],
        ['U4:Z4', 'LESS RETURN & WITHDRAWALS'],
        ['AA4:AA6', 'NET COLLECTION'],
        ['AB4:AF4', 'Info on Full Payment'],
    ];
    h4.forEach(([range, val]) => {
        ws.mergeCells(range);
        const c = ws.getCell(range.split(':')[0]);
        c.value = val; c.font = bold; c.alignment = centerXS; c.fill = hdrFill;
    });
    ws.getRow(4).height = 28;

    // Header row 5
    const h5 = [
        ['G5:I5', 'Regular Loan (60 Days)'],
        ['J5:L5', 'Other Loan (Weekly)'],
        ['U5:U6', 'MCBU Withdrawals'],
        ['V5:W5', 'MCBU Return'],
        ['X5:X6', 'CSF Withdrawals'],
        ['Y5:Z5', 'CSF Return'],
        ['AB5:AC5', 'Renewal (Regular)'],
        ['AD5:AE5', 'Offset (Regular)'],
        ['AF5:AF6', 'No. of Client'],
    ];
    h5.forEach(([range, val]) => {
        ws.mergeCells(range);
        const c = ws.getCell(range.split(':')[0]);
        c.value = val; c.font = bold; c.alignment = centerXS; c.fill = hdrFill;
    });
    ws.getRow(5).height = 18;

    // Header row 6
    const r6 = [
        ['D6','Target'], ['E6','Actual'],
        ['G6','Target'], ['H6','Adv. Pay'], ['I6','Actual'],
        ['J6','Target'], ['K6','Adv. Pay'], ['L6','Actual'],
        ['M6','No.'],    ['N6','Amt.'],
        ['P6','No.'],    ['Q6','₱200'],
        ['V6','No.'],    ['W6','Amt.'],
        ['Y6','No.'],    ['Z6','Amt.'],
        ['AB6','No.'],   ['AC6','Amt.'],
        ['AD6','No.'],   ['AE6','Amt.'],
    ];
    r6.forEach(([cell, val]) => {
        const c = ws.getCell(cell);
        c.value = val; c.font = bold; c.alignment = centerXS; c.fill = hdrFill;
    });
    ws.getRow(6).height = 18;

    // Data rows
    let rowNum = 7;
    exportRows.forEach((item, idx) => {
        const r = ws.getRow(rowNum++);
        r.height = 16;
        const compTotal =
            (item.mcbuActual||0) + (item.csfCollection||0) + (item.regularLoanActual||0) +
            (item.otherLoanActual||0) + (item.admissionAmount||0) + (item.lrfCollection||0) +
            (item.cbhbAmount||0) + (item.addHospitalization||0) + (item.otherIncome||0);
        const compNet = compTotal -
            (item.mcbuWithdrawal||0) - (item.mcbuReturnAmount||0) -
            (item.csfWithdrawal||0) - (item.csfReturnAmount||0);

        const cols = [
            ['A', idx + 1,                    'center'],
            ['B', item.loName || item.branchName || '', 'left'],
            ['C', item.groupName || item.branchCode || '', 'left'],
            ['D', item.mcbuTarget,             'right', currFmt],
            ['E', item.mcbuActual,             'right', currFmt],
            ['F', item.csfCollection,          'right', currFmt],
            ['G', item.regularLoanTarget,      'right', currFmt],
            ['H', item.regularLoanAdvance,     'right', currFmt],
            ['I', item.regularLoanActual,      'right', currFmt],
            ['J', item.otherLoanTarget,        'right', currFmt],
            ['K', item.otherLoanAdvance,       'right', currFmt],
            ['L', item.otherLoanActual,        'right', currFmt],
            ['M', item.admissionNo,            'center'],
            ['N', item.admissionAmount,        'right', currFmt],
            ['O', item.lrfCollection,          'right', currFmt],
            ['P', item.cbhbNo,                 'center'],
            ['Q', item.cbhbAmount,             'right', currFmt],
            ['R', item.addHospitalization,     'right', currFmt],
            ['S', item.otherIncome,            'right', currFmt],
            ['T', compTotal,                   'right', currFmt],
            ['U', item.mcbuWithdrawal,         'right', currFmt],
            ['V', item.mcbuReturnNo,           'center'],
            ['W', item.mcbuReturnAmount,       'right', currFmt],
            ['X', item.csfWithdrawal,          'right', currFmt],
            ['Y', item.csfReturnNo,            'center'],
            ['Z', item.csfReturnAmount,        'right', currFmt],
            ['AA', compNet,                    'right', currFmt],
            ['AB', item.renewalNo,             'center'],
            ['AC', item.renewalAmount,         'right', currFmt],
            ['AD', item.offsetNo,              'center'],
            ['AE', item.offsetAmount,          'right', currFmt],
            ['AF', item.fullPaymentClients,    'center'],
        ];
        cols.forEach(([col, val, align, fmt]) => {
            const cell = r.getCell(col);
            cell.value = val;
            cell.alignment = { horizontal: align, vertical: 'middle' };
            if (fmt) cell.numFmt = fmt;
        });
    });

    // Totals row
    if (totals) {
        const tr = ws.getRow(rowNum);
        tr.height = 18;
        tr.getCell('B').value = 'TOTAL';
        tr.getCell('B').font  = bold;

        const tCompTotal = exportRows.reduce((s, r) =>
            s + (r.mcbuActual||0) + (r.csfCollection||0) + (r.regularLoanActual||0) +
            (r.otherLoanActual||0) + (r.admissionAmount||0) + (r.lrfCollection||0) +
            (r.cbhbAmount||0) + (r.addHospitalization||0) + (r.otherIncome||0), 0);
        const tCompNet = exportRows.reduce((s, r) =>
            s + (r.mcbuActual||0) + (r.csfCollection||0) + (r.regularLoanActual||0) +
            (r.otherLoanActual||0) + (r.admissionAmount||0) + (r.lrfCollection||0) +
            (r.cbhbAmount||0) + (r.addHospitalization||0) + (r.otherIncome||0) -
            (r.mcbuWithdrawal||0) - (r.mcbuReturnAmount||0) -
            (r.csfWithdrawal||0) - (r.csfReturnAmount||0), 0);

        const tCols = [
            ['D', totals.mcbuTarget,         currFmt], ['E', totals.mcbuActual,         currFmt],
            ['F', totals.csfCollection,      currFmt],
            ['G', totals.regularLoanTarget,  currFmt], ['H', totals.regularLoanAdvance,  currFmt], ['I', totals.regularLoanActual,  currFmt],
            ['J', totals.otherLoanTarget,    currFmt], ['K', totals.otherLoanAdvance,    currFmt], ['L', totals.otherLoanActual,    currFmt],
            ['M', totals.admissionNo,        intFmt],  ['N', totals.admissionAmount,     currFmt],
            ['O', totals.lrfCollection,      currFmt],
            ['P', totals.cbhbNo,             intFmt],  ['Q', totals.cbhbAmount,          currFmt],
            ['R', totals.addHospitalization, currFmt], ['S', totals.otherIncome,         currFmt],
            ['T', tCompTotal,                currFmt],
            ['U', totals.mcbuWithdrawal,     currFmt], ['V', totals.mcbuReturnNo,        intFmt],  ['W', totals.mcbuReturnAmount,    currFmt],
            ['X', totals.csfWithdrawal,      currFmt], ['Y', totals.csfReturnNo,         intFmt],  ['Z', totals.csfReturnAmount,     currFmt],
            ['AA', tCompNet,                 currFmt],
            ['AB', totals.renewalNo,         intFmt],  ['AC', totals.renewalAmount,      currFmt],
            ['AD', totals.offsetNo,          intFmt],  ['AE', totals.offsetAmount,       currFmt],
            ['AF', totals.fullPaymentClients,intFmt],
        ];
        tCols.forEach(([col, val, fmt]) => {
            const c = tr.getCell(col);
            c.value = val; c.font = bold; c.fill = totFill; c.numFmt = fmt;
            c.alignment = fmt === intFmt ? centerXS : rightXS;
        });
    }
}

// ─── Summary sheet ────────────────────────────────────────────────────────────
function buildSummarySheet(workbook, { summaryData, branchName, selectedDate }) {
    const sm = summaryData;
    const ws = workbook.addWorksheet('Summary');

    ws.columns = [{ width: 8 }, { width: 38 }, { width: 18 }];

    ws.mergeCells('A1:C1');
    const st = ws.getCell('A1');
    st.value = `CASHBOOK SUMMARY — ${branchName} — ${moment(selectedDate).format('MMMM D, YYYY')}`;
    st.font = { bold: true, size: 12 }; st.alignment = { horizontal: 'center' };
    ws.getRow(1).height = 20;

    let sr = 2;

    const sectionHdr = (label) => {
        ws.mergeCells(`A${sr}:C${sr}`);
        const c = ws.getCell(`A${sr}`);
        c.value = label; c.font = bold; c.alignment = { horizontal: 'center' }; c.fill = hdrFill;
        ws.getRow(sr).height = 16;
        sr++;
    };

    const dataRow = (no, label, value, isTotal = false) => {
        const r = ws.getRow(sr++);
        r.height = 15;
        r.getCell('A').value = no ?? '';
        r.getCell('A').alignment = { horizontal: 'center' };
        r.getCell('B').value = label;
        r.getCell('B').alignment = leftXS;
        const vc = r.getCell('C');
        vc.value = value || 0; vc.numFmt = currFmt; vc.alignment = rightXS;
        if (isTotal) {
            ['A','B','C'].forEach(col => { r.getCell(col).font = bold; r.getCell(col).fill = totFill; });
        }
    };

    // Beginning Balance
    const bbRow = ws.getRow(sr++);
    bbRow.height = 16;
    ws.mergeCells(`A${sr - 1}:B${sr - 1}`);
    bbRow.getCell('A').value = 'Beginning Balance'; bbRow.getCell('A').font = bold;
    bbRow.getCell('C').value = sm.beginning_balance || 0;
    bbRow.getCell('C').numFmt = currFmt; bbRow.getCell('C').alignment = rightXS;
    ['A','B','C'].forEach(col => bbRow.getCell(col).fill = bbFill);

    sectionHdr('RECEIPTS');
    const receipts = [
        ['1a','MCBU Collection',               sm.rcpt_mcbu],
        ['1b','CSF Collection',                sm.rcpt_csf],
        [2,   'Regular Loan (60 Days)',        sm.rcpt_regular_loan],
        [3,   'Other Loan (Weekly)',           sm.rcpt_other_loan],
        [4,   'Staff Collection CBU/CashBond', sm.rcpt_staff_cbu],
        [5,   'Staff Principal Loan',          sm.rcpt_staff_principal],
        [6,   'Admin Fees',                    sm.rcpt_admin_fees],
        [7,   'LRF Collection',                sm.rcpt_lrf],
        [8,   'C B H B Collection',            sm.rcpt_cbhb],
        [9,   'ADD-Hospi',                     sm.rcpt_add_hospi],
        [10,  'W/Tax, EE&ER',                  sm.rcpt_wtax],
        [11,  'MCBU Unclaimed (In)',            sm.rcpt_mcbu_unclaimed_in],
        ['12a','Other Income (Passbook)',      sm.rcpt_other_income_passbook],
        ['12b','Other Income',                 sm.rcpt_other_income],
        ['12c','Other Income CSF W/o Agent',   sm.rcpt_other_income_csf],
        [13,  'Other Receipts (Picture)',       sm.rcpt_other_receipts_picture],
        [14,  'Other Receipts',                sm.rcpt_other_receipts_gl],
        [15,  'Fund Transfer (In)',             sm.rcpt_fund_transfer_in],
        [16,  'Bank Withdrawal',               sm.rcpt_bank_withdrawal],
    ];
    receipts.forEach(([no, label, val]) => dataRow(no, label, val));
    dataRow('', 'TOTAL RECEIPTS', sm.total_receipts, true);

    sectionHdr('PAYMENTS');
    const loReleaseNo = sm.pay_loan_release_no || 0;
    const payments = [
        [1,   `Client Loan Release (${loReleaseNo} prs.)`, sm.pay_loan_release_amount],
        ['2a','Client MCBU Withdrawal',       sm.pay_mcbu_withdrawal],
        ['2b','CSF Withdrawal',               sm.pay_csf_withdrawal],
        ['3a','MCBU Return',                  sm.pay_mcbu_return],
        ['3b','CSF Return',                   sm.pay_csf_return],
        [4,   'Staff Loan Release / CBU Withd.', sm.pay_staff_loan_release],
        [5,   'Mngt. Expenses',               sm.pay_mngt_expenses],
        [6,   'CBHB Disbursed',               sm.pay_cbhb_disbursed],
        [7,   'MCBU Unclaimed (Out)',          sm.pay_mcbu_unclaimed_out],
        [8,   'Rebates',                      sm.pay_rebates],
        [9,   'Other Payments',               sm.pay_other_payments],
        [10,  'Fund Transfer (Out)',           sm.pay_fund_transfer_out],
        [11,  'Bank Deposits',                sm.pay_bank_deposits],
    ];
    payments.forEach(([no, label, val]) => dataRow(no, label, val));
    dataRow('', 'TOTAL PAYMENTS', sm.total_payments, true);

    sr++;  // blank row
    const cbRow = ws.getRow(sr++);
    cbRow.height = 18;
    ws.mergeCells(`A${sr - 1}:B${sr - 1}`);
    cbRow.getCell('A').value = 'Closing Balance';
    cbRow.getCell('A').font  = { bold: true, size: 12 };
    const cbVal = sm.closing_balance || 0;
    cbRow.getCell('C').value  = cbVal;
    cbRow.getCell('C').numFmt = currFmt;
    cbRow.getCell('C').alignment = rightXS;
    cbRow.getCell('C').font = { bold: true, size: 12, color: { argb: cbVal < 0 ? 'FFFF0000' : 'FF1F6B2A' } };
    const cbFill = cbVal < 0 ? negFill : { type:'pattern', pattern:'solid', fgColor:{ argb:'FFD9EAD3' } };
    ['A','B','C'].forEach(col => cbRow.getCell(col).fill = cbFill);

    sr++;  // blank row
    // Loan release per LO
    const loReleases = sm.loan_release_per_lo || [];
    if (loReleases.length > 0) {
        sectionHdr('LOAN RELEASE PER LOAN OFFICER');
        const lrHdr = ws.getRow(sr++);
        lrHdr.height = 15;
        ['LO', 'Name', '# Clients', 'Release Amount'].forEach((h, i) => {
            const c = lrHdr.getCell(i + 1);
            c.value = h; c.font = bold; c.fill = hdrFill;
            c.alignment = i === 0 ? { horizontal: 'center' } : i === 1 ? leftXS : rightXS;
        });
        loReleases.forEach(lo => {
            const r = ws.getRow(sr++);
            r.height = 15;
            r.getCell(1).value = `LO-${lo.loNo}`; r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(2).value = lo.loName;        r.getCell(2).alignment = leftXS;
            r.getCell(3).value = lo.noClients;     r.getCell(3).alignment = { horizontal: 'center' };
            r.getCell(4).value = lo.releaseAmount || 0;
            r.getCell(4).numFmt = currFmt;          r.getCell(4).alignment = rightXS;
        });
        const lrTot = ws.getRow(sr++);
        lrTot.height = 15;
        lrTot.getCell(2).value = 'TOTAL'; lrTot.getCell(2).font = bold; lrTot.getCell(2).fill = totFill;
        lrTot.getCell(3).value = loReleases.reduce((s, lo) => s + (lo.noClients||0), 0);
        lrTot.getCell(3).font = bold; lrTot.getCell(3).fill = totFill; lrTot.getCell(3).alignment = { horizontal: 'center' };
        lrTot.getCell(4).value = loReleases.reduce((s, lo) => s + (lo.releaseAmount||0), 0);
        lrTot.getCell(4).numFmt = currFmt; lrTot.getCell(4).font = bold;
        lrTot.getCell(4).fill = totFill; lrTot.getCell(4).alignment = rightXS;
    }
}

// ─── Morning & Afternoon sheet ────────────────────────────────────────────────
function buildMorningAfternoonSheet(workbook, { summaryData, branchName, selectedDate }) {
    const denomRows = summaryData?.denomination_summary || [];
    const sm = summaryData;

    const ws = workbook.addWorksheet('Morning & Afternoon');
    ws.columns = [
        { width: 8 }, { width: 28 }, { width: 18 },
        { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 },
    ];

    ws.mergeCells('A1:G1');
    const dt = ws.getCell('A1');
    dt.value = `MORNING / AFTERNOON DENOMINATION — ${branchName} — ${moment(selectedDate).format('MMMM D, YYYY')}`;
    dt.font = { bold: true, size: 12 }; dt.alignment = { horizontal: 'center' };
    ws.getRow(1).height = 20;

    const dh = ws.getRow(2);
    dh.height = 16;
    ['LO No.', 'Loan Officer', 'Total Net Collection', 'Morning Remittance', 'Afternoon Remittance', 'BCC vs Remittances', 'Status']
        .forEach((h, i) => {
            const c = dh.getCell(i + 1);
            c.value = h; c.font = bold; c.fill = hdrFill;
            c.alignment = i <= 1 ? (i === 0 ? centerXS : leftXS) : rightXS;
        });

    let dr = 3;
    let tNet = 0, tMorn = 0, tAftn = 0, tBcc = 0;
    denomRows.forEach(lo => {
        const r = ws.getRow(dr++);
        r.height = 15;
        r.getCell(1).value = `LO-${lo.loNo}`;            r.getCell(1).alignment = centerXS;
        r.getCell(2).value = lo.loName;                   r.getCell(2).alignment = leftXS;
        r.getCell(3).value = lo.totalNetCollection || 0;  r.getCell(3).numFmt = currFmt; r.getCell(3).alignment = rightXS;
        r.getCell(4).value = lo.morningRemittance  || 0;  r.getCell(4).numFmt = currFmt; r.getCell(4).alignment = rightXS;
        r.getCell(5).value = lo.afternoonRemittance|| 0;  r.getCell(5).numFmt = currFmt; r.getCell(5).alignment = rightXS;
        r.getCell(6).value = lo.bccVsRemittances   || 0;  r.getCell(6).numFmt = currFmt; r.getCell(6).alignment = rightXS;
        r.getCell(7).value = lo.status || '';              r.getCell(7).alignment = centerXS;
        tNet  += lo.totalNetCollection  || 0;
        tMorn += lo.morningRemittance   || 0;
        tAftn += lo.afternoonRemittance || 0;
        tBcc  += lo.bccVsRemittances    || 0;
    });

    const tr = ws.getRow(dr++);
    tr.height = 16;
    tr.getCell(2).value = 'TOTAL'; tr.getCell(2).font = bold; tr.getCell(2).fill = totFill;
    [[3, tNet],[4, tMorn],[5, tAftn],[6, tBcc]].forEach(([col, val]) => {
        const c = tr.getCell(col);
        c.value = val; c.numFmt = currFmt; c.font = bold;
        c.fill = totFill; c.alignment = rightXS;
    });

    if (sm) {
        dr++;
        ws.mergeCells(`A${dr}:C${dr}`);
        ws.getCell(`A${dr}`).value = 'Morning Closing Balance  =  Beginning Balance + Morning Remittance − Loan Releases';
        ws.getCell(`A${dr}`).font  = { italic: true, color: { argb: 'FF555555' } };
        dr++;

        const mornClosing = (sm.beginning_balance||0) + tMorn - (sm.pay_loan_release_amount||0);
        [
            ['Beginning Balance',      sm.beginning_balance    || 0],
            ['Morning Remittance',      tMorn],
            ['Loan Releases',          -(sm.pay_loan_release_amount || 0)],
            ['Morning Closing Balance', mornClosing],
            ['Afternoon Remittance',    tAftn],
            ['Closing Balance (Day)',   sm.closing_balance     || 0],
        ].forEach(([label, val], i) => {
            const r = ws.getRow(dr++);
            r.height = 15;
            ws.mergeCells(`A${dr - 1}:B${dr - 1}`);
            r.getCell('A').value = label;
            r.getCell('A').font  = (i === 3 || i === 5) ? bold : {};
            r.getCell('C').value = val;
            r.getCell('C').numFmt = currFmt;
            r.getCell('C').alignment = rightXS;
            r.getCell('C').font = (i === 3 || i === 5) ? bold : {};
            if (i === 3 || i === 5) {
                ['A','B','C'].forEach(col => r.getCell(col).fill = totFill);
            }
        });
    }
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function exportDCSExcel({
    data,
    branchData,
    totals,
    summaryData,
    selectedDate,
    getBranchName,
    isAdmin,
    selectedBranch,
    currentBranch,
}) {
    const exportRows = data?.length > 0 ? data : branchData?.length > 0 ? branchData : null;
    if (!exportRows?.length) { toast.warning('No data to export'); return; }

    try {
        const workbook = new ExcelJS.Workbook();

        const branchObj  = isAdmin ? selectedBranch : currentBranch;
        const branchCode = branchObj?.code || 'BRANCH';
        const branchName = branchObj?.name || getBranchName();
        const safeCode   = branchCode.replace(/[\/\\?%*:|"<>]/g, '-');
        const safeName   = branchName.replace(/[\/\\?%*:|"<>]/g, '-');
        const dateStr    = moment(selectedDate).format('YYYYMMDD');
        const fileName   = `${safeCode} - ${safeName} - ${dateStr}.xlsx`;

        // Sheet 1 – DCS
        buildDCSSheet(workbook, { exportRows, totals, selectedDate, getBranchName });

        // Sheet 2 – Summary (only when summaryData is available)
        if (summaryData) {
            buildSummarySheet(workbook, { summaryData, branchName, selectedDate });
        }

        // Sheet 3 – Morning & Afternoon (only when denomination data exists)
        if (summaryData?.denomination_summary?.length > 0) {
            buildMorningAfternoonSheet(workbook, { summaryData, branchName, selectedDate });
        }

        // Write and trigger browser download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url    = window.URL.createObjectURL(blob);
        const link   = document.createElement('a');
        link.href = url; link.download = fileName;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('Excel exported successfully!');
    } catch (error) {
        console.error('Error exporting Excel:', error);
        toast.error('Error exporting to Excel');
    }
}