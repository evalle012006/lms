#!/usr/bin/env node
/**
 * hris-link-import.mjs  ->  lms/scripts/hris-link-import.mjs
 * ----------------------------------------------------------
 * Day-one helper: turns a CSV into a call to POST /api/v2/hris/link-import.
 * DRY RUN unless you pass --apply. Needs Node 18+ (built-in fetch). No dependencies.
 *
 * CSV (header row required; use any identifier column you have, one per row):
 *   email,loNo,user_id,employee_no,action
 *   juan@ambercash.ph,,,EMP-0001,link
 *   ,12,,EMP-0042,link
 *   unused.lo@ambercash.ph,,,,open
 * "action" is optional and defaults to link.
 *
 * Usage
 *   HRIS_API_KEY=... node scripts/hris-link-import.mjs links.csv --url https://lms.ambercashph.com
 *   ... --apply            write for real (links only)
 *   ... --apply --confirm  also run "open" rows (these RESET accounts)
 *   ... --relink           allow changing an existing employee_no
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const urlIdx = args.indexOf('--url');
const urlValue = urlIdx >= 0 ? args[urlIdx + 1] : null;
const file = args.find((a) => !a.startsWith('--') && a !== urlValue);
const baseUrl = (urlIdx >= 0 ? args[urlIdx + 1] : process.env.LMS_URL || '').replace(/\/+$/, '');
const key = process.env.HRIS_API_KEY;

if (!file || !baseUrl || !key) {
    console.error('Usage: HRIS_API_KEY=... node scripts/hris-link-import.mjs <file.csv> --url <lms base url> [--apply] [--confirm] [--relink]');
    process.exit(1);
}

// minimal CSV parser (handles "quoted, fields" and "" escapes)
function parseCsv(text) {
    const out = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some((x) => x.trim() !== '')) out.push(row);
            row = [];
        } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim() !== '')) out.push(row);
    return out;
}

const [header, ...body] = parseCsv(readFileSync(file, 'utf8'));
const cols = header.map((h) => h.trim());
const rows = body.map((r) => {
    const o = {};
    cols.forEach((c, i) => { const v = (r[i] ?? '').trim(); if (v !== '') o[c] = v; });
    return o;
});

const apply = flag('apply');
const resp = await fetch(`${baseUrl}/api/v2/hris/link-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hris-api-key': key },
    body: JSON.stringify({ rows, dry_run: !apply, confirm: flag('confirm'), relink: flag('relink'), actor: 'link-import-script' }),
});
const result = await resp.json().catch(() => ({}));

if (!resp.ok || result.success === false) {
    console.error('Request failed:', resp.status, result.code ?? '', result.message ?? '');
    process.exit(1);
}

console.log(apply ? '== APPLIED ==' : '== DRY RUN (nothing written) ==');
console.log(result.summary);
const problems = result.results.filter((r) => r.status === 'error');
if (problems.length) {
    console.log(`\n${problems.length} row(s) need attention:`);
    problems.forEach((p) => console.log(`  row ${p.index + 2}  ${p.ref}  ${p.code}: ${p.message}`));
    const out = file.replace(/\.csv$/i, '') + '.problems.json';
    writeFileSync(out, JSON.stringify(problems, null, 2));
    console.log(`\nFull list written to ${out}`);
}
