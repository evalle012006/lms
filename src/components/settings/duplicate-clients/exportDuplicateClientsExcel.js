// src/components/settings/duplicate-clients/exportDuplicateClientsExcel.js
// One row per client; rows belonging to the same duplicate cluster share a
// "Group #" and a banded background so they read as a set in Excel.

import ExcelJS from 'exceljs';
import moment from 'moment';

export const SCENARIO_LABELS = {
    cross_branch: 'Different branch',
    same_branch_diff_lo: 'Same branch, different LO',
    same_lo_diff_group: 'Same branch & LO, different group',
    same_group: 'Same group',
};

export const CONFIDENCE_LABELS = { exact: 'Exact', high: 'High', possible: 'Possible' };
export const SEVERITY_LABELS = {
    both_active: 'Multiple active loans',
    one_active: 'One active loan',
    no_active: 'No active loan',
};

const COLUMNS = [
    { header: 'Group #', key: 'group', width: 9 },
    { header: 'Confidence', key: 'confidence', width: 12 },
    { header: 'Severity', key: 'severity', width: 22 },
    { header: 'Scenario', key: 'scenario', width: 32 },
    { header: 'Why flagged', key: 'reasons', width: 46 },
    { header: 'Review', key: 'review', width: 20 },
    { header: 'Client ID', key: 'id', width: 26 },
    { header: 'Last name', key: 'lastName', width: 18 },
    { header: 'First name', key: 'firstName', width: 18 },
    { header: 'Middle name', key: 'middleName', width: 16 },
    { header: 'Birthdate', key: 'birthdate', width: 14 },
    { header: 'Contact number', key: 'contact', width: 16 },
    { header: 'Address', key: 'address', width: 40 },
    { header: 'Client status', key: 'status', width: 12 },
    { header: 'Active loan', key: 'hasActive', width: 11 },
    { header: 'Loan cycle', key: 'cycle', width: 10 },
    { header: 'Principal', key: 'principal', width: 13 },
    { header: 'Loan balance', key: 'balance', width: 13 },
    { header: 'Slot #', key: 'slot', width: 8 },
    { header: 'Total loans', key: 'loanCount', width: 11 },
    { header: 'Last closed', key: 'lastClosed', width: 13 },
    { header: 'Branch', key: 'branch', width: 20 },
    { header: 'Loan officer', key: 'lo', width: 22 },
    { header: 'Group', key: 'groupName', width: 18 },
    { header: 'Date added', key: 'dateAdded', width: 13 },
];

const fmtDate = (d) => (d ? moment(d).format('YYYY-MM-DD') : '');
const joinAddress = (m) =>
    [m.addressStreetNo, m.addressBarangayDistrict, m.addressMunicipalityCity, m.addressProvince]
        .filter(Boolean).join(', ') || m.address || '';

/**
 * @param {Array}  clusters  cluster objects as returned by /clients/duplicates/list
 * @param {Object} opts      { sheetName, fileName, filtersNote }
 */
export async function exportDuplicateClientsExcel(clusters, opts = {}) {
    const { sheetName = 'Duplicate clients', fileName, filtersNote } = opts;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LMS';
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: 'frozen', ySplit: filtersNote ? 3 : 1 }] });

    let headerRowIndex = 1;
    if (filtersNote) {
        ws.addRow([`Filters: ${filtersNote}`]).font = { italic: true, color: { argb: 'FF6B7280' } };
        ws.addRow([`Generated: ${moment().format('YYYY-MM-DD HH:mm')}  |  ${clusters.length} group(s)`])
            .font = { italic: true, color: { argb: 'FF6B7280' } };
        headerRowIndex = 3;
    }

    ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));
    const headerRow = ws.getRow(headerRowIndex);
    COLUMNS.forEach((c, i) => { headerRow.getCell(i + 1).value = c.header; });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 22;

    clusters.forEach((cluster, idx) => {
        const band = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF3F4F6';
        // same_client groups: one row per active loan so each loan is visible in Excel.
        const lines = cluster.members.flatMap(m =>
            cluster.view === 'same_client' && m.activeLoans?.length
                ? m.activeLoans.map(l => ({ m, loan: l }))
                : [{ m, loan: m.activeLoan }]);
        lines.forEach(({ m, loan }) => {
            const row = ws.addRow({
                group: idx + 1,
                confidence: CONFIDENCE_LABELS[cluster.confidence] ?? cluster.confidence,
                severity: SEVERITY_LABELS[cluster.severity] ?? cluster.severity,
                scenario: cluster.scenarios.map(s => SCENARIO_LABELS[s] ?? s).join('; '),
                reasons: cluster.reasons.join('; '),
                review: { confirmed: 'Confirmed duplicate', not_duplicate: 'Not a duplicate' }[cluster.reviewStatus] ?? 'Needs review',
                id: m._id,
                lastName: m.lastName ?? '',
                firstName: m.firstName ?? '',
                middleName: m.middleName ?? '',
                birthdate: fmtDate(m.birthdate),
                // Stored as text so Excel doesn't strip the leading 0 of 09XXXXXXXXX.
                contact: m.contactNumber ? String(m.contactNumber) : '',
                address: joinAddress(m),
                status: m.status ?? '',
                hasActive: m.hasActiveLoan ? 'Yes' : 'No',
                cycle: loan?.loanCycle ?? '',
                principal: loan?.principalLoan ?? '',
                balance: loan?.loanBalance ?? '',
                slot: loan?.slotNo ?? '',
                loanCount: m.loanCount ?? 0,
                lastClosed: fmtDate(m.lastClosedDate),
                branch: m.branchName ?? '',
                lo: m.loName ?? '',
                groupName: m.groupName ?? '',
                dateAdded: fmtDate(m.dateAdded),
            });
            row.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: band } };
            });
            row.getCell('contact').numFmt = '@';
            row.getCell('principal').numFmt = '#,##0.00';
            row.getCell('balance').numFmt = '#,##0.00';
            if (m.hasActiveLoan) row.getCell('hasActive').font = { bold: true, color: { argb: 'FFB91C1C' } };
        });
    });

    ws.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: COLUMNS.length },
    };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? `duplicate-clients-${moment().format('YYYYMMDD-HHmm')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
