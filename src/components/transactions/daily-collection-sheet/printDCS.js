/**
 * printDCS.js
 * Standalone print utility for the Daily Collection Sheet.
 * Generates a multi-page HTML document (DCS + Summary + Morning/Afternoon)
 * and opens it in a new window for printing.
 *
 * Call: printDCS({ data, branchData, totals, summaryData, selectedDate,
 *                  getBranchName, selectedLo, isLoanOfficer, currentUser })
 */

import moment  from 'moment';
import { toast } from 'react-toastify';

// ─── currency formatter ───────────────────────────────────────────────────────
const fmt = (v) => {
    if (!v || v === 0) return '—';
    return '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtRaw = (v) =>
    Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #000; }
  @page { size: A3 landscape; margin: 8mm; }

  /* ── page-break between sections ── */
  .page-break { page-break-before: always; break-before: page; }
  .no-break   { page-break-inside: avoid; break-inside: avoid; }

  /* ── DCS table ── */
  .dcs-page .page-header { margin-bottom: 4px; }
  .dcs-page .page-header h1 { font-size: 11pt; font-weight: bold; text-align: center; }
  .dcs-page .page-header h2 { font-size: 9pt;  font-weight: bold; text-align: center; margin-bottom: 2px; }
  .meta { display: flex; justify-content: space-between; font-size: 7.5pt; margin-bottom: 4px; }
  .meta b { margin-right: 4px; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td {
    border: 0.5pt solid #666;
    padding: 1px 2px;
    text-align: right;
    vertical-align: middle;
    font-size: 6.5pt;
    white-space: nowrap;
    overflow: hidden;
  }
  th  { background: #d9ead3; font-weight: bold; text-align: center; }
  .left  { text-align: left;   }
  .right { text-align: right;  }
  .center{ text-align: center; }
  .bold  { font-weight: bold;  }
  .net-col   { font-weight: bold; background: #e8f5e9; }
  .total-col { font-weight: bold; }

  col.c-no  { width: 18pt; }
  col.c-lo  { width: 56pt; }
  col.c-grp { width: 40pt; }
  col.c-sm  { width: 20pt; }
  col.c-md  { width: 28pt; }
  col.c-lg  { width: 32pt; }

  tbody tr:nth-child(even) { background: #f9f9f9; }
  .totals-row { background: #fff9c4 !important; font-weight: bold; }
  .totals-row td { border-top: 1pt solid #333; }

  /* ── Summary page ── */
  .summary-page { font-size: 8pt; }
  .summary-page h1 { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
  .summary-table { width: 480pt; margin: 0 auto; border-collapse: collapse; }
  .summary-table td { border: 0.5pt solid #aaa; padding: 2px 4px; }
  .summary-table .s-no   { width: 30pt;  text-align: center; }
  .summary-table .s-lbl  { width: 300pt; text-align: left;   }
  .summary-table .s-val  { width: 90pt;  text-align: right;  font-family: monospace; }
  .sec-hdr { background: #d9ead3; font-weight: bold; text-align: center; }
  .tot-row { background: #fff9c4; font-weight: bold; }
  .bb-row  { background: #fff3cd; font-weight: bold; }
  .cb-row  { font-weight: bold; font-size: 10pt; }
  .cb-pos  { background: #d9ead3; color: #1f6b2a; }
  .cb-neg  { background: #fce4d6; color: #cc0000; }

  /* ── Morning/Afternoon page ── */
  .denom-page { font-size: 8pt; }
  .denom-page h1 { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 8px; }
  .denom-table { width: 580pt; margin: 0 auto; border-collapse: collapse; }
  .denom-table td, .denom-table th { border: 0.5pt solid #aaa; padding: 2px 4px; }
  .denom-table .d-no   { width: 40pt;  text-align: center; }
  .denom-table .d-name { width: 180pt; text-align: left;   }
  .denom-table .d-val  { width: 90pt;  text-align: right;  font-family: monospace; }
  .calc-block { width: 320pt; margin: 16px auto 0; border-collapse: collapse; font-size: 8pt; }
  .calc-block td { padding: 3px 6px; border: 0.5pt solid #ccc; }
  .calc-block .c-lbl { width: 200pt; text-align: left; }
  .calc-block .c-val { width: 100pt; text-align: right; font-family: monospace; font-weight: bold; }
  .calc-hl { background: #fff9c4; font-weight: bold; }

  .print-footer { margin-top: 6px; font-size: 6.5pt; color: #666; text-align: right; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

// ─── DCS HTML section ─────────────────────────────────────────────────────────
function buildDCSSection({ exportRows, totals, branchLabel, dateLabel, dayLabel, selectedLoLabel }) {
    const bodyRows = exportRows.map((item, idx) => {
        const compTotal =
            (item.mcbuActual||0) + (item.csfCollection||0) + (item.regularLoanActual||0) +
            (item.otherLoanActual||0) + (item.admissionAmount||0) + (item.lrfCollection||0) +
            (item.cbhbAmount||0) + (item.addHospitalization||0) + (item.otherIncome||0);
        const compNet = compTotal -
            (item.mcbuWithdrawal||0) - (item.mcbuReturnAmount||0) -
            (item.csfWithdrawal||0) - (item.csfReturnAmount||0);

        return `<tr>
            <td class="center">${idx + 1}</td>
            <td class="left">${item.loName || item.branchName || ''}</td>
            <td class="left">${item.groupName || item.branchCode || ''}</td>
            <td>${fmt(item.mcbuTarget)}</td>
            <td>${fmt(item.mcbuActual)}</td>
            <td>${fmt(item.csfCollection)}</td>
            <td>${fmt(item.regularLoanTarget)}</td>
            <td>${fmt(item.regularLoanAdvance)}</td>
            <td>${fmt(item.regularLoanActual)}</td>
            <td>${fmt(item.otherLoanTarget)}</td>
            <td>${fmt(item.otherLoanAdvance)}</td>
            <td>${fmt(item.otherLoanActual)}</td>
            <td class="center">${item.admissionNo || '—'}</td>
            <td>${fmt(item.admissionAmount)}</td>
            <td>${fmt(item.lrfCollection)}</td>
            <td class="center">${item.cbhbNo || '—'}</td>
            <td>${fmt(item.cbhbAmount)}</td>
            <td>${fmt(item.addHospitalization)}</td>
            <td>${fmt(item.otherIncome)}</td>
            <td class="bold">${fmt(compTotal)}</td>
            <td>${fmt(item.mcbuWithdrawal)}</td>
            <td class="center">${item.mcbuReturnNo || '—'}</td>
            <td>${fmt(item.mcbuReturnAmount)}</td>
            <td>${fmt(item.csfWithdrawal)}</td>
            <td class="center">${item.csfReturnNo || '—'}</td>
            <td>${fmt(item.csfReturnAmount)}</td>
            <td class="bold net-col">${fmt(compNet)}</td>
            <td class="center">${item.renewalNo || '—'}</td>
            <td>${fmt(item.renewalAmount)}</td>
            <td class="center">${item.offsetNo || '—'}</td>
            <td>${fmt(item.offsetAmount)}</td>
            <td class="center">${item.fullPaymentClients || '—'}</td>
        </tr>`;
    }).join('');

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
    const t = totals || {};

    const totalsRow = `<tr class="totals-row">
        <td></td><td class="left bold" colspan="2">TOTAL</td>
        <td>${fmt(t.mcbuTarget)}</td><td>${fmt(t.mcbuActual)}</td>
        <td>${fmt(t.csfCollection)}</td>
        <td>${fmt(t.regularLoanTarget)}</td><td>${fmt(t.regularLoanAdvance)}</td><td>${fmt(t.regularLoanActual)}</td>
        <td>${fmt(t.otherLoanTarget)}</td><td>${fmt(t.otherLoanAdvance)}</td><td>${fmt(t.otherLoanActual)}</td>
        <td class="center">${t.admissionNo||'—'}</td><td>${fmt(t.admissionAmount)}</td>
        <td>${fmt(t.lrfCollection)}</td>
        <td class="center">${t.cbhbNo||'—'}</td><td>${fmt(t.cbhbAmount)}</td>
        <td>${fmt(t.addHospitalization)}</td>
        <td>${fmt(t.otherIncome)}</td>
        <td class="bold">${fmt(tCompTotal)}</td>
        <td>${fmt(t.mcbuWithdrawal)}</td>
        <td class="center">${t.mcbuReturnNo||'—'}</td><td>${fmt(t.mcbuReturnAmount)}</td>
        <td>${fmt(t.csfWithdrawal)}</td>
        <td class="center">${t.csfReturnNo||'—'}</td><td>${fmt(t.csfReturnAmount)}</td>
        <td class="bold net-col">${fmt(tCompNet)}</td>
        <td class="center">${t.renewalNo||'—'}</td><td>${fmt(t.renewalAmount)}</td>
        <td class="center">${t.offsetNo||'—'}</td><td>${fmt(t.offsetAmount)}</td>
        <td class="center">${t.fullPaymentClients||'—'}</td>
    </tr>`;

    return `
<div class="dcs-page">
  <div class="page-header">
    <h1>AmberCash PH Micro Lending Corp.</h1>
    <h2>DAILY COLLECTION SHEET</h2>
    <div class="meta">
      <span><b>Branch:</b>${branchLabel}</span>
      <span><b>Date:</b>${dateLabel} (${dayLabel})</span>
      <span><b>Loan Officer:</b>${selectedLoLabel}</span>
    </div>
  </div>

  <table>
  <colgroup>
    <col class="c-no"/><col class="c-lo"/><col class="c-grp"/>
    <col class="c-md"/><col class="c-md"/>
    <col class="c-md"/>
    <col class="c-md"/><col class="c-md"/><col class="c-md"/>
    <col class="c-md"/><col class="c-md"/><col class="c-md"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-md"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-md"/>
    <col class="c-md"/>
    <col class="c-lg"/>
    <col class="c-md"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-md"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-lg"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-sm"/><col class="c-md"/>
    <col class="c-sm"/>
  </colgroup>
  <thead>
    <tr>
      <th rowspan="3">No.</th>
      <th rowspan="3">Name of LO</th>
      <th rowspan="3">Group</th>
      <th colspan="2">MCBU Col.</th>
      <th rowspan="3">CSF Col.</th>
      <th colspan="6">CLIENT'S LOAN COLLECTION</th>
      <th colspan="2">Admission</th>
      <th rowspan="3">LRF</th>
      <th colspan="2">C.B.H.B</th>
      <th rowspan="3">Add Hospi</th>
      <th rowspan="3">Other Inc.</th>
      <th rowspan="3" class="total-col">TOTAL</th>
      <th colspan="6">LESS RETURNS &amp; WD</th>
      <th rowspan="3" class="net-col">NET</th>
      <th colspan="2">Renewal</th>
      <th colspan="2">Offset</th>
      <th rowspan="3">Clients</th>
    </tr>
    <tr>
      <th>Tgt</th><th>Act</th>
      <th colspan="3">Regular (60d)</th>
      <th colspan="3">Other (Wkly)</th>
      <th>No.</th><th>Amt</th>
      <th>No.</th><th>₱200</th>
      <th>MCBU WD</th><th>No.</th><th>Amt</th>
      <th>CSF WD</th><th>No.</th><th>Amt</th>
      <th>No.</th><th>Amt</th>
      <th>No.</th><th>Amt</th>
    </tr>
    <tr>
      <th></th><th></th>
      <th>Tgt</th><th>Adv</th><th>Act</th>
      <th>Tgt</th><th>Adv</th><th>Act</th>
      <th></th><th></th>
      <th></th><th></th>
      <th></th><th></th><th></th>
      <th></th><th></th><th></th>
      <th></th><th></th>
      <th></th><th></th>
    </tr>
  </thead>
  <tbody>
    ${bodyRows}
    ${totalsRow}
  </tbody>
  </table>
</div>`;
}

// ─── Summary HTML section ─────────────────────────────────────────────────────
function buildSummarySection({ summaryData, branchLabel, dateLabel }) {
    if (!summaryData) return '';
    const sm = summaryData;

    const row = (no, label, val, cls = '') =>
        `<tr class="${cls}">
            <td class="s-no">${no ?? ''}</td>
            <td class="s-lbl">${label}</td>
            <td class="s-val">₱ ${fmtRaw(val)}</td>
        </tr>`;

    const sectionHdr = (label) =>
        `<tr><td colspan="3" class="sec-hdr">${label}</td></tr>`;

    const loReleaseNo  = sm.pay_loan_release_no || 0;
    const cbVal        = sm.closing_balance || 0;
    const cbCls        = cbVal < 0 ? 'cb-row cb-neg' : 'cb-row cb-pos';

    const loReleases   = sm.loan_release_per_lo || [];
    let loReleaseRows  = '';
    if (loReleases.length > 0) {
        loReleaseRows = `
        ${sectionHdr('LOAN RELEASE PER LOAN OFFICER')}
        <tr class="sec-hdr">
            <td class="s-no">LO</td>
            <td class="s-lbl">Name</td>
            <td class="s-val"># / Amount</td>
        </tr>
        ${loReleases.map(lo => `<tr>
            <td class="s-no">LO-${lo.loNo}</td>
            <td class="s-lbl">${lo.loName}</td>
            <td class="s-val">${lo.noClients} prs. / ₱ ${fmtRaw(lo.releaseAmount)}</td>
        </tr>`).join('')}
        <tr class="tot-row">
            <td class="s-no"></td>
            <td class="s-lbl bold">TOTAL</td>
            <td class="s-val">₱ ${fmtRaw(loReleases.reduce((s,lo) => s + (lo.releaseAmount||0), 0))}</td>
        </tr>`;
    }

    return `
<div class="page-break summary-page">
  <h1>CASHBOOK SUMMARY — ${branchLabel} — ${dateLabel}</h1>
  <table class="summary-table">
    <tbody>
      <tr class="bb-row">
        <td colspan="2" class="s-lbl bold">Beginning Balance</td>
        <td class="s-val">₱ ${fmtRaw(sm.beginning_balance)}</td>
      </tr>

      ${sectionHdr('RECEIPTS')}
      ${row('1a', 'MCBU Collection',               sm.rcpt_mcbu)}
      ${row('1b', 'CSF Collection',                sm.rcpt_csf)}
      ${row(2,    'Regular Loan (60 Days)',         sm.rcpt_regular_loan)}
      ${row(3,    'Other Loan (Weekly)',            sm.rcpt_other_loan)}
      ${row(4,    'Staff Collection CBU/CashBond',  sm.rcpt_staff_cbu)}
      ${row(5,    'Staff Principal Loan',           sm.rcpt_staff_principal)}
      ${row(6,    'Admin Fees',                     sm.rcpt_admin_fees)}
      ${row(7,    'LRF Collection',                 sm.rcpt_lrf)}
      ${row(8,    'C B H B Collection',             sm.rcpt_cbhb)}
      ${row(9,    'ADD-Hospi',                      sm.rcpt_add_hospi)}
      ${row(10,   'W/Tax, EE&amp;ER',               sm.rcpt_wtax)}
      ${row(11,   'MCBU Unclaimed (In)',             sm.rcpt_mcbu_unclaimed_in)}
      ${row('12a','Other Income (Passbook)',         sm.rcpt_other_income_passbook)}
      ${row('12b','Other Income',                   sm.rcpt_other_income)}
      ${row('12c','Other Income CSF W/o Agent',     sm.rcpt_other_income_csf)}
      ${row(13,   'Other Receipts (Picture)',        sm.rcpt_other_receipts_picture)}
      ${row(14,   'Other Receipts',                 sm.rcpt_other_receipts_gl)}
      ${row(15,   'Fund Transfer (In)',              sm.rcpt_fund_transfer_in)}
      ${row(16,   'Bank Withdrawal',                sm.rcpt_bank_withdrawal)}
      <tr class="tot-row">
        <td class="s-no"></td>
        <td class="s-lbl bold">TOTAL RECEIPTS</td>
        <td class="s-val">₱ ${fmtRaw(sm.total_receipts)}</td>
      </tr>

      ${sectionHdr('PAYMENTS')}
      ${row(1,    `Client Loan Release (${loReleaseNo} prs.)`, sm.pay_loan_release_amount)}
      ${row('2a', 'Client MCBU Withdrawal',       sm.pay_mcbu_withdrawal)}
      ${row('2b', 'CSF Withdrawal',               sm.pay_csf_withdrawal)}
      ${row('3a', 'MCBU Return',                  sm.pay_mcbu_return)}
      ${row('3b', 'CSF Return',                   sm.pay_csf_return)}
      ${row(4,    'Staff Loan Release / CBU Withd.', sm.pay_staff_loan_release)}
      ${row(5,    'Mngt. Expenses',               sm.pay_mngt_expenses)}
      ${row(6,    'CBHB Disbursed',               sm.pay_cbhb_disbursed)}
      ${row(7,    'MCBU Unclaimed (Out)',           sm.pay_mcbu_unclaimed_out)}
      ${row(8,    'Rebates',                       sm.pay_rebates)}
      ${row(9,    'Other Payments',                sm.pay_other_payments)}
      ${row(10,   'Fund Transfer (Out)',            sm.pay_fund_transfer_out)}
      ${row(11,   'Bank Deposits',                 sm.pay_bank_deposits)}
      <tr class="tot-row">
        <td class="s-no"></td>
        <td class="s-lbl bold">TOTAL PAYMENTS</td>
        <td class="s-val">₱ ${fmtRaw(sm.total_payments)}</td>
      </tr>

      <tr><td colspan="3" style="height:6px;border:none;"></td></tr>
      <tr class="${cbCls}">
        <td colspan="2" class="s-lbl" style="font-size:10pt;">Closing Balance</td>
        <td class="s-val" style="font-size:10pt;">₱ ${fmtRaw(cbVal)}</td>
      </tr>

      ${loReleaseRows}
    </tbody>
  </table>
</div>`;
}

// ─── Morning/Afternoon HTML section ──────────────────────────────────────────
function buildMorningAfternoonSection({ summaryData, branchLabel, dateLabel }) {
    if (!summaryData?.denomination_summary?.length) return '';
    const denomRows = summaryData.denomination_summary;
    const sm = summaryData;

    let tNet = 0, tMorn = 0, tAftn = 0, tBcc = 0;
    const loRows = denomRows.map(lo => {
        tNet  += lo.totalNetCollection  || 0;
        tMorn += lo.morningRemittance   || 0;
        tAftn += lo.afternoonRemittance || 0;
        tBcc  += lo.bccVsRemittances    || 0;
        return `<tr>
            <td class="d-no">LO-${lo.loNo}</td>
            <td class="d-name">${lo.loName}</td>
            <td class="d-val">₱ ${fmtRaw(lo.totalNetCollection)}</td>
            <td class="d-val">₱ ${fmtRaw(lo.morningRemittance)}</td>
            <td class="d-val">₱ ${fmtRaw(lo.afternoonRemittance)}</td>
            <td class="d-val">₱ ${fmtRaw(lo.bccVsRemittances)}</td>
            <td class="center">${lo.status || ''}</td>
        </tr>`;
    }).join('');

    const mornClosing = (sm.beginning_balance||0) + tMorn - (sm.pay_loan_release_amount||0);

    return `
<div class="page-break denom-page">
  <h1>MORNING / AFTERNOON — ${branchLabel} — ${dateLabel}</h1>
  <table class="denom-table">
    <thead>
      <tr>
        <th class="d-no">LO No.</th>
        <th class="d-name">Loan Officer</th>
        <th class="d-val">Total Net Collection</th>
        <th class="d-val">Morning Remittance</th>
        <th class="d-val">Afternoon Remittance</th>
        <th class="d-val">BCC vs Remittances</th>
        <th style="width:50pt; text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${loRows}
      <tr class="totals-row">
        <td class="d-no"></td>
        <td class="d-name bold">TOTAL</td>
        <td class="d-val">₱ ${fmtRaw(tNet)}</td>
        <td class="d-val">₱ ${fmtRaw(tMorn)}</td>
        <td class="d-val">₱ ${fmtRaw(tAftn)}</td>
        <td class="d-val">₱ ${fmtRaw(tBcc)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <table class="calc-block">
    <tbody>
      <tr><td class="c-lbl" colspan="2" style="font-style:italic; color:#555; border:none; padding-top:12px;">
        Morning Closing = Beginning Balance + Morning Remittance − Loan Releases
      </td></tr>
      <tr>
        <td class="c-lbl">Beginning Balance</td>
        <td class="c-val">₱ ${fmtRaw(sm.beginning_balance)}</td>
      </tr>
      <tr>
        <td class="c-lbl">Morning Remittance</td>
        <td class="c-val">₱ ${fmtRaw(tMorn)}</td>
      </tr>
      <tr>
        <td class="c-lbl">Loan Releases</td>
        <td class="c-val">( ₱ ${fmtRaw(sm.pay_loan_release_amount)} )</td>
      </tr>
      <tr class="calc-hl">
        <td class="c-lbl">Morning Closing Balance</td>
        <td class="c-val">₱ ${fmtRaw(mornClosing)}</td>
      </tr>
      <tr>
        <td class="c-lbl">Afternoon Remittance</td>
        <td class="c-val">₱ ${fmtRaw(tAftn)}</td>
      </tr>
      <tr class="calc-hl">
        <td class="c-lbl">Closing Balance (Day)</td>
        <td class="c-val">₱ ${fmtRaw(sm.closing_balance)}</td>
      </tr>
    </tbody>
  </table>
</div>`;
}

// ─── Main print function ──────────────────────────────────────────────────────
export function printDCS({
    data,
    branchData,
    totals,
    summaryData,
    selectedDate,
    getBranchName,
    selectedLo,
    isLoanOfficer,
    currentUser,
}) {
    const exportRows = data?.length > 0 ? data : branchData?.length > 0 ? branchData : null;
    if (!exportRows?.length) { toast.warning('No data to print'); return; }

    const branchLabel    = getBranchName();
    const dateLabel      = moment(selectedDate).format('MMMM D, YYYY');
    const dayLabel       = moment(selectedDate).format('dddd');
    const selectedLoLabel = selectedLo?.label || (isLoanOfficer
        ? `${currentUser?.firstName} ${currentUser?.lastName}` : 'All Loan Officers');

    const dcsSection = buildDCSSection({
        exportRows, totals, branchLabel, dateLabel, dayLabel, selectedLoLabel,
    });

    const summarySection = buildSummarySection({
        summaryData, branchLabel, dateLabel,
    });

    const morningSection = buildMorningAfternoonSection({
        summaryData, branchLabel, dateLabel,
    });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>DCS — ${branchLabel} — ${dateLabel}</title>
<style>${BASE_CSS}</style>
</head>
<body>
${dcsSection}
${summarySection}
${morningSection}
<div class="print-footer">Printed: ${new Date().toLocaleString()}</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) { toast.error('Pop-up blocked. Allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
}